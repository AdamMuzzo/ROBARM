"""Extract a printable base-interface coupon from the official PAROL6 case.

The coupon is a Boolean crop of the original Electronics_case_v1_1 STL.
This deliberately preserves the mounting ears, mating surfaces, and pilot
holes from the upstream mesh instead of reconstructing them from photographs.

Dependencies:
    trimesh
    manifold3d
"""

from pathlib import Path

import numpy as np
import trimesh


# The interface occupies the final 23 mm of the source case's Z axis.
CROP_MIN_Z = 107.5
CROP_MAX_Z = 130.5


def build_coupon(source_path: Path) -> trimesh.Trimesh:
    source = trimesh.load_mesh(source_path)

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
    coupon = trimesh.boolean.intersection(
        [source, crop_box],
        engine="manifold",
    )

    # Put the cut face on the slicer's Z=0 plane.
    coupon.apply_translation((0, 0, -coupon.bounds[0][2]))

    if not coupon.is_watertight or not coupon.is_winding_consistent:
        raise RuntimeError("Generated interface coupon failed mesh validation")

    return coupon


def main() -> None:
    cad_dir = Path(__file__).resolve().parent
    source_path = cad_dir / "reference" / "Electronics_case_v1_1.STL"
    output_path = cad_dir / "output" / "parol6_base_interface_coupon.stl"

    if not source_path.exists():
        raise FileNotFoundError(
            "Missing official reference STL: "
            f"{source_path}\n"
            "Download Electronics_case_v1_1.STL from the official PAROL6 repo."
        )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    coupon = build_coupon(source_path)
    coupon.export(output_path)

    print(
        "Generated base-interface coupon: "
        f"{coupon.extents[0]:.2f} x {coupon.extents[1]:.2f} "
        f"x {coupon.extents[2]:.2f} mm"
    )


if __name__ == "__main__":
    main()
