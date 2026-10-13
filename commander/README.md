# ROBARM Commander

ROBARM Commander is the standalone, safety-first desktop control environment
for the custom PAROL6-based ROBARM using the BIGTREETECH Octopus Pro V1.1 H723
controller and TMC5160T Pro drivers.

It is a new Electron + React + Three.js application. The legacy PAROL Commander
is used only as a protocol and kinematics reference; its UI and process model
are not reused.

## Current capabilities

- COM-port discovery through the desktop serial service
- Exact ROBARM firmware identity and configuration checks
- Fixed-layout Commander protocol encoder/decoder with mixed ASCII/binary parser
- Central fail-closed safety policy for every motion producer
- 40 ms heartbeat, 120 ms host telemetry freshness limit, and stale-data Disable
- Explicit simulation/real target isolation with no “both” mode
- Mouse press-and-hold dead-man jog with host-side acceleration ramp, release,
  blur, and visibility revocation
- Live labeled Xbox controller workbench using MIT-licensed open-source Xbox
  artwork, raw button/axis feedback, and click-to-assign controls
- Fully assignable synchronized multi-joint axes, buttons, and analog triggers,
  including direction, dead zones, curves, speed, dead-man, Disable, and chord
- Modular hand-provider contract and disabled-by-default configuration
- Integrated URDF-derived PAROL6 3D simulator with limit, sensor, floor, and
  approximate non-adjacent collision visualization
- Validated and saveable read-only query shortcuts, bounded maintenance workflow,
  raw packets, decoded status, filtered logs, and JSONL export
- Versioned command programs with target, moves, delays, notes, loops, dry run,
  step, pause/resume, stop, import/export, and per-step safety validation
- Guarded J2 → J3 → J4 startup calibration with bounded sensor seeks, absolute
  references, configured home positions, progress telemetry, and calibrated hold
- Octopus Pro FAN0 cooling defaults on at board startup and can be explicitly
  switched on/off from Commander with reported state
- Vitals for state, E-stop, telemetry, packets, joints, sensors, drivers,
  prerequisites, watchdog, and holding-joint state
- Reversible calibration profiles and finite J1-J4 HOME_TEST workflows; J5/J6
  are explicitly unavailable/non-homing
- Dataset recording, labeling, playback, splits, model metadata/versioning, and
  simulation-first deployment gates
- Mock-firmware integration tests that never touch physical hardware

## Start in development

```powershell
cd "A:\WaypointRoot\Personal\Projects\ROBARM\commander"
npm install
npm run dev
```

Or double-click `Start_ROBARM_Commander.cmd`.

The app always starts disconnected, in Simulation, with both the simulation and
real robot disabled.

## Verify

```powershell
npm test
npm run build
npm run test:visual
```

The visual test expects the Vite renderer on `http://127.0.0.1:5174`. Start it
with `npm run dev:web` before running that one test directly.

## Package for Windows

```powershell
npm run package
```

The NSIS installer is written to
`release/ROBARM Commander Setup 0.4.1.exe`. The packaged application includes
the Electron-compatible N-API serial binding and is verified with a packaged
desktop smoke test. This local build is not code-signed, so Windows may display
an unknown-publisher warning.

## Architecture and safety evidence

- [Protocol audit](docs/PROTOCOL_AUDIT.md)
- [Architecture](docs/ARCHITECTURE.md)
- [User guide](docs/USER_GUIDE.md)

## Important limitations

- Legacy binary Home command 100 is not offered. Startup calibration is the
  supported automated reference path; finite maintenance HOME_TEST is separate.
- Cartesian jog is visible but safety-blocked until its IK, singularity, and
  collision behavior is verified against this hardware.
- Firmware does not currently report motor temperatures, live motor currents,
  board uptime, or packet counters. The UI says “not reported”.
- Runtime current/microstep adjustment is not exposed because firmware has no
  reversible command for it.
- MediaPipe/OpenXR and camera providers are plugin contracts, not bundled fake
  implementations.
- Physical hardware motion has not been exercised by the automated suite.
- Configuration 6 reverses J1, J2, J3, J4, and J6 command signs. Configuration
  5 position programs are rejected because their coordinates mean the opposite
  motion; recreate them after verifying each corrected direction at low speed.
