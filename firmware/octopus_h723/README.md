# ROBARM firmware — Octopus Pro V1.1 H723

This firmware is a safety-first bridge between the PAROL6 Commander packet
format and the BIGTREETECH Octopus Pro V1.1 with STM32H723ZET6 and
TMC5160T Pro drivers.

The checked-in configuration is the **startup-calibration build**. The six
motor channels, directions and six home inputs are recorded; J1-J4 sensor paths
are validated, while J5/J6 lack mechanical targets and remain non-homing. The
controller treats loss of communication with any installed TMC5160 as an
E-stop-unsafe condition. Command 69, malformed packets and unknown commands
fail closed.

Configuration 11 retains the corrected joint directions and includes
`CALIBRATE_STARTUP I_UNDERSTAND`. It maps the Octopus Pro V1.1 FAN0 MOSFET to
PA8 and provides `FAN AUTO|FULL|OFF`: AUTO kick-starts at 100%, idles at 70%,
and returns to 100% whenever motors are energized. The FAN0 voltage jumper must
be set to 5 V for the installed Noctua NF-A4x20 5V fan. Duty is reported, but
the two-wire connection provides no physical RPM feedback.

Configuration 6 reversed
the command/coordinate signs for J1, J2, J3, J4, and J6 while leaving J5
unchanged. Calibration seeks J2 upward, J3 downward, and J4 clockwise
simultaneously at approximately 1,200 microsteps/s. Each joint stops
independently when its sensor edge appears. After all three signals qualify
continuously for 25 ms within their bounded full-span seeks, all three axes move
concurrently to their configured homes: J2 `32000` (+90°), J3 `0`, J4 `0`.
Success leaves those joints holding until explicit Enable or
Disable. Disable, E-stop, reset, power loss, or fault invalidates the reference.
The separate finite `MOTOR_TEST` and `HOME_TEST` workflows remain available at
the 900 mA commissioning ceiling.

## Safety state bytes shown by Commander

| Value | Meaning |
|---:|---|
| `0x52` | Commissioning locked; all driver enables high |
| `0x53` | Mapping verified and ready, but disabled |
| `0x54` | Enabled |
| `0x55` | Fault; all drivers disabled |
| `0x56` | Startup calibration active |
| `0x57` | Startup calibration complete; J2-J4 holding at home |

Commander accepts Enable in `0x53` or `0x57`; motion is accepted only in
`0x54`. At startup the missing reference keeps normal motion prerequisites
false and state `0x52`, while the separately guarded calibration command remains
available.

## Build

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\platformio.exe run
.\.venv\Scripts\python.exe -m pytest -q
```

The release DFU image is
`dist/ROBARM-Octopus-H723-config11-performance.bin`. Its SHA-256 is
recorded in the commissioning runbook. The identical build output remains at
`.pio/build/octopus_pro_v11_h723/firmware.bin`.

## Configuration gates

All wiring-dependent values live in `include/robot_config.h`:

1. `kCommissioningMotionEnabled` unlocks only finite, low-current physical
   motor-port tests.
2. `kRobotMappingVerified` asserts that the motor, sensor, direction and
   polarity maps have been reviewed. It does not claim an E-stop feedback input
   exists.
3. `kFullRobotMotionEnabled` permits Commander motion, but runtime also
   requires complete maps, safe E-stop feedback, and a completed J2-J4 startup
   reference.

Do not change any gate merely to get past an error. Each gate corresponds to a
completed physical checklist in `docs/ROBARM_COMMISSIONING.md`.
