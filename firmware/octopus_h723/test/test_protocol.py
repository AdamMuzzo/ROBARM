from pathlib import Path


def signed24(value: int) -> bytes:
    return (value & 0xFFFFFF).to_bytes(3, "big")


def make_commander_frame(command: int = 255) -> bytes:
    body = b"".join(signed24(v) for v in (-1, 0, 1, 0x7FFFFF, -0x800000, 42))
    body += b"".join(signed24(0) for _ in range(6))
    body += bytes((command, 0xFC, 0, 0))
    body += bytes(9)
    body += bytes((228, 1, 2))
    assert len(body) == 52
    return b"\xff\xff\xff" + bytes((len(body),)) + body


def test_commander_frame_layout():
    frame = make_commander_frame()
    assert len(frame) == 56
    assert frame[:4] == b"\xff\xff\xff\x34"
    assert frame[-3:] == bytes((228, 1, 2))


def test_stage_one_commissioning_limits():
    config = (Path(__file__).parents[1] / "include" / "robot_config.h").read_text()
    assert "kCommissioningMotionEnabled = true" in config
    assert "kRobotMappingVerified = true" in config
    assert "kFullRobotMotionEnabled = true" in config
    assert "kHardwareEstopCutsMotorPower = true" in config
    assert "kUseDriverPowerEstopFeedback = true" in config
    assert "0, 1, 2, 5, 4, 3" in config
    assert "{false, false, false, false, true, false}" in config
    assert (
        "kDiscoveryCurrentMa[8] = {900, 900, 900, 900, 900, 900, 900, 900}"
        in config
    )
    assert "kMaximumDiscoverySteps = 2000" in config
    assert "kDiscoveryStepIntervalUs = 2500" in config
    assert "kDiscoveryDriverSettleMs = 100" in config
    assert "kMaximumHomeTestSteps = 2000" in config
    assert "kHomeTestStepIntervalUs = 5000" in config
    assert "kHomeBackoffSteps[6] = {1138, 3556, 3217, 711, 711, 1778}" in config
    assert "kHomeBackoffStepIntervalUs = 2500" in config
    assert "{true, true, false, true, false, true}" in config
    assert "{true, true, true, true, false, false}" in config
    assert "{true, true, true, true, false, false}" in config


def test_discovery_requires_live_driver_and_stops_on_home_sensor():
    source = (Path(__file__).parents[1] / "src" / "main.cpp").read_text()
    assert "if (!driverCommunicating(port))" in source
    assert "if (anyHomeSensorActive())" in source
    assert "anyHomeSensorActive()) {" in source
    assert "delay(config::kDiscoveryDriverSettleMs)" in source
    assert "commissioning pre-motion safety recheck failed" in source


def test_estop_uses_verified_driver_power_feedback():
    source = (Path(__file__).parents[1] / "src" / "main.cpp").read_text()
    assert "bool mappedDriverPowerPresent()" in source
    assert "if (config::kUseDriverPowerEstopFeedback) return mappedDriverPowerPresent();" in source
    assert "if (enabled && !emergencyStopSafe()) setFault();" in source
    assert "if (discovery.active && !emergencyStopSafe()) {" in source
    assert 'Serial.println(F("ERR E-stop motor power lost; driver disabled"))' in source
    assert 'Serial.print(F("driver_power"))' in source


def test_home_test_is_bounded_sensor_targeted_and_separately_confirmed():
    source = (Path(__file__).parents[1] / "src" / "main.cpp").read_text()
    assert "void startHomeTest(uint8_t joint, uint16_t steps)" in source
    assert "steps > config::kMaximumHomeTestSteps" in source
    assert "config::kHomingDirectionPositive[joint] != config::kDirectionInverted[joint]" in source
    assert "if (stopActiveForJoint(discovery.joint))" in source
    assert "if (anyOtherHomeSensorActive(discovery.joint))" in source
    assert 'strcmp(command, "HOME_TEST") == 0' in source
    assert 'strcmp(token, "I_UNDERSTAND") != 0' in source
    assert "millis() - discovery.sensorCandidateSinceMs < 25U" in source
    assert "kHomeSensorMechanicallyAvailable[joint]" in source
    assert "DiscoveryMove::Kind::kHomeBackoff" in source
    assert "config::kHomeBackoffSteps[discovery.joint]" in source
    assert 'F(" sensor qualified; backing off 10 degrees")' in source
    assert 'F(" backed off 10 degrees; driver holding")' in source
    assert "commissioningHoldActive = true" in source


def test_commissioning_hold_requires_explicit_disable_and_monitors_estop():
    source = (Path(__file__).parents[1] / "src" / "main.cpp").read_text()
    assert "commissioningHoldActive = false" in source
    assert "commissioningHoldJoint = config::kUnmapped" in source
    assert "if (commissioningHoldActive && !emergencyStopSafe())" in source
    assert r'\"commissioning_hold\":' in source
    assert r'\"holding_joint\":' in source
    assert 'strcmp(command, "DISABLE") == 0' in source


def test_faulted_commissioning_requires_explicit_safe_clear():
    source = (Path(__file__).parents[1] / "src" / "main.cpp").read_text()
    assert "if (latchedFault || timeoutFault)" in source
    assert 'strcmp(command, "CLEAR_FAULT") == 0' in source
    assert "if (anyHomeSensorActive())" in source
    assert 'Serial.println(F("OK fault cleared; all drivers disabled"))' in source


def test_driver_diagnostics_are_read_only():
    source = (Path(__file__).parents[1] / "src" / "main.cpp").read_text()
    start = source.index("void printDriverDiagnostics")
    end = source.index("void startDiscoveryMove", start)
    diagnostic = source[start:end]
    assert "GSTAT()" in diagnostic
    assert "DRV_STATUS()" in diagnostic
    assert "IOIN()" in diagnostic
    assert "CHOPCONF()" in diagnostic
    assert "IHOLD_IRUN()" in diagnostic
    assert "digitalWrite" not in diagnostic
    assert "move" not in diagnostic.lower()


def test_commander_reply_contains_robarm_identity():
    protocol = (Path(__file__).parents[1] / "include" / "protocol.h").read_text()
    source = (Path(__file__).parents[1] / "src" / "main.cpp").read_text()
    assert "kIdentityDevice = 0xA6" in protocol
    assert "kIdentityTag = 0x5242" in protocol
    assert "kIdentityMagic1 = 0x52" in protocol
    assert "kIdentityMagic2 = 0x42" in protocol
    assert "body[44] = protocol::kIdentityDevice" in source
    assert "body[51] = protocol::kIdentityMagic1" in source
    assert "body[52] = protocol::kIdentityMagic2" in source


def test_startup_calibration_is_ordered_bounded_and_uses_absolute_references():
    config = (Path(__file__).parents[1] / "include" / "robot_config.h").read_text()
    assert "kStartupCalibrationJoints[kStartupCalibrationJointCount] = {1, 2, 3}" in config
    assert "0, 51558, -17300, 7500, 0, 0" in config
    assert "0, 32000, 0, 0, 0, 0" in config
    assert "0, 50358, 34600, 15000, 0, 0" in config
    assert "kCalibrationSeekStepIntervalUs = 833" in config
    assert "0.0F, 2400.0F, 2400.0F, 2400.0F, 0.0F, 0.0F" in config
    assert "0.0F, 3000.0F, 3000.0F, 3000.0F, 0.0F, 0.0F" in config
    assert "kCalibrationSensorQualificationMs = 25" in config
    assert "kCalibrationSensorQualificationTimeoutMs = 250" in config
    assert "kCalibrationSensorReferenceSteps[1] == kJointMaxSteps[1]" in config
    assert "kCalibrationSensorReferenceSteps[2] == kJointMinSteps[2]" in config
    assert "kCalibrationSensorReferenceSteps[3] == kJointMaxSteps[3]" in config


def test_startup_calibration_runs_three_independent_concurrent_sensor_seeks():
    source = (Path(__file__).parents[1] / "src" / "main.cpp").read_text()
    assert 'strcmp(command, "CALIBRATE_STARTUP") == 0' in source
    assert 'strcmp(token, "I_UNDERSTAND") != 0' in source
    assert "void serviceStartupCalibration()" in source
    assert "prepareConcurrentCalibrationSeek()" in source
    assert "CalibrationJointState joints[config::kStartupCalibrationJointCount]" in source
    assert "anyNonCalibrationHomeSensorActive()" in source
    assert "config::kCalibrationSensorQualificationMs" in source
    assert "config::kCalibrationMaximumSeekSteps[joint]" in source
    assert "steppers[port]->setCurrentPosition(" in source
    assert "config::kCalibrationSensorReferenceSteps[joint]" in source
    assert "steppers[port]->moveTo(config::kCalibrationHomeSteps[joint])" in source
    assert 'F("a sensor was not reached inside its bounded concurrent seek")' in source
    assert 'F(" sensor edge detected; this joint latched off for qualification")' in source
    assert 'F("a target sensor did not remain active for qualification")' in source
    assert 'F("a sensor remained active at its configured home position")' in source
    assert "CalibrationJointState::Phase::kSensorQualified" in source
    assert "if (allSensorsQualified) startConcurrentCalibrationHomeMoves();" in source
    assert "steppers[port]->run();" in source
    assert "referencedJointMask |= jointReferenceBit(joint)" in source
    assert "calibration.holdActive = true" in source


def test_startup_calibration_all_joint_hold_and_settle_are_non_blocking():
    source = (Path(__file__).parents[1] / "src" / "main.cpp").read_text()
    service_start = source.index("void serviceStartupCalibration()")
    service_end = source.index("bool parseBoundedSteps", service_start)
    service = source[service_start:service_end]
    assert "delay(config::kDiscoveryDriverSettleMs)" not in service
    assert "StartupCalibration::Phase::kPreparingHold" in service
    assert "StartupCalibration::Phase::kSettlingHold" in service
    assert "calibration.holdPrepareJoint >= kJointCount" in service
    assert "configureDriver(*drivers[holdPort], config::kDiscoveryCurrentMa[holdPort])" in service
    assert "digitalWrite(kEnablePins[holdPort], LOW)" in service
    assert "lastCommanderPacketMs = millis()" in source
    assert "millis() - calibration.driverSettleStartedMs" in source
    assert 'F("all-joint hold safety recheck failed")' in source


def test_startup_reference_is_required_for_motion_and_invalidated_by_disable():
    protocol = (Path(__file__).parents[1] / "include" / "protocol.h").read_text()
    source = (Path(__file__).parents[1] / "src" / "main.cpp").read_text()
    assert "kIdentityConfigVersion = 11" in protocol
    assert "kCalibrating = 0x56" in protocol
    assert "kCalibrationHold = 0x57" in protocol
    assert "mappingsAreComplete() && allHomingValidated() && startupCalibrationComplete()" in source
    disable_start = source.index("void disableAllDrivers()")
    disable_end = source.index("uint8_t jointReferenceBit", disable_start)
    assert "referencedJointMask = 0" in source[disable_start:disable_end]
    assert "body[36] = referencedJointMask" in source
    assert r'\"calibration_complete\":' in source
    assert r'\"calibration_required_mask\":' in source
    assert "enabled || calibration.active || calibration.holdActive" in source


def test_fan0_defaults_on_and_has_explicit_control_and_status():
    pins = (Path(__file__).parents[1] / "include" / "board_pins.h").read_text()
    config = (Path(__file__).parents[1] / "include" / "robot_config.h").read_text()
    source = (Path(__file__).parents[1] / "src" / "main.cpp").read_text()
    assert "kControllerFanPin = PA8" in pins
    assert "pinMode(kControllerFanPin, OUTPUT)" in source
    assert "kControllerFanPwmHz = 100" in config
    assert "kControllerFanIdlePercent = 70" in config
    assert "kControllerFanActivePercent = 100" in config
    assert "analogWrite(kControllerFanPin, duty)" in source
    assert "setControllerFanMode(ControllerFanMode::kAuto)" in source
    assert "motorPowerActiveForCooling()" in source
    assert "serviceControllerFan();" in source
    assert 'strcmp(command, "FAN") == 0' in source
    assert 'F("ERR use FAN AUTO|FULL|OFF")' in source
    assert r'\"fan_supported\":true' in source
    assert r'\"fan_on\":' in source
    assert r'\"fan_mode\":\"' in source
    assert r'\"fan_speed_percent\":' in source
    assert r'\"fan_tach_supported\":false' in source
    assert r'\"fan_startup_default_on\":true' in source


def test_manual_sensor_interlock_blocks_only_the_unsafe_joint_direction():
    source = (Path(__file__).parents[1] / "src" / "main.cpp").read_text()
    service_start = source.index("void serviceRobotMotion()")
    service_end = source.index("bool jointAffected", service_start)
    service = source[service_start:service_end]
    jog_start = source.index("case protocol::kCommandJog:")
    jog_end = source.index("case protocol::kCommandPosition:", jog_start)
    jog = source[jog_start:jog_end]
    assert "((speed > 0.0F) == config::kHomingDirectionPositive[joint])" in service
    assert "if (stopActiveForJoint(joint) && towardSensor) stepper.setSpeed(0.0F);" in service
    assert "stepper.runSpeed();" in service
    assert "stepper.moveTo(stepper.currentPosition());" in service
    assert "sensorBackoffJoint" not in source
    assert "steppers[port]->setMaxSpeed(config::kJointMaxSpeed[joint]);" in jog
    assert "config::kJointMaxSpeed[joint] / 4.0F" not in source


def test_performance_profile_uses_motor_ratings_and_preserves_commissioning_current():
    config = (Path(__file__).parents[1] / "include" / "robot_config.h").read_text()
    assert "kJointRunCurrentMa[6] = {2100, 2100, 2000, 2000, 2000, 965}" in config
    assert "kDiscoveryCurrentMa[8] = {900, 900, 900, 900, 900, 900, 900, 900}" in config
    assert "kJointMaxSpeed[6] = {19200, 32000, 32000, 32000, 32000, 32000}" in config
    assert "kJointAcceleration[6] = {8000, 12000, 12000, 18000, 18000, 18000}" in config
    assert "kJointRunCurrentMa[0] <= 2100" in config
    assert "kJointRunCurrentMa[2] <= 2000" in config
    assert "kJointRunCurrentMa[5] <= 965" in config
