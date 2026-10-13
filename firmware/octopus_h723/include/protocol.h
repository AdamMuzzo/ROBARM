#pragma once

#include <Arduino.h>

namespace robarm::protocol {

constexpr uint8_t kHeader = 0xFF;
constexpr uint8_t kEnd1 = 0x01;
constexpr uint8_t kEnd2 = 0x02;
constexpr uint8_t kLegacyCrc = 228;
constexpr uint8_t kPcBodyLength = 52;
constexpr uint8_t kRobotBodyLength = 56;

// ROBARM identity occupies the unused legacy gripper telemetry fields. The
// Commander safety layer requires the complete tuple before allowing motion.
constexpr uint8_t kIdentityDevice = 0xA6;
constexpr uint16_t kIdentityProtocolVersion = 1;
constexpr uint16_t kIdentityTag = 0x5242;  // ASCII "RB".
constexpr uint16_t kIdentityConfigVersion = 11;
constexpr uint8_t kIdentityMagic1 = 0x52;
constexpr uint8_t kIdentityMagic2 = 0x42;

constexpr uint8_t kCommandHome = 100;
constexpr uint8_t kCommandEnable = 101;
constexpr uint8_t kCommandDisable = 102;
constexpr uint8_t kCommandClearError = 103;
constexpr uint8_t kCommandJog = 123;
constexpr uint8_t kCommandPosition = 156;
constexpr uint8_t kCommandDummy = 255;

enum class FirmwareState : uint8_t {
  kCommissioningLocked = 0x52,
  kReadyDisabled = 0x53,
  kEnabled = 0x54,
  kFault = 0x55,
  kCalibrating = 0x56,
  kCalibrationHold = 0x57,
};

struct CommanderPacket {
  int32_t position[6]{};
  int32_t speed[6]{};
  uint8_t command = kCommandDummy;
  uint8_t affected = 0;
  uint8_t io = 0;
  uint8_t timeout = 0;
};

int32_t decodeSigned24(const uint8_t* bytes);
void encodeSigned24(int32_t value, uint8_t* bytes);
bool decodeCommanderBody(const uint8_t* body, size_t length, CommanderPacket& packet);

}  // namespace robarm::protocol
