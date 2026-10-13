"""Generate a low-material mounting test frame for the BTT Octopus Pro V1.1.

All dimensions are millimetres. The frame verifies:
- 160 x 100 mm motherboard outline
- 150 x 90 mm four-hole centre pattern
- M3 screw clearance

Run with CadQuery 2.8+:
    python octopus_mount_test_frame.py
"""

from pathlib import Path

import cadquery as cq
from cadquery import exporters


BOARD_LENGTH = 160.0
BOARD_WIDTH = 100.0
HOLE_PITCH_X = 150.0
HOLE_PITCH_Y = 90.0

FRAME_THICKNESS = 2.0
FRAME_BORDER = 6.0
FRAME_CORNER_RADIUS = 5.0
CROSS_RIB_WIDTH = 4.0

STANDOFF_HEIGHT = 5.0
STANDOFF_DIAMETER = 8.0
M3_CLEARANCE_DIAMETER = 3.4


def rounded_box(length: float, width: float, height: float, radius: float) -> cq.Workplane:
    """Create a box with rounded vertical corners and its bottom on Z=0."""
    return (
        cq.Workplane("XY")
        .box(length, width, height, centered=(True, True, False))
        .edges("|Z")
        .fillet(radius)
    )


def build_frame() -> cq.Workplane:
    outer = rounded_box(
        BOARD_LENGTH,
        BOARD_WIDTH,
        FRAME_THICKNESS,
        FRAME_CORNER_RADIUS,
    )
    inner = rounded_box(
        BOARD_LENGTH - 2 * FRAME_BORDER,
        BOARD_WIDTH - 2 * FRAME_BORDER,
        FRAME_THICKNESS + 1.0,
        max(FRAME_CORNER_RADIUS - FRAME_BORDER / 2, 1.0),
    ).translate((0, 0, -0.5))

    frame = outer.cut(inner)

    # Low ribs keep the gauge square. The motherboard sits above them on
    # 5 mm corner pads, leaving 3 mm of clearance for underside solder joints.
    horizontal_rib = cq.Workplane("XY").box(
        BOARD_LENGTH - 2 * FRAME_BORDER,
        CROSS_RIB_WIDTH,
        FRAME_THICKNESS,
        centered=(True, True, False),
    )
    vertical_rib = cq.Workplane("XY").box(
        CROSS_RIB_WIDTH,
        BOARD_WIDTH - 2 * FRAME_BORDER,
        FRAME_THICKNESS,
        centered=(True, True, False),
    )
    frame = frame.union(horizontal_rib).union(vertical_rib)

    hole_centres = [
        (-HOLE_PITCH_X / 2, -HOLE_PITCH_Y / 2),
        (HOLE_PITCH_X / 2, -HOLE_PITCH_Y / 2),
        (-HOLE_PITCH_X / 2, HOLE_PITCH_Y / 2),
        (HOLE_PITCH_X / 2, HOLE_PITCH_Y / 2),
    ]

    for x, y in hole_centres:
        pad = (
            cq.Workplane("XY")
            .center(x, y)
            .circle(STANDOFF_DIAMETER / 2)
            .extrude(STANDOFF_HEIGHT)
        )
        clearance_hole = (
            cq.Workplane("XY")
            .workplane(offset=-0.5)
            .center(x, y)
            .circle(M3_CLEARANCE_DIAMETER / 2)
            .extrude(STANDOFF_HEIGHT + 1.0)
        )
        frame = frame.union(pad).cut(clearance_hole)

    return frame.clean()


def main() -> None:
    output_dir = Path(__file__).resolve().parent / "output"
    output_dir.mkdir(parents=True, exist_ok=True)

    model = build_frame()
    exporters.export(
        model,
        str(output_dir / "octopus_mount_test_frame.stl"),
        tolerance=0.02,
        angularTolerance=0.1,
    )
    exporters.export(
        model,
        str(output_dir / "octopus_mount_test_frame.step"),
    )

    bounds = model.val().BoundingBox()
    print(
        "Generated test frame: "
        f"{bounds.xlen:.2f} x {bounds.ylen:.2f} x {bounds.zlen:.2f} mm"
    )


if __name__ == "__main__":
    main()
