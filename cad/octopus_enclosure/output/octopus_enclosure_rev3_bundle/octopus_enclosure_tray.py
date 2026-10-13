"""Generate the Rev3 split Octopus Pro enclosure tray and flush fan lid.

The enclosure is designed around:
- BTT Octopus Pro V1.1: 160 x 100 mm
- Mounting pattern: 150 x 90 mm
- PAROL6 stock electronics-case height: 59.8 mm
- FlashForge Adventurer 5M build area: 220 x 220 mm
- M3 assembly hardware

Coordinate system:
- X: enclosure width
- Y: outward USB end (0) toward PAROL6 base (positive)
- Z: enclosure height
"""

from pathlib import Path

import cadquery as cq
from cadquery import exporters


# Overall printable tray envelope.
# Rev3 is wider than the board so the tall side walls do not crowd the
# vertical edge connectors. 126 x 206 mm still fits the Adventurer 5M bed.
TRAY_WIDTH = 126.0
TRAY_LENGTH = 206.0
WALL = 3.2
FLOOR = 3.2
ASSEMBLED_HEIGHT = 59.8
LID_THICKNESS = 3.0
TRAY_HEIGHT = ASSEMBLED_HEIGHT - LID_THICKNESS

# Board geometry and location.
BOARD_WIDTH = 100.0
BOARD_LENGTH = 160.0
BOARD_X = (TRAY_WIDTH - BOARD_WIDTH) / 2
BOARD_Y = 8.0
HOLE_PITCH_X = 90.0
HOLE_PITCH_Y = 150.0

STANDOFF_DIAMETER = 8.0
STANDOFF_HEIGHT = 6.0
M3_PILOT_DIAMETER = 2.8
M3_CLEARANCE_DIAMETER = 3.4

# The board ends at Y=168, leaving 35 mm to the inside of the seam wall.
POWER_WIRING_CLEARANCE = TRAY_LENGTH - WALL - (BOARD_Y + BOARD_LENGTH)

# Dedicated panel openings copied from the functional cutouts in the official
# Electronics_case_v1_1.STL. Diameters include its approximately 0.2 mm fit
# allowance for nominal 12 mm and GX16-class panel components.
POWER_CONNECTOR_DIAMETER = 15.6
POWER_BUTTON_DIAMETER = 12.2
PNEUMATIC_DIAMETER = 12.2
PANEL_CENTER_Y = 184.0
LOWER_PANEL_CENTER_Z = 19.0
UPPER_PANEL_CENTER_Z = 41.0

# One continuous rectangular service opening faces outward with the board's
# USB/microSD edge.
SERVICE_WINDOW_X = 42.0
SERVICE_WINDOW_WIDTH = 77.0
SERVICE_WINDOW_HEIGHT = 18.0
SERVICE_WINDOW_BOTTOM = 7.0

# Narrow, vertical ventilation slots on both long walls.
VENT_SLOT_CENTERS_Y = (78.0, 88.0, 98.0, 108.0, 118.0, 128.0)
VENT_SLOT_WIDTH = 3.6
VENT_SLOT_BOTTOM = 14.0
VENT_SLOT_HEIGHT = 25.0

# Interface-adapter fasteners. The adapter is centred under the tray.
ADAPTER_X_OFFSET = (TRAY_WIDTH - 109.0) / 2
ADAPTER_HOLE_X = (8.0 + ADAPTER_X_OFFSET, 101.0 + ADAPTER_X_OFFSET)
ADAPTER_HOLE_Z = (14.0, 44.0)
SEAM_POST_WIDTH = 13.0

# Lid and fan.
LID_SKIRT_HEIGHT = 15.0
LID_SKIRT_THICKNESS = 4.0
LID_FIT_CLEARANCE = 0.35

FAN_SIZE = 40.0
FAN_OPENING_DIAMETER = 38.0
FAN_HOLE_PITCH = 32.0
FAN_CENTER_X = BOARD_X + 82.0
FAN_CENTER_Y = 95.0
FAN_GUARD_SIZE = 46.0
FAN_GUARD_THICKNESS = 2.4

# Four horizontal M3 screws retain the lid, one pair at each end.
LID_SCREW_Y = (22.0, 171.5)
LID_SCREW_Z = 51.0
LID_SCREW_PRINT_Z = LID_THICKNESS + (TRAY_HEIGHT - LID_SCREW_Z)


def box(
    x: float,
    y: float,
    z: float,
    origin: tuple[float, float, float] = (0, 0, 0),
) -> cq.Workplane:
    return (
        cq.Workplane("XY", origin=origin)
        .box(x, y, z, centered=(False, False, False))
    )


def axis_y_hole(
    x: float,
    y_start: float,
    z: float,
    diameter: float,
    length: float,
) -> cq.Workplane:
    # XZ has a -Y normal, so a positive extrusion moves toward decreasing Y.
    return (
        cq.Workplane("XZ", origin=(0, y_start, 0))
        .center(x, z)
        .circle(diameter / 2)
        .extrude(length)
    )


def axis_x_cylinder(
    x_start: float,
    y: float,
    z: float,
    diameter: float,
    length: float,
) -> cq.Workplane:
    return (
        cq.Workplane("YZ", origin=(x_start, 0, 0))
        .center(y, z)
        .circle(diameter / 2)
        .extrude(length)
    )


def build_tray() -> cq.Workplane:
    # Floor and full-height, enclosed side walls.
    body = box(TRAY_WIDTH, TRAY_LENGTH, FLOOR)
    body = body.union(box(WALL, TRAY_LENGTH, TRAY_HEIGHT))
    body = body.union(
        box(
            WALL,
            TRAY_LENGTH,
            TRAY_HEIGHT,
            (TRAY_WIDTH - WALL, 0, 0),
        )
    )

    # Full-height outward USB wall.
    body = body.union(box(TRAY_WIDTH, WALL, TRAY_HEIGHT))

    # U-shaped seam wall: a low cross rail plus wide side posts. The centre
    # stays open for power and robot wiring.
    body = body.union(
        box(
            TRAY_WIDTH,
            WALL,
            10.0,
            (0, TRAY_LENGTH - WALL, 0),
        )
    )
    body = body.union(
        box(
            SEAM_POST_WIDTH,
            WALL,
            TRAY_HEIGHT,
            (0, TRAY_LENGTH - WALL, 0),
        )
    )
    body = body.union(
        box(
            SEAM_POST_WIDTH,
            WALL,
            TRAY_HEIGHT,
            (TRAY_WIDTH - SEAM_POST_WIDTH, TRAY_LENGTH - WALL, 0),
        )
    )

    # One continuous outward service opening for the USB and microSD edge.
    body = body.cut(
        box(
            SERVICE_WINDOW_WIDTH,
            WALL + 2.0,
            SERVICE_WINDOW_HEIGHT,
            (
                SERVICE_WINDOW_X,
                -1.0,
                SERVICE_WINDOW_BOTTOM,
            ),
        )
    )

    # Matching "jail-bar" ventilation slots on both long walls.
    for y in VENT_SLOT_CENTERS_Y:
        slot_left = box(
            WALL + 2.0,
            VENT_SLOT_WIDTH,
            VENT_SLOT_HEIGHT,
            (
                -1.0,
                y - VENT_SLOT_WIDTH / 2,
                VENT_SLOT_BOTTOM,
            ),
        )
        slot_right = box(
            WALL + 2.0,
            VENT_SLOT_WIDTH,
            VENT_SLOT_HEIGHT,
            (
                TRAY_WIDTH - WALL - 1.0,
                y - VENT_SLOT_WIDTH / 2,
                VENT_SLOT_BOTTOM,
            ),
        )
        body = body.cut(slot_left).cut(slot_right)

    # Dedicated left-side power panel. These reproduce the stock case's
    # nominal GX16 and 12 mm illuminated-button cutout sizes.
    body = body.cut(
        axis_x_cylinder(
            -1.0,
            PANEL_CENTER_Y,
            LOWER_PANEL_CENTER_Z,
            POWER_CONNECTOR_DIAMETER,
            WALL + 2.0,
        )
    )
    body = body.cut(
        axis_x_cylinder(
            -1.0,
            PANEL_CENTER_Y,
            UPPER_PANEL_CENTER_Z,
            POWER_BUTTON_DIAMETER,
            WALL + 2.0,
        )
    )

    # Dedicated right-side pneumatic panel, safely within the wiring bay and
    # clear of the Octopus board and base-interface screws.
    for z in (LOWER_PANEL_CENTER_Z, UPPER_PANEL_CENTER_Z):
        body = body.cut(
            axis_x_cylinder(
                TRAY_WIDTH + 1.0,
                PANEL_CENTER_Y,
                z,
                PNEUMATIC_DIAMETER,
                -(WALL + 2.0),
            )
        )

    # Four board standoffs.
    board_holes = [
        (BOARD_X + 5.0, BOARD_Y + 5.0),
        (BOARD_X + 5.0 + HOLE_PITCH_X, BOARD_Y + 5.0),
        (BOARD_X + 5.0, BOARD_Y + 5.0 + HOLE_PITCH_Y),
        (
            BOARD_X + 5.0 + HOLE_PITCH_X,
            BOARD_Y + 5.0 + HOLE_PITCH_Y,
        ),
    ]
    for x, y in board_holes:
        standoff = (
            cq.Workplane("XY", origin=(0, 0, FLOOR))
            .center(x, y)
            .circle(STANDOFF_DIAMETER / 2)
            .extrude(STANDOFF_HEIGHT)
        )
        pilot = (
            cq.Workplane("XY", origin=(0, 0, FLOOR - 0.2))
            .center(x, y)
            .circle(M3_PILOT_DIAMETER / 2)
            .extrude(STANDOFF_HEIGHT + 0.4)
        )
        body = body.union(standoff).cut(pilot)

    # Four M3 clearance holes join the tray to the exact PAROL6 adapter.
    for x in ADAPTER_HOLE_X:
        for z in ADAPTER_HOLE_Z:
            body = body.cut(
                axis_y_hole(
                    x,
                    TRAY_LENGTH + 1.0,
                    z,
                    M3_CLEARANCE_DIAMETER,
                    WALL + 2.0,
                )
            )

    # Four simple M3 clearance holes pass only through the enclosure walls.
    # The matching thread-forming pilots are in the lid's thicker skirts, so
    # no cylindrical bosses protrude into the enclosure.
    for y in LID_SCREW_Y:
        body = body.cut(
            axis_x_cylinder(
                -1.0,
                y,
                LID_SCREW_Z,
                M3_CLEARANCE_DIAMETER,
                WALL + 2.0,
            )
        )
        body = body.cut(
            axis_x_cylinder(
                TRAY_WIDTH + 1.0,
                y,
                LID_SCREW_Z,
                M3_CLEARANCE_DIAMETER,
                -(WALL + 2.0),
            )
        )

    return body.clean()


def build_lid() -> cq.Workplane:
    # The lid exports in its print orientation: broad top face on Z=0 and
    # retention skirts growing upward, so no support material is required.
    lid = box(TRAY_WIDTH, TRAY_LENGTH, LID_THICKNESS)

    skirt_offset = WALL + LID_FIT_CLEARANCE
    left_x = skirt_offset
    right_x = TRAY_WIDTH - skirt_offset - LID_SKIRT_THICKNESS
    front_y = skirt_offset
    rear_y = TRAY_LENGTH - skirt_offset - LID_SKIRT_THICKNESS

    side_length = TRAY_LENGTH - 2 * skirt_offset
    end_width = TRAY_WIDTH - 2 * (
        skirt_offset + LID_SKIRT_THICKNESS
    )

    lid = lid.union(
        box(
            LID_SKIRT_THICKNESS,
            side_length,
            LID_SKIRT_HEIGHT,
            (left_x, front_y, LID_THICKNESS),
        )
    )
    lid = lid.union(
        box(
            LID_SKIRT_THICKNESS,
            side_length,
            LID_SKIRT_HEIGHT,
            (right_x, front_y, LID_THICKNESS),
        )
    )
    lid = lid.union(
        box(
            end_width,
            LID_SKIRT_THICKNESS,
            LID_SKIRT_HEIGHT,
            (
                skirt_offset + LID_SKIRT_THICKNESS,
                front_y,
                LID_THICKNESS,
            ),
        )
    )
    lid = lid.union(
        box(
            end_width,
            LID_SKIRT_THICKNESS,
            LID_SKIRT_HEIGHT,
            (
                skirt_offset + LID_SKIRT_THICKNESS,
                rear_y,
                LID_THICKNESS,
            ),
        )
    )

    # Standard 40 mm fan mount above the driver row.
    fan_opening = (
        cq.Workplane("XY", origin=(0, 0, -0.5))
        .center(FAN_CENTER_X, FAN_CENTER_Y)
        .circle(FAN_OPENING_DIAMETER / 2)
        .extrude(LID_THICKNESS + 1.0)
    )
    lid = lid.cut(fan_opening)

    # Flush integral grille: the fan mounts beneath the lid, and these bars
    # stay entirely within the 3 mm lid thickness and 59.8 mm envelope.
    for offset in (-12.0, -6.0, 0.0, 6.0, 12.0):
        lid = lid.union(
            box(
                FAN_OPENING_DIAMETER,
                2.4,
                LID_THICKNESS,
                (
                    FAN_CENTER_X - FAN_OPENING_DIAMETER / 2,
                    FAN_CENTER_Y + offset - 1.2,
                    0,
                ),
            )
        )

    for dx in (-FAN_HOLE_PITCH / 2, FAN_HOLE_PITCH / 2):
        for dy in (-FAN_HOLE_PITCH / 2, FAN_HOLE_PITCH / 2):
            fan_screw = (
                cq.Workplane("XY", origin=(0, 0, -0.5))
                .center(FAN_CENTER_X + dx, FAN_CENTER_Y + dy)
                .circle(M3_CLEARANCE_DIAMETER / 2)
                .extrude(LID_THICKNESS + 1.0)
            )
            lid = lid.cut(fan_screw)

    # Four 2.8 mm thread-forming pilots align with the wall clearance holes.
    for y in LID_SCREW_Y:
        lid = lid.cut(
            axis_x_cylinder(
                left_x - 1.0,
                y,
                LID_SCREW_PRINT_Z,
                M3_PILOT_DIAMETER,
                LID_SKIRT_THICKNESS + 2.0,
            )
        )
        lid = lid.cut(
            axis_x_cylinder(
                right_x + LID_SKIRT_THICKNESS + 1.0,
                y,
                LID_SCREW_PRINT_Z,
                M3_PILOT_DIAMETER,
                -(LID_SKIRT_THICKNESS + 2.0),
            )
        )

    return lid.clean()


def build_fan_guard() -> cq.Workplane:
    guard = box(
        FAN_GUARD_SIZE,
        FAN_GUARD_SIZE,
        FAN_GUARD_THICKNESS,
    )
    opening = (
        cq.Workplane("XY", origin=(0, 0, -0.5))
        .center(FAN_GUARD_SIZE / 2, FAN_GUARD_SIZE / 2)
        .circle(FAN_OPENING_DIAMETER / 2)
        .extrude(FAN_GUARD_THICKNESS + 1.0)
    )
    guard = guard.cut(opening)

    # Five low-profile bars protect the fan while keeping the guard
    # support-free in its flat print orientation.
    for offset in (-12.0, -6.0, 0.0, 6.0, 12.0):
        guard = guard.union(
            box(
                FAN_OPENING_DIAMETER,
                2.4,
                FAN_GUARD_THICKNESS,
                (
                    (FAN_GUARD_SIZE - FAN_OPENING_DIAMETER) / 2,
                    FAN_GUARD_SIZE / 2 + offset - 1.2,
                    0,
                ),
            )
        )

    for dx in (-FAN_HOLE_PITCH / 2, FAN_HOLE_PITCH / 2):
        for dy in (-FAN_HOLE_PITCH / 2, FAN_HOLE_PITCH / 2):
            screw = (
                cq.Workplane("XY", origin=(0, 0, -0.5))
                .center(
                    FAN_GUARD_SIZE / 2 + dx,
                    FAN_GUARD_SIZE / 2 + dy,
                )
                .circle(M3_CLEARANCE_DIAMETER / 2)
                .extrude(FAN_GUARD_THICKNESS + 1.0)
            )
            guard = guard.cut(screw)

    return guard.clean()


def build_component_fit_coupon() -> cq.Workplane:
    """Small flat coupon for checking the four original panel components."""
    coupon_width = 72.0
    coupon_height = 32.0
    coupon = box(coupon_width, coupon_height, WALL)

    hole_specs = (
        (11.0, POWER_CONNECTOR_DIAMETER),
        (29.0, POWER_BUTTON_DIAMETER),
        (47.0, PNEUMATIC_DIAMETER),
        (63.0, PNEUMATIC_DIAMETER),
    )
    for x, diameter in hole_specs:
        hole = (
            cq.Workplane("XY", origin=(0, 0, -0.5))
            .center(x, coupon_height / 2)
            .circle(diameter / 2)
            .extrude(WALL + 1.0)
        )
        coupon = coupon.cut(hole)

    return coupon.clean()


def export_model(model: cq.Workplane, stem: str, output_dir: Path) -> None:
    exporters.export(
        model,
        str(output_dir / f"{stem}.stl"),
        tolerance=0.02,
        angularTolerance=0.1,
    )
    exporters.export(model, str(output_dir / f"{stem}.step"))


def main() -> None:
    output_dir = Path(__file__).resolve().parent / "output"
    output_dir.mkdir(parents=True, exist_ok=True)

    tray = build_tray()
    lid = build_lid()
    component_coupon = build_component_fit_coupon()
    export_model(tray, "octopus_enclosure_tray_rev3", output_dir)
    export_model(lid, "octopus_enclosure_fan_lid_rev3", output_dir)
    export_model(
        component_coupon,
        "octopus_component_fit_coupon_rev3",
        output_dir,
    )

    tray_bounds = tray.val().BoundingBox()
    lid_bounds = lid.val().BoundingBox()
    coupon_bounds = component_coupon.val().BoundingBox()
    print(
        "Generated tray: "
        f"{tray_bounds.xlen:.2f} x {tray_bounds.ylen:.2f} "
        f"x {tray_bounds.zlen:.2f} mm"
    )
    print(
        "Generated lid: "
        f"{lid_bounds.xlen:.2f} x {lid_bounds.ylen:.2f} "
        f"x {lid_bounds.zlen:.2f} mm"
    )
    print(
        "Generated component fit coupon: "
        f"{coupon_bounds.xlen:.2f} x {coupon_bounds.ylen:.2f} "
        f"x {coupon_bounds.zlen:.2f} mm"
    )
    print(f"Power-wiring clearance: {POWER_WIRING_CLEARANCE:.2f} mm")
    print(f"Assembled tray + lid height: {ASSEMBLED_HEIGHT:.2f} mm")


if __name__ == "__main__":
    main()
