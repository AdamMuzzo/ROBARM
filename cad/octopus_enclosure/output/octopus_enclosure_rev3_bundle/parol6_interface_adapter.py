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

# Keep 50.5 mm of the original case, including the complete mounting region.
CROP_MIN_Z = 80.0
CROP_MAX_Z = SOURCE_CASE_MAX_Z

JOIN_WALL = 3.2
JOIN_SIDE_WIDTH = 12.0
JOIN_BOTTOM_HEIGHT = 10.0

M3_PILOT_DIAMETER = 2.8
JOIN_BOSS_DIAMETER = 10.0
JOIN_BOSS_LENGTH = 12.0
JOIN_HOLE_X = (8.0, 101.0)
JOIN_HOLE_Z = (14.0, 44.0)

# Close the obsolete controller/fan service cutout that survives in the
# right-hand side of the cropped stock case. The patch stays inside the
# official 109 mm outer envelope and does not alter the base-facing features.
SIDE_PATCH_THICKNESS = 2.0
SIDE_PATCH_LENGTH = 22.5
SIDE_PATCH_HEIGHT = 30.0
SIDE_PATCH_BOTTOM = 24.0


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
    # source Y -> adapter Z (height)
    vertices = cropped.vertices.copy()
    cropped.vertices = vertices[:, [0, 2, 1]]
    cropped.faces = cropped.faces[:, ::-1]
    cropped.apply_translation(-cropped.bounds[0])
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


def build_adapter(source_path: Path) -> trimesh.Trimesh:
    source = trimesh.load_mesh(source_path)
    exact_interface = crop_official_interface(source)

    left_side = make_box(
        (JOIN_SIDE_WIDTH, JOIN_WALL, SOURCE_CASE_HEIGHT),
        (JOIN_SIDE_WIDTH / 2, JOIN_WALL / 2, SOURCE_CASE_HEIGHT / 2),
    )
    right_side = make_box(
        (JOIN_SIDE_WIDTH, JOIN_WALL, SOURCE_CASE_HEIGHT),
        (
            SOURCE_CASE_WIDTH - JOIN_SIDE_WIDTH / 2,
            JOIN_WALL / 2,
            SOURCE_CASE_HEIGHT / 2,
        ),
    )
    bottom = make_box(
        (SOURCE_CASE_WIDTH, JOIN_WALL, JOIN_BOTTOM_HEIGHT),
        (
            SOURCE_CASE_WIDTH / 2,
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
            SOURCE_CASE_WIDTH - SIDE_PATCH_THICKNESS / 2,
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
    adapter = trimesh.boolean.difference(
        [adapter, *pilots],
        engine="manifold",
    )

    adapter.remove_unreferenced_vertices()
    adapter.fix_normals()

    if not adapter.is_watertight or not adapter.is_winding_consistent:
        raise RuntimeError("Generated adapter failed mesh validation")
    if len(adapter.split()) != 1:
        raise RuntimeError("Generated adapter is not a single connected body")

    return adapter


def main() -> None:
    cad_dir = Path(__file__).resolve().parent
    source_path = cad_dir / "reference" / "Electronics_case_v1_1.STL"
    output_path = (
        cad_dir
        / "output"
        / "parol6_octopus_interface_adapter_rev3.stl"
    )

    if not source_path.exists():
        raise FileNotFoundError(f"Missing official reference STL: {source_path}")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    adapter = build_adapter(source_path)
    adapter.export(output_path)

    print(
        "Generated PAROL6 interface adapter: "
        f"{adapter.extents[0]:.2f} x {adapter.extents[1]:.2f} "
        f"x {adapter.extents[2]:.2f} mm"
    )


if __name__ == "__main__":
    main()
