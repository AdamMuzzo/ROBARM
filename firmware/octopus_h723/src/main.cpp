#include <AccelStepper.h>
#include <Arduino.h>
#include <SPI.h>
#include <TMCStepper.h>

#include "board_pins.h"
#include "protocol.h"
#include "robot_config.h"

namespace robarm {
namespace {

constexpr float kSenseResistorOhms = 0.075F;
constexpr size_t kAsciiBufferLength = 120;

AccelStepper stepper0(AccelStepper::DRIVER, kStepPins[0], kDirectionPins[0]);
AccelStepper stepper1(AccelStepper::DRIVER, kStepPins[1], kDirectionPins[1]);
AccelStepper stepper2(AccelStepper::DRIVER, kStepPins[2], kDirectionPins[2]);
AccelStepper stepper3(AccelStepper::DRIVER, kStepPins[3], kDirectionPins[3]);
AccelStepper stepper4(AccelStepper::DRIVER, kStepPins[4], kDirectionPins[4]);
AccelStepper stepper5(AccelStepper::DRIVER, kStepPins[5], kDirectionPins[5]);
AccelStepper stepper6(AccelStepper::DRIVER, kStepPins[6], kDirectionPins[6]);
AccelStepper stepper7(AccelStepper::DRIVER, kStepPins[7], kDirectionPins[7]);
AccelStepper* const steppers[kMotorCount] = {
    &stepper0, &stepper1, &stepper2, &stepper3,
    &stepper4, &stepper5, &stepper6, &stepper7};

TMC5160Stepper driver0(kChipSelectPins[0], kSenseResistorOhms);
TMC5160Stepper driver1(kChipSelectPins[1], kSenseResistorOhms);
TMC5160Stepper driver2(kChipSelectPins[2], kSenseResistorOhms);
TMC5160Stepper driver3(kChipSelectPins[3], kSenseResistorOhms);
TMC5160Stepper driver4(kChipSelectPins[4], kSenseResistorOhms);
TMC5160Stepper driver5(kChipSelectPins[5], kSenseResistorOhms);
TMC5160Stepper driver6(kChipSelectPins[6], kSenseResistorOhms);
TMC5160Stepper driver7(kChipSelectPins[7], kSenseResistorOhms);
TMC5160Stepper* const drivers[kMotorCount] = {
    &driver0, &driver1, &driver2, &driver3,
    &driver4, &driver5, &driver6, &driver7};

bool enabled = false;
bool latchedFault = false;
bool timeoutFault = false;
bool commissioningHoldActive = false;
uint8_t commissioningHoldJoint = config::kUnmapped;
uint32_t lastCommanderPacketMs = 0;

enum class MotionMode : uint8_t { kHold, kJog, kPosition };
MotionMode motionMode = MotionMode::kHold;

uint8_t binaryHeaderCount = 0;
bool awaitingBinaryLength = false;
uint8_t binaryLength = 0;
uint8_t binaryBody[protocol::kPcBodyLength]{};
uint8_t binaryIndex = 0;

char asciiBuffer[kAsciiBufferLength]{};
size_t asciiLength = 0;

struct DiscoveryMove {
  enum class Kind : uint8_t { kMotor, kHome, kHomeBackoff };
  bool active = false;
  Kind kind = Kind::kMotor;
  uint8_t port = config::kUnmapped;
  uint8_t joint = config::kUnmapped;
  uint16_t stepsRemaining = 0;
  bool pulseHigh = false;
  bool sensorCandidate = false;
  uint32_t sensorCandidateSinceMs = 0;
  uint32_t lastTransitionUs = 0;
} discovery;

struct CalibrationJointState {
  enum class Phase : uint8_t {
    kInactive,
    kSeeking,
    kQualifying,
    kSensorQualified,
    kMovingHome,
    kComplete
  };
  uint8_t joint = config::kUnmapped;
  Phase phase = Phase::kInactive;
  uint32_t stepsRemaining = 0;
  uint32_t stepsTaken = 0;
  bool pulseHigh = false;
  bool sensorQualificationActive = false;
  uint32_t sensorCandidateSinceMs = 0;
  uint32_t sensorEdgeDetectedMs = 0;
  uint32_t lastTransitionUs = 0;
};

struct StartupCalibration {
  enum class Phase : uint8_t {
    kIdle,
    kPreparingHold,
    kSettlingHold,
    kSeeking,
    kMovingHome,
    kComplete,
    kFault
  };
  bool active = false;
  bool holdActive = false;
  Phase phase = Phase::kIdle;
  uint8_t holdPrepareJoint = 0;
  CalibrationJointState joints[config::kStartupCalibrationJointCount]{};
  uint32_t driverSettleStartedMs = 0;
} calibration;

uint8_t referencedJointMask = 0;

enum class ControllerFanMode : uint8_t { kAuto, kFull, kOff };
ControllerFanMode controllerFanMode = ControllerFanMode::kAuto;
uint8_t controllerFanSpeedPercent = 100;
uint32_t controllerFanStartupMs = 0;
uint32_t controllerFanLastApplyMs = 0;

bool validPort(uint8_t port) { return port < kMotorCount; }
bool validStop(uint8_t port) { return port < kStopCount; }

bool motorPowerActiveForCooling() {
  return enabled || discovery.active || commissioningHoldActive ||
         calibration.active || calibration.holdActive;
}

uint8_t requestedControllerFanPercent() {
  if (controllerFanMode == ControllerFanMode::kOff) return 0;
  if (controllerFanMode == ControllerFanMode::kFull) return 100;
  if (millis() - controllerFanStartupMs < config::kControllerFanKickStartMs) return 100;
  return motorPowerActiveForCooling() ? config::kControllerFanActivePercent
                                     : config::kControllerFanIdlePercent;
}

void applyControllerFanPercent(uint8_t percent) {
  controllerFanSpeedPercent = constrain(percent, 0U, 100U);
  const uint32_t duty =
      (static_cast<uint32_t>(controllerFanSpeedPercent) * 255U + 50U) / 100U;
  analogWrite(kControllerFanPin, duty);
  controllerFanLastApplyMs = millis();
}

void serviceControllerFan() {
  const uint8_t requestedPercent = requestedControllerFanPercent();
  if (requestedPercent != controllerFanSpeedPercent ||
      millis() - controllerFanLastApplyMs >= config::kControllerFanRefreshMs) {
    // Reasserting the timer output prevents USB/peripheral initialization from
    // leaving the software flag ON while PA8 is no longer driving FAN0.
    applyControllerFanPercent(requestedPercent);
  }
}

void setControllerFanMode(ControllerFanMode mode) {
  controllerFanMode = mode;
  applyControllerFanPercent(requestedControllerFanPercent());
}

bool estopFeedbackConfigured() {
  return validStop(config::kEmergencyStopPort) ||
         (config::kHardwareEstopCutsMotorPower &&
          config::kUseDriverPowerEstopFeedback);
}

void disableAllDrivers() {
  enabled = false;
  motionMode = MotionMode::kHold;
  discovery.active = false;
  commissioningHoldActive = false;
  commissioningHoldJoint = config::kUnmapped;
  calibration.active = false;
  calibration.holdActive = false;
  calibration.phase = StartupCalibration::Phase::kIdle;
  calibration.holdPrepareJoint = 0;
  for (uint8_t index = 0; index < config::kStartupCalibrationJointCount; ++index) {
    calibration.joints[index] = CalibrationJointState{};
  }
  referencedJointMask = 0;
  for (uint8_t port = 0; port < kMotorCount; ++port) {
    steppers[port]->setSpeed(0.0F);
    digitalWrite(kStepPins[port], LOW);
    digitalWrite(kEnablePins[port], HIGH);  // TMC enable is active LOW.
  }
}

uint8_t jointReferenceBit(uint8_t joint) {
  return joint < kJointCount ? static_cast<uint8_t>(1U << (7U - joint)) : 0;
}

uint8_t requiredCalibrationMask() {
  uint8_t mask = 0;
  for (uint8_t index = 0; index < config::kStartupCalibrationJointCount; ++index) {
    mask |= jointReferenceBit(config::kStartupCalibrationJoints[index]);
  }
  return mask;
}

bool startupCalibrationComplete() {
  const uint8_t required = requiredCalibrationMask();
  return (referencedJointMask & required) == required;
}

bool mappingsAreComplete() {
  if (!config::kRobotMappingVerified || !estopFeedbackConfigured()) return false;
  uint8_t motorMask = 0;
  uint8_t stopMask = 0;
  for (uint8_t joint = 0; joint < kJointCount; ++joint) {
    const uint8_t motor = config::kJointToMotorPort[joint];
    const uint8_t stop = config::kJointToStopPort[joint];
    if (!validPort(motor) || !validStop(stop)) return false;
    const uint8_t motorBit = static_cast<uint8_t>(1U << motor);
    const uint8_t stopBit = static_cast<uint8_t>(1U << stop);
    if ((motorMask & motorBit) != 0 || (stopMask & stopBit) != 0) return false;
    motorMask |= motorBit;
    stopMask |= stopBit;
  }
  return true;
}

bool allHomingValidated() {
  for (uint8_t joint = 0; joint < kJointCount; ++joint) {
    // Joints without a physically available homing target are deliberately
    // excluded from the prerequisite set. They remain non-referenced joints
    // and must not be treated as homed by the firmware.
    if (!config::kHomeSensorMechanicallyAvailable[joint]) continue;
    if (!config::kHomingValidated[joint]) return false;
  }
  return true;
}

bool normalMotionPrerequisites() {
  return mappingsAreComplete() && allHomingValidated() && startupCalibrationComplete();
}

bool fullMotionReady() {
  return config::kFullRobotMotionEnabled && normalMotionPrerequisites();
}

bool driverCommunicating(uint8_t port) {
  return validPort(port) && drivers[port]->test_connection() == 0;
}

bool mappedDriverPowerPresent() {
  for (uint8_t joint = 0; joint < kJointCount; ++joint) {
    if (!driverCommunicating(config::kJointToMotorPort[joint])) return false;
  }
  return true;
}

bool emergencyStopSafe() {
  if (validStop(config::kEmergencyStopPort)) {
    return digitalRead(kStopPins[config::kEmergencyStopPort]) !=
           config::kEmergencyStopActiveLevel;
  }
  if (config::kUseDriverPowerEstopFeedback) return mappedDriverPowerPresent();
  return false;
}

bool stopActiveForJoint(uint8_t joint) {
  if (joint >= kJointCount || !validStop(config::kJointToStopPort[joint])) return true;
  if (!config::kHomeSensorMechanicallyAvailable[joint]) return false;
  const bool rawHigh = digitalRead(kStopPins[config::kJointToStopPort[joint]]) == HIGH;
  return config::kStopActiveLow[joint] ? !rawHigh : rawHigh;
}

bool anyHomeSensorActive() {
  for (uint8_t joint = 0; joint < kJointCount; ++joint) {
    if (stopActiveForJoint(joint)) return true;
  }
  return false;
}

bool anyOtherHomeSensorActive(uint8_t targetJoint) {
  for (uint8_t joint = 0; joint < kJointCount; ++joint) {
    if (joint != targetJoint && stopActiveForJoint(joint)) return true;
  }
  return false;
}

bool commissioningEstopReady() {
  return emergencyStopSafe();
}

uint8_t rawStopBits() {
  uint8_t bits = 0;
  for (uint8_t port = 0; port < kStopCount; ++port) {
    if (digitalRead(kStopPins[port]) == HIGH) bits |= static_cast<uint8_t>(1U << port);
  }
  return bits;
}

protocol::FirmwareState firmwareState() {
  if (latchedFault || timeoutFault) return protocol::FirmwareState::kFault;
  if (calibration.active) return protocol::FirmwareState::kCalibrating;
  if (calibration.holdActive) return protocol::FirmwareState::kCalibrationHold;
  if (!fullMotionReady()) return protocol::FirmwareState::kCommissioningLocked;
  return enabled ? protocol::FirmwareState::kEnabled
                 : protocol::FirmwareState::kReadyDisabled;
}

void configureDriver(TMC5160Stepper& driver, uint16_t currentMa) {
  driver.begin();
  driver.toff(5);
  driver.blank_time(24);
  driver.rms_current(currentMa);
  driver.microsteps(config::kMicrosteps);
  driver.en_pwm_mode(false);
  driver.pwm_autoscale(true);
  driver.TPOWERDOWN(10);
  driver.GSTAT(0b111);
}

void initializeHardware() {
  // This is deliberately first: no SPI, serial, or sensor work precedes disabling EN.
  for (uint8_t port = 0; port < kMotorCount; ++port) {
    pinMode(kEnablePins[port], OUTPUT);
    digitalWrite(kEnablePins[port], HIGH);
    pinMode(kStepPins[port], OUTPUT);
    digitalWrite(kStepPins[port], LOW);
    pinMode(kDirectionPins[port], OUTPUT);
    digitalWrite(kDirectionPins[port], LOW);
    pinMode(kChipSelectPins[port], OUTPUT);
    digitalWrite(kChipSelectPins[port], HIGH);
  }
  pinMode(kControllerFanPin, OUTPUT);
  analogWriteResolution(8);
  analogWriteFrequency(config::kControllerFanPwmHz);
  controllerFanStartupMs = millis();
  setControllerFanMode(ControllerFanMode::kAuto);
  for (uint8_t port = 0; port < kStopCount; ++port) pinMode(kStopPins[port], INPUT_PULLUP);

  SPI.setMOSI(kTmcMosiPin);
  SPI.setMISO(kTmcMisoPin);
  SPI.setSCLK(kTmcSckPin);
  SPI.begin();
  for (uint8_t port = 0; port < kMotorCount; ++port) {
    configureDriver(*drivers[port], config::kDiscoveryCurrentMa[port]);
    steppers[port]->setMinPulseWidth(3);
  }

  if (mappingsAreComplete()) {
    for (uint8_t joint = 0; joint < kJointCount; ++joint) {
      const uint8_t port = config::kJointToMotorPort[joint];
      configureDriver(*drivers[port], config::kJointRunCurrentMa[joint]);
      steppers[port]->setPinsInverted(config::kDirectionInverted[joint], false, false);
      steppers[port]->setMaxSpeed(config::kJointMaxSpeed[joint]);
      steppers[port]->setAcceleration(config::kJointAcceleration[joint]);
    }
  }
  disableAllDrivers();
}

bool enableRobot() {
  if (!fullMotionReady() || !emergencyStopSafe() || latchedFault || timeoutFault) {
    disableAllDrivers();
    return false;
  }
  // Motor power may have been connected after MCU boot. Reinitialize and
  // verify every mapped TMC before energizing its output.
  for (uint8_t joint = 0; joint < kJointCount; ++joint) {
    const uint8_t port = config::kJointToMotorPort[joint];
    if (!driverCommunicating(port)) {
      disableAllDrivers();
      return false;
    }
    configureDriver(*drivers[port], config::kJointRunCurrentMa[joint]);
    if (!driverCommunicating(port)) {
      disableAllDrivers();
      return false;
    }
  }
  for (uint8_t joint = 0; joint < kJointCount; ++joint) {
    digitalWrite(kEnablePins[config::kJointToMotorPort[joint]], LOW);
  }
  calibration.holdActive = false;
  calibration.phase = StartupCalibration::Phase::kComplete;
  enabled = true;
  motionMode = MotionMode::kHold;
  return true;
}

void setFault() {
  const bool calibrationWasActive = calibration.active || calibration.holdActive;
  latchedFault = true;
  disableAllDrivers();
  if (calibrationWasActive) calibration.phase = StartupCalibration::Phase::kFault;
}

void serviceSafety() {
  if (enabled && !emergencyStopSafe()) setFault();
  if (discovery.active && !emergencyStopSafe()) {
    setFault();
    Serial.println(F("ERR E-stop motor power lost; driver disabled"));
  }
  if ((calibration.active || calibration.holdActive) && !emergencyStopSafe()) {
    setFault();
    Serial.println(F("ERR calibration reference lost: E-stop motor power removed"));
  }
  if (commissioningHoldActive && !emergencyStopSafe()) {
    setFault();
    Serial.println(F("ERR E-stop motor power lost; holding driver disabled"));
  }
  if ((enabled || calibration.active || calibration.holdActive) &&
      millis() - lastCommanderPacketMs > config::kCommanderWatchdogMs) {
    timeoutFault = true;
    disableAllDrivers();
  }
}

void serviceRobotMotion() {
  if (!enabled) return;
  for (uint8_t joint = 0; joint < kJointCount; ++joint) {
    AccelStepper& stepper = *steppers[config::kJointToMotorPort[joint]];
    if (motionMode == MotionMode::kJog) {
      // A manual jog may always move away from an active home sensor at the
      // operator's requested speed. Only the unsafe direction for that one
      // joint is suppressed; every other joint continues concurrently.
      const float speed = stepper.speed();
      const bool towardSensor = speed != 0.0F &&
          ((speed > 0.0F) == config::kHomingDirectionPositive[joint]);
      if (stopActiveForJoint(joint) && towardSensor) stepper.setSpeed(0.0F);
      stepper.runSpeed();
    } else if (motionMode == MotionMode::kPosition) {
      const int32_t remaining = stepper.distanceToGo();
      const bool towardSensor = remaining != 0 &&
          ((remaining > 0) == config::kHomingDirectionPositive[joint]);
      if (stopActiveForJoint(joint) && towardSensor) {
        // Stop only this joint at its present coordinate. There is no automatic
        // slow backoff and no global motion lock; an explicit away command is
        // required to leave the sensor.
        stepper.moveTo(stepper.currentPosition());
        stepper.setSpeed(0.0F);
      }
      stepper.run();
    }
  }
}

bool jointAffected(uint8_t field, uint8_t joint) {
  return (field & static_cast<uint8_t>(1U << (7U - joint))) != 0;
}

void handleCommanderPacket(const protocol::CommanderPacket& packet) {
  lastCommanderPacketMs = millis();
  timeoutFault = false;

  switch (packet.command) {
    case protocol::kCommandDisable:
      disableAllDrivers();
      break;
    case protocol::kCommandClearError:
      disableAllDrivers();
      if (emergencyStopSafe() && !anyHomeSensorActive()) {
        latchedFault = false;
        timeoutFault = false;
      }
      break;
    case protocol::kCommandEnable:
      enableRobot();
      break;
    case protocol::kCommandHome:
      // Homing remains unavailable until its sensor order is validated on hardware.
      setFault();
      break;
    case protocol::kCommandJog:
      if (!enabled || !fullMotionReady()) break;
      motionMode = MotionMode::kJog;
      for (uint8_t joint = 0; joint < kJointCount; ++joint) {
        const uint8_t port = config::kJointToMotorPort[joint];
        float speed = static_cast<float>(packet.speed[joint]);
        speed = constrain(speed, -config::kJointMaxSpeed[joint], config::kJointMaxSpeed[joint]);
        if (!jointAffected(packet.affected, joint)) speed = 0.0F;
        const bool towardSensor = speed != 0.0F &&
            ((speed > 0.0F) == config::kHomingDirectionPositive[joint]);
        if (stopActiveForJoint(joint) && towardSensor) speed = 0.0F;
        // Reassert the configured ceiling so reverse escape uses normal speed.
        steppers[port]->setMaxSpeed(config::kJointMaxSpeed[joint]);
        steppers[port]->setSpeed(speed);
      }
      break;
    case protocol::kCommandPosition:
      if (!enabled || !fullMotionReady()) break;
      motionMode = MotionMode::kPosition;
      for (uint8_t joint = 0; joint < kJointCount; ++joint) {
        if (!jointAffected(packet.affected, joint)) continue;
        if (packet.position[joint] < config::kJointMinSteps[joint] ||
            packet.position[joint] > config::kJointMaxSteps[joint]) {
          setFault();
          return;
        }
        const uint8_t port = config::kJointToMotorPort[joint];
        const float requested = abs(packet.speed[joint]);
        const float limited = min(requested, config::kJointMaxSpeed[joint]);
        steppers[port]->setMaxSpeed(max(limited, 1.0F));
        steppers[port]->moveTo(packet.position[joint]);
      }
      break;
    case protocol::kCommandDummy:
      if (motionMode == MotionMode::kJog) {
        for (uint8_t joint = 0; joint < kJointCount; ++joint) {
          steppers[config::kJointToMotorPort[joint]]->setSpeed(0.0F);
        }
        motionMode = MotionMode::kHold;
      }
      break;
    default:
      // Command 69 and every unknown command fail closed.
      setFault();
      break;
  }
}

void appendU16(uint16_t value, uint8_t* output) {
  output[0] = static_cast<uint8_t>(value >> 8);
  output[1] = static_cast<uint8_t>(value);
}

void sendCommanderReply() {
  uint8_t frame[60]{};
  frame[0] = protocol::kHeader;
  frame[1] = protocol::kHeader;
  frame[2] = protocol::kHeader;
  frame[3] = protocol::kRobotBodyLength;
  uint8_t* body = &frame[4];

  for (uint8_t joint = 0; joint < kJointCount; ++joint) {
    int32_t position = 0;
    int32_t speed = 0;
    if (mappingsAreComplete()) {
      const uint8_t port = config::kJointToMotorPort[joint];
      position = steppers[port]->currentPosition();
      speed = static_cast<int32_t>(steppers[port]->speed());
    }
    protocol::encodeSigned24(position, &body[joint * 3]);
    protocol::encodeSigned24(speed, &body[18 + joint * 3]);
  }

  body[36] = referencedJointMask;
  uint8_t io = 0;
  if (digitalRead(kStopPins[0]) == HIGH) io |= 0x80;
  if (digitalRead(kStopPins[1]) == HIGH) io |= 0x40;
  if (emergencyStopSafe()) io |= 0x08;  // Commander InOut_in[4].
  body[37] = io;
  body[38] = 0;
  body[39] = latchedFault ? 0xFF : 0;
  appendU16(0, &body[40]);
  body[42] = timeoutFault ? 1 : 0;
  body[43] = static_cast<uint8_t>(firmwareState());
  body[44] = protocol::kIdentityDevice;
  appendU16(protocol::kIdentityProtocolVersion, &body[45]);
  appendU16(protocol::kIdentityTag, &body[47]);
  appendU16(protocol::kIdentityConfigVersion, &body[49]);
  body[51] = protocol::kIdentityMagic1;
  body[52] = protocol::kIdentityMagic2;
  body[53] = protocol::kLegacyCrc;
  body[54] = protocol::kEnd1;
  body[55] = protocol::kEnd2;
  Serial.write(frame, sizeof(frame));
}

void processBinaryByte(uint8_t value) {
  if (binaryLength != 0) {
    if (binaryIndex < sizeof(binaryBody)) binaryBody[binaryIndex] = value;
    ++binaryIndex;
    if (binaryIndex >= binaryLength) {
      protocol::CommanderPacket packet;
      if (binaryLength == protocol::kPcBodyLength &&
          protocol::decodeCommanderBody(binaryBody, binaryLength, packet)) {
        handleCommanderPacket(packet);
        sendCommanderReply();
      } else {
        setFault();
      }
      binaryLength = 0;
      binaryIndex = 0;
    }
    return;
  }

  if (awaitingBinaryLength) {
    awaitingBinaryLength = false;
    if (value == protocol::kPcBodyLength) {
      binaryLength = value;
      binaryIndex = 0;
    } else {
      binaryHeaderCount = 0;
      setFault();
    }
    return;
  }

  if (value == protocol::kHeader) {
    if (++binaryHeaderCount == 3) {
      binaryHeaderCount = 0;
      awaitingBinaryLength = true;
    }
  } else {
    binaryHeaderCount = 0;
  }
}

const __FlashStringHelper* calibrationPhaseName() {
  switch (calibration.phase) {
    case StartupCalibration::Phase::kPreparingHold:
      return F("preparing_hold");
    case StartupCalibration::Phase::kSettlingHold:
      return F("settling_hold");
    case StartupCalibration::Phase::kSeeking:
      return F("seeking");
    case StartupCalibration::Phase::kMovingHome:
      return F("moving_home");
    case StartupCalibration::Phase::kComplete:
      return F("complete");
    case StartupCalibration::Phase::kFault:
      return F("fault");
    default:
      return F("idle");
  }
}

const __FlashStringHelper* calibrationJointPhaseName(
    CalibrationJointState::Phase phase) {
  switch (phase) {
    case CalibrationJointState::Phase::kSeeking:
      return F("seeking");
    case CalibrationJointState::Phase::kQualifying:
      return F("qualifying");
    case CalibrationJointState::Phase::kSensorQualified:
      return F("sensor_qualified");
    case CalibrationJointState::Phase::kMovingHome:
      return F("moving_home");
    case CalibrationJointState::Phase::kComplete:
      return F("complete");
    default:
      return F("inactive");
  }
}

uint8_t singleActiveCalibrationJoint() {
  uint8_t activeJoint = config::kUnmapped;
  for (uint8_t index = 0; index < config::kStartupCalibrationJointCount; ++index) {
    const CalibrationJointState& state = calibration.joints[index];
    if (state.phase == CalibrationJointState::Phase::kInactive ||
        state.phase == CalibrationJointState::Phase::kComplete) continue;
    if (activeJoint != config::kUnmapped) return 0;
    activeJoint = state.joint;
  }
  return activeJoint < kJointCount ? activeJoint + 1U : 0U;
}

uint32_t calibrationStepsTaken() {
  uint32_t total = 0;
  for (uint8_t index = 0; index < config::kStartupCalibrationJointCount; ++index) {
    total += calibration.joints[index].stepsTaken;
  }
  return total;
}

uint32_t calibrationStepsRemaining() {
  uint32_t total = 0;
  for (uint8_t index = 0; index < config::kStartupCalibrationJointCount; ++index) {
    total += calibration.joints[index].stepsRemaining;
  }
  return total;
}

const __FlashStringHelper* controllerFanModeName() {
  if (controllerFanMode == ControllerFanMode::kFull) return F("full");
  if (controllerFanMode == ControllerFanMode::kOff) return F("off");
  return F("auto");
}

void printStatus() {
  Serial.print(F("{\"firmware\":\"ROBARM-OCTOPUS-H723\",\"version\":1,"));
  Serial.print(F("\"protocol_signature\":\"RB\",\"protocol_version\":"));
  Serial.print(protocol::kIdentityProtocolVersion);
  Serial.print(F(",\"config_version\":"));
  Serial.print(protocol::kIdentityConfigVersion);
  Serial.print(',');
  Serial.print(F("\"state\":"));
  Serial.print(static_cast<uint8_t>(firmwareState()));
  Serial.print(F(",\"mapping_verified\":"));
  Serial.print(config::kRobotMappingVerified ? F("true") : F("false"));
  Serial.print(F(",\"motion_prerequisites\":"));
  Serial.print(normalMotionPrerequisites() ? F("true") : F("false"));
  Serial.print(F(",\"homing_validated\":"));
  Serial.print(allHomingValidated() ? F("true") : F("false"));
  Serial.print(F(",\"calibration_supported\":true"));
  Serial.print(F(",\"calibration_active\":"));
  Serial.print(calibration.active ? F("true") : F("false"));
  Serial.print(F(",\"calibration_hold\":"));
  Serial.print(calibration.holdActive ? F("true") : F("false"));
  Serial.print(F(",\"calibration_complete\":"));
  Serial.print(startupCalibrationComplete() ? F("true") : F("false"));
  Serial.print(F(",\"calibration_joint\":"));
  Serial.print(singleActiveCalibrationJoint());
  Serial.print(F(",\"calibration_phase\":\""));
  Serial.print(calibrationPhaseName());
  Serial.print('"');
  Serial.print(F(",\"calibration_joint_phases\":["));
  for (uint8_t index = 0; index < config::kStartupCalibrationJointCount; ++index) {
    if (index != 0) Serial.print(',');
    Serial.print('"');
    Serial.print(calibrationJointPhaseName(calibration.joints[index].phase));
    Serial.print('"');
  }
  Serial.print(']');
  Serial.print(F(",\"referenced_mask\":"));
  Serial.print(referencedJointMask);
  Serial.print(F(",\"calibration_required_mask\":"));
  Serial.print(requiredCalibrationMask());
  Serial.print(F(",\"calibration_steps_taken\":"));
  Serial.print(calibrationStepsTaken());
  Serial.print(F(",\"calibration_steps_remaining\":"));
  Serial.print(calibrationStepsRemaining());
  Serial.print(F(",\"calibration_home_steps\":["));
  for (uint8_t joint = 0; joint < kJointCount; ++joint) {
    if (joint != 0) Serial.print(',');
    Serial.print(config::kCalibrationHomeSteps[joint]);
  }
  Serial.print(']');
  Serial.print(F(",\"full_motion\":"));
  Serial.print(config::kFullRobotMotionEnabled ? F("true") : F("false"));
  Serial.print(F(",\"commissioning_motion\":"));
  Serial.print(config::kCommissioningMotionEnabled ? F("true") : F("false"));
  Serial.print(F(",\"commissioning_hold\":"));
  Serial.print(commissioningHoldActive ? F("true") : F("false"));
  Serial.print(F(",\"holding_joint\":"));
  Serial.print(commissioningHoldActive ? commissioningHoldJoint + 1U : 0U);
  Serial.print(F(",\"hardware_estop_motor_cut\":"));
  Serial.print(config::kHardwareEstopCutsMotorPower ? F("true") : F("false"));
  Serial.print(F(",\"estop_configured\":"));
  Serial.print(estopFeedbackConfigured() ? F("true") : F("false"));
  Serial.print(F(",\"estop_feedback\":\""));
  if (validStop(config::kEmergencyStopPort)) {
    Serial.print(F("gpio"));
  } else if (config::kUseDriverPowerEstopFeedback) {
    Serial.print(F("driver_power"));
  } else {
    Serial.print(F("none"));
  }
  Serial.print('"');
  Serial.print(F(",\"estop_safe\":"));
  Serial.print(emergencyStopSafe() ? F("true") : F("false"));
  Serial.print(F(",\"fan_supported\":true"));
  Serial.print(F(",\"fan_on\":"));
  Serial.print(controllerFanSpeedPercent > 0 ? F("true") : F("false"));
  Serial.print(F(",\"fan_mode\":\""));
  Serial.print(controllerFanModeName());
  Serial.print('"');
  Serial.print(F(",\"fan_speed_percent\":"));
  Serial.print(controllerFanSpeedPercent);
  Serial.print(F(",\"fan_tach_supported\":false"));
  Serial.print(F(",\"fan_startup_default_on\":true"));
  Serial.println(F("}"));
}

void printSensors() {
  Serial.print(F("{\"raw_high_mask\":"));
  Serial.print(rawStopBits());
  Serial.print(F(",\"ports\":["));
  for (uint8_t port = 0; port < kStopCount; ++port) {
    if (port != 0) Serial.print(',');
    Serial.print(digitalRead(kStopPins[port]) == HIGH ? 1 : 0);
  }
  Serial.println(F("]}"));
}

void printDrivers() {
  Serial.print(F("{\"tmc_connection\":["));
  for (uint8_t port = 0; port < kMotorCount; ++port) {
    if (port != 0) Serial.print(',');
    Serial.print(drivers[port]->test_connection());
  }
  Serial.println(F("]}"));
}

void printDriverDiagnostics(uint8_t port) {
  if (!validPort(port)) {
    Serial.println(F("ERR use DRIVER_DIAG <0-7>"));
    return;
  }
  // Register reads only: this command never enables a driver or emits STEP pulses.
  Serial.print(F("{\"port\":"));
  Serial.print(port);
  Serial.print(F(",\"connection\":"));
  Serial.print(drivers[port]->test_connection());
  Serial.print(F(",\"gstat\":"));
  Serial.print(drivers[port]->GSTAT());
  Serial.print(F(",\"drv_status\":"));
  Serial.print(drivers[port]->DRV_STATUS());
  Serial.print(F(",\"ioin\":"));
  Serial.print(drivers[port]->IOIN());
  Serial.print(F(",\"chopconf\":"));
  Serial.print(drivers[port]->CHOPCONF());
  Serial.print(F(",\"ihold_irun\":"));
  Serial.print(drivers[port]->IHOLD_IRUN());
  Serial.println(F("}"));
}

void startDiscoveryMove(uint8_t port, bool direction, uint16_t steps) {
  if (!config::kCommissioningMotionEnabled) {
    Serial.println(F("ERR commissioning motion is compile-locked"));
    return;
  }
  if (!validPort(port) || steps == 0 || steps > config::kMaximumDiscoverySteps) {
    Serial.println(F("ERR invalid port or step count"));
    return;
  }
  if (latchedFault || timeoutFault) {
    Serial.println(F("ERR fault is latched; release all sensors and use CLEAR_FAULT"));
    return;
  }
  if (!commissioningEstopReady()) {
    Serial.println(F("ERR commissioning E-stop safety gate is not satisfied"));
    return;
  }
  if (anyHomeSensorActive()) {
    Serial.println(F("ERR a home sensor is active"));
    return;
  }

  disableAllDrivers();
  if (!driverCommunicating(port)) {
    Serial.println(F("ERR selected driver is unpowered or not communicating"));
    return;
  }
  configureDriver(*drivers[port], config::kDiscoveryCurrentMa[port]);
  if (!driverCommunicating(port)) {
    Serial.println(F("ERR selected driver failed its post-configuration check"));
    disableAllDrivers();
    return;
  }
  digitalWrite(kDirectionPins[port], direction ? HIGH : LOW);
  digitalWrite(kEnablePins[port], LOW);
  delay(config::kDiscoveryDriverSettleMs);
  if (!driverCommunicating(port) || anyHomeSensorActive()) {
    Serial.println(F("ERR commissioning pre-motion safety recheck failed"));
    disableAllDrivers();
    return;
  }
  discovery.active = true;
  discovery.kind = DiscoveryMove::Kind::kMotor;
  discovery.port = port;
  discovery.joint = config::kUnmapped;
  discovery.stepsRemaining = steps;
  discovery.pulseHigh = false;
  discovery.sensorCandidate = false;
  discovery.sensorCandidateSinceMs = 0;
  discovery.lastTransitionUs = micros();
  Serial.println(F("OK finite discovery move started"));
}

void startHomeTest(uint8_t joint, uint16_t steps) {
  if (!config::kCommissioningMotionEnabled) {
    Serial.println(F("ERR commissioning motion is compile-locked"));
    return;
  }
  if (joint >= kJointCount || steps == 0 || steps > config::kMaximumHomeTestSteps) {
    Serial.println(F("ERR invalid joint or step count"));
    return;
  }
  if (!config::kHomeSensorMechanicallyAvailable[joint]) {
    Serial.println(F("ERR HOME_TEST blocked; mechanical sensor target is not installed"));
    return;
  }
  if (latchedFault || timeoutFault) {
    Serial.println(F("ERR fault is latched; release all sensors and use CLEAR_FAULT"));
    return;
  }
  if (!commissioningEstopReady()) {
    Serial.println(F("ERR commissioning E-stop safety gate is not satisfied"));
    return;
  }
  if (anyHomeSensorActive()) {
    Serial.println(F("ERR a home sensor is already active"));
    return;
  }

  disableAllDrivers();
  const uint8_t port = config::kJointToMotorPort[joint];
  if (!driverCommunicating(port)) {
    Serial.println(F("ERR selected driver is unpowered or not communicating"));
    return;
  }
  configureDriver(*drivers[port], config::kDiscoveryCurrentMa[port]);
  if (!driverCommunicating(port)) {
    Serial.println(F("ERR selected driver failed its post-configuration check"));
    disableAllDrivers();
    return;
  }

  const bool rawDirectionHigh =
      config::kHomingDirectionPositive[joint] != config::kDirectionInverted[joint];
  digitalWrite(kDirectionPins[port], rawDirectionHigh ? HIGH : LOW);
  digitalWrite(kEnablePins[port], LOW);
  delay(config::kDiscoveryDriverSettleMs);
  if (!emergencyStopSafe() || !driverCommunicating(port) || anyHomeSensorActive()) {
    Serial.println(F("ERR HOME_TEST pre-motion safety recheck failed"));
    disableAllDrivers();
    return;
  }

  discovery.active = true;
  discovery.kind = DiscoveryMove::Kind::kHome;
  discovery.port = port;
  discovery.joint = joint;
  discovery.stepsRemaining = steps;
  discovery.pulseHigh = false;
  discovery.sensorCandidate = false;
  discovery.sensorCandidateSinceMs = 0;
  discovery.lastTransitionUs = micros();
  Serial.print(F("OK finite HOME_TEST J"));
  Serial.print(joint + 1);
  Serial.println(F(" started"));
}

void serviceDiscoveryMove() {
  if (!discovery.active) return;
  // serviceSafety handles E-stop loss first in every loop.

  if (discovery.kind == DiscoveryMove::Kind::kHome) {
    if (anyOtherHomeSensorActive(discovery.joint)) {
      setFault();
      Serial.println(F("ERR unrelated home sensor activated; driver disabled"));
      return;
    }

    if (stopActiveForJoint(discovery.joint)) {
      // Pause immediately, then require 25 ms of continuous activation so a
      // one-sample electrical glitch cannot be accepted as a home event.
      if (discovery.pulseHigh) {
        digitalWrite(kStepPins[discovery.port], LOW);
        discovery.pulseHigh = false;
        if (discovery.stepsRemaining > 0) --discovery.stepsRemaining;
      }
      if (!discovery.sensorCandidate) {
        discovery.sensorCandidate = true;
        discovery.sensorCandidateSinceMs = millis();
      }
      if (millis() - discovery.sensorCandidateSinceMs < 25U) return;

      const bool seekRawDirectionHigh =
          config::kHomingDirectionPositive[discovery.joint] !=
          config::kDirectionInverted[discovery.joint];
      digitalWrite(kDirectionPins[discovery.port], seekRawDirectionHigh ? LOW : HIGH);
      discovery.kind = DiscoveryMove::Kind::kHomeBackoff;
      discovery.stepsRemaining = config::kHomeBackoffSteps[discovery.joint];
      discovery.sensorCandidate = false;
      discovery.sensorCandidateSinceMs = 0;
      discovery.lastTransitionUs = micros();
      Serial.print(F("OK HOME_TEST J"));
      Serial.print(discovery.joint + 1);
      Serial.println(F(" sensor qualified; backing off 10 degrees"));
      return;
    }
    discovery.sensorCandidate = false;
  } else if (discovery.kind == DiscoveryMove::Kind::kHomeBackoff) {
    if (anyOtherHomeSensorActive(discovery.joint)) {
      setFault();
      Serial.println(F("ERR unrelated home sensor activated; driver disabled"));
      return;
    }
  } else if (anyHomeSensorActive()) {
    setFault();
    Serial.println(F("ERR home sensor activated; driver disabled"));
    return;
  }

  if (discovery.stepsRemaining == 0) {
    if (discovery.kind == DiscoveryMove::Kind::kHomeBackoff) {
      const uint8_t joint = discovery.joint;
      discovery.active = false;
      commissioningHoldActive = true;
      commissioningHoldJoint = joint;
      digitalWrite(kStepPins[discovery.port], LOW);
      Serial.print(stopActiveForJoint(joint) ? F("ERR HOME_TEST J")
                                            : F("DONE HOME_TEST J"));
      Serial.print(joint + 1);
      Serial.println(stopActiveForJoint(joint)
                         ? F(" backed off 10 degrees but sensor remains active; driver holding")
                         : F(" backed off 10 degrees; driver holding"));
      return;
    }
    if (discovery.kind == DiscoveryMove::Kind::kHome) {
      const uint8_t joint = discovery.joint;
      discovery.active = false;
      commissioningHoldActive = true;
      commissioningHoldJoint = joint;
      digitalWrite(kStepPins[discovery.port], LOW);
      Serial.print(F("ERR HOME_TEST J"));
      Serial.print(joint + 1);
      Serial.println(F(" limit not reached; driver holding"));
      return;
    }
    const uint8_t port = discovery.port;
    discovery.active = false;
    digitalWrite(kEnablePins[port], HIGH);
    Serial.println(F("DONE discovery move; driver disabled"));
    return;
  }

  const uint32_t interval =
      discovery.kind == DiscoveryMove::Kind::kHome
          ? config::kHomeTestStepIntervalUs
          : (discovery.kind == DiscoveryMove::Kind::kHomeBackoff
                 ? config::kHomeBackoffStepIntervalUs
                 : config::kDiscoveryStepIntervalUs);
  const uint32_t halfPeriod = interval / 2U;
  if (micros() - discovery.lastTransitionUs < halfPeriod) return;
  discovery.lastTransitionUs = micros();
  discovery.pulseHigh = !discovery.pulseHigh;
  digitalWrite(kStepPins[discovery.port], discovery.pulseHigh ? HIGH : LOW);
  if (!discovery.pulseHigh) {
    --discovery.stepsRemaining;
    if (discovery.kind == DiscoveryMove::Kind::kMotor) {
      if (anyHomeSensorActive()) {
        setFault();
        Serial.println(F("ERR home sensor activated; driver disabled"));
      } else if (discovery.stepsRemaining == 0) {
        const uint8_t port = discovery.port;
        discovery.active = false;
        digitalWrite(kEnablePins[port], HIGH);
      Serial.println(F("DONE discovery move; driver disabled"));
      }
    }
  }
}

void failStartupCalibration(const __FlashStringHelper* reason) {
  setFault();
  calibration.phase = StartupCalibration::Phase::kFault;
  Serial.print(F("ERR startup calibration failed: "));
  Serial.println(reason);
}

bool isStartupCalibrationJoint(uint8_t joint) {
  for (uint8_t index = 0; index < config::kStartupCalibrationJointCount; ++index) {
    if (config::kStartupCalibrationJoints[index] == joint) return true;
  }
  return false;
}

bool anyNonCalibrationHomeSensorActive() {
  for (uint8_t joint = 0; joint < kJointCount; ++joint) {
    if (!isStartupCalibrationJoint(joint) && stopActiveForJoint(joint)) return true;
  }
  return false;
}

bool prepareConcurrentCalibrationSeek() {
  if (anyHomeSensorActive()) {
    failStartupCalibration(F("a home sensor is active before the concurrent seek"));
    return false;
  }

  const uint32_t nowUs = micros();
  for (uint8_t index = 0; index < config::kStartupCalibrationJointCount; ++index) {
    const uint8_t joint = config::kStartupCalibrationJoints[index];
    const uint8_t port = config::kJointToMotorPort[joint];
    if (!config::kHomeSensorMechanicallyAvailable[joint] ||
        !config::kHomingValidated[joint]) {
      failStartupCalibration(F("joint sensor path is not validated"));
      return false;
    }
    if (!driverCommunicating(port)) {
      failStartupCalibration(F("a calibration driver is unpowered or not communicating"));
      return false;
    }

    CalibrationJointState& state = calibration.joints[index];
    state = CalibrationJointState{};
    state.joint = joint;
    state.phase = CalibrationJointState::Phase::kSeeking;
    state.stepsRemaining = config::kCalibrationMaximumSeekSteps[joint];
    state.lastTransitionUs = nowUs;
    const bool rawDirectionHigh =
        config::kHomingDirectionPositive[joint] != config::kDirectionInverted[joint];
    digitalWrite(kDirectionPins[port], rawDirectionHigh ? HIGH : LOW);
    digitalWrite(kStepPins[port], LOW);

    Serial.print(F("OK CALIBRATE_STARTUP concurrent seek J"));
    Serial.print(joint + 1U);
    Serial.print(F(" for at most "));
    Serial.print(state.stepsRemaining);
    Serial.println(F(" microsteps"));
  }
  calibration.phase = StartupCalibration::Phase::kSeeking;
  return true;
}

void startConcurrentCalibrationHomeMoves() {
  for (uint8_t index = 0; index < config::kStartupCalibrationJointCount; ++index) {
    CalibrationJointState& state = calibration.joints[index];
    const uint8_t joint = state.joint;
    const uint8_t port = config::kJointToMotorPort[joint];
    steppers[port]->setMaxSpeed(config::kCalibrationHomeMaxSpeed[joint]);
    steppers[port]->setAcceleration(config::kCalibrationHomeAcceleration[joint]);
    steppers[port]->moveTo(config::kCalibrationHomeSteps[joint]);
    state.phase = CalibrationJointState::Phase::kMovingHome;
    state.stepsRemaining = static_cast<uint32_t>(abs(
        config::kCalibrationHomeSteps[joint] -
        config::kCalibrationSensorReferenceSteps[joint]));
    Serial.print(F("OK CALIBRATE_STARTUP J"));
    Serial.print(joint + 1U);
    Serial.print(F(" moving concurrently to home "));
    Serial.println(config::kCalibrationHomeSteps[joint]);
  }
  calibration.phase = StartupCalibration::Phase::kMovingHome;
}

void startStartupCalibration() {
  if (!config::kCommissioningMotionEnabled) {
    Serial.println(F("ERR startup calibration is compile-locked"));
    return;
  }
  if (enabled || discovery.active || commissioningHoldActive ||
      calibration.active || calibration.holdActive) {
    Serial.println(F("ERR disable all other motion before startup calibration"));
    return;
  }
  if (latchedFault || timeoutFault) {
    Serial.println(F("ERR fault is latched; make sensors safe and use CLEAR_FAULT"));
    return;
  }
  if (!mappingsAreComplete() || !allHomingValidated() || !commissioningEstopReady()) {
    Serial.println(F("ERR startup calibration safety prerequisites are incomplete"));
    return;
  }

  disableAllDrivers();
  // The accepted ASCII control request starts a fresh watchdog window. Binary
  // Commander heartbeats must then arrive throughout the non-blocking settle
  // and every subsequent calibration phase.
  lastCommanderPacketMs = millis();
  calibration.active = true;
  calibration.holdActive = false;
  calibration.phase = StartupCalibration::Phase::kPreparingHold;
  calibration.holdPrepareJoint = 0;
  referencedJointMask = 0;
  Serial.println(F("OK CALIBRATE_STARTUP preparing six-joint stationary hold"));
}

void serviceStartupCalibration() {
  if (!calibration.active) return;

  if (calibration.phase == StartupCalibration::Phase::kPreparingHold) {
    if (calibration.holdPrepareJoint >= kJointCount) {
      calibration.phase = StartupCalibration::Phase::kSettlingHold;
      calibration.driverSettleStartedMs = millis();
      Serial.println(F("OK CALIBRATE_STARTUP all mapped joints holding; settling drivers"));
      return;
    }
    const uint8_t holdJoint = calibration.holdPrepareJoint;
    const uint8_t holdPort = config::kJointToMotorPort[holdJoint];
    if (!driverCommunicating(holdPort)) {
      failStartupCalibration(F("hold driver is unpowered or not communicating"));
      return;
    }
    configureDriver(*drivers[holdPort], config::kDiscoveryCurrentMa[holdPort]);
    steppers[holdPort]->setPinsInverted(
        config::kDirectionInverted[holdJoint], false, false);
    digitalWrite(kStepPins[holdPort], LOW);
    digitalWrite(kEnablePins[holdPort], LOW);
    if (!driverCommunicating(holdPort)) {
      failStartupCalibration(F("hold driver failed its post-configuration check"));
      return;
    }
    ++calibration.holdPrepareJoint;
    return;
  }

  if (calibration.phase == StartupCalibration::Phase::kSettlingHold) {
    if (millis() - calibration.driverSettleStartedMs <
        config::kDiscoveryDriverSettleMs) return;
    if (!commissioningEstopReady()) {
      failStartupCalibration(F("all-joint hold safety recheck failed"));
      return;
    }
    Serial.println(F("OK CALIBRATE_STARTUP six-joint hold qualified; simultaneous J2,J3,J4 seek started"));
    prepareConcurrentCalibrationSeek();
    return;
  }

  if (anyNonCalibrationHomeSensorActive()) {
    failStartupCalibration(F("a non-calibration home sensor activated"));
    return;
  }

  if (calibration.phase == StartupCalibration::Phase::kSeeking) {
    for (uint8_t index = 0; index < config::kStartupCalibrationJointCount; ++index) {
      CalibrationJointState& state = calibration.joints[index];
      const uint8_t joint = state.joint;
      const uint8_t port = config::kJointToMotorPort[joint];
      const bool targetSensorActive = stopActiveForJoint(joint);

      if (state.phase == CalibrationJointState::Phase::kSeeking) {
        if (targetSensorActive) {
          if (state.pulseHigh) {
            digitalWrite(kStepPins[port], LOW);
            state.pulseHigh = false;
            if (state.stepsRemaining > 0) --state.stepsRemaining;
            ++state.stepsTaken;
          }
          state.phase = CalibrationJointState::Phase::kQualifying;
          state.sensorQualificationActive = true;
          state.sensorCandidateSinceMs = millis();
          state.sensorEdgeDetectedMs = state.sensorCandidateSinceMs;
          Serial.print(F("OK CALIBRATE_STARTUP J"));
          Serial.print(joint + 1U);
          Serial.println(F(" sensor edge detected; this joint latched off for qualification"));
          continue;
        }
        if (state.stepsRemaining == 0) {
          Serial.print(F("ERR CALIBRATE_STARTUP J"));
          Serial.println(joint + 1U);
          failStartupCalibration(F("a sensor was not reached inside its bounded concurrent seek"));
          return;
        }
        const uint32_t halfPeriod = config::kCalibrationSeekStepIntervalUs / 2U;
        if (micros() - state.lastTransitionUs >= halfPeriod) {
          state.lastTransitionUs = micros();
          state.pulseHigh = !state.pulseHigh;
          digitalWrite(kStepPins[port], state.pulseHigh ? HIGH : LOW);
          if (!state.pulseHigh) {
            --state.stepsRemaining;
            ++state.stepsTaken;
          }
        }
        continue;
      }

      if (state.phase != CalibrationJointState::Phase::kQualifying) continue;
      if (!targetSensorActive) {
        state.sensorQualificationActive = false;
        if (millis() - state.sensorEdgeDetectedMs >=
            config::kCalibrationSensorQualificationTimeoutMs) {
          failStartupCalibration(F("a target sensor did not remain active for qualification"));
          return;
        }
        continue;
      }
      if (!state.sensorQualificationActive) {
        state.sensorQualificationActive = true;
        state.sensorCandidateSinceMs = millis();
      }
      if (millis() - state.sensorCandidateSinceMs <
          config::kCalibrationSensorQualificationMs) continue;

      digitalWrite(kStepPins[port], LOW);
      steppers[port]->setCurrentPosition(
          config::kCalibrationSensorReferenceSteps[joint]);
      state.phase = CalibrationJointState::Phase::kSensorQualified;
      state.stepsRemaining = 0;
      Serial.print(F("OK CALIBRATE_STARTUP J"));
      Serial.print(joint + 1U);
      Serial.print(F(" sensor qualified at "));
      Serial.print(config::kCalibrationSensorReferenceSteps[joint]);
      Serial.println(F("; holding until all three sensors qualify"));
    }

    bool allSensorsQualified = true;
    for (uint8_t index = 0; index < config::kStartupCalibrationJointCount; ++index) {
      if (calibration.joints[index].phase !=
          CalibrationJointState::Phase::kSensorQualified) {
        allSensorsQualified = false;
        break;
      }
    }
    if (allSensorsQualified) startConcurrentCalibrationHomeMoves();
    return;
  }

  if (calibration.phase != StartupCalibration::Phase::kMovingHome) return;
  bool allHome = true;
  for (uint8_t index = 0; index < config::kStartupCalibrationJointCount; ++index) {
    CalibrationJointState& state = calibration.joints[index];
    if (state.phase == CalibrationJointState::Phase::kComplete) continue;
    allHome = false;
    const uint8_t joint = state.joint;
    const uint8_t port = config::kJointToMotorPort[joint];
    if (steppers[port]->distanceToGo() != 0) {
      const int32_t before = steppers[port]->currentPosition();
      steppers[port]->run();
      const int32_t after = steppers[port]->currentPosition();
      if (after != before) {
        ++state.stepsTaken;
        if (state.stepsRemaining > 0) --state.stepsRemaining;
      }
      continue;
    }
    if (stopActiveForJoint(joint)) {
      failStartupCalibration(F("a sensor remained active at its configured home position"));
      return;
    }
    state.phase = CalibrationJointState::Phase::kComplete;
    state.stepsRemaining = 0;
    referencedJointMask |= jointReferenceBit(joint);
    Serial.print(F("DONE CALIBRATE_STARTUP J"));
    Serial.print(joint + 1U);
    Serial.println(F(" referenced and holding at home"));
  }

  allHome = true;
  for (uint8_t index = 0; index < config::kStartupCalibrationJointCount; ++index) {
    if (calibration.joints[index].phase != CalibrationJointState::Phase::kComplete) {
      allHome = false;
      break;
    }
  }
  if (!allHome) return;

  calibration.active = false;
  calibration.holdActive = true;
  calibration.phase = StartupCalibration::Phase::kComplete;
  Serial.println(F("DONE CALIBRATE_STARTUP J2,J3,J4 referenced simultaneously; calibrated hold active"));
}

bool parseBoundedSteps(const char* text, uint16_t maximum, uint16_t& result) {
  if (text == nullptr || text[0] == '\0' || text[0] == '-') return false;
  char* end = nullptr;
  const unsigned long value = strtoul(text, &end, 10);
  if (end == text || *end != '\0' || value == 0 || value > maximum) return false;
  result = static_cast<uint16_t>(value);
  return true;
}

void clearCommissioningFault() {
  disableAllDrivers();
  if (!emergencyStopSafe()) {
    Serial.println(F("ERR cannot clear fault while E-stop motor power is absent"));
    return;
  }
  if (anyHomeSensorActive()) {
    Serial.println(F("ERR cannot clear fault while a home sensor is active"));
    return;
  }
  latchedFault = false;
  timeoutFault = false;
  Serial.println(F("OK fault cleared; all drivers disabled"));
}

void handleAsciiCommand(char* line) {
  char* command = strtok(line, " ");
  if (command == nullptr) return;
  if (strcmp(command, "STATUS") == 0 || strcmp(command, "HELLO") == 0) {
    printStatus();
  } else if (strcmp(command, "SENSORS") == 0) {
    printSensors();
  } else if (strcmp(command, "DRIVERS") == 0) {
    printDrivers();
  } else if (strcmp(command, "DRIVER_DIAG") == 0) {
    char* portText = strtok(nullptr, " ");
    char* extra = strtok(nullptr, " ");
    if (portText == nullptr || extra != nullptr || portText[1] != '\0' ||
        portText[0] < '0' || portText[0] > '7') {
      Serial.println(F("ERR use DRIVER_DIAG <0-7>"));
      return;
    }
    printDriverDiagnostics(static_cast<uint8_t>(portText[0] - '0'));
  } else if (strcmp(command, "DISABLE") == 0 || strcmp(command, "STOP") == 0) {
    disableAllDrivers();
    Serial.println(F("OK all drivers disabled"));
  } else if (strcmp(command, "CLEAR_FAULT") == 0) {
    clearCommissioningFault();
  } else if (strcmp(command, "FAN") == 0) {
    char* state = strtok(nullptr, " ");
    char* extra = strtok(nullptr, " ");
    if (state == nullptr || extra != nullptr ||
        (strcmp(state, "AUTO") != 0 && strcmp(state, "FULL") != 0 &&
         strcmp(state, "ON") != 0 && strcmp(state, "OFF") != 0)) {
      Serial.println(F("ERR use FAN AUTO|FULL|OFF"));
      return;
    }
    if (strcmp(state, "OFF") == 0) {
      setControllerFanMode(ControllerFanMode::kOff);
    } else if (strcmp(state, "AUTO") == 0) {
      setControllerFanMode(ControllerFanMode::kAuto);
    } else {
      // FAN ON remains a compatibility alias for an explicit full-speed request.
      setControllerFanMode(ControllerFanMode::kFull);
    }
    Serial.print(F("OK FAN "));
    Serial.print(controllerFanModeName());
    Serial.print(' ');
    Serial.print(controllerFanSpeedPercent);
    Serial.println('%');
  } else if (strcmp(command, "CALIBRATE_STARTUP") == 0) {
    char* token = strtok(nullptr, " ");
    char* extra = strtok(nullptr, " ");
    if (token == nullptr || extra != nullptr ||
        strcmp(token, "I_UNDERSTAND") != 0) {
      Serial.println(F("ERR use CALIBRATE_STARTUP I_UNDERSTAND"));
      return;
    }
    startStartupCalibration();
  } else if (strcmp(command, "MOTOR_TEST") == 0) {
    char* portText = strtok(nullptr, " ");
    char* directionText = strtok(nullptr, " ");
    char* stepsText = strtok(nullptr, " ");
    char* token = strtok(nullptr, " ");
    char* extra = strtok(nullptr, " ");
    uint16_t steps = 0;
    if (portText == nullptr || directionText == nullptr || stepsText == nullptr ||
        token == nullptr || extra != nullptr || portText[1] != '\0' ||
        portText[0] < '0' || portText[0] > '7' || directionText[1] != '\0' ||
        (directionText[0] != '0' && directionText[0] != '1') ||
        strcmp(token, "I_UNDERSTAND") != 0 ||
        !parseBoundedSteps(stepsText, config::kMaximumDiscoverySteps, steps)) {
        Serial.println(F("ERR use MOTOR_TEST <0-7> <0|1> <1-2000> I_UNDERSTAND"));
      return;
    }
    startDiscoveryMove(static_cast<uint8_t>(portText[0] - '0'), directionText[0] == '1',
                       steps);
  } else if (strcmp(command, "HOME_TEST") == 0) {
    char* jointText = strtok(nullptr, " ");
    char* stepsText = strtok(nullptr, " ");
    char* token = strtok(nullptr, " ");
    char* extra = strtok(nullptr, " ");
    uint16_t steps = 0;
    if (jointText == nullptr || stepsText == nullptr || token == nullptr ||
        extra != nullptr || jointText[1] != '\0' || jointText[0] < '1' ||
        jointText[0] > '6' || strcmp(token, "I_UNDERSTAND") != 0 ||
        !parseBoundedSteps(stepsText, config::kMaximumHomeTestSteps, steps)) {
      Serial.println(F("ERR use HOME_TEST <1-6> <1-2000> I_UNDERSTAND"));
      return;
    }
    startHomeTest(static_cast<uint8_t>(jointText[0] - '1'),
                  steps);
  } else {
    Serial.println(F("ERR commands: STATUS SENSORS DRIVERS DRIVER_DIAG FAN(AUTO|FULL|OFF) DISABLE CLEAR_FAULT CALIBRATE_STARTUP MOTOR_TEST HOME_TEST"));
  }
}

void serviceSerial() {
  while (Serial.available() > 0) {
    const uint8_t value = static_cast<uint8_t>(Serial.read());
    if (binaryLength != 0 || awaitingBinaryLength || binaryHeaderCount != 0 ||
        value == protocol::kHeader) {
      processBinaryByte(value);
      continue;
    }

    if (value == '\r') continue;
    if (value == '\n') {
      asciiBuffer[asciiLength] = '\0';
      handleAsciiCommand(asciiBuffer);
      asciiLength = 0;
    } else if (value >= 32 && value <= 126 && asciiLength + 1 < kAsciiBufferLength) {
      asciiBuffer[asciiLength++] = static_cast<char>(value);
    } else {
      asciiLength = 0;
    }
  }
}

}  // namespace
}  // namespace robarm

void setup() {
  robarm::initializeHardware();
  Serial.begin(3000000);
}

void loop() {
  robarm::serviceSafety();
  robarm::serviceControllerFan();
  robarm::serviceSerial();
  robarm::serviceDiscoveryMove();
  robarm::serviceStartupCalibration();
  robarm::serviceRobotMotion();
}
