# ROBARM Commander architecture

## Design objective

ROBARM Commander is a standalone Windows desktop control environment for the
custom PAROL6 arm. It starts disconnected, defaults to simulation, and treats a
serial connection as untrusted until identity, status, E-stop feedback, and
telemetry freshness are all verified.

The application is organized around a single rule: every request capable of
changing physical behavior must pass through the same safety gateway immediately
before it reaches the real transport.

## Runtime layers

```text
React UI / input plugins / program runner
                 |
           Command intents
                 v
        Motion lease + safety gateway
          |                     |
 simulation command bus     real command bus
          |                     |
 integrated simulator       protocol encoder
                                |
                       serialized transport queue
                                |
                     Electron serial-port service
                                |
                         ROBARM firmware
```

### Desktop boundary

Electron owns operating-system serial access, application lifecycle, file
dialogs, and safe renderer IPC. The renderer has no Node.js access. The preload
bridge exposes a deliberately narrow, typed API for port discovery, open/close,
write, and received-byte events.

### Core domain

- `protocol`: binary frame encoding/decoding, ASCII reply parsing, signed
  24-bit conversion, and identity validation
- `transport`: abstract transport plus Electron and deterministic mock adapters
- `telemetry`: validated snapshots, age, communication statistics, and raw data
- `safety`: pure policy evaluation, state derivation, rejection reasons, and
  motion-lease revocation
- `motion`: bounded joint intents, host speed/acceleration scaling, and dead-man
  semantics; Cartesian intents remain safety-blocked
- `hardware`: one audited joint/motor/sensor/limit model shared by real-command
  validation and simulation
- `programs`: schema-validated program files and a stoppable execution engine,
  including a non-looping, confirmation-gated startup calibration step
- `logging`: append-only structured events and export

### Feature modules

- Robot control and mouse dead-man jogging
- Controller discovery, profiles, mappings, chords, and loss detection
- Optional hand-control provider interface with explicit dead-man support
- Read-only command console and separately guarded maintenance console
- Program editor, dry-run, step, pause/resume/stop, loop, import/export
- Integrated Three.js simulator using the checked-in PAROL6 URDF meshes
- Vitals and driver/sensor diagnostics
- Calibration profiles and bounded commissioning workflows
- Dataset recorder and model registry with simulation-only deployment by default
- Settings, mappings, limits, transport, logging, and workspace management

## Safety policy

### Real-target prerequisites

Every physical motion command requires all of the following at dispatch time:

1. target is explicitly `real`;
2. a port is open and the transport has not reported an error;
3. the exact ROBARM identity tuple and status identity are compatible;
4. the most recent validated telemetry is inside the configured freshness
   limit;
5. firmware state is `enabled`;
6. firmware reports mapping and motion prerequisites true;
7. full motion is advertised true;
8. E-stop is configured and currently safe;
9. no fault or watchdog timeout is reported;
10. target positions, speeds, and affected joints are within application bounds;
11. continuous motion has a live dead-man lease from the active input source.

If any gate fails, the command is replaced by no motion, the lease is revoked,
and a structured `safety.blocked` event records every failing gate. Dangerous
values are rejected rather than silently clamped.

### Commands that remain available

- Disable/Stop is always allowed to the currently open real transport.
- Read-only queries are allowed whenever the transport is open.
- Enable requires compatible fresh telemetry, ready/disabled state, complete
  prerequisites, and explicit confirmation.
- Clear Fault requires compatible fresh telemetry, firmware fault state, and
  explicit confirmation.
- Commissioning commands use a separate maintenance policy and never inherit an
  ordinary jog lease.
- Startup calibration uses its own safety intent before normal motion
  prerequisites are complete. It requires compatible fresh telemetry, safe
  E-stop/driver power, disabled outputs, exact typed confirmation, and firmware
  configuration 5. Completion permits explicit Enable; Disable invalidates it.

### Motion lease

Continuous mouse, controller, and hand inputs receive short-lived leases.
Leases are renewed only while the source remains present and its configured
dead-man condition is true. Release, cancel, focus loss, page visibility loss,
controller disconnect, tracking timeout, transport change, target change, or a
failed safety gate immediately emits a zero-speed/Dummy intent and revokes the
lease.

### Simulation isolation

Simulation is the initial and default target. Selecting the real robot requires
an explicit mode change after compatibility verification. Simulation commands
are delivered only to in-memory state. The real bus accepts intents only when
the target field is exactly `real`; there is no mirroring or “both” mode.

## Persistence formats

All user-authored files are JSON with a `schemaVersion`, stable identifiers,
creation/update timestamps, and an explicit target (`simulation` or `real`).

- `.robarm-program.json`: schema-2 program metadata and typed steps; schema 1
  is rejected after the configuration-6 coordinate-sign reversal
- `.robarm-controller.json`: controller mapping profile
- `.robarm-calibration.json`: per-joint calibration profile
- `.robarm-dataset.json`: dataset manifest pointing to recorded samples/assets
- `.robarm-model.json`: model metadata, lineage, evaluation, and deployment state
- `.robarm-log.jsonl`: append-only event export

Importers validate the complete document before changing application state.
Unknown schema versions fail closed and remain viewable as raw text.

## UI composition

The shell keeps three safety facts visible on every screen:

- active target: SIMULATION or REAL ROBOT;
- connection/identity/telemetry state;
- prominent software Stop.

Primary workspaces are Control, Simulator, Programs, Commands, Vitals,
Calibration, Inputs, Learning, and Settings. Destructive or physical-state
changes use accessible confirmation dialogs. Missing firmware telemetry is
shown as “not reported”; faults and rejected actions remain visible in the
event rail.

## Verification coverage

- Unit tests cover binary layouts, signed values, exact identity, malformed
  frames, telemetry freshness, safety gates, bounds, and program schemas.
- Mock-firmware integration tests cover connect, verify, explicit target
  selection, Enable, E-stop loss, jog, host acceleration ramp, and release.
- Playwright renders every workspace at desktop resolution and rejects browser
  errors or horizontal overflow.
- Electron smoke tests exercise the source and packaged preload/serial bridge,
  safe Simulation startup target, and global software Stop.
- Physical motion is intentionally excluded from automation. Read-only hardware
  commissioning and deliberately supervised motion remain operator procedures.

## Packaging and launch

Development uses Vite for the renderer and Electron for the desktop shell.
Production builds package the compiled renderer, preload bridge, desktop main
process, and required serial bindings into a Windows application. The app never
opens a port or enables hardware on launch.
