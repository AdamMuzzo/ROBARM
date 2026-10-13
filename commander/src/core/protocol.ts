export const COMMANDER_HEADER = 0xff;
export const PC_BODY_LENGTH = 52;
export const ROBOT_BODY_LENGTH = 56;
export const FIXED_LEGACY_CRC = 228;
export const END_1 = 1;
export const END_2 = 2;

export const COMMANDS = {
  HOME: 100,
  ENABLE: 101,
  DISABLE: 102,
  CLEAR_ERROR: 103,
  JOG: 123,
  POSITION: 156,
  DUMMY: 255
} as const;

export const FIRMWARE_STATES = {
  COMMISSIONING_LOCKED: 0x52,
  READY_DISABLED: 0x53,
  ENABLED: 0x54,
  FAULT: 0x55,
  CALIBRATING: 0x56,
  CALIBRATION_HOLD: 0x57
} as const;

export const EXPECTED_IDENTITY = {
  device: 0xa6,
  protocolVersion: 1,
  tag: 0x5242,
  configVersion: 11,
  magic1: 0x52,
  magic2: 0x42
} as const;

export interface CommanderPayload {
  position: readonly number[];
  speed: readonly number[];
  command: number;
  affected: readonly boolean[];
  io?: readonly boolean[];
  timeout?: number;
  gripper?: readonly number[];
}

export interface FirmwareIdentity {
  device: number;
  protocolVersion: number;
  tag: number;
  configVersion: number;
  magic1: number;
  magic2: number;
}

export interface RobotTelemetry {
  position: number[];
  velocity: number[];
  homedBits: number;
  ioBits: number;
  temperatureErrorBits: number;
  positionErrorBits: number;
  timing: number;
  watchdogTimeout: boolean;
  state: number;
  identity: FirmwareIdentity;
  raw: Uint8Array;
}

function requireCount(name: string, values: readonly unknown[], count: number) {
  if (values.length !== count) throw new RangeError(`${name} must contain exactly ${count} values`);
}

export function encodeSigned24(value: number, target: Uint8Array, offset: number) {
  if (!Number.isSafeInteger(value) || value < -0x800000 || value > 0x7fffff) {
    throw new RangeError(`signed 24-bit value out of range: ${value}`);
  }
  const packed = value & 0xffffff;
  target[offset] = (packed >>> 16) & 0xff;
  target[offset + 1] = (packed >>> 8) & 0xff;
  target[offset + 2] = packed & 0xff;
}

export function decodeSigned24(source: Uint8Array, offset: number) {
  let value = (source[offset] << 16) | (source[offset + 1] << 8) | source[offset + 2];
  if ((value & 0x800000) !== 0) value |= 0xff000000;
  return value;
}

function encodeBitfield(values: readonly boolean[]) {
  requireCount('bitfield', values, 8);
  return values.reduce((result, value) => (result << 1) | (value ? 1 : 0), 0);
}

function writeUnsigned16(value: number, target: Uint8Array, offset: number) {
  if (!Number.isInteger(value) || value < 0 || value > 0xffff) {
    throw new RangeError(`unsigned 16-bit value out of range: ${value}`);
  }
  target[offset] = value >>> 8;
  target[offset + 1] = value & 0xff;
}

export function buildCommanderFrame(payload: CommanderPayload) {
  requireCount('position', payload.position, 6);
  requireCount('speed', payload.speed, 6);
  requireCount('affected', payload.affected, 6);
  const io = payload.io ?? Array<boolean>(8).fill(false);
  const gripper = payload.gripper ?? [0, 0, 0, 0, 0, 0];
  requireCount('io', io, 8);
  requireCount('gripper', gripper, 6);
  if (!Number.isInteger(payload.command) || payload.command < 0 || payload.command > 255) {
    throw new RangeError('command must fit in one byte');
  }
  const timeout = payload.timeout ?? 0;
  if (!Number.isInteger(timeout) || timeout < 0 || timeout > 255) {
    throw new RangeError('timeout must fit in one byte');
  }

  const frame = new Uint8Array(56);
  frame.set([COMMANDER_HEADER, COMMANDER_HEADER, COMMANDER_HEADER, PC_BODY_LENGTH], 0);
  const bodyOffset = 4;
  for (let joint = 0; joint < 6; joint += 1) {
    encodeSigned24(payload.position[joint], frame, bodyOffset + joint * 3);
    encodeSigned24(payload.speed[joint], frame, bodyOffset + 18 + joint * 3);
  }
  frame[bodyOffset + 36] = payload.command;
  const affectedBits = [...payload.affected, false, false];
  frame[bodyOffset + 37] = encodeBitfield(affectedBits);
  frame[bodyOffset + 38] = encodeBitfield(io);
  frame[bodyOffset + 39] = timeout;
  writeUnsigned16(gripper[0], frame, bodyOffset + 40);
  writeUnsigned16(gripper[1], frame, bodyOffset + 42);
  writeUnsigned16(gripper[2], frame, bodyOffset + 44);
  for (let index = 3; index < 6; index += 1) {
    const value = gripper[index];
    if (!Number.isInteger(value) || value < 0 || value > 255) {
      throw new RangeError(`gripper field ${index} must fit in one byte`);
    }
    frame[bodyOffset + 43 + index] = value;
  }
  frame[bodyOffset + 49] = FIXED_LEGACY_CRC;
  frame[bodyOffset + 50] = END_1;
  frame[bodyOffset + 51] = END_2;
  return frame;
}

export function identityMatches(identity: FirmwareIdentity | null | undefined) {
  return Boolean(identity)
    && identity!.device === EXPECTED_IDENTITY.device
    && identity!.protocolVersion === EXPECTED_IDENTITY.protocolVersion
    && identity!.tag === EXPECTED_IDENTITY.tag
    && identity!.configVersion === EXPECTED_IDENTITY.configVersion
    && identity!.magic1 === EXPECTED_IDENTITY.magic1
    && identity!.magic2 === EXPECTED_IDENTITY.magic2;
}

export function decodeRobotFrame(frame: Uint8Array): RobotTelemetry {
  if (frame.length !== 60) throw new Error(`robot frame must be 60 bytes, received ${frame.length}`);
  if (frame[0] !== 0xff || frame[1] !== 0xff || frame[2] !== 0xff) {
    throw new Error('robot frame header is invalid');
  }
  if (frame[3] !== ROBOT_BODY_LENGTH) throw new Error('robot frame body length is invalid');
  const body = frame.subarray(4);
  if (body[53] !== FIXED_LEGACY_CRC || body[54] !== END_1 || body[55] !== END_2) {
    throw new Error('robot frame sentinel or terminator is invalid');
  }
  const position = Array.from({ length: 6 }, (_, joint) => decodeSigned24(body, joint * 3));
  const velocity = Array.from({ length: 6 }, (_, joint) => decodeSigned24(body, 18 + joint * 3));
  return {
    position,
    velocity,
    homedBits: body[36],
    ioBits: body[37],
    temperatureErrorBits: body[38],
    positionErrorBits: body[39],
    timing: (body[40] << 8) | body[41],
    watchdogTimeout: body[42] !== 0,
    state: body[43],
    identity: {
      device: body[44],
      protocolVersion: (body[45] << 8) | body[46],
      tag: (body[47] << 8) | body[48],
      configVersion: (body[49] << 8) | body[50],
      magic1: body[51],
      magic2: body[52]
    },
    raw: new Uint8Array(frame)
  };
}

export function makePassiveFrame(command: number = COMMANDS.DUMMY) {
  return buildCommanderFrame({
    position: [0, 0, 0, 0, 0, 0],
    speed: [0, 0, 0, 0, 0, 0],
    command,
    affected: [false, false, false, false, false, false]
  });
}
