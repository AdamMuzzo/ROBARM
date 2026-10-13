# Octopus Pro enclosure CAD

This directory contains the parametric CAD and printable test pieces for the
PAROL6 Octopus Pro V1.1 electronics enclosure.

## Complete enclosure - Rev9 full adapter cover

The current assembly uses the unchanged Rev6 tray, the shortened-skirt Rev9
fan lid, and the widened Rev9 base adapter with its full-footprint cover. The
adapter keeps the corrected upright orientation, widens the enclosure-facing
body to the same 126 mm width as the electronics case, and preserves the
official 109 mm base-mating geometry without scaling it. Every part fits the
FlashForge Adventurer 5M's 220 x 220 mm bed:

- `output/octopus_enclosure_tray_rev6.stl`
  - 126 x 206 x 56.8 mm without the lid
  - Exactly 59.8 mm high with the 3.0 mm flush lid installed
  - Holds the 160 x 100 mm Octopus Pro on four printed M3 standoffs
  - One continuous 77 x 18 mm USB/microSD service opening faces outward
  - Twelve narrow ventilation slots on each long wall, spanning 113.6 mm
  - Leaves 34.8 mm behind the inward-facing power terminals
  - Leaves 9.8 mm between each long board edge and the inside side wall
  - Four 14 mm standoff base flanges and eight short inward support ribs
  - A central anti-flex cross 0.8 mm below the nominal PCB underside
  - Left wiring-bay panel: power connector and illuminated power button
  - Right wiring-bay panel: two pneumatic bulkhead fittings
- `output/octopus_enclosure_fan_lid_rev9.stl`
  - 126 x 206 mm removable lid
  - Four boss-free side-retention screw positions
  - Retention skirts shortened from 15.0 to 7.8 mm
  - Skirts end exactly 2.0 mm past the M3 screw centres
  - Print-orientation height reduced from 18.0 to 10.8 mm
  - Standard 40 mm fan pattern with a grille integrated into the lid
  - Fan installs beneath the lid so nothing projects above 59.8 mm
- `output/octopus_component_fit_coupon_rev6.stl`
  - 72 x 32 x 3.2 mm
  - Optional low-cost check for all four panel component cutouts
- `output/parol6_octopus_interface_adapter_rev9.stl`
  - Exact base-facing geometry cropped from the official PAROL6 case
  - Correct upright orientation with the original floor at Z = 0
  - 126 mm enclosure-facing body and tray-facing flange
  - Symmetric 8.5 mm widening on each side
  - Final 12.5 mm remains the untouched 109 mm official base interface
  - The sides step inward only near the base-mating end
  - Top 3.08 mm recessed to receive the full adapter cover
  - Base-mating geometry below the lid recess remains unchanged
  - Obsolete side opening filled
  - Adds four new M3 tray-fastening bosses only at the outward cut plane
  - Aligns with four tray clearance holes at X = 16.5/109.5 mm and
    Z = 14/44 mm
- `output/parol6_octopus_interface_adapter_lid_rev9.stl`
  - Replaces almost the complete top surface of the widened adapter
  - Covers the rounded base-side portions as well as the central opening
  - 125.4 x 49.9 mm rounded full-footprint cover
  - Steps inward with the preserved 109 mm base-interface zone
  - No overhanging or T-shaped perimeter lip
  - Four M3 pilot holes align with supported stock adapter edge locations
  - Installed top is exactly flush with the 59.8 mm adapter height

The panel cutout diameters were measured directly from the official
`Electronics_case_v1_1.STL`:

- Power connector: 15.6 mm
- Illuminated button: 12.2 mm
- Pneumatic fitting 1: 12.2 mm
- Pneumatic fitting 2: 12.2 mm

The tray, lid and component coupon also have STEP exports. The adapter remains
an STL because its base-facing geometry is preserved directly from the
official triangulated PAROL6 source.

### Hardware

- 4 x M3 x 8 mm screws for the Octopus board
- 4 x M3 x 16 mm screws for tray-to-interface assembly
- 4 x M3 x 8 mm screws for the removable lid
- 2 x M3 x 16 mm screws for the left side of the adapter lid
- 2 x M3 x 25 mm screws for the thicker right side of the adapter lid
- 4 x M3 fan screws plus nuts, sized for the selected fan thickness
- 1 x slim 40 x 40 x 10 mm fan

The 2.8 mm printed pilot holes are intended to be thread-formed by an M3 screw
or pre-tapped with an M3 tap. Do not overtighten screws in printed plastic.

### Print settings

Use the part orientation supplied in each STL:

- Tray: floor on the build plate
- Lid: broad outer face on the build plate, skirts upward
- Interface adapter: original case floor on the build plate
- Interface adapter lid: broad outer face on the build plate, edges upward
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
2. Place the Rev9 adapter and Rev6 tray on the same flat surface. The 126 mm
   tray-facing flange aligns directly with the tray; do not flip the adapter
   or add an 8.5 mm manual offset.
3. Insert four M3 x 16 mm screws from inside the tray's power-wiring bay into
   the adapter's 2.8 mm pilot bosses.
4. Install the Octopus board with its USB/microSD edge at the large outward
   rectangular service opening. Confirm no unusually long solder pins touch
   the anti-flex rails, then use four M3 x 8 mm screws.
5. Install the power connector and button in the left wiring-bay wall, and
   the two pneumatic fittings in the right wiring-bay wall.
6. Seat the full adapter cover in its shallow top recess. Its top face must be
   level with the surrounding 59.8 mm edge. Secure it through the two
   supported holes on each side at adapter Y = 34 mm and Z = 43/55 mm.
7. Complete wiring before fitting the main case lid.
8. Mount the 40 mm fan beneath the main lid. Configure it as exhaust so cool air
   enters through the side vents, outward opening and rear wiring passage.
9. Seat the main lid's internal skirts. Secure it with four M3 x 8 mm screws:
   one through each wall near the outward end and one through each wall near
   the wiring bay.

The power supply remains external. Route power wiring through the protected
34.8 mm bay rather than bending it tightly against the board terminals.

The central support cross stops the nominal PCB after approximately 0.8 mm of
deflection. If immediate soft support is desired, add only a thin
non-conductive silicone or foam pad after verifying the actual board gap; do
not force the PCB upward or place a pad beneath protruding solder joints.

Some earlier comparison parts remain in `output`. Do not print or use the
Rev6-or-earlier adapter; its vertical orientation causes the joining holes to
miss when the parts share a flat surface. Rev7 corrected the alignment but
retained the narrow stock body, while Rev8 used only a partial adapter lid.
The current printable combination is the Rev6 tray plus the Rev9 fan lid,
adapter, and full adapter cover.

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
