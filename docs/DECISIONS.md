# Decision Log

## 2026-07-13

Decision: Use PAROL6 as the mechanical direction.

Reason: The visual design is much closer to a clean desktop industrial arm than BCN3D Moveo. It has a serious 6-axis layout, official print files, a BOM, build instructions, and end-effector examples.

## 2026-07-13

Decision: Do not buy the official PAROL6 control board yet.

Reason: The board is expensive. We want to try a cheaper controller path first using a BIGTREETECH Octopus Pro and TMC5160 drivers.

Risk: The official PAROL6 software will not be drop-in compatible. We may need custom firmware or a firmware port.

## 2026-07-13

Decision: Keep the existing Arduino Uno-compatible board out of the main controller path.

Reason: It can receive serial commands, but it is too limited for a full six-axis stepper robot arm with sensors, homing, safety handling, and coordinated motion.

Use: Small learning experiments only.

## 2026-07-13

Decision: Make detachable end effectors a core ROBARM feature.

Reason: A tool-changing wrist makes the project more useful and personal. It also gives us a clear original CAD/design task beyond assembling PAROL6.
