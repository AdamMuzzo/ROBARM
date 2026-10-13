# ROBARM protocol and firmware audit

Audit date: 2026-08-12

This document records the behavior of the checked-in ROBARM firmware and the
legacy PAROL Commander integration. It is the compatibility baseline for the
new standalone Commander. The firmware remains the final safety authority.

## Sources reviewed

- `firmware/octopus_h723/include/board_pins.h`
- `firmware/octopus_h723/include/protocol.h`
- `firmware/octopus_h723/include/robot_config.h`
- `firmware/octopus_h723/src/main.cpp`
- `firmware/octopus_h723/src/protocol.cpp`
- `firmware/octopus_h723/test/test_protocol.py`
- `firmware/octopus_h723/tools/commission.py`
- Legacy `GUI/files/Serial_sender_good_latest.py`
- Legacy `GUI/files/PAROL6_ROBOT.py`
- Legacy `GUI/files/ROBARM_PROTOCOL.py`
- Legacy `GUI/files/ROBARM_SAFETY.py`
- Legacy `GUI/files/GUI_PAROL_latest.py`
- Legacy Windows launch scripts and first-use notes
- `public/models/parol6/PAROL6.urdf` and the current Three.js model transforms

The older commissioning notes still describe full motion as locked and J3 as
unvalidated. The checked-in firmware configuration is newer and authoritative:
`kFullRobotMotionEnabled` is `true`, J1-J4 homing is validated, and J5/J6 are
explicitly unavailable and excluded from the homing prerequisite.

## Physical mapping

| Joint | Function | Motor port | Stop input | Active level | Homing direction | Homing status |
|---|---|---:|---|---|---|---|
| J1 | Base rotation | MOTOR0 | STOP0 / PG6 | Low | Clockwise | Validated |
| J2 | Shoulder | MOTOR1 | STOP2 / PG10 | High | Up | Validated |
| J3 | Elbow | MOTOR2_1 | STOP1 / PG9 | High | Down | Validated |
| J4 | Forearm roll | MOTOR5 | STOP3 / PG11 | Low | Clockwise | Validated |
| J5 | Wrist pitch | MOTOR4 | STOP4 / PG12 | High | Not mechanically available | Non-homing |
| J6 | Tool roll | MOTOR3 | STOP5 / PG13 | Low | Not mechanically available | Non-homing |

MOTOR6, MOTOR7, and the duplicate MOTOR2_2 connector are unused. PG14 and PG15
belong to the illuminated On/Off control and must never be treated as robot
home inputs.

The physical E-stop removes driver power. Firmware considers the E-stop safe
only when every mapped TMC5160 answers `test_connection() == 0`. A missing or
unpowered mapped driver therefore fails closed.

## Binary transport

USB CDC runs at a nominal 3,000,000 baud. The firmware accepts the legacy
Commander binary framing and ASCII maintenance commands on the same stream.
Writers must be serialized so binary frames and ASCII lines cannot interleave.

### PC to robot frame

Total length: 56 bytes.

| Absolute bytes | Body bytes | Meaning |
|---|---|---|
| 0-2 | - | Header `FF FF FF` |
| 3 | - | Body length `52` (`0x34`) |
| 4-21 | 0-17 | Six signed 24-bit joint positions, big-endian |
| 22-39 | 18-35 | Six signed 24-bit joint speeds, big-endian |
| 40 | 36 | Command byte |
| 41 | 37 | Affected-joint bitfield; J1 is bit 7 through J6 bit 2 |
| 42 | 38 | Legacy I/O bitfield |
| 43 | 39 | Legacy timeout byte |
| 44-52 | 40-48 | Legacy gripper fields |
| 53 | 49 | Fixed legacy CRC byte `228` (`0xE4`) |
| 54-55 | 50-51 | Terminator `01 02` |

The so-called CRC is a fixed sentinel, not a calculated checksum. New code
must describe it accurately and must validate the complete frame shape.

Supported command bytes:

| Value | Name | Firmware behavior |
|---:|---|---|
| 100 | Home | Currently fails closed and latches fault; automated homing is not implemented |
| 101 | Enable | Reinitializes and verifies all mapped TMC drivers, then enables |
| 102 | Disable | Immediately disables all drivers and clears active motion |
| 103 | Clear error | Clears only when E-stop is safe and no available home sensor is active |
| 123 | Jog | Speed mode for affected joints; bounded by firmware speed limits |
| 156 | Position | Position mode; out-of-range targets latch fault |
| 255 | Dummy / heartbeat | Stops an active jog and otherwise keeps the watchdog alive |

Command 69 and every unknown command latch a firmware fault. Malformed length,
fixed-CRC, or terminator fields also latch a fault.

### Robot to PC frame

Total length: 60 bytes.

| Absolute bytes | Body bytes | Meaning |
|---|---|---|
| 0-2 | - | Header `FF FF FF` |
| 3 | - | Body length `56` (`0x38`) |
| 4-21 | 0-17 | Six signed 24-bit joint positions |
| 22-39 | 18-35 | Six signed 24-bit joint velocities |
| 40 | 36 | Referenced-joint bitfield; J1 is bit 7 through J6 bit 2 |
| 41 | 37 | I/O: raw STOP0 on bit 7, raw STOP1 on bit 6, E-stop-safe on bit 3 |
| 42 | 38 | Temperature error; currently zero |
| 43 | 39 | Position/fault byte; `0xFF` for a latched fault |
| 44-45 | 40-41 | Legacy timing field; currently zero |
| 46 | 42 | Watchdog timeout flag |
| 47 | 43 | Firmware state byte |
| 48 | 44 | Identity device `0xA6` |
| 49-50 | 45-46 | Protocol version `1` |
| 51-52 | 47-48 | Identity tag `0x5242` (`RB`) |
| 53-54 | 49-50 | Configuration version `7` |
| 55-56 | 51-52 | Identity magic `52 42` (`RB`) |
| 57 | 53 | Fixed legacy CRC byte `0xE4` |
| 58-59 | 54-55 | Terminator `01 02` |

A port is never considered compatible from its name, VID/PID, or ability to
open. Compatibility requires the complete identity tuple:

`(device=0xA6, protocol=1, tag=0x5242, config=7, magic=0x52,0x42)`

## ASCII maintenance protocol

ASCII commands are newline-terminated and return one line. The transport must
distinguish JSON/text lines from framed binary replies.

Read-only commands:

- `STATUS` or `HELLO`: firmware identity, state, commissioning and safety gates
- `SENSORS`: raw-high mask and all eight STOP input levels
- `DRIVERS`: TMC connection results for all eight physical ports
- `DRIVER_DIAG <0-7>`: read-only TMC register snapshot

State-changing maintenance commands:

- `DISABLE` or `STOP`
- `CLEAR_FAULT`
- `FAN AUTO|FULL|OFF` (`FAN ON` remains a compatibility alias for FULL)
- `CALIBRATE_STARTUP I_UNDERSTAND`
- `MOTOR_TEST <0-7> <0|1> <1-2000> I_UNDERSTAND`
- `HOME_TEST <1-6> <1-2000> I_UNDERSTAND`

The four query commands are read-only. Every state-changing command requires
safety validation. Startup calibration and the two test commands additionally
require explicit typed confirmation and visible finite bounds.

## Firmware status object

The current `STATUS` response includes:

- `firmware`: must equal `ROBARM-OCTOPUS-H723`
- `protocol_signature`: must equal `RB`
- `protocol_version`: must equal `1`
- `config_version`: must equal `11`
- `state`: one of the state bytes below
- `mapping_verified`
- `motion_prerequisites`
- `homing_validated`
- `full_motion`
- `commissioning_motion`
- `commissioning_hold`
- `holding_joint` (`0` for none, otherwise J1-J6)
- `calibration_supported`, `calibration_active`, `calibration_hold`
- `calibration_complete`, `calibration_joint`, `calibration_phase`
- `calibration_joint_phases` (J2, J3, and J4 independent concurrent states)
- `referenced_mask`, `calibration_required_mask`
- `calibration_steps_taken`, `calibration_steps_remaining`
- `calibration_home_steps` (six absolute step coordinates)
- `hardware_estop_motor_cut`
- `estop_configured`
- `estop_feedback` (`driver_power` in this build)
- `estop_safe`
- `fan_supported`, `fan_on`, `fan_mode`, `fan_speed_percent`
- `fan_tach_supported` (false for the installed two-wire connection)
- `fan_startup_default_on`

## Safety state machine

| State | Byte | Meaning | Host motion policy |
|---|---:|---|---|
| Commissioning locked | `0x52` | Mapping/prerequisites/full-motion gate incomplete | Queries and Disable only; maintenance tests through their separate workflow |
| Ready / disabled | `0x53` | Compatible, prerequisites complete, outputs disabled | Queries, Disable, Clear Fault when applicable, and explicit Enable |
| Enabled | `0x54` | Motor outputs enabled | Bounded motion only while all host gates and dead-man conditions remain true |
| Fault | `0x55` | Latched fault or watchdog timeout | Queries, Disable, and guarded Clear Fault only |
| Calibrating | `0x56` | Guarded concurrent J2 + J3 + J4 reference sequence is moving | Calibration status and immediate Disable only |
| Calibration hold | `0x57` | Required joints are referenced and holding at configured homes | Queries, Disable, or explicit Enable |

Runtime firmware transitions and guards:

1. Boot initializes every enable pin HIGH before SPI, sensors, or USB, then
   configures drivers and ends disabled.
2. Normal Enable is accepted only after the startup reference is complete,
   full-motion prerequisites are true, E-stop
   feedback is safe, no fault is latched, and every mapped TMC passes both a
   pre- and post-reinitialization communication check.
3. An enabled robot faults and disables if driver-power E-stop feedback becomes
   unsafe.
4. More than 100 ms without a valid Commander packet sets the watchdog fault
   and disables all drivers.
5. During regular motion, an active home sensor suppresses only that joint's
   direction toward the sensor. Reverse escape and other joints remain active.
6. Position targets outside firmware bounds latch a fault. Jog speed is bounded
   in firmware. Unknown commands and malformed packets latch a fault.
7. Commissioning motor/home tests use independent gates, one driver, a 900 mA
   ceiling, finite steps, pre-motion rechecks, sensor monitoring, and explicit
   confirmation. HOME_TEST backs off ten degrees and intentionally holds the
   selected driver until an explicit release.
8. `CALIBRATE_STARTUP I_UNDERSTAND` seeks J2 upward, J3 downward, and J4
   clockwise concurrently at approximately 1,200 microsteps/s. Each joint stops
   independently and its sensor must qualify continuously for 25 ms inside its
   bounded full-span seek. Once all three qualify, firmware assigns the three
   configured sensor-edge coordinates and moves all three concurrently to J2
   `32000` (+90°), J3 `0`, and J4 `0`.
9. Successful calibration enters `0x57` with J2-J4 energized and holding.
   Disable, E-stop, fault, reset, or power loss invalidates the reference;
   regular motion requires an explicit Enable from the hold state.

## Host-side compatibility requirements

The new Commander strengthens the legacy policy in these ways:

- all motion producers route through one immutable safety decision function;
- no UI component writes to a transport directly;
- real and simulation targets have distinct command buses and cannot be active
  simultaneously;
- telemetry freshness is measured from validated replies, never from writes;
- continuous input requires a dead-man signal and a renewable motion lease;
- pointer-up, pointer-cancel, window blur, controller loss, hand-tracking loss,
  target changes, stale telemetry, and transport loss revoke that lease;
- a rejected command is logged with the failed gate and never silently clamped;
- values are validated before encoding; firmware limits remain the final check;
- read-only ASCII queries are separated from maintenance and motion commands.

## Known firmware limitations exposed by the audit

- Configuration 6 reverses the command/coordinate sign for J1, J2, J3, J4,
  and J6; J5 is unchanged. Program schema 2 prevents configuration-5 position
  files from being executed under the reversed convention.
- Configuration 7 maps Octopus Pro V1.1 FAN0 to PA8. FAN0 is driven on during
  firmware initialization and supports exact `FAN ON` / `FAN OFF` commands.
- Configuration 8 makes calibration driver settling non-blocking so binary
  heartbeats continue through the 100 ms settle interval before any step pulse.
- Configuration 9 holds all six mapped joints at the verified 900 mA
  commissioning setting, runs calibration seek/home motion at three times the
  previous speed, and latches motion off on the first target-sensor edge while
  qualification completes or fails closed.
- Configuration 10 changes normal manual sensor response: only motion toward
  the active sensor is suppressed for that joint. Reverse motion keeps its
  requested speed, other joints remain live, and automatic slow backoff is
  removed. Calibration keeps its separate qualified edge-handling sequence.
- Configuration 11 is the motor-rated performance profile. Normal motion uses
  the installed motors' rated RMS currents (J1/J2 2.1 A, J3-J5 2.0 A, J6
  0.965 A hardware-limited), raises the step-rate ceilings toward 300 motor
  RPM, and raises acceleration. Calibration remains on its proven 900 mA,
  bounded-speed path; all sensor, watchdog, E-stop, and position gates remain.
  Its finalized pre-flash build seeks and homes J2/J3/J4 concurrently with
  independent sensor qualification. It also replaces the FAN0 Boolean shadow
  state with 100 Hz PWM AUTO/FULL/OFF modes, periodic PA8 reassertion, commanded
  duty telemetry, and an explicit declaration that no tach feedback exists.

- Binary telemetry reports only two raw STOP inputs; the full sensor array
  requires the `SENSORS` query.
- Temperature, board uptime, current telemetry, and packet counters are not
  currently present in the status protocol. The UI must show “not reported”,
  not synthetic values.
- Legacy binary Home (command 100) still latches fault. The supported automated
  path is the explicitly confirmed startup calibration command.
- J5 and J6 are intentionally non-homing; they must never appear calibrated or
  homed merely because overall prerequisites are true.
- The fixed “CRC” detects only an incorrect sentinel, not arbitrary corruption.
  Protocol v1 compatibility is preserved; a future protocol revision should
  add a calculated checksum and explicit capability bits.
