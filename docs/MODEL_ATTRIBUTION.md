# Model Attribution

## PAROL6 Arm

The 3D assets in `public/models/parol6/` were copied from the official [Source Robotics PAROL6 Desktop Robot Arm repository](https://github.com/Source-Robotics/PAROL6-Desktop-robot-arm).

## Included Upstream Files

- `PAROL6_URDF/PAROL6/meshes/base_link.STL`
- `PAROL6_URDF/PAROL6/meshes/L1.STL` through `L6.STL`
- `PAROL6_URDF/PAROL6/urdf/PAROL6.urdf`

The filenames were normalized to lowercase `.stl` extensions where needed. The mesh geometry and URDF contents were not modified.

## License

The upstream PAROL6 project states that it is licensed under GNU GPL version 3. A verbatim copy of the upstream license is stored at `docs/third-party/PAROL6-GPL-3.0.txt`.

## ROBARM Use

ROBARM loads these meshes locally with Three.js `STLLoader`. The simulator builds the moving hierarchy from the joint origins, roll-pitch-yaw rotations, axis signs, and limits in `PAROL6.urdf`. Each assembly link can also be inspected independently in the parts view.

## BIGTREETECH Electronics

The following browser-ready assets were converted from manufacturer STEP assemblies and Draco-compressed without remodeling their geometry:

- `public/models/electronics/octopus-pro.glb` from BIGTREETECH's [`3D/Octopus_Pro - beta.stp`](https://github.com/bigtreetech/BIGTREETECH-OCTOPUS-Pro/blob/60a01f412959b62c349ba00da15b45232b7d90c5/3D/Octopus_Pro%20-%20beta.stp)
- `public/models/electronics/tmc5160-pro.glb` from BIGTREETECH's [`TMC5160_Pro V1.1.step`](https://github.com/bigtreetech/BIGTREETECH-Stepper-Motor-Driver/blob/9cf922d5176c97bfeaa022504d8b6129e47f4743/TMC5160(T)%20Pro%20V1.1/3D/TMC5160_Pro%20V1.1.step)

The repeatable STEP-to-GLB conversion is implemented in `scripts/convert-step.mjs`. The referenced BIGTREETECH repositories did not contain standalone license files at the pinned revisions, so their inclusion here must not be interpreted as a license grant. Preserve this provenance and confirm redistribution rights before publishing packaged copies outside this project.

## Dimensioned Component Models

The NEMA 17 motors, planetary gearboxes, Mean Well EDR-120-24 power supply, Noctua NF-A4x20 5V fan, ZW12-3 switch, inductive sensor, and emergency stop are original Three.js constructions in `src/electronicModels.ts`. Their principal envelopes and identifying features follow manufacturer product data linked from the individual catalog entries; they are visual planning models, not manufacturing CAD.
