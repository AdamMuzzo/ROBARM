# Printing And CAD

The current mechanical target is the PAROL6 desktop robot arm.

## Official Files

- Main repo: [Source-Robotics/PAROL6-Desktop-robot-arm](https://github.com/Source-Robotics/PAROL6-Desktop-robot-arm)
- Printable STL files: [STL folder](https://github.com/Source-Robotics/PAROL6-Desktop-robot-arm/tree/main/STL)
- Official BOM: [BOM.md](https://github.com/Source-Robotics/PAROL6-Desktop-robot-arm/blob/main/BOM/BOM.md)
- Print settings table: [Print table](https://github.com/Source-Robotics/PAROL6-Desktop-robot-arm/tree/main/Print%20table)
- Build instructions: [Building instructions folder](https://github.com/Source-Robotics/PAROL6-Desktop-robot-arm/tree/main/Building%20instructions)

## Folders To Print

Print parts from:

- [BASE](https://github.com/Source-Robotics/PAROL6-Desktop-robot-arm/tree/main/STL/BASE)
- [SHOULDER](https://github.com/Source-Robotics/PAROL6-Desktop-robot-arm/tree/main/STL/SHOULDER)
- [UPPER_ARM](https://github.com/Source-Robotics/PAROL6-Desktop-robot-arm/tree/main/STL/UPPER_ARM)
- [ELBOW](https://github.com/Source-Robotics/PAROL6-Desktop-robot-arm/tree/main/STL/ELBOW)
- [FOREARM](https://github.com/Source-Robotics/PAROL6-Desktop-robot-arm/tree/main/STL/FOREARM)
- [WRIST](https://github.com/Source-Robotics/PAROL6-Desktop-robot-arm/tree/main/STL/WRIST)
- [ESTOP](https://github.com/Source-Robotics/PAROL6-Desktop-robot-arm/tree/main/STL/ESTOP)
- [GRIPPER_ATTACHMENTS](https://github.com/Source-Robotics/PAROL6-Desktop-robot-arm/tree/main/STL/GRIPPER_ATTACHMENTS), optional

## Printer Fit Notes

The printer is believed to be a Flashforge Adventurer 5 class machine with an approximately 220 x 220 x 220 mm build volume.

Measured from the cloned PAROL6 STL files:

- `UPPER_ARM/Upper_arm.STL` is about 231 x 102 x 28 mm.
- It is slightly longer than 220 mm on one axis, but should fit diagonally on a 220 x 220 mm bed.
- Most other printed parts are comfortably smaller.

Before long prints:

1. Import the part into FlashPrint.
2. Confirm units are millimeters.
3. Rotate for bed fit and layer strength.
4. Slice with the PAROL6 print table as a reference.
5. Print a smaller fit-check part before committing to the big upper arm.

## Material

The official print notes discuss PETG. PETG is the preferred starting material because it has better heat resistance and layer toughness than PLA while staying easier than ABS/ASA.

No filament cost is tracked in this repo because we already have filament.

## CAD Notes

The public PAROL6 repo is mainly STL print files, not full editable native CAD for every part. It includes some STEP mounting plate files:

- [big_base.STEP](https://github.com/Source-Robotics/PAROL6-Desktop-robot-arm/blob/main/STL/mounting%20plates/big_base.STEP)
- [small_base.STEP](https://github.com/Source-Robotics/PAROL6-Desktop-robot-arm/blob/main/STL/mounting%20plates/small_base.STEP)

Reference model pages:

- [PAROL6 on Thangs](https://thangs.com/designer/Source%20robotics/3d-model/PAROL6%20Desktop%20robotic%20arm-1038940)
- [PAROL6 on GrabCAD](https://grabcad.com/library/parol6-desktop-robotic-arm-1)

For custom work, the practical plan is:

1. Use official STLs for the base robot.
2. Use the wrist geometry as a reference.
3. Design our own detachable tool adapter as clean parametric CAD.
4. Keep all ROBARM-created adapters in this repo once designed.
