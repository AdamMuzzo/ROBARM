# Octopus Pro enclosure CAD

This directory contains the parametric CAD and printable test pieces for the
PAROL6 Octopus Pro V1.1 electronics enclosure.

## Complete enclosure — Rev2

Rev2 replaces the Rev1 open cable sides with full-height enclosed walls and
restores dedicated openings for the original PAROL6 panel hardware. The model
is split so every part fits the FlashForge Adventurer 5M's 220 x 220 mm bed:

- `output/octopus_enclosure_tray_rev2.stl`
  - 126 x 206 x 59.8 mm
  - Holds the 160 x 100 mm Octopus Pro on four printed M3 standoffs
  - Three localized USB/microSD service windows face away from the robot base
  - Leaves 34.8 mm behind the inward-facing power terminals
  - Leaves 9.8 mm between each long board edge and the inside side wall
  - Left wiring-bay panel: power connector and illuminated power button
  - Right wiring-bay panel: two pneumatic bulkhead fittings
- `output/octopus_enclosure_fan_lid_rev2.stl`
  - 126 x 206 mm removable lid
  - Standard 40 mm fan opening with a 32 x 32 mm M3 pattern
- `output/octopus_enclosure_fan_guard_rev2.stl`
  - 46 x 46 mm external guard for the 40 mm fan
- `output/octopus_component_fit_coupon_rev2.stl`
  - 72 x 32 x 3.2 mm
  - Optional low-cost check for all four panel component cutouts
- `output/parol6_octopus_interface_adapter.stl`
  - Exact base-facing geometry cropped from the official PAROL6 case
  - Adds four new M3 tray-fastening bosses only at the outward cut plane

The panel cutout diameters were measured directly from the official
`Electronics_case_v1_1.STL`:

- Power connector: 15.6 mm
- Illuminated button: 12.2 mm
- Pneumatic fitting 1: 12.2 mm
- Pneumatic fitting 2: 12.2 mm

The tray, lid, guard and component coupon also have STEP exports. The adapter
remains an STL because its base-facing geometry is preserved directly from the
official triangulated PAROL6 source.

### Hardware

- 4 x M3 x 8 mm screws for the Octopus board
- 4 x M3 x 16 mm screws for tray-to-interface assembly
- 2 x M3 x 12 mm screws for the removable lid
- 4 x M3 fan screws plus nuts, sized for the selected fan thickness
- 1 x 40 mm fan

The 2.8 mm printed pilot holes are intended to be thread-formed by an M3 screw
or pre-tapped with an M3 tap. Do not overtighten screws in printed plastic.

### Print settings

Use the part orientation supplied in each STL:

- Tray: floor on the build plate
- Lid: broad outer face on the build plate, skirts upward
- Interface adapter: original case floor on the build plate
- Fan guard: flat
- Component coupon: flat

Recommended starting profile:

- Material: PETG
- Nozzle: 0.4 mm
- Layer height: 0.20 mm
- Walls: 4
- Top/bottom layers: 5
- Infill: 20% gyroid or grid
- Supports: none
- Tray brim: 5 mm maximum; the resulting 216 mm length remains within the bed

### Assembly order

1. Dry-fit the interface adapter to the PAROL6 base using the original M3
   mounting locations.
2. Centre the 109 mm adapter against the 126 mm tray. The designed offset is
   8.5 mm on each side.
3. Insert four M3 x 16 mm screws from inside the tray's power-wiring bay into
   the adapter's 2.8 mm pilot bosses.
4. Install the Octopus board with its USB/microSD edge at the large outward
   service-window group. Use four M3 x 8 mm screws.
5. Install the power connector and button in the left wiring-bay wall, and
   the two pneumatic fittings in the right wiring-bay wall.
6. Complete wiring before fitting the lid.
7. Mount the 40 mm fan over the lid opening. Configure it as exhaust so cool
   air enters through the outward service windows and rear wiring passage.
8. Seat the lid's internal skirts and secure it with two M3 x 12 mm screws
   through the sides of the protected wiring bay.

The power supply remains external. Route power wiring through the protected
34.8 mm bay rather than bending it tightly against the board terminals.

The original Rev1 STLs remain in `output` for comparison only. Use the files
with `_rev2` in their names for the enclosed-wall design.

## First fit test

`output/octopus_mount_test_frame.stl` checks:

- 160 x 100 mm board outline
- 150 x 90 mm corner-hole centre pattern
- 3.4 mm M3 clearance holes

The board should sit on the four raised pads without forcing any screw. Test
with four loose M3 screws before printing the complete enclosure.

Recommended test-frame slicing:

- Orientation: flat, pads facing upward
- Nozzle: 0.4 mm
- Layer height: 0.20 mm
- Walls: 3
- Top/bottom layers: 4
- Infill: 15%
- Supports: none
- Material: PLA or PETG

The source model uses CadQuery 2.8 or newer and exports both STL and STEP.

## PAROL6 base-interface coupon

`output/parol6_base_interface_coupon.stl` is a Boolean crop taken directly
from the official `Electronics_case_v1_1.STL`. It preserves the original
mounting ears, mating surfaces, and 2.8 mm M3 pilot-hole geometry.

Use this coupon only if an independent base-interface fit check is useful.
The already-printed stock electronics case remains the best evidence that the
upstream interface fits the printed base assembly.

Recommended coupon slicing:

- Orientation: flat cropped face on the build plate
- Layer height: 0.20 mm
- Walls: 3
- Top/bottom layers: 4
- Infill: 15%
- Supports: none
- Material: the same material planned for the finished enclosure

The extraction script uses `trimesh` with the `manifold3d` Boolean engine.
