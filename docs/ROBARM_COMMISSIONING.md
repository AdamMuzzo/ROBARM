# ROBARM safe commissioning runbook

## Current state

The Octopus Pro V1.1 H723 is connected over its USB-C device port and normally
appears as COM5. All six motor channels and both directions, all six home
sensors, motor coil pairs, driver orientation, and the physical E-stop motor
power cut have been checked. The mapped Commander integration and firmware
identity handshake are implemented and tested. The bounded J2-J4 startup
calibration state machine is implemented and software-tested.

Normal Commander motion is runtime-locked after startup until the explicitly
confirmed J2-J4 calibration sequence completes. Separately guarded finite
commissioning moves remain available. Live diagnostics confirmed E-stop release changes the six installed
TMC channels to `[0,0,0,0,0,0]`, while pressing it changes them to
`[1,1,1,1,1,1]`; firmware now treats that actual power loss as fail-closed
E-stop feedback.

## Hardware configuration

- Board: BIGTREETECH Octopus Pro V1.1, STM32H723ZET6.
- Drivers: six BIGTREETECH TMC5160T Pro modules in MOTOR0 through MOTOR5, SPI
  mode, `R_SENSE=0.075 ohm`; MOTOR6 and MOTOR7 are intentionally empty.
- USB serial: 3,000,000 baud through USB-C. USB-A is a host/OTG connector and
  is not used for the PC connection.
- TMC SPI: SCK PA5, MISO PA6, MOSI PA7, with individual chip-select pins.
- STOP inputs: STOP0 through STOP7 on PG6, PG9, PG10, PG11, PG12, PG13, PG14,
  and PG15.
- All driver enables go HIGH (disabled) before SPI, sensors, or USB startup.
- The Commander watchdog disables all drivers after 100 ms without a valid
  packet.
- The inductive sensor signals pass through optocouplers before the board.
- The physical E-stop removes motor-driver power. Firmware monitors that result
  through all six installed TMC channels; any missing channel is unsafe.
- V_USB remains installed. BOOT0 is installed only while entering DFU and must
  be bare for normal firmware operation.
- FAN0 is PA8 through its board MOSFET. The installed Noctua NF-A4x20 is the
  5 V model, so the FAN0 voltage-selection jumper must be set to 5 V. Firmware
  configuration 11 kick-starts FAN0 at 100%, idles it at 70%, and raises it to
  100% whenever motors are energized. Commander provides Auto, Full, and Off.
  Reported duty is a command value; the two-wire connection has no RPM feedback.

## Confirmed motor map

`MOTOR2_1` and `MOTOR2_2` are two connectors on the same driver channel.
`MOTOR2_2` remains empty.

| Physical port | Logical joint and motion | Direction 0 | Direction 1 |
|---|---|---|---|
| MOTOR0 | J1 base rotation | Counterclockwise viewed from above, electronics case at 12 o'clock | Clockwise |
| MOTOR1 | J2 shoulder / upper-arm lift | Down | Up |
| MOTOR2_1 | J3 elbow bend | Down | Up |
| MOTOR3 | J6 gripper/tool roll | Counterclockwise viewed head-on from the gripper end | Clockwise |
| MOTOR4 | J5 wrist bend/pitch | Down | Up |
| MOTOR5 | J4 forearm roll | Counterclockwise viewed from the tool end toward the base | Clockwise |
| MOTOR6 | Unused | | |
| MOTOR7 | Unused | | |

Every listed direction was observed with a bounded move. Return-direction tests
also passed. MOTOR3/J6 is kept below the upstream 965 mA limit; the temporary
1500 mA diagnostic image was replaced and must not be reused.

## Confirmed sensor map

Inactive baseline: raw-high mask `233`, or `[1,0,0,1,0,1,1,1]` for
STOP0 through STOP7.

| Logical sensor | Physical input | Released | Triggered | Interface |
|---|---|---:|---:|---|
| J1 base | STOP0 / PG6 | 1 | 0 | Optocoupled inductive, active LOW |
| J2 shoulder | STOP2 / PG10 | 0 | 1 | Mechanical roller, active HIGH |
| J3 elbow | STOP1 / PG9 | 0 | 1 | Mechanical roller, active HIGH |
| J4 forearm roll | STOP3 / PG11 | 1 | 0 | Optocoupled inductive, active LOW |
| J5 wrist pitch | STOP4 / PG12 | 0 | 1 | Mechanical roller, active HIGH |
| J6 tool roll | STOP5 / PG13 | 1 | 0 | Optocoupled inductive, active LOW |
| E-stop feedback | Unmapped | | | Separate NC feedback still required |

PG14/STOP6 and PG15/STOP7 are used by the illuminated on/off button signal and
LED wiring, not as home sensors.

## Current firmware safety gates

- `kCommissioningMotionEnabled = true`: permits only the explicit finite
  `MOTOR_TEST` and `HOME_TEST` maintenance commands.
- `kRobotMappingVerified = true`: records the confirmed maps above.
- `kFullRobotMotionEnabled = true`: permits normal Commander motion only after
  runtime startup calibration completes.
- `kEmergencyStopPort = kUnmapped`: no dedicated GPIO contact is installed.
- `kUseDriverPowerEstopFeedback = true`: all six mapped TMC channels must report
  powered and communicating before guarded motion can start or continue.
- `kHomeSensorMechanicallyAvailable`: J1-J4 true; J5/J6 false until the missing
  wrist attachments/targets are installed.
- `kHomingValidated`: J1-J4 true; J5/J6 false and mechanically unavailable.
- Commissioning current ceiling: 900 mA per physical port.
- Discovery speed: 400 microsteps/s; maximum 2,000 microsteps (five seconds).
- Startup calibration configures all six mapped joints at the verified 900 mA
  commissioning setting before motion. Seek speed is approximately 1,200
  microsteps/s and home moves are limited to 2,400 microsteps/s with 3,000
  microsteps/s^2 acceleration.
- Logical motor map J1..J6: `{0, 1, 2, 5, 4, 3}`.
- Logical sensor map J1..J6: `{0, 2, 1, 3, 4, 5}`.
- Normal direction inversion J1..J6: `{false, false, false, false, true, false}`.
  Configuration 6 flips J1, J2, J3, J4, and J6 from the configuration-5
  convention at the operator's request; J5 remains unchanged. Recheck every
  corrected control at the lowest speed before calibration or normal use.
- Confirmed HOME_TEST physical directions: J1 clockwise, J2 upward, J3
  downward, and J4 clockwise. J5/J6 remain unavailable.

## Flashing the current mapped build

Keep 24 V disconnected and the arm supported.

1. Install BOOT0 with USB-C disconnected.
2. Connect USB-C and flash
   `dist/ROBARM-Octopus-H723-config11-performance.bin` to application address
   `0x08020000` through STM32 DFU. Never write the application image at
   `0x08000000`; that address contains the 128 KiB BTT bootloader.
3. A complete download may end with dfu-util error 74 while attempting to leave
   DFU. On this board, recover by unplugging USB-C, removing BOOT0, and
   reconnecting USB-C.
4. Leave BOOT0 bare for all normal operation.
5. Verify without motion:

```powershell
cd "A:\WaypointRoot\Personal\Projects\ROBARM\firmware\octopus_h723"
.\.venv\Scripts\python.exe tools\commission.py list
.\.venv\Scripts\python.exe tools\commission.py --port COM5 safe-check
```

The expected result is `SAFE-CHECK PASS`, with `mapping_verified: true`,
`config_version: 11`, `motion_prerequisites: false`,
`homing_validated: true`, `calibration_complete: false`,
`estop_feedback: "driver_power"`, `full_motion: true`, and
`commissioning_motion: true`.

Current candidate DFU build (2026-08-24): 67,008 bytes, SHA-256
`FC3502AF5CE401BCE4B33CAA8CB3CE53121ABBE74A39830537683DD96B1ED220`.
Do not flash an image whose hash does not match this runbook.

## Startup calibration workflow

This is physical motion under active commissioning. Keep the arm supported,
clear the full envelope, and keep E-stop in hand.

The first configuration-7 physical attempt was safely stopped before its first
step because the blocking 100 ms driver-settle interval crossed the firmware and
Commander watchdog thresholds. Configuration 8 replaces that delay with a
non-blocking settle state: binary heartbeats continue, the driver and E-stop are
rechecked after the full settle interval, and only then may step pulses begin.

The configuration-8 live sequence then referenced J2 and J3 successfully. J4
rotated in the correct clockwise direction, but continued after the operator
observed its inductive sensor change state. Configuration 9 holds all six mapped
joints before seeking, increases seek/home rates by 3x, and permanently latches
step output off on the first target-sensor edge. The signal then has 250 ms to
provide a continuous 25 ms qualification; otherwise the sequence faults and
disables rather than continuing past the target.

1. Boot configuration 11 and verify all drivers, sensors, FAN0, and E-stop power
   feedback without motion.
2. In ROBARM Commander select the real target and open **Calibration**.
3. Type `CALIBRATE J2 J3 J4` and confirm the physical sequence.
4. Observe J2 move up, J3 move down, and J4 move clockwise at the same time.
   Each must stop independently when STOP2, STOP1, and STOP3 respectively
   qualify. After all three sensors qualify, observe all three move concurrently
   to `32000` (+90°), `0`, and `0`. J1 must hold without rotating.
5. Success reports state `0x57`, reference mask `0x70`, and calibrated hold.
   Explicitly Enable for normal motion or Disable to release torque and erase
   the reference.

Firmware fails closed if a non-calibration sensor activates, any target is not
reached inside its finite seek, a sensor remains active at home, a driver disappears,
E-stop removes motor power, or the operator aborts. Never leave calibrated hold
unattended.

For normal manual control, configuration 11 retains configuration 10's sensor
interlock and does not perform an automatic
reduced-speed sensor backoff. If a home sensor activates, only that joint's
direction toward the sensor is suppressed. An explicit command away from the
sensor runs at the normal requested speed, and other joints remain independently
controllable at the same time. The qualified startup-calibration sequence above
retains its separate finite sensor-edge and homing behavior.

Configuration 11 also enables the motor-rated performance profile for normal
manual/program motion. J1/J2 use 2.1 A RMS, J3-J5 use 2.0 A RMS, and J6 remains
at its verified 0.965 A hardware ceiling. Step ceilings are 19,200 microsteps/s
for J1 and 32,000 microsteps/s for J2-J6, with higher accelerations. Startup
calibration and bounded maintenance motion remain at 900 mA and their existing
validated speeds. Do not raise motor voltage or driver current beyond this
profile; monitor motor/driver temperature and stop immediately for missed
steps, belt slip, impact, unexpected noise, or thermal fault.

## Read-only maintenance checks

```powershell
.\.venv\Scripts\python.exe tools\commission.py --port COM5 status
.\.venv\Scripts\python.exe tools\commission.py --port COM5 drivers
.\.venv\Scripts\python.exe tools\commission.py --port COM5 sensors --watch
```

`DRIVER_DIAG <0-7>` is also read-only. TMC connection results are `0=OK`,
`1=no motor power`, and `2=no communication`.

The finite motor-test interface remains present for explicitly confirmed
maintenance only:

```powershell
.\.venv\Scripts\python.exe tools\commission.py --port COM5 motor-test 0 0 --steps 16 --permit-motion --confirm MOTOR0
```

It enables one selected channel, waits 100 ms, rechecks driver communication
and sensors, performs the bounded move, then disables the channel. If a motor
buzzes, jumps, or fails to rotate smoothly, press E-stop and investigate rather
than increasing current.

The bounded homing-direction test seeks one joint at 900 mA and 200
microsteps/s, pauses immediately on a candidate signal, and requires 25 ms of
continuous activation. It then reverses exactly 10 joint-degrees at 400
microsteps/s. After the retreat, that driver remains energized and holding at
900 mA; it does not automatically release. J5 and J6 fail closed until their
mechanical targets are installed:

```powershell
.\.venv\Scripts\python.exe tools\commission.py --port COM5 home-test 1 --steps 200 --permit-motion --confirm J1
```

After confirming the joint is mechanically supported, release the hold with:

```powershell
.\.venv\Scripts\python.exe tools\commission.py --port COM5 disable
```

Starting another commissioning test also disables the previous hold first.
Never leave a holding driver energized unattended; watch driver and motor
temperature. An E-stop, reset, USB loss, or 24 V loss can still remove holding
torque, so preventing a gravity-driven drop under those conditions requires a
mechanical brake, counterbalance, or external support.

## Motionless Commander verification

1. Keep 24 V disconnected, E-stop pressed, BOOT0 bare, and support the arm.
2. Start Commander with `Start_ROBARM_Commander.cmd`.
3. Confirm it opens in Simulator mode and says `ROBARM firmware: not verified`.
4. Enter COM5 and click Connect.
5. Confirm the label becomes `ROBARM firmware: commissioning locked`.
6. Confirm normal Enable, jog, Park, and position programs remain unavailable
   until startup calibration completes; calibration itself is available only
   after selecting Real robot and passing its confirmation gates.
7. Click Disconnect when finished.

## Remaining gates before normal motion

1. Physically validate the complete J2-up, J3-down, J4-clockwise startup
   sequence at low current and with mechanical support.
2. Verify each compiled sensor-edge coordinate and configured home position.
3. Install the missing J5/J6 wrist sensor actuators if those joints are later
   added to the reference sequence.
4. Recheck positive directions, joint limits, steps-per-degree, current, and
   temperature at the lowest useful speed.
5. Keep J1 deliberately outside startup calibration until a base-reference
   workflow is specified and validated.

Always keep the physical E-stop within reach, support the arm before disabling
it, and never rotate J5 more than one complete turn because its internal wiring
can be damaged.
