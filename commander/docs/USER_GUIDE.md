# ROBARM Commander user guide

## 1. Safety first

ROBARM Commander does not make the robot intrinsically safe. The physical
E-stop, motor-power cut, mechanical support, firmware limits, and trained
operator remain essential. Firmware is the final safety authority.

Before any physical operation:

1. Support joints that can fall when torque is removed.
2. Clear people, tools, loose cables, and fixtures from the work envelope.
3. Keep the physical E-stop within immediate reach.
4. Inspect belts, fasteners, wiring, sensor targets, and the tool attachment.
5. Remember that J5 and J6 are not homing joints until their mechanical targets
   are installed and validated.
6. Never rotate J6/tool wiring beyond its mechanically safe routing.

The large red **SOFTWARE STOP** sends Disable when a real port is open and
disables the simulator when simulation is active. `Ctrl+Shift+S` invokes the
same action. Software controls do not replace the physical E-stop.

## 2. Installation

Development requirements:

- Windows 10/11
- Node.js 22 or newer and npm
- A WebGL-capable GPU
- USB-C data cable to the Octopus Pro device port for real hardware

Install and start:

```powershell
cd "A:\WaypointRoot\Personal\Projects\ROBARM\commander"
npm install
npm run dev
```

`Start_ROBARM_Commander.cmd` performs the same dependency check and launch.

Create a Windows installer with `npm run package`, or run the checked build at
`release/ROBARM Commander Setup 0.4.1.exe`. The development and packaged apps
use the same narrow Electron preload bridge; the React renderer has no direct
Node.js or arbitrary filesystem access. This local build is unsigned, so verify
its workspace source and expect Windows to identify the publisher as unknown.

## 3. Startup state

Every start has these invariants:

- active target is **SIMULATION**;
- no serial port is open;
- simulation is disabled;
- physical robot is not selected;
- no Enable or motion command is sent;
- no saved controller or program starts automatically.

The top bar always shows the target, connection, E-stop, enabled/fault state,
and global software Stop.

## 4. Simulation

Open **Simulator** and select **Enable**. Simulation never opens or writes to a
real serial port.

Use the six joint sliders or the Control workspace dead-man buttons. The 3D
view uses the checked-in PAROL6 meshes and URDF joint origins/axes. Orange marks
the selected joint. Sensor markers reflect the simulated raw inputs. A red
floor ring and `COLLISION / FLOOR` status indicate approximate floor or
non-adjacent link-bound overlap.

Simulation safety controls can:

- enable/disable simulated driver output;
- trip/reset a simulated E-stop;
- remove/restore simulated driver power;
- reset all simulated state to a disabled neutral pose.

Simulation and real commands cannot be mirrored. Returning to Simulation sends
Disable to an open real transport before changing the target.

## 5. Connect to the real robot

1. Begin with the arm supported and the physical E-stop pressed if doing a
   connection-only check.
2. Connect the controller through the Octopus Pro USB-C device port.
3. In **Control**, click **Discover**.
4. Select the discovered COM port (historically COM5). Never infer safety from
   the port name.
5. Click **Connect**.
6. Wait for `COMPATIBLE`. Commander requires both the binary identity tuple and
   the ASCII status identity:
   - firmware `ROBARM-OCTOPUS-H723`
   - device `0xA6`
   - signature/tag `RB`
   - protocol version `1`
   - configuration version `7`
7. Verify E-stop feedback, mapping, prerequisites, and fresh telemetry all show
   `PASS`.
8. Click **Select real robot** and confirm the target change.

Opening a port never enables the robot. An incompatible, faulted, or stale
connection stays blocked. Disconnect clears identity and returns to Simulation.

## 6. Startup calibration, enable, and disable

Normal physical motion is locked after every boot, reset, Disable, E-stop, or
loss of motor power. To establish the J2-J4 reference:

1. Mechanically support the arm, clear the entire work envelope, and keep the
   physical E-stop in hand.
2. Connect, reach `COMPATIBLE`, select **Real robot**, and open **Calibration**.
3. Verify J2, J3, and J4 sensors are released and the motor-power E-stop check
   passes.
4. Type `CALIBRATE J2 J3 J4`, click **Run startup calibration**, and confirm.
5. All six mapped joints first energize at the verified commissioning setting
   so non-target axes hold still. J2 moves upward, J3 downward, and J4 clockwise
   simultaneously. Each stops independently when its own sensor qualifies.
   After all three qualify, J2 moves to `32000` steps (+90°), J3 to `0`, and J4
   counterclockwise to `0`, concurrently. J1 holds without rotating. Seek and
   home movement use the validated 3x calibration rates.
6. Watch the three per-joint phases and combined bounded-step counter. Press E-stop on any
   unexpected direction, sound, obstruction, or cable tension.
7. Success ends in **CALIBRATION HOLD** with J2-J4 energized at their configured
   homes. Click **Enable robot** separately before normal motion.

The first target-sensor edge latches step output off immediately. If that signal
cannot continuously qualify for 25 ms inside its 250 ms qualification window,
the sensor is not reached within its configured full-span bound, an unrelated
sensor activates, a target sensor remains active at home, driver power is lost,
or the command is aborted, firmware faults/disables and discards the reference.

The real **Enable robot** control is available only in firmware state `0x53`
(ready/disabled) or `0x57` (calibration hold) with every safety prerequisite
satisfied. The confirmation reminds the operator that all mapped drivers may
energize.

Firmware reinitializes and verifies every mapped TMC5160 before enabling. The
UI waits for firmware state `0x54` before allowing motion.

Disable is always available. Disable also releases a commissioning hold. Loss
of telemetry, input, target, or transport revokes active motion; stale valid
telemetry causes the host to send Disable. The firmware independently disables
after 100 ms without a valid Commander packet.

## 7. Mouse joint jog

1. Select the intended target and Enable it.
2. Choose a jog speed. The normal session range is limited to 50%.
3. Choose the host acceleration ramp. Every press starts at 5% and ramps toward
   the selected speed; firmware speed and acceleration bounds remain final.
4. Unlocking up to 100% requires a session-only confirmation.
5. Press and hold a labeled direction button.
6. Release the mouse button to stop immediately.

Pointer release/cancel, lost pointer capture, window blur, hidden application,
target change, stale telemetry, E-stop, fault, or failed prerequisites revoke
the short motion lease. The UI rejects invalid speeds rather than silently
clamping them.

Cartesian jog is currently blocked. It will remain blocked until numerical IK,
singularity behavior, limits, and collision coverage are verified for this
hardware.

## 8. Xbox/controller setup

Open **Inputs**:

1. Connect the controller and click **Discover**. The full Xbox diagram and raw
   values update live even while robot input remains stopped.
2. Press each control to identify it. Labels show the standard human name and
   raw index, such as `A · B0`, `LT · B6`, or `Left stick X · A0`.
3. Click any diagram label to add a mapping, or add one in the tables. Axes,
   buttons, and analog triggers may target any joint in either direction.
4. Add as many independent mappings as needed. A control may target several
   joints, several controls may target one joint, and all active joint results
   are combined into one synchronized command vector.
5. Assign any button as dead-man or Disable and configure the software-stop
   chord. These bindings do not limit the joint mappings for other controls.
6. Configure direction/inversion, dead zone or trigger threshold, curve,
   maximum speed scale, and profile acceleration scale, then save the profile.
7. Click **Start robot input** only after the live map behaves as expected.

Every active mapped axis, button, or trigger contributes to one synchronized
six-joint velocity vector, so any combination can move different joints at the
same time. If multiple inputs map to the same joint, the strongest mapping for
that joint wins. The dead-man button must stay pressed. Returning every input to neutral,
releasing dead-man, disconnecting the controller, or any robot safety failure
stops every commanded joint together.

The controller cannot auto-select the real target, auto-enable, bypass limits,
or bypass firmware gates.

## 9. Hand control

The **Inputs** workspace defines a modular provider contract for MediaPipe and
OpenXR, including:

- hand position mapping;
- dead-man gesture or physical-enable requirement;
- pinch/gripper and wrist/tool-roll actions;
- dead zone, motion scaling, smoothing, and tracking timeout.

No camera provider is bundled in this version. Selecting a provider only saves
configuration; it does not enable motion. A future provider must report fresh
tracking and renew the same safety lease as every other input source.

## 10. Commands and logs

The **Commands** workspace separates read-only queries from motion. Validated
queries can be saved as local shortcuts; arbitrary strings never reach the
transport:

- `STATUS`
- `SENSORS`
- `DRIVERS`
- `DRIVER_DIAG <0-7>`

Replies appear in the append-only response/safety log. Search filters the
visible history. Export writes JSON Lines containing timestamps, severity,
category, message, and details.

The raw view shows the most recent validated 60-byte robot frame in hex. The
decoded status is shown elsewhere in Vitals.

Finite `HOME_TEST` is a maintenance command, not ordinary Home. It requires:

- real target;
- compatible fresh telemetry;
- safe E-stop feedback;
- disabled firmware;
- available J1-J4 mechanical sensor target;
- finite step count from 1 to 2000;
- typed joint confirmation;
- final confirmation dialog.

After the ten-degree backoff, firmware intentionally holds the selected driver.
Use **Release commissioning hold / Disable** and support the joint first.

## 11. Programs

Programs are versioned `.robarm-program.json` files. Each declares exactly one
target: Simulation or Real robot.

Supported steps:

- one non-looping startup-calibration command (it cannot be mixed with moves);
- bounded six-joint position move with speed scale;
- interruptible delay;
- operator note.

Programs also support names, descriptions, finite loop counts, dry run, step
once, pause/resume, Stop, local save, import, and export.

Dry run validates schema, limits, target, and step structure without motion.
Physical startup calibration additionally requires typing
`CALIBRATE J2 J3 J4`; it cannot be launched with **Step once**. Real execution
requires a confirmation. Every real step passes through the
current safety gateway and waits for fresh telemetry to confirm target position
and near-zero velocity. A target change, stale telemetry, E-stop, fault, safety
rejection, or timeout sends Disable and stops the program.

## 12. Vitals and diagnostics

Vitals shows:

- firmware and enabled/fault state;
- E-stop and driver-power safety;
- watchdog status and telemetry age;
- joint positions, velocities, limits, motor and stop mappings;
- all eight TMC connection results;
- all eight raw STOP inputs, polarity, and PG14/PG15 reservation;
- packet transmit/receive, errors, rejected commands, and last command;
- mapping, motion, homing, commissioning hold, and holding joint.
- FAN0 mode, commanded duty, startup default, and absence of tach feedback.

The **Controller cooling** panel operates physical FAN0 after selecting the real
robot. **Auto** is restored on every reset: 100% for a two-second kick-start,
70% while idle, and 100% whenever motors, calibration, or a holding mode are
energized. **Full** forces 100%; **Off** requires confirmation and is not
overridden by motor activation. Commander reports commanded PWM duty, not
measured airflow or RPM, because the two-wire FAN0 connection has no tachometer
input. The Octopus Pro FAN0 voltage-selection jumper must be set to 5 V.

The firmware does not currently report motor temperatures, live currents,
board uptime, or board packet statistics. Commander displays `not reported`
instead of manufacturing values.

Current, microstep, and driver-setting controls remain unavailable because
protocol v1 has no reversible runtime setting commands. A future capability
must show current and proposed values and support rollback.

## 13. Calibration and homing training

The **Calibration** workspace records reversible per-joint profiles for:

- seek direction;
- sensor polarity;
- maximum finite seek;
- maximum travel;
- backoff distance;
- debounce and qualification time;
- status and activation snapshots.

Saving/exporting a profile changes no firmware. The current firmware uses its
audited values: a 25 ms qualified sensor and exact ten-degree backoff.

J1-J4 are available and validated. J5/J6 are visibly `UNAVAILABLE` and cannot
be trained or falsely marked homed. Software calibration alone never validates
missing mechanical hardware.

The prominent startup sequence is the normal J2-J4 reference workflow. Its
absolute sensor/home coordinates are compiled into firmware configuration 6;
editing or exporting a training profile does not change them. Legacy binary
Home remains absent because command 100 fails closed.

Configuration 6 flips the physical command direction and coordinate sign for
J1 base, J2 shoulder, J3 elbow, J4 forearm, and J6 tool roll. J5 wrist pitch is
unchanged. Imported/saved program schema 1 files are intentionally incompatible;
recreate position programs as schema 2 after low-speed direction verification.

## 14. Model training and robot learning

The **Learning** workspace can record timestamped samples containing target,
positions, velocities, last command, sensor state, and a camera-frame reference.
Without a camera provider, that reference is explicitly null.

Datasets support labels, adjustable sample period, train/validation/test split,
playback into Simulation, validation, and JSON export. The model registry stores
name, version, dataset lineage, framework/task metadata, evaluation state, and
deployment gate.

Registering metadata does not train a model. External training and evaluation
are required. Real deployment is blocked until a future signed model adapter
has passed simulation evaluation and recorded human approval. Model output will
never bypass the normal safety gateway.

## 15. Emergency procedures

If motion is unexpected or unsafe:

1. Press the physical E-stop immediately.
2. Do not rely on clicking through UI dialogs.
3. Keep clear of joints that may drop when driver power is removed.
4. Once the scene is stable, press **SOFTWARE STOP** or Disable.
5. Inspect the response log, E-stop feedback, drivers, sensors, watchdog, and
   firmware fault before attempting a reset.
6. Correct the physical cause.
7. Reset the physical E-stop.
8. Use **Clear fault** only when the firmware reports safe conditions.
9. The robot remains disabled; re-enable only after a new safety review.

If the application freezes or USB disconnects, firmware's 100 ms valid-packet
watchdog disables motor outputs. This can remove holding torque; mechanical
support, brakes, or counterbalance are required wherever a joint could fall.

## 16. Verification commands

```powershell
cd "A:\WaypointRoot\Personal\Projects\ROBARM\commander"
npm test
npm run build
```

The automated suite uses mock firmware. It covers protocol framing, malformed
input, exact identity, stale telemetry, E-stop loss, dead-man requirements,
joint limits, program validation, explicit target selection, Enable, jog,
acceleration ramping, and release behavior without issuing physical motion.
