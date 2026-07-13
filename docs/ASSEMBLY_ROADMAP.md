# Assembly Roadmap

The build should be staged so each subsystem proves itself before the full arm is powered.

## Stage 0: Repo And Planning

- Keep this repo as the build notebook.
- Track decisions and purchased parts.
- Run the simulator locally.
- Confirm the controller choice before buying the rest of the electronics.

## Stage 1: Print Fit Checks

- Open PAROL6 STL files in FlashPrint.
- Print one small part from the wrist or gripper attachment folder.
- Test holes, inserts, bearing fit, and surface quality.
- Dial PETG settings before printing large structural parts.

## Stage 2: One-Axis Electronics Test

- Buy controller, one driver if needed, one motor, power supply, one limit switch, and e-stop parts.
- Wire one motor on the bench.
- Jog slowly from the computer.
- Add one limit switch.
- Home one axis safely.

Do not assemble all six axes until one axis behaves predictably.

## Stage 3: Mechanical Subassemblies

Suggested order:

1. Base and J1
2. Shoulder and J2
3. Upper arm and J3
4. Elbow/forearm and J4/J5
5. Wrist and J6
6. Tool adapter

For each joint:

- Fit bearings and shafts by hand first.
- Confirm belt path and tensioner movement.
- Confirm wiring path before closing covers.
- Move the joint by hand before installing belts under tension.

## Stage 4: Six-Axis Bring-Up

- Wire all motors and sensors.
- Test driver current settings.
- Test emergency stop.
- Home one joint at a time.
- Add joint limits.
- Run slow jog tests.
- Run low-speed scripted moves.

## Stage 5: Detachable Tooling

- Design the screw-on wrist adapter.
- Print the adapter and pen holder first.
- Add a simple gripper or vacuum pickup.
- Store tool offsets in software.

## Stage 6: Software Expansion

- Add a Python control layer.
- Add serial command logging.
- Add pose files.
- Add calibration workflow.
- Add simulator-to-hardware export once the hardware protocol stabilizes.
