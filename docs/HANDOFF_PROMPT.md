# Handoff Prompt

Paste this into a new chat when you want another assistant to get oriented on ROBARM.

```text
I am working on ROBARM, a personal desktop robot-arm build project. Please read and use the repository as the source of truth before giving advice or making changes.

Repository: https://github.com/AdamMuzzo/ROBARM

Start by reviewing these files in order:

1. README.md - project overview, simulator commands, and current direction.
2. docs/DECISIONS.md - decisions already made and why.
3. docs/BOM.md - current parts list, purchase links, and CAD cost ranges. Filament cost is intentionally excluded because I already have filament.
4. docs/ELECTRONICS.md - controller architecture, Arduino Uno limitation, PAROL6 control board tradeoff, and the BTT Octopus Pro workaround.
5. docs/PRINTING_AND_CAD.md - PAROL6 STL/CAD links, print folders, Flashforge Adventurer 5 fit notes, and material notes.
6. docs/END_EFFECTORS.md - detachable wrist tool plan for claw, pen holder, vacuum pickup, camera mount, and future tools.
7. docs/ASSEMBLY_ROADMAP.md - staged build plan from print tests to full six-axis bring-up.
8. docs/TOOLS.md - bench tools and consumables needed.
9. docs/DIAGRAMS.md - Mermaid diagrams for system architecture, electrical blocks, dependencies, and tool changer concept.

Important context:

- The mechanical target is the PAROL6 desktop robot arm.
- I like the PAROL6 look and want to keep this project visually closer to a clean industrial desktop arm than a chunky academic-style arm.
- I have a Flashforge Adventurer 5 class printer, likely with a 220 x 220 x 220 mm build volume.
- I have plenty of filament, so do not include estimated filament cost unless I explicitly ask.
- I have an Arduino Uno-compatible board, but it is not intended to be the main full-arm controller. It can be used for small learning tests only.
- The main software/control architecture should be: computer program -> USB -> robot controller board -> stepper drivers/motors/sensors -> robot arm.
- The official PAROL6 control board is expensive, so the current preferred experiment is a BIGTREETECH Octopus Pro with TMC5160 drivers.
- The repo includes a React + Three.js simulator in src/ for planning motion, assemblies, electronics, and part layout.
- A key original design goal is a detachable end-effector interface so the arm can use a claw, pen holder, vacuum pickup, camera mount, and other tools.

When helping me:

- Keep recommendations practical for a DIY build.
- Prefer staged purchasing and staged testing over buying everything at once.
- Be honest about integration risk, especially around the controller workaround.
- If you suggest parts, include links and prices in Canadian dollars when possible.
- If you change code, run npm run build.
- If you change simulator rendering behavior, run the smoke test against a local Vite server.
- Preserve the existing repo structure unless there is a clear reason to change it.
```
