"""Safety-gated commissioning utility for the ROBARM Octopus firmware.

Motor tests require three separate gates: a CLI flag, a port-specific confirmation
string, and a firmware build with commissioning motion explicitly enabled.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from dataclasses import dataclass

import serial
from serial.tools import list_ports


BAUD = 3_000_000
READ_TIMEOUT = 1.0


@dataclass(frozen=True)
class PortInfo:
    device: str
    description: str
    hwid: str


def available_ports() -> list[PortInfo]:
    return [PortInfo(p.device, p.description, p.hwid) for p in list_ports.comports()]


def print_ports() -> None:
    ports = available_ports()
    if not ports:
        print("No serial ports detected.")
        return
    for port in ports:
        print(f"{port.device:10} {port.description} [{port.hwid}]")


def open_port(name: str) -> serial.Serial:
    connection = serial.Serial(name, BAUD, timeout=READ_TIMEOUT, write_timeout=1.0)
    connection.reset_input_buffer()
    connection.reset_output_buffer()
    time.sleep(0.25)
    return connection


def query(connection: serial.Serial, command: str) -> str:
    connection.reset_input_buffer()
    connection.write((command + "\n").encode("ascii"))
    connection.flush()
    reply = connection.readline().decode("ascii", errors="replace").strip()
    if not reply:
        raise RuntimeError(f"No reply to {command!r}")
    return reply


def parsed_query(connection: serial.Serial, command: str) -> dict:
    reply = query(connection, command)
    try:
        return json.loads(reply)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Unexpected firmware reply: {reply}") from exc


def status(connection: serial.Serial) -> None:
    print(json.dumps(parsed_query(connection, "STATUS"), indent=2))


def drivers(connection: serial.Serial) -> None:
    data = parsed_query(connection, "DRIVERS")
    print(json.dumps(data, indent=2))
    print("TMC test_connection values: 0=OK, 1=no motor power, 2=no communication")


def sensors(connection: serial.Serial, watch: bool) -> None:
    previous: list[int] | None = None
    while True:
        data = parsed_query(connection, "SENSORS")
        values = data["ports"]
        if previous is None:
            print("baseline  " + " ".join(f"STOP{i}={value}" for i, value in enumerate(values)))
        else:
            changed = [i for i, (old, new) in enumerate(zip(previous, values)) if old != new]
            if changed:
                details = ", ".join(f"STOP{i}: {previous[i]} -> {values[i]}" for i in changed)
                print(f"changed   {details}")
        previous = values
        if not watch:
            return
        time.sleep(0.1)


def clear_fault(connection: serial.Serial) -> None:
    print(query(connection, "CLEAR_FAULT"))


def disable(connection: serial.Serial) -> None:
    print(query(connection, "DISABLE"))


def safe_check(connection: serial.Serial) -> None:
    state = parsed_query(connection, "STATUS")
    sensor_data = parsed_query(connection, "SENSORS")
    failures: list[str] = []
    if state.get("firmware") != "ROBARM-OCTOPUS-H723":
        failures.append("firmware identity is wrong")
    if (
        state.get("protocol_signature") != "RB"
        or state.get("protocol_version") != 1
        or state.get("config_version") != 11
    ):
        failures.append("Commander protocol identity is wrong")
    if state.get("mapping_verified") is not True:
        failures.append("joint and sensor mapping is not marked verified")
    if state.get("full_motion") is not True:
        failures.append("verified full-motion configuration is not enabled")
    if state.get("commissioning_motion") is not True:
        failures.append("bounded commissioning motion is not available")
    if state.get("commissioning_hold") is not False or state.get("holding_joint") != 0:
        failures.append("a commissioning driver is still holding")
    if state.get("motion_prerequisites") is not False:
        failures.append("normal-motion prerequisites unexpectedly report complete")
    if state.get("homing_validated") is not True:
        failures.append("available homing paths are not marked validated")
    if state.get("estop_configured") is not True:
        failures.append("E-stop feedback is not configured")
    if state.get("estop_feedback") != "driver_power":
        failures.append("E-stop feedback is not using verified driver-power loss")
    if len(sensor_data.get("ports", [])) != 8:
        failures.append("did not receive eight STOP inputs")
    if failures:
        print("SAFE-CHECK FAILED: " + "; ".join(failures), file=sys.stderr)
        raise SystemExit(2)
    print(
        "SAFE-CHECK PASS: verified ROBARM identity, startup reference incomplete, "
        "driver-power E-stop feedback configured, bounded commissioning "
        "available, eight inputs readable"
    )


def motor_test(
    connection: serial.Serial,
    port: int,
    direction: int,
    steps: int,
    permit_motion: bool,
    confirm: str,
) -> None:
    if not permit_motion:
        raise SystemExit("Refusing: add --permit-motion only when the physical checklist is complete")
    expected = f"MOTOR{port}"
    if confirm != expected:
        raise SystemExit(f"Refusing: --confirm must be exactly {expected}")
    if not 0 <= port <= 7 or direction not in (0, 1) or not 1 <= steps <= 2000:
        raise SystemExit("Port must be 0-7, direction 0 or 1, and steps 1-2000")
    command = f"MOTOR_TEST {port} {direction} {steps} I_UNDERSTAND"
    first_reply = query(connection, command)
    print(first_reply)
    if first_reply.startswith("DONE") or first_reply.startswith("ERR"):
        return
    deadline = time.monotonic() + 7.0
    while time.monotonic() < deadline:
        reply = connection.readline().decode("ascii", errors="replace").strip()
        if reply:
            print(reply)
            if reply.startswith("DONE") or reply.startswith("ERR"):
                return
    raise RuntimeError("Timed out waiting for the finite test to finish")


def home_test(
    connection: serial.Serial,
    joint: int,
    steps: int,
    permit_motion: bool,
    confirm: str,
) -> None:
    if not permit_motion:
        raise SystemExit("Refusing: add --permit-motion only when the physical checklist is complete")
    expected = f"J{joint}"
    if confirm != expected:
        raise SystemExit(f"Refusing: --confirm must be exactly {expected}")
    if not 1 <= joint <= 6 or not 1 <= steps <= 2000:
        raise SystemExit("Joint must be 1-6 and steps 1-2000")
    command = f"HOME_TEST {joint} {steps} I_UNDERSTAND"
    first_reply = query(connection, command)
    print(first_reply)
    if first_reply.startswith("DONE") or first_reply.startswith("ERR"):
        return
    deadline = time.monotonic() + 25.0
    while time.monotonic() < deadline:
        reply = connection.readline().decode("ascii", errors="replace").strip()
        if reply:
            print(reply)
            if reply.startswith("DONE") or reply.startswith("ERR"):
                return
    raise RuntimeError("Timed out waiting for HOME_TEST to finish")


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description=__doc__)
    result.add_argument("--port", help="USB serial port, for example COM7")
    sub = result.add_subparsers(dest="command", required=True)
    sub.add_parser("list", help="List serial ports; does not open one")
    sub.add_parser("status", help="Read firmware state; no motion")
    sub.add_parser("drivers", help="Read TMC SPI connection status; no motion")
    sensors_parser = sub.add_parser("sensors", help="Read all eight STOP inputs; no motion")
    sensors_parser.add_argument("--watch", action="store_true", help="Report changes until Ctrl+C")
    sub.add_parser("safe-check", help="Verify the current commissioning safety gates")
    sub.add_parser("clear-fault", help="Clear a latched commissioning fault only when all safety inputs are released")
    sub.add_parser("disable", help="Disable every motor driver, including a commissioning hold")
    motor = sub.add_parser("motor-test", help="Finite, low-current motor-port discovery")
    motor.add_argument("motor_port", type=int)
    motor.add_argument("direction", type=int)
    motor.add_argument("--steps", type=int, default=16)
    motor.add_argument("--permit-motion", action="store_true")
    motor.add_argument("--confirm", default="")
    home = sub.add_parser("home-test", help="Bounded one-joint seek toward its mapped home sensor")
    home.add_argument("joint", type=int)
    home.add_argument("--steps", type=int, default=200)
    home.add_argument("--permit-motion", action="store_true")
    home.add_argument("--confirm", default="")
    return result


def main() -> None:
    args = parser().parse_args()
    if args.command == "list":
        print_ports()
        return
    if not args.port:
        raise SystemExit("--port is required for this command (run 'list' first)")
    with open_port(args.port) as connection:
        if args.command == "status":
            status(connection)
        elif args.command == "drivers":
            drivers(connection)
        elif args.command == "sensors":
            sensors(connection, args.watch)
        elif args.command == "safe-check":
            safe_check(connection)
        elif args.command == "clear-fault":
            clear_fault(connection)
        elif args.command == "disable":
            disable(connection)
        elif args.command == "motor-test":
            motor_test(
                connection,
                args.motor_port,
                args.direction,
                args.steps,
                args.permit_motion,
                args.confirm,
            )
        elif args.command == "home-test":
            home_test(
                connection,
                args.joint,
                args.steps,
                args.permit_motion,
                args.confirm,
            )


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nMonitor stopped. Use the disable command or E-stop to release a commissioning hold.")
