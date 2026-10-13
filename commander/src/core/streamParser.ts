import { decodeRobotFrame, ROBOT_BODY_LENGTH, type RobotTelemetry } from './protocol';

export type ParsedStreamEvent =
  | { kind: 'telemetry'; telemetry: RobotTelemetry }
  | { kind: 'line'; line: string }
  | { kind: 'error'; message: string; discarded: Uint8Array };

const MAX_ASCII_LINE = 4096;

export class RobarmStreamParser {
  private buffer: number[] = [];
  private readonly decoder = new TextDecoder('ascii', { fatal: false });

  reset() {
    this.buffer = [];
  }

  push(chunk: Uint8Array): ParsedStreamEvent[] {
    this.buffer.push(...chunk);
    const events: ParsedStreamEvent[] = [];

    while (this.buffer.length > 0) {
      if (this.buffer[0] === 0xff) {
        if (this.buffer.length < 4) break;
        if (this.buffer[1] !== 0xff || this.buffer[2] !== 0xff) {
          events.push({ kind: 'error', message: 'invalid binary header', discarded: new Uint8Array([this.buffer.shift()!]) });
          continue;
        }
        const bodyLength = this.buffer[3];
        if (bodyLength !== ROBOT_BODY_LENGTH) {
          events.push({ kind: 'error', message: `unexpected binary body length ${bodyLength}`, discarded: new Uint8Array(this.buffer.splice(0, 4)) });
          continue;
        }
        const frameLength = bodyLength + 4;
        if (this.buffer.length < frameLength) break;
        const frame = new Uint8Array(this.buffer.splice(0, frameLength));
        try {
          events.push({ kind: 'telemetry', telemetry: decodeRobotFrame(frame) });
        } catch (error) {
          events.push({
            kind: 'error',
            message: error instanceof Error ? error.message : 'invalid robot frame',
            discarded: frame
          });
        }
        continue;
      }

      const newline = this.buffer.indexOf(10);
      const nextHeader = this.buffer.indexOf(0xff);
      if (nextHeader > 0 && (newline < 0 || nextHeader < newline)) {
        const discarded = new Uint8Array(this.buffer.splice(0, nextHeader));
        events.push({ kind: 'error', message: 'discarded unterminated ASCII data before binary frame', discarded });
        continue;
      }
      if (newline < 0) {
        if (this.buffer.length <= MAX_ASCII_LINE) break;
        const discarded = new Uint8Array(this.buffer.splice(0, this.buffer.length));
        events.push({ kind: 'error', message: 'ASCII reply exceeded maximum length', discarded });
        continue;
      }
      const bytes = new Uint8Array(this.buffer.splice(0, newline + 1));
      const line = this.decoder.decode(bytes).replace(/[\r\n]+$/g, '').trim();
      if (line) events.push({ kind: 'line', line });
    }

    return events;
  }
}

