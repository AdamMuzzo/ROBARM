#include "protocol.h"

namespace robarm::protocol {

int32_t decodeSigned24(const uint8_t* bytes) {
  int32_t value = (static_cast<int32_t>(bytes[0]) << 16) |
                  (static_cast<int32_t>(bytes[1]) << 8) |
                  static_cast<int32_t>(bytes[2]);
  if ((value & 0x00800000L) != 0) value |= 0xFF000000L;
  return value;
}

void encodeSigned24(int32_t value, uint8_t* bytes) {
  const uint32_t packed = static_cast<uint32_t>(value) & 0x00FFFFFFUL;
  bytes[0] = static_cast<uint8_t>(packed >> 16);
  bytes[1] = static_cast<uint8_t>(packed >> 8);
  bytes[2] = static_cast<uint8_t>(packed);
}

bool decodeCommanderBody(const uint8_t* body, size_t length, CommanderPacket& packet) {
  if (length != kPcBodyLength || body[49] != kLegacyCrc ||
      body[50] != kEnd1 || body[51] != kEnd2) {
    return false;
  }
  for (uint8_t joint = 0; joint < 6; ++joint) {
    packet.position[joint] = decodeSigned24(&body[joint * 3]);
    packet.speed[joint] = decodeSigned24(&body[18 + joint * 3]);
  }
  packet.command = body[36];
  packet.affected = body[37];
  packet.io = body[38];
  packet.timeout = body[39];
  return true;
}

}  // namespace robarm::protocol

