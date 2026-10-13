import { describe, expect, it } from 'vitest';
import {
  buildCommanderFrame,
  COMMANDS,
  decodeRobotFrame,
  decodeSigned24,
  encodeSigned24,
  EXPECTED_IDENTITY,
  FIXED_LEGACY_CRC,
  identityMatches
} from '../src/core/protocol';

describe('ROBARM protocol', () => {
  it.each([-0x800000, -1, 0, 1, 0x7fffff])('round trips signed 24-bit value %i', (value) => {
    const bytes = new Uint8Array(3);
    encodeSigned24(value, bytes, 0);
    expect(decodeSigned24(bytes, 0)).toBe(value);
  });

  it('builds the exact 56-byte Commander frame', () => {
    const frame = buildCommanderFrame({
      position: [-1, 0, 1, 2, 3, 4],
      speed: [10, -10, 20, -20, 30, -30],
      command: COMMANDS.JOG,
      affected: [true, false, true, false, false, true]
    });
    expect(frame).toHaveLength(56);
    expect([...frame.slice(0, 4)]).toEqual([255, 255, 255, 52]);
    expect(frame[40]).toBe(COMMANDS.JOG);
    expect(frame[41]).toBe(0xa4);
    expect(frame[53]).toBe(FIXED_LEGACY_CRC);
    expect([...frame.slice(-2)]).toEqual([1, 2]);
  });

  it('decodes the ROBARM identity from a firmware reply', () => {
    const frame = new Uint8Array(60);
    frame.set([255, 255, 255, 56], 0);
    const body = frame.subarray(4);
    body[43] = 0x53;
    body[44] = EXPECTED_IDENTITY.device;
    body[45] = 0;
    body[46] = EXPECTED_IDENTITY.protocolVersion;
    body[47] = 0x52;
    body[48] = 0x42;
    body[49] = 0;
    body[50] = EXPECTED_IDENTITY.configVersion;
    body[51] = EXPECTED_IDENTITY.magic1;
    body[52] = EXPECTED_IDENTITY.magic2;
    body[53] = FIXED_LEGACY_CRC;
    body[54] = 1;
    body[55] = 2;
    const telemetry = decodeRobotFrame(frame);
    expect(identityMatches(telemetry.identity)).toBe(true);
    expect(telemetry.state).toBe(0x53);
  });

  it('rejects malformed reply sentinels', () => {
    const frame = new Uint8Array(60);
    frame.set([255, 255, 255, 56], 0);
    expect(() => decodeRobotFrame(frame)).toThrow(/sentinel/);
  });
});

