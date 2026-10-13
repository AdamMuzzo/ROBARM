"""Build the exact PAROL6-to-Octopus enclosure interface adapter.

The base-facing portion is cropped directly from the official
Electronics_case_v1_1.STL. A new M3 joining frame is added only at the
outward crop plane, away from the original PAROL6 mating surfaces.

Dependencies:
    trimesh
    manifold3d
"""

from pathlib import Path

import numpy as np
import trimesh


SOURCE_CASE_WIDTH = 109.0
SOURCE_CASE_HEIGHT = 59.8
SOURCE_CASE_MAX_Z = 130.5
TRAY_WIDTH = 126.0
INTERFACE_X_OFFSET = (TRAY_WIDTH - SOURCE_CASE_WIDTH) / 2

# Keep 50.5 mm of the original case, including the complete mounting region.
CROP_MIN_Z = 80.0
CROP_MAX_Z = SOURCE_CASE_MAX_Z

JOIN_WALL = 3.2
JOIN_SIDE_WIDTH = 24.0
JOIN_BOTTOM_HEIGHT = 10.0

M3_PILOT_DIAMETER = 2.8
M3_CLEARANCE_DIAMETER = 3.4
JOIN_BOSS_DIAMETER = 10.0
JOIN_BOSS_LENGTH = 12.0
JOIN_HOLE_X = (16.5, 109.5)
JOIN_HOLE_Z = (14.0, 44.0)

# Widen only the enclosure-facing portion. The final 12.5 mm remains the
# untouched official 109 mm base interface, including every mating feature.
WIDENED_BODY_END_Y = 38.0
ORIGINAL_LEFT_INNER_X = 21.2
ORIGINAL_RIGHT_INNER_X = 95.8
WIDENED_LEFT_INNER_X = ORIGINAL_LEFT_INNER_X - INTERFACE_X_OFFSET
WIDENED_RIGHT_INNER_X = ORIGINAL_RIGHT_INNER_X + INTERFACE_X_OFFSET
WIDENED_FLOOR_THICKNESS = 3.2

# Flush inset lid. Its front is widened with the enclosure-facing body and its
# rear follows the untouched official base interface.
LID_WIDE_MIN_X = WIDENED_LEFT_INNER_X + 0.35
LID_WIDE_MAX_X = WIDENED_RIGHT_INNER_X - 0.35
LID_NARROW_MIN_X = ORIGINAL_LEFT_INNER_X + 0.35
LID_NARROW_MAX_X = ORIGINAL_RIGHT_INNER_X - 0.35
LID_MIN_Y = 3.55
LID_MAX_Y = 50.15
LID_STEP_Y = WIDENED_BODY_END_Y
LID_COVER_EDGE_INSET = 0.30
LID_RECESS_EDGE_INSET = 0.20
LID_COVER_CORNER_RADIUS = 3.0
LID_TOP_Z = SOURCE_CASE_HEIGHT
LID_THICKNESS = 3.0
LID_SIDE_SKIRT_DEPTH = 17.0
LID_END_SKIRT_DEPTH = 7.0
LID_SKIRT_THICKNESS = 3.0
LID_SCREW_Y = 34.0
LID_SCREW_Z = (43.0, 55.0)

# Close the obsolete controller/fan service cutout that survives in the
# right-hand side of the cropped stock case. The patch stays inside the
# official 109 mm outer envelope and does not alter the base-facing features.
SIDE_PATCH_THICKNESS = 2.0
SIDE_PATCH_LENGTH = 22.5
SIDE_PATCH_HEIGHT = 29.0
SIDE_PATCH_BOTTOM = 6.5


def crop_official_interface(source: trimesh.Trimesh) -> trimesh.Trimesh:
    source_min, source_max = source.bounds
    crop_size = np.array(
        [
            source_max[0] - source_min[0] + 2.0,
            source_max[1] - source_min[1] + 2.0,
            CROP_MAX_Z - CROP_MIN_Z,
        ]
    )
    crop_center = np.array(
        [
            (source_min[0] + source_max[0]) / 2,
            (source_min[1] + source_max[1]) / 2,
            (CROP_MIN_Z + CROP_MAX_Z) / 2,
        ]
    )
    crop_box = trimesh.creation.box(
        extents=crop_size,
        transform=trimesh.transformations.translation_matrix(crop_center),
    )
    cropped = trimesh.boolean.intersection(
        [source, crop_box],
        engine="manifold",
    )

    # Reorient the source axes to match the new tray:
    # source X -> adapter X
    # source Z -> adapter Y (outward seam toward robot base)
    # source Y -> inverted adapter Z, putting the official case floor at
    # Z=0 and its open side at Z=59.8 when both parts sit on a flat surface.
    vertices = cropped.vertices.copy()
    cropped.vertices = np.column_stack(
        (
            vertices[:, 0],
            vertices[:, 2],
            SOURCE_CASE_HEIGHT - vertices[:, 1],
        )
    )
    cropped.apply_translation(-cropped.bounds[0])
    cropped.apply_translation((INTERFACE_X_OFFSET, 0.0, 0.0))
    cropped.fix_normals()
    return cropped


def make_box(
    extents: tuple[float, float, float],
    center: tuple[float, float, float],
) -> trimesh.Trimesh:
    return trimesh.creation.box(
        extents=extents,
        transform=trimesh.transformations.translation_matrix(center),
    )


def rounded_xy_prism(
    x_min: float,
    x_max: float,
    y_min: float,
    y_max: float,
    radius: float,
    z_bottom: float,
    height: float,
) -> trimesh.Trimesh:
    """Create a rounded-rectangle prism aligned to the XY plane."""
    width = x_max - x_min
    length = y_max - y_min
    center_x = (x_min + x_max) / 2
    center_y = (y_min + y_max) / 2
    center_z = z_bottom + height / 2

    pieces = [
        make_box(
            (width - 2 * radius, length, height),
            (center_x, center_y, center_z),
        ),
        make_box(
            (width, length - 2 * radius, height),
            (center_x, center_y, center_z),
        ),
    ]
    for x in (x_min + radius, x_max - radius):
        for y in (y_min + radius, y_max - radius):
            pieces.append(
                trimesh.creation.cylinder(
                    radius=radius,
                    height=height,
                    sections=64,
                    transform=trimesh.transformations.translation_matrix(
                        (x, y, center_z)
                    ),
                )
            )
    return trimesh.boolean.union(pieces, engine="manifold")


def build_lid_cover_profile(
    edge_inset: float,
    z_bottom: float,
    height: float,
    radius: float,
) -> trimesh.Trimesh:
    """Full adapter-top footprint, including the rounded base-side area."""
    wide = rounded_xy_prism(
        edge_inset,
        TRAY_WIDTH - edge_inset,
        edge_inset,
        LID_STEP_Y + 0.4,
        radius,
        z_bottom,
        height,
    )
    narrow = rounded_xy_prism(
        INTERFACE_X_OFFSET + edge_inset,
        INTERFACE_X_OFFSET + SOURCE_CASE_WIDTH - edge_inset,
        LID_STEP_Y - 0.4,
        CROP_MAX_Z - CROP_MIN_Z - edge_inset,
        radius,
        z_bottom,
        height,
    )
    return trimesh.boolean.union([wide, narrow], engine="manifold")


def widen_enclosure_facing_body(
    exact_interface: trimesh.Trimesh,
) -> trimesh.Trimesh:
    """Widen Y=0..38 while preserving the final base-mating zone exactly."""
    left_clip = make_box(
        (
            ORIGINAL_LEFT_INNER_X - INTERFACE_X_OFFSET + 1.0,
            WIDENED_BODY_END_Y + 1.0,
            SOURCE_CASE_HEIGHT + 2.0,
        ),
        (
            (
                INTERFACE_X_OFFSET
                + ORIGINAL_LEFT_INNER_X
            )
            / 2,
            (WIDENED_BODY_END_Y - 1.0) / 2,
            SOURCE_CASE_HEIGHT / 2,
        ),
    )
    right_clip = make_box(
        (
            (
                INTERFACE_X_OFFSET
                + SOURCE_CASE_WIDTH
                - ORIGINAL_RIGHT_INNER_X
                + 1.0
            ),
            WIDENED_BODY_END_Y + 1.0,
            SOURCE_CASE_HEIGHT + 2.0,
        ),
        (
            (
                ORIGINAL_RIGHT_INNER_X
                + INTERFACE_X_OFFSET
                + SOURCE_CASE_WIDTH
            )
            / 2,
            (WIDENED_BODY_END_Y - 1.0) / 2,
            SOURCE_CASE_HEIGHT / 2,
        ),
    )

    left_piece = trimesh.boolean.intersection(
        [exact_interface, left_clip],
        engine="manifold",
    )
    right_piece = trimesh.boolean.intersection(
        [exact_interface, right_clip],
        engine="manifold",
    )
    center_and_base = trimesh.boolean.difference(
        [exact_interface, left_clip, right_clip],
        engine="manifold",
    )

    left_piece.apply_translation((-INTERFACE_X_OFFSET, 0.0, 0.0))
    right_piece.apply_translation((INTERFACE_X_OFFSET, 0.0, 0.0))

    # Moving the side shells exposes two narrow floor strips. Restore only
    # those strips; the original central and base-facing floor stays intact.
    left_floor_strip = make_box(
        (
            INTERFACE_X_OFFSET,
            WIDENED_BODY_END_Y,
            WIDENED_FLOOR_THICKNESS,
        ),
        (
            WIDENED_LEFT_INNER_X + INTERFACE_X_OFFSET / 2,
            WIDENED_BODY_END_Y / 2,
            WIDENED_FLOOR_THICKNESS / 2,
        ),
    )
    right_floor_strip = make_box(
        (
            INTERFACE_X_OFFSET,
            WIDENED_BODY_END_Y,
            WIDENED_FLOOR_THICKNESS,
        ),
        (
            ORIGINAL_RIGHT_INNER_X + INTERFACE_X_OFFSET / 2,
            WIDENED_BODY_END_Y / 2,
            WIDENED_FLOOR_THICKNESS / 2,
        ),
    )

    widened = trimesh.boolean.union(
        [
            center_and_base,
            left_piece,
            right_piece,
            left_floor_strip,
            right_floor_strip,
        ],
        engine="manifold",
    )
    widened.remove_unreferenced_vertices()
    widened.fix_normals()
    return widened


def cylinder_along_y(
    diameter: float,
    length: float,
    center: tuple[float, float, float],
) -> trimesh.Trimesh:
    # Trimesh cylinders start along Z. Rotate -90 degrees about X to align
    # their axes with +Y.
    transform = trimesh.transformations.rotation_matrix(
        np.deg2rad(-90),
        (1, 0, 0),
    )
    transform[:3, 3] = center
    return trimesh.creation.cylinder(
        radius=diameter / 2,
        height=length,
        sections=64,
        transform=transform,
    )


def cylinder_along_x(
    diameter: float,
    length: float,
    center: tuple[float, float, float],
) -> trimesh.Trimesh:
    transform = trimesh.transformations.rotation_matrix(
        np.deg2rad(90),
        (0, 1, 0),
    )
    transform[:3, 3] = center
    return trimesh.creation.cylinder(
        radius=diameter / 2,
        height=length,
        sections=64,
        transform=transform,
    )


def build_adapter(source_path: Path) -> trimesh.Trimesh:
    source = trimesh.load_mesh(source_path)
    exact_interface = widen_enclosure_facing_body(
        crop_official_interface(source)
    )

    left_side = make_box(
        (JOIN_SIDE_WIDTH, JOIN_WALL, SOURCE_CASE_HEIGHT),
        (JOIN_SIDE_WIDTH / 2, JOIN_WALL / 2, SOURCE_CASE_HEIGHT / 2),
    )
    right_side = make_box(
        (JOIN_SIDE_WIDTH, JOIN_WALL, SOURCE_CASE_HEIGHT),
        (
            TRAY_WIDTH - JOIN_SIDE_WIDTH / 2,
            JOIN_WALL / 2,
            SOURCE_CASE_HEIGHT / 2,
        ),
    )
    bottom = make_box(
        (TRAY_WIDTH, JOIN_WALL, JOIN_BOTTOM_HEIGHT),
        (
            TRAY_WIDTH / 2,
            JOIN_WALL / 2,
            JOIN_BOTTOM_HEIGHT / 2,
        ),
    )
    side_patch = make_box(
        (
            SIDE_PATCH_THICKNESS,
            SIDE_PATCH_LENGTH,
            SIDE_PATCH_HEIGHT,
        ),
        (
            TRAY_WIDTH - SIDE_PATCH_THICKNESS / 2,
            SIDE_PATCH_LENGTH / 2,
            SIDE_PATCH_BOTTOM + SIDE_PATCH_HEIGHT / 2,
        ),
    )

    bosses: list[trimesh.Trimesh] = []
    pilots: list[trimesh.Trimesh] = []
    for x in JOIN_HOLE_X:
        for z in JOIN_HOLE_Z:
            bosses.append(
                cylinder_along_y(
                    JOIN_BOSS_DIAMETER,
                    JOIN_BOSS_LENGTH,
                    (x, JOIN_BOSS_LENGTH / 2, z),
                )
            )
            pilots.append(
                cylinder_along_y(
                    M3_PILOT_DIAMETER,
                    JOIN_BOSS_LENGTH + 2.0,
                    (x, JOIN_BOSS_LENGTH / 2 - 0.5, z),
                )
            )

    # Open four selected stock edge-hole locations all the way through the
    # adapter side walls. Screws enter from outside and thread into the lid's
    # downward 90-degree skirts.
    lid_clearance_holes: list[trimesh.Trimesh] = []
    for z in LID_SCREW_Z:
        lid_clearance_holes.append(
            cylinder_along_x(
                M3_CLEARANCE_DIAMETER,
                WIDENED_LEFT_INNER_X + 2.0,
                (
                    (WIDENED_LEFT_INNER_X + 2.0) / 2 - 1.0,
                    LID_SCREW_Y,
                    z,
                ),
            )
        )
        lid_clearance_holes.append(
            cylinder_along_x(
                M3_CLEARANCE_DIAMETER,
                TRAY_WIDTH - WIDENED_RIGHT_INNER_X + 2.0,
                (
                    (
                        TRAY_WIDTH
                        + WIDENED_RIGHT_INNER_X
                    )
                    / 2
                    + 1.0,
                    LID_SCREW_Y,
                    z,
                ),
            )
        )

    adapter = trimesh.boolean.union(
        [
            exact_interface,
            left_side,
            right_side,
            bottom,
            side_patch,
            *bosses,
        ],
        engine="manifold",
    )
    lid_recess = build_lid_cover_profile(
        LID_RECESS_EDGE_INSET,
        LID_TOP_Z - LID_THICKNESS - 0.08,
        LID_THICKNESS + 0.4,
        LID_COVER_CORNER_RADIUS + 0.1,
    )
    adapter = trimesh.boolean.difference(
        [
            adapter,
            lid_recess,
            *pilots,
            *lid_clearance_holes,
        ],
        engine="manifold",
    )

    adapter.remove_unreferenced_vertices()
    adapter.fix_normals()

    if not adapter.is_watertight or not adapter.is_winding_consistent:
        raise RuntimeError("Generated adapter failed mesh validation")
    if len(adapter.split()) != 1:
        raise RuntimeError("Generated adapter is not a single connected body")

    return adapter


def build_adapter_lid() -> trimesh.Trimesh:
    wide_width = LID_WIDE_MAX_X - LID_WIDE_MIN_X
    narrow_width = LID_NARROW_MAX_X - LID_NARROW_MIN_X
    wide_center_x = (LID_WIDE_MIN_X + LID_WIDE_MAX_X) / 2
    narrow_center_x = (
        LID_NARROW_MIN_X + LID_NARROW_MAX_X
    ) / 2
    wide_end_y = LID_STEP_Y - 0.35
    narrow_side_start_y = LID_STEP_Y + 0.35
    wide_length = wide_end_y - LID_MIN_Y
    narrow_length = LID_MAX_Y - wide_end_y
    plate_bottom = LID_TOP_Z - LID_THICKNESS
    side_skirt_bottom = plate_bottom - LID_SIDE_SKIRT_DEPTH
    end_skirt_bottom = plate_bottom - LID_END_SKIRT_DEPTH

    cover_plate = build_lid_cover_profile(
        LID_COVER_EDGE_INSET,
        plate_bottom,
        LID_THICKNESS,
        LID_COVER_CORNER_RADIUS,
    )

    wide_left_skirt = make_box(
        (
            LID_SKIRT_THICKNESS,
            wide_length,
            LID_END_SKIRT_DEPTH,
        ),
        (
            LID_WIDE_MIN_X + LID_SKIRT_THICKNESS / 2,
            LID_MIN_Y + wide_length / 2,
            end_skirt_bottom + LID_END_SKIRT_DEPTH / 2,
        ),
    )
    wide_right_skirt = make_box(
        (
            LID_SKIRT_THICKNESS,
            wide_length,
            LID_END_SKIRT_DEPTH,
        ),
        (
            LID_WIDE_MAX_X - LID_SKIRT_THICKNESS / 2,
            LID_MIN_Y + wide_length / 2,
            end_skirt_bottom + LID_END_SKIRT_DEPTH / 2,
        ),
    )

    # The stock interface has an internal brace ending at Y=12.0. Keep the
    # full perimeter skirt shallow there, then add the deeper screw-bearing
    # portion after 0.35 mm clearance.
    deep_skirt_start_y = 12.35
    deep_skirt_length = wide_end_y - deep_skirt_start_y
    deep_extension_height = (
        LID_SIDE_SKIRT_DEPTH - LID_END_SKIRT_DEPTH
    )
    wide_left_deep_extension = make_box(
        (
            LID_SKIRT_THICKNESS,
            deep_skirt_length,
            deep_extension_height,
        ),
        (
            LID_WIDE_MIN_X + LID_SKIRT_THICKNESS / 2,
            deep_skirt_start_y + deep_skirt_length / 2,
            side_skirt_bottom + deep_extension_height / 2,
        ),
    )
    wide_right_deep_extension = make_box(
        (
            LID_SKIRT_THICKNESS,
            deep_skirt_length,
            deep_extension_height,
        ),
        (
            LID_WIDE_MAX_X - LID_SKIRT_THICKNESS / 2,
            deep_skirt_start_y + deep_skirt_length / 2,
            side_skirt_bottom + deep_extension_height / 2,
        ),
    )

    narrow_side_length = LID_MAX_Y - narrow_side_start_y
    narrow_left_skirt = make_box(
        (
            LID_SKIRT_THICKNESS,
            narrow_side_length,
            LID_END_SKIRT_DEPTH,
        ),
        (
            LID_NARROW_MIN_X + LID_SKIRT_THICKNESS / 2,
            narrow_side_start_y + narrow_side_length / 2,
            end_skirt_bottom + LID_END_SKIRT_DEPTH / 2,
        ),
    )
    narrow_right_skirt = make_box(
        (
            LID_SKIRT_THICKNESS,
            narrow_side_length,
            LID_END_SKIRT_DEPTH,
        ),
        (
            LID_NARROW_MAX_X - LID_SKIRT_THICKNESS / 2,
            narrow_side_start_y + narrow_side_length / 2,
            end_skirt_bottom + LID_END_SKIRT_DEPTH / 2,
        ),
    )

    front_width = wide_width - 2 * LID_SKIRT_THICKNESS
    front_skirt = make_box(
        (
            front_width,
            LID_SKIRT_THICKNESS,
            LID_END_SKIRT_DEPTH,
        ),
        (
            wide_center_x,
            LID_MIN_Y + LID_SKIRT_THICKNESS / 2,
            end_skirt_bottom + LID_END_SKIRT_DEPTH / 2,
        ),
    )
    rear_width = narrow_width - 2 * LID_SKIRT_THICKNESS
    rear_skirt = make_box(
        (
            rear_width,
            LID_SKIRT_THICKNESS,
            LID_END_SKIRT_DEPTH,
        ),
        (
            narrow_center_x,
            LID_MAX_Y - LID_SKIRT_THICKNESS / 2,
            end_skirt_bottom + LID_END_SKIRT_DEPTH / 2,
        ),
    )

    shoulder_width = LID_NARROW_MIN_X - LID_WIDE_MIN_X
    left_shoulder = make_box(
        (
            shoulder_width,
            LID_SKIRT_THICKNESS,
            LID_END_SKIRT_DEPTH,
        ),
        (
            LID_WIDE_MIN_X + shoulder_width / 2,
            wide_end_y - LID_SKIRT_THICKNESS / 2,
            end_skirt_bottom + LID_END_SKIRT_DEPTH / 2,
        ),
    )
    right_shoulder = make_box(
        (
            shoulder_width,
            LID_SKIRT_THICKNESS,
            LID_END_SKIRT_DEPTH,
        ),
        (
            LID_NARROW_MAX_X + shoulder_width / 2,
            wide_end_y - LID_SKIRT_THICKNESS / 2,
            end_skirt_bottom + LID_END_SKIRT_DEPTH / 2,
        ),
    )

    lid = trimesh.boolean.union(
        [
            cover_plate,
            wide_left_skirt,
            wide_right_skirt,
            wide_left_deep_extension,
            wide_right_deep_extension,
            narrow_left_skirt,
            narrow_right_skirt,
            front_skirt,
            rear_skirt,
            left_shoulder,
            right_shoulder,
        ],
        engine="manifold",
    )

    pilots: list[trimesh.Trimesh] = []
    for z in LID_SCREW_Z:
        pilots.append(
            cylinder_along_x(
                M3_PILOT_DIAMETER,
                LID_SKIRT_THICKNESS + 2.0,
                (
                    LID_WIDE_MIN_X + LID_SKIRT_THICKNESS / 2,
                    LID_SCREW_Y,
                    z,
                ),
            )
        )
        pilots.append(
            cylinder_along_x(
                M3_PILOT_DIAMETER,
                LID_SKIRT_THICKNESS + 2.0,
                (
                    LID_WIDE_MAX_X - LID_SKIRT_THICKNESS / 2,
                    LID_SCREW_Y,
                    z,
                ),
            )
        )
    lid = trimesh.boolean.difference([lid, *pilots], engine="manifold")

    # Export in support-free print orientation: flush top face on Z=0 and
    # the 90-degree perimeter skirts extending upward.
    vertices = lid.vertices.copy()
    vertices[:, 2] = LID_TOP_Z - vertices[:, 2]
    lid.vertices = vertices
    lid.faces = lid.faces[:, ::-1]
    lid.apply_translation(-lid.bounds[0])
    lid.remove_unreferenced_vertices()
    lid.fix_normals()

    if not lid.is_watertight or not lid.is_winding_consistent:
        raise RuntimeError("Generated adapter lid failed mesh validation")
    if len(lid.split()) != 1:
        raise RuntimeError("Generated adapter lid is not one connected body")

    return lid


def main() -> None:
    cad_dir = Path(__file__).resolve().parent
    source_path = cad_dir / "reference" / "Electronics_case_v1_1.STL"
    output_path = (
        cad_dir
        / "output"
        / "parol6_octopus_interface_adapter_rev9.stl"
    )
    lid_output_path = (
        cad_dir
        / "output"
        / "parol6_octopus_interface_adapter_lid_rev9.stl"
    )

    if not source_path.exists():
        raise FileNotFoundError(f"Missing official reference STL: {source_path}")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    adapter = build_adapter(source_path)
    adapter.export(output_path)
    lid = build_adapter_lid()
    lid.export(lid_output_path)

    print(
        "Generated PAROL6 interface adapter: "
        f"{adapter.extents[0]:.2f} x {adapter.extents[1]:.2f} "
        f"x {adapter.extents[2]:.2f} mm"
    )
    print(
        "Generated flush adapter lid: "
        f"{lid.extents[0]:.2f} x {lid.extents[1]:.2f} "
        f"x {lid.extents[2]:.2f} mm"
    )


if __name__ == "__main__":
    main()
