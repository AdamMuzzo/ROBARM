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

## 2026-07-13

Decision: Use the official PAROL6 URDF assembly meshes and joint transforms in the ROBARM simulator.

Reason: The previous procedural Three.js model was visually blocky and did not match the printable robot. The upstream `base_link` and `L1` through `L6` meshes preserve the real enclosure, link, wrist, motor-clearance, fastener, and gripper geometry while the URDF provides an authoritative six-axis hierarchy.

Constraint: These imported model assets are GPLv3-licensed. Keep the upstream license and attribution with any redistributed copy.

## 2026-07-13

Decision: Expand the simulator parts browser into the complete mechanical and electronics BOM.

Reason: Build planning needs the purchased controller, drivers, motors, gearboxes, power, cooling, homing, and safety components alongside the printed arm links. The BTT Octopus Pro and TMC5160 Pro use converted manufacturer CAD; the remaining electronics use dimensioned component models with recognizable terminals, shafts, mounting hardware, cabling, and controls.

Constraint: Treat generated electronics as planning representations, not fabrication CAD. Preserve source links and the BIGTREETECH provenance caveat in `docs/MODEL_ATTRIBUTION.md`.
