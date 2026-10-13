#pragma once

#include <Arduino.h>

namespace robarm::config {

// SAFETY LOCKS. Guarded commissioning remains available, while normal motion
// is runtime-locked until the startup reference sequence completes.
constexpr bool kCommissioningMotionEnabled = true;
constexpr bool kRobotMappingVerified = true;
constexpr bool kFullRobotMotionEnabled = true;

// The physical E-stop has been verified to remove the motor-driver supply.
// There is not yet a separate MCU feedback contact, so commissioning also
// requires the selected driver to answer over SPI before it can be enabled.
constexpr bool kHardwareEstopCutsMotorPower = true;
// Verified live on 2026-08-11: the six installed TMC5160 channels all return
// test_connection()==1 while E-stop removes VM, and all return 0 when released.
// This monitors the actual power-cut result rather than only the button state.
constexpr bool kUseDriverPowerEstopFeedback = true;

constexpr uint8_t kUnmapped = 0xFF;

// Confirmed by individual bounded motion tests on 2026-08-11. Index is logical
// J1..J6; value is the physical MOTOR driver channel. MOTOR2_2 is only a second
// connector on channel 2 and remains unused.
constexpr uint8_t kJointToMotorPort[6] = {
    0, 1, 2, 5, 4, 3};

// Set after discovery: index is logical J1..J6, value is physical STOP0..STOP7.
// J1..J6 were confirmed during live manual sensor tests on 2026-08-11.
constexpr uint8_t kJointToStopPort[6] = {
    0, 2, 1, 3, 4, 5};

// Must be mapped to the NC hardware E-stop feedback contact before any motion.
constexpr uint8_t kEmergencyStopPort = kUnmapped;
// NC feedback wired Signal-to-GND is LOW while safe and opens HIGH when pressed.
constexpr uint8_t kEmergencyStopActiveLevel = HIGH;

// Filled by manual triggering. true means the input is active LOW. The
// mechanical switches for J2, J3 and J5 are active HIGH; the optocoupled
// sensors for J1, J4 and J6 are active LOW.
constexpr bool kStopActiveLow[6] = {true, false, false, true, false, true};

// Operator-verified control signs. J1, J2, J3, J4 and J6 were reversed in
// configuration 5 and are flipped here; J5 is deliberately unchanged.
constexpr bool kDirectionInverted[6] = {false, false, false, false, true, false};

// Hardware-validated seek signs. J3 must move down and J4 clockwise on this
// build, which differs from the initial upstream-sign inference.
// HOME_TEST converts these through kDirectionInverted to the physical DIR pin.
constexpr bool kHomingDirectionPositive[6] = {true, true, false, true, false, true};

// J5 and J6 currently lack the mechanical wrist attachment/targets needed to
// actuate their mapped sensors, so their HOME_TEST commands fail closed.
constexpr bool kHomeSensorMechanicallyAvailable[6] = {true, true, true, true, false, false};

// Automatic sensor stopping has been physically validated for J1-J4. J5/J6
// await their mechanical attachments and are excluded from the prerequisite.
constexpr bool kHomingValidated[6] = {true, true, true, true, false, false};

// PAROL6 kinematics, 200 full steps/rev and 32 microsteps.
constexpr uint16_t kMicrosteps = 32;
constexpr float kGearReduction[6] = {6.4F, 20.0F, 18.0952381F, 4.0F, 4.0F, 10.0F};

// Configuration 11 normal-motion RMS currents use the installed motors' rated
// phase currents: 17HS24-2104S on J1/J2, 17HS16-2004S1 on J3-J5, and the
// compact 17HS08-1004S on J6. J6 remains below the upstream PAROL6 965 mA
// hardware ceiling. Commissioning/calibration remains at the separately proven
// 900 mA ceiling so this performance profile cannot alter its behavior.
constexpr uint16_t kJointRunCurrentMa[6] = {2100, 2100, 2000, 2000, 2000, 965};
constexpr uint16_t kDiscoveryCurrentMa[8] = {900, 900, 900, 900, 900, 900, 900, 900};

// Commander step limits copied from the PAROL6 model and enforced in firmware.
// J2-J4 become meaningful only after the startup reference sequence assigns
// their sensor-edge coordinates.
constexpr int32_t kJointMinSteps[6] = {-14000, 1200, -17300, -7500, -6400, -64000};
constexpr int32_t kJointMaxSteps[6] = {14000, 51558, 17300, 7500, 6400, 0};
// Performance profile. The 32,000 microstep/s ceiling is 300 motor RPM at
// 32x microstepping. J1 is capped at 180 motor RPM because its 6.4:1 reduction
// otherwise produces an excessive base joint speed. These are command ceilings,
// not guaranteed under-load speeds; loss of synchronism remains fault-prone.
constexpr float kJointMaxSpeed[6] = {19200, 32000, 32000, 32000, 32000, 32000};
constexpr float kJointAcceleration[6] = {8000, 12000, 12000, 18000, 18000, 18000};

constexpr uint32_t kCommanderWatchdogMs = 100;

// FAN0 automatic cooling profile. The two-wire 5 V enclosure fan receives a
// 100 Hz low-side supply PWM drive, is kick-started at full duty, idles at 70%, and
// rises to full duty whenever any motor is energized. The output is refreshed
// periodically so a later peripheral initialization cannot silently steal PA8.
constexpr uint32_t kControllerFanPwmHz = 100;
constexpr uint8_t kControllerFanIdlePercent = 70;
constexpr uint8_t kControllerFanActivePercent = 100;
constexpr uint16_t kControllerFanKickStartMs = 2000;
constexpr uint16_t kControllerFanRefreshMs = 250;
// Allows a bounded five-second confirmation move. At 32 microsteps and the J3
// 18.095:1 reduction, 2000 microsteps produce approximately 6.2 joint degrees.
constexpr uint16_t kMaximumDiscoverySteps = 2000;
constexpr uint16_t kDiscoveryStepIntervalUs = 2500;  // 400 steps/s
constexpr uint16_t kDiscoveryDriverSettleMs = 100;
constexpr uint16_t kMaximumHomeTestSteps = 2000;
constexpr uint16_t kHomeTestStepIntervalUs = 5000;  // 200 microsteps/s.
// Exactly 10 logical joint degrees at 200 full-steps/rev and 32 microsteps.
constexpr uint16_t kHomeBackoffSteps[6] = {1138, 3556, 3217, 711, 711, 1778};
constexpr uint16_t kHomeBackoffStepIntervalUs = 2500;  // 400 microsteps/s.

// Startup reference sequence. J1 is intentionally omitted. Each joint seeks
// its physically validated sensor, assigns the sensor edge an absolute step
// coordinate, then moves away to the configured home coordinate. These values
// are compile-time safety configuration and require a config-version bump when
// changed. Order: J2 shoulder up, J3 elbow down, J4 forearm clockwise.
constexpr uint8_t kStartupCalibrationJointCount = 3;
constexpr uint8_t kStartupCalibrationJoints[kStartupCalibrationJointCount] = {1, 2, 3};
constexpr int32_t kCalibrationSensorReferenceSteps[6] = {
    0, 51558, -17300, 7500, 0, 0};
constexpr int32_t kCalibrationHomeSteps[6] = {
    0, 32000, 0, 0, 0, 0};  // J2=+90 degrees, J3=0, J4=0.
constexpr uint32_t kCalibrationMaximumSeekSteps[6] = {
    0, 50358, 34600, 15000, 0, 0};
constexpr uint16_t kCalibrationSeekStepIntervalUs = 833;  // ~1,200 microsteps/s (3x).
constexpr float kCalibrationHomeMaxSpeed[6] = {0.0F, 2400.0F, 2400.0F, 2400.0F, 0.0F, 0.0F};
constexpr float kCalibrationHomeAcceleration[6] = {0.0F, 3000.0F, 3000.0F, 3000.0F, 0.0F, 0.0F};
constexpr uint16_t kCalibrationSensorQualificationMs = 25;
constexpr uint16_t kCalibrationSensorQualificationTimeoutMs = 250;

static_assert(!kFullRobotMotionEnabled || kRobotMappingVerified,
              "Full motion requires a verified physical map");
static_assert(!kFullRobotMotionEnabled ||
                  ( (!kHomeSensorMechanicallyAvailable[0] || kHomingValidated[0]) &&
                    (!kHomeSensorMechanicallyAvailable[1] || kHomingValidated[1]) &&
                    (!kHomeSensorMechanicallyAvailable[2] || kHomingValidated[2]) &&
                    (!kHomeSensorMechanicallyAvailable[3] || kHomingValidated[3]) &&
                    (!kHomeSensorMechanicallyAvailable[4] || kHomingValidated[4]) &&
                    (!kHomeSensorMechanicallyAvailable[5] || kHomingValidated[5]) ),
              "Full motion requires every available homing path to be validated");
static_assert(!kCommissioningMotionEnabled || kHardwareEstopCutsMotorPower ||
                  kEmergencyStopPort != kUnmapped,
              "Commissioning requires a hardware motor-power cut or E-stop feedback");
static_assert(!kUseDriverPowerEstopFeedback || kHardwareEstopCutsMotorPower,
              "Driver-power feedback requires the E-stop to cut motor power");
static_assert(kDiscoveryCurrentMa[0] <= 900 && kDiscoveryCurrentMa[1] <= 900 &&
                  kDiscoveryCurrentMa[2] <= 900 && kDiscoveryCurrentMa[3] <= 900 &&
                  kDiscoveryCurrentMa[4] <= 900 && kDiscoveryCurrentMa[5] <= 900 &&
                  kDiscoveryCurrentMa[6] <= 900 && kDiscoveryCurrentMa[7] <= 900,
              "Commissioning current exceeds its verified per-port ceiling");
static_assert(kJointRunCurrentMa[0] <= 2100 && kJointRunCurrentMa[1] <= 2100,
              "J1/J2 current exceeds the installed 17HS24-2104S rating");
static_assert(kJointRunCurrentMa[2] <= 2000 && kJointRunCurrentMa[3] <= 2000 &&
                  kJointRunCurrentMa[4] <= 2000,
              "J3-J5 current exceeds the installed 17HS16-2004S1 rating");
static_assert(kJointRunCurrentMa[5] <= 965,
              "J6 current exceeds the verified PAROL6 hardware ceiling");
static_assert(kControllerFanIdlePercent > 0 && kControllerFanIdlePercent <= 100 &&
                  kControllerFanActivePercent == 100,
              "Controller fan automatic duty profile is invalid");
static_assert(kMaximumDiscoverySteps <= 2000,
              "A discovery command must remain finite and at most 2000 microsteps");
static_assert(kMaximumHomeTestSteps <= 2000,
              "A HOME_TEST must remain finite and at most 2000 microsteps");
static_assert(kHomeBackoffSteps[0] <= 4000 && kHomeBackoffSteps[1] <= 4000 &&
                  kHomeBackoffSteps[2] <= 4000 && kHomeBackoffSteps[3] <= 4000 &&
                  kHomeBackoffSteps[4] <= 4000 && kHomeBackoffSteps[5] <= 4000,
              "A homing backoff must remain bounded");
static_assert(kStartupCalibrationJoints[0] == 1 &&
                  kStartupCalibrationJoints[1] == 2 &&
                  kStartupCalibrationJoints[2] == 3,
              "Startup calibration must remain ordered J2, J3, J4");
static_assert(kCalibrationSensorReferenceSteps[1] == kJointMaxSteps[1] &&
                  kCalibrationSensorReferenceSteps[2] == kJointMinSteps[2] &&
                  kCalibrationSensorReferenceSteps[3] == kJointMaxSteps[3],
              "Calibration sensor references must match the validated seek boundaries");
static_assert(kCalibrationHomeSteps[1] >= kJointMinSteps[1] &&
                  kCalibrationHomeSteps[1] <= kJointMaxSteps[1] &&
                  kCalibrationHomeSteps[2] >= kJointMinSteps[2] &&
                  kCalibrationHomeSteps[2] <= kJointMaxSteps[2] &&
                  kCalibrationHomeSteps[3] >= kJointMinSteps[3] &&
                  kCalibrationHomeSteps[3] <= kJointMaxSteps[3],
              "Calibration home targets must remain inside joint limits");

}  // namespace robarm::config
