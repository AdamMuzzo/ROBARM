import { describe, expect, it } from 'vitest';
import { EXPECTED_IDENTITY, FIXED_LEGACY_CRC } from '../src/core/protocol';
import { RobarmStreamParser } from '../src/core/streamParser';

function replyFrame() {
  const frame = new Uint8Array(60);
  frame.set([255, 255, 255, 56], 0);
  const body = frame.subarray(4);
  body[44] = EXPECTED_IDENTITY.device;
  body[46] = EXPECTED_IDENTITY.protocolVersion;
  body[47] = 0x52;
  body[48] = 0x42;
  body[50] = EXPECTED_IDENTITY.configVersion;
  body[51] = EXPECTED_IDENTITY.magic1;
  body[52] = EXPECTED_IDENTITY.magic2;
  body[53] = FIXED_LEGACY_CRC;
  body[54] = 1;
  body[55] = 2;
  return frame;
}

describe('mixed serial stream parser', () => {
  it('waits for and decodes a fragmented binary frame', () => {
    const parser = new RobarmStreamParser();
    const frame = replyFrame();
    expect(parser.push(frame.slice(0, 17))).toEqual([]);
    const events = parser.push(frame.slice(17));
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe('telemetry');
  });

  it('separates ASCII status lines from binary replies', () => {
    const parser = new RobarmStreamParser();
    const line = new TextEncoder().encode('{"state":83}\n');
    const combined = new Uint8Array(line.length + 60);
    combined.set(line, 0);
    combined.set(replyFrame(), line.length);
    expect(parser.push(combined).map((event) => event.kind)).toEqual(['line', 'telemetry']);
  });
});

