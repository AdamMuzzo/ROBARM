"""Render the Rev10 straight adapter cover and shortened main lid skirts."""

from pathlib import Path

import vtk


ROOT = Path(__file__).resolve().parent
OUTPUT = ROOT / "output"


def stl_actor(
    path: Path,
    color: tuple[float, float, float],
    matrix: list[list[float]] | None = None,
) -> vtk.vtkActor:
    reader = vtk.vtkSTLReader()
    reader.SetFileName(str(path))
    reader.Update()

    mapper = vtk.vtkPolyDataMapper()
    mapper.SetInputConnection(reader.GetOutputPort())

    actor = vtk.vtkActor()
    actor.SetMapper(mapper)
    actor.GetProperty().SetColor(*color)
    actor.GetProperty().SetInterpolationToPBR()
    actor.GetProperty().SetMetallic(0.04)
    actor.GetProperty().SetRoughness(0.62)

    if matrix is not None:
        vtk_matrix = vtk.vtkMatrix4x4()
        for row in range(4):
            for column in range(4):
                vtk_matrix.SetElement(row, column, matrix[row][column])
        actor.SetUserMatrix(vtk_matrix)

    return actor


def add_label(
    renderer: vtk.vtkRenderer,
    text: str,
    x: int,
    y: int,
    size: int = 25,
) -> None:
    label = vtk.vtkTextActor()
    label.SetInput(text)
    label.SetPosition(x, y)
    label.GetTextProperty().SetFontSize(size)
    label.GetTextProperty().SetColor(0.10, 0.12, 0.16)
    renderer.AddViewProp(label)


def configure_renderer(
    render_window: vtk.vtkRenderWindow,
    viewport: tuple[float, float, float, float],
) -> vtk.vtkRenderer:
    renderer = vtk.vtkRenderer()
    renderer.SetViewport(*viewport)
    renderer.SetBackground(0.94, 0.95, 0.97)
    renderer.SetBackground2(0.82, 0.86, 0.90)
    renderer.GradientBackgroundOn()
    render_window.AddRenderer(renderer)

    light = vtk.vtkLight()
    light.SetLightTypeToCameraLight()
    light.SetIntensity(1.2)
    renderer.AddLight(light)
    return renderer


def add_assembly(
    renderer: vtk.vtkRenderer,
    lid_explosion: float,
) -> None:
    tray = OUTPUT / "octopus_enclosure_tray_rev6.stl"
    tray_lid = OUTPUT / "octopus_enclosure_fan_lid_rev9.stl"
    adapter = OUTPUT / "parol6_octopus_interface_adapter_rev10.stl"
    adapter_lid = (
        OUTPUT / "parol6_octopus_interface_adapter_lid_rev10.stl"
    )

    renderer.AddActor(stl_actor(tray, (0.18, 0.39, 0.55)))
    renderer.AddActor(
        stl_actor(
            tray_lid,
            (0.46, 0.70, 0.84),
            [
                [1, 0, 0, 0],
                [0, 1, 0, 0],
                [0, 0, -1, 59.8 + lid_explosion],
                [0, 0, 0, 1],
            ],
        )
    )
    renderer.AddActor(
        stl_actor(
            adapter,
            (0.18, 0.57, 0.35),
            [
                [1, 0, 0, 0],
                [0, 1, 0, 206],
                [0, 0, 1, 0],
                [0, 0, 0, 1],
            ],
        )
    )
    renderer.AddActor(
        stl_actor(
            adapter_lid,
            (0.95, 0.58, 0.12),
            [
                [1, 0, 0, 0.30],
                [0, 1, 0, 206.30],
                [0, 0, -1, 59.8 + lid_explosion],
                [0, 0, 0, 1],
            ],
        )
    )


def main() -> None:
    render_window = vtk.vtkRenderWindow()
    render_window.SetOffScreenRendering(True)
    render_window.SetSize(1800, 1100)
    render_window.SetMultiSamples(8)

    full = configure_renderer(render_window, (0.0, 0.0, 0.62, 1.0))
    add_assembly(full, lid_explosion=10.0)
    full_camera = full.GetActiveCamera()
    full_camera.SetPosition(-285, -250, 235)
    full_camera.SetFocalPoint(63, 128, 26)
    full_camera.SetViewUp(0, 0, 1)
    full_camera.SetViewAngle(28)
    add_label(full, "REV10 ASSEMBLY", 25, 1045, 30)
    add_label(
        full,
        "Straight stepped adapter cover | 0.30 mm base-edge clearance",
        25,
        1008,
        21,
    )

    detail = configure_renderer(render_window, (0.62, 0.50, 1.0, 1.0))
    add_assembly(detail, lid_explosion=11.0)
    detail_camera = detail.GetActiveCamera()
    detail_camera.SetPosition(-175, 335, 130)
    detail_camera.SetFocalPoint(63, 229, 34)
    detail_camera.SetViewUp(0, 0, 1)
    detail_camera.SetViewAngle(24)
    add_label(detail, "ADAPTER + FLUSH LID", 1140, 1045, 27)

    seam = configure_renderer(render_window, (0.62, 0.0, 1.0, 0.50))
    add_assembly(seam, lid_explosion=0.0)
    seam_camera = seam.GetActiveCamera()
    seam_camera.SetPosition(-270, 206, 55)
    seam_camera.SetFocalPoint(63, 206, 29.9)
    seam_camera.SetViewUp(0, 0, 1)
    seam_camera.ParallelProjectionOn()
    seam_camera.SetParallelScale(76)
    add_label(seam, "FLAT-SURFACE SEAM ALIGNMENT", 1140, 495, 24)
    add_label(
        seam,
        "4 holes: X 16.5 / 109.5, Z 14 / 44 mm",
        1140,
        462,
        19,
    )

    render_window.Render()
    image = vtk.vtkWindowToImageFilter()
    image.SetInput(render_window)
    image.Update()

    output_path = OUTPUT / "octopus_enclosure_rev10_preview.png"
    writer = vtk.vtkPNGWriter()
    writer.SetFileName(str(output_path))
    writer.SetInputConnection(image.GetOutputPort())
    writer.Write()
    print(f"Rendered {output_path}")


if __name__ == "__main__":
    main()
