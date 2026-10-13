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
LID_MIN_Y = 3.55
LID_STEP_Y = WIDENED_BODY_END_Y
LID_COVER_EDGE_INSET = 0.30
LID_RECESS_EDGE_INSET = 0.20
LID_INWARD_FINGER_WIDTH = 12.0
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


def build_lid_cover_profile(
    edge_inset: float,
    z_bottom: float,
    height: float,
) -> trimesh.Trimesh:
    """Cover with rear fingers only above the two base-side hole rails."""
    wide_width = TRAY_WIDTH - 2 * edge_inset
    cover_length = LID_STEP_Y - 2 * edge_inset
    front_cover = make_box(
        (wide_width, cover_length, height),
        (
            TRAY_WIDTH / 2,
            edge_inset + cover_length / 2,
            z_bottom + height / 2,
        ),
    )

    finger_start_y = LID_STEP_Y - edge_inset
    finger_end_y = CROP_MAX_Z - CROP_MIN_Z - edge_inset
    finger_length = finger_end_y - finger_start_y
    finger_center_y = (finger_start_y + finger_end_y) / 2

    left_finger_min_x = ORIGINAL_LEFT_INNER_X + edge_inset
    left_finger_max_x = (
        ORIGINAL_LEFT_INNER_X
        + LID_INWARD_FINGER_WIDTH
        - edge_inset
    )
    left_finger = make_box(
        (
            left_finger_max_x - left_finger_min_x,
            finger_length,
            height,
        ),
        (
            (left_finger_min_x + left_finger_max_x) / 2,
            finger_center_y,
            z_bottom + height / 2,
        ),
    )

    right_finger_min_x = (
        ORIGINAL_RIGHT_INNER_X
        - LID_INWARD_FINGER_WIDTH
        + edge_inset
    )
    right_finger_max_x = ORIGINAL_RIGHT_INNER_X - edge_inset
    right_finger = make_box(
        (
            right_finger_max_x - right_finger_min_x,
            finger_length,
            height,
        ),
        (
            (right_finger_min_x + right_finger_max_x) / 2,
            finger_center_y,
            z_bottom + height / 2,
        ),
    )

    return trimesh.boolean.union(
        [front_cover, left_finger, right_finger],
        engine="manifold",
    )


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
    wide_center_x = (LID_WIDE_MIN_X + LID_WIDE_MAX_X) / 2
    wide_end_y = LID_STEP_Y - 0.35
    wide_length = wide_end_y - LID_MIN_Y
    plate_bottom = LID_TOP_Z - LID_THICKNESS
    side_skirt_bottom = plate_bottom - LID_SIDE_SKIRT_DEPTH
    end_skirt_bottom = plate_bottom - LID_END_SKIRT_DEPTH

    cover_plate = build_lid_cover_profile(
        LID_COVER_EDGE_INSET,
        plate_bottom,
        LID_THICKNESS,
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
    rear_skirt = make_box(
        (
            front_width,
            LID_SKIRT_THICKNESS,
            LID_END_SKIRT_DEPTH,
        ),
        (
            wide_center_x,
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
            front_skirt,
            rear_skirt,
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

    # Export the primary lid in intuitive assembly orientation: the outer
    # cover is on top and the screw-bearing retention tabs point downward.
    lid.apply_translation(-lid.bounds[0])
    lid.remove_unreferenced_vertices()
    lid.fix_normals()

    if not lid.is_watertight or not lid.is_winding_consistent:
        raise RuntimeError("Generated adapter lid failed mesh validation")
    if len(lid.split()) != 1:
        raise RuntimeError("Generated adapter lid is not one connected body")

    return lid


def make_print_oriented_lid(
    assembly_lid: trimesh.Trimesh,
) -> trimesh.Trimesh:
    """Flip the lid onto its broad outer face for support-free printing."""
    print_lid = assembly_lid.copy()
    vertices = print_lid.vertices.copy()
    vertices[:, 2] = print_lid.extents[2] - vertices[:, 2]
    print_lid.vertices = vertices
    print_lid.faces = print_lid.faces[:, ::-1]
    print_lid.remove_unreferenced_vertices()
    print_lid.fix_normals()

    if (
        not print_lid.is_watertight
        or not print_lid.is_winding_consistent
    ):
        raise RuntimeError("Print-oriented adapter lid failed validation")
    if len(print_lid.split()) != 1:
        raise RuntimeError("Print-oriented adapter lid is not one body")

    return print_lid


def main() -> None:
    cad_dir = Path(__file__).resolve().parent
    source_path = cad_dir / "reference" / "Electronics_case_v1_1.STL"
    output_path = (
        cad_dir
        / "output"
        / "parol6_octopus_interface_adapter_rev14.stl"
    )
    lid_output_path = (
        cad_dir
        / "output"
        / "parol6_octopus_interface_adapter_lid_rev14.stl"
    )
    print_lid_output_path = (
        cad_dir
        / "output"
        / "parol6_octopus_interface_adapter_lid_rev14_print_orientation.stl"
    )

    if not source_path.exists():
        raise FileNotFoundError(f"Missing official reference STL: {source_path}")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    adapter = build_adapter(source_path)
    adapter.export(output_path)
    lid = build_adapter_lid()
    lid.export(lid_output_path)
    print_lid = make_print_oriented_lid(lid)
    print_lid.export(print_lid_output_path)

    print(
        "Generated PAROL6 interface adapter: "
        f"{adapter.extents[0]:.2f} x {adapter.extents[1]:.2f} "
        f"x {adapter.extents[2]:.2f} mm"
    )
    print(
        "Generated assembly-oriented flush adapter lid: "
        f"{lid.extents[0]:.2f} x {lid.extents[1]:.2f} "
        f"x {lid.extents[2]:.2f} mm"
    )
    print(
        "Generated support-free print-oriented copy: "
        f"{print_lid.extents[0]:.2f} x {print_lid.extents[1]:.2f} "
        f"x {print_lid.extents[2]:.2f} mm"
    )


if __name__ == "__main__":
    main()
