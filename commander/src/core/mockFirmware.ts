import {
  COMMANDS,
  decodeSigned24,
  encodeSigned24,
  EXPECTED_IDENTITY,
  FIRMWARE_STATES,
  FIXED_LEGACY_CRC,
  PC_BODY_LENGTH
} from './protocol';
import type { FirmwareStatus } from './safety';
import type { ByteTransport, TransportDataListener, TransportErrorListener } from './transport';

type Unsubscribe = () => void;

function addListener<T>(listeners: Set<T>, listener: T): Unsubscribe {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export class MockFirmwareTransport implements ByteTransport {
  private dataListeners = new Set<TransportDataListener>();
  private errorListeners = new Set<TransportErrorListener>();
  private closedListeners = new Set<() => void>();
  private opened = false;
  private positions = [0, 20_000, 0, 0, 0, -32_000];
  private velocities = [0, 0, 0, 0, 0, 0];
  private state: number = FIRMWARE_STATES.COMMISSIONING_LOCKED;
  private estopSafe = true;
  private watchdogTimeout = false;
  private sensors = [1, 0, 0, 1, 0, 1, 1, 1];
  private drivers = [0, 0, 0, 0, 0, 0, 2, 2];
  private calibrationActive = false;
  private calibrationHold = false;
  private referencedMask = 0;
  private fanMode: 'auto' | 'full' | 'off' = 'auto';

  listPorts() {
    return Promise.resolve([{ path: 'MOCK:ROBARM', manufacturer: 'ROBARM test harness', friendlyName: 'Mock ROBARM firmware' }]);
  }

  async open(path: string) {
    if (path !== 'MOCK:ROBARM') throw new Error('Mock port not found');
    this.opened = true;
  }

  async close() {
    if (!this.opened) return;
    this.opened = false;
    this.closedListeners.forEach((listener) => listener());
  }

  setEstopSafe(safe: boolean) {
    this.estopSafe = safe;
    if (!safe) {
      this.referencedMask = 0;
      this.calibrationActive = false;
      this.calibrationHold = false;
      this.state = FIRMWARE_STATES.FAULT;
      this.velocities.fill(0);
      this.drivers = [1, 1, 1, 1, 1, 1, 2, 2];
    } else {
      this.drivers = [0, 0, 0, 0, 0, 0, 2, 2];
    }
  }

  async write(data: Uint8Array) {
    if (!this.opened) throw new Error('Mock port is closed');
    if (data[0] === 0xff) this.handleBinary(data);
    else this.handleAscii(new TextDecoder('ascii').decode(data).trim());
  }

  onData(listener: TransportDataListener) {
    return addListener(this.dataListeners, listener);
  }

  onError(listener: TransportErrorListener) {
    return addListener(this.errorListeners, listener);
  }

  onClosed(listener: () => void) {
    return addListener(this.closedListeners, listener);
  }

  private emit(data: Uint8Array) {
    queueMicrotask(() => this.dataListeners.forEach((listener) => listener(data)));
  }

  private status(): FirmwareStatus {
    return {
      firmware: 'ROBARM-OCTOPUS-H723',
      protocol_signature: 'RB',
      protocol_version: 1,
      config_version: 11,
      state: this.state,
      mapping_verified: true,
      motion_prerequisites: this.referencedMask === 0x70,
      homing_validated: true,
      calibration_supported: true,
      calibration_active: this.calibrationActive,
      calibration_hold: this.calibrationHold,
      calibration_complete: this.referencedMask === 0x70,
      calibration_joint: 0,
      calibration_phase: this.calibrationActive ? 'seeking' : this.calibrationHold || this.referencedMask === 0x70 ? 'complete' : 'idle',
      calibration_joint_phases: this.calibrationActive
        ? ['seeking', 'seeking', 'seeking']
        : this.calibrationHold || this.referencedMask === 0x70
          ? ['complete', 'complete', 'complete']
          : ['inactive', 'inactive', 'inactive'],
      referenced_mask: this.referencedMask,
      calibration_required_mask: 0x70,
      calibration_steps_taken: 0,
      calibration_steps_remaining: 0,
      calibration_home_steps: [0, 32_000, 0, 0, 0, 0],
      full_motion: true,
      commissioning_motion: true,
      commissioning_hold: false,
      holding_joint: 0,
      hardware_estop_motor_cut: true,
      estop_configured: true,
      estop_feedback: 'driver_power',
      estop_safe: this.estopSafe,
      fan_supported: true,
      fan_on: this.fanMode !== 'off',
      fan_mode: this.fanMode,
      fan_speed_percent: this.fanMode === 'off' ? 0 : this.fanMode === 'full' || this.state === FIRMWARE_STATES.ENABLED || this.calibrationActive || this.calibrationHold ? 100 : 70,
      fan_tach_supported: false,
      fan_startup_default_on: true
    };
  }

  private handleAscii(command: string) {
    let response: string;
    if (command === 'STATUS' || command === 'HELLO') response = JSON.stringify(this.status());
    else if (command === 'SENSORS') response = JSON.stringify({
      raw_high_mask: this.sensors.reduce((mask, value, index) => mask | (value << index), 0),
      ports: this.sensors
    });
    else if (command === 'DRIVERS') response = JSON.stringify({ tmc_connection: this.drivers });
    else if (command === 'FAN AUTO' || command === 'FAN FULL' || command === 'FAN ON' || command === 'FAN OFF') {
      this.fanMode = command === 'FAN OFF' ? 'off' : command === 'FAN AUTO' ? 'auto' : 'full';
      response = `OK FAN ${this.fanMode}`;
    } else if (command === 'DISABLE' || command === 'STOP') {
      this.referencedMask = 0;
      this.calibrationActive = false;
      this.calibrationHold = false;
      this.state = FIRMWARE_STATES.COMMISSIONING_LOCKED;
      this.velocities.fill(0);
      response = 'OK all drivers disabled';
    } else if (command === 'CLEAR_FAULT' && this.estopSafe) {
      this.referencedMask = 0;
      this.calibrationActive = false;
      this.calibrationHold = false;
      this.state = FIRMWARE_STATES.COMMISSIONING_LOCKED;
      this.watchdogTimeout = false;
      response = 'OK fault cleared; all drivers disabled';
    } else if (command === 'CALIBRATE_STARTUP I_UNDERSTAND' && this.estopSafe && this.state === FIRMWARE_STATES.COMMISSIONING_LOCKED) {
      this.calibrationActive = false;
      this.calibrationHold = true;
      this.referencedMask = 0x70;
      this.positions[1] = 32_000;
      this.positions[2] = 0;
      this.positions[3] = 0;
      this.state = FIRMWARE_STATES.CALIBRATION_HOLD;
      response = 'DONE CALIBRATE_STARTUP J2,J3,J4 referenced; calibrated hold active';
    } else response = 'ERR unsupported mock command';
    this.emit(new TextEncoder().encode(`${response}\n`));
  }

  private handleBinary(frame: Uint8Array) {
    if (frame.length !== 56 || frame[3] !== PC_BODY_LENGTH) {
      this.referencedMask = 0;
      this.calibrationActive = false;
      this.calibrationHold = false;
      this.state = FIRMWARE_STATES.FAULT;
      this.emitReply();
      return;
    }
    const body = frame.subarray(4);
    const command = body[36];
    if (command === COMMANDS.DISABLE) {
      this.referencedMask = 0;
      this.calibrationActive = false;
      this.calibrationHold = false;
      this.state = FIRMWARE_STATES.COMMISSIONING_LOCKED;
      this.velocities.fill(0);
    } else if (command === COMMANDS.ENABLE && this.estopSafe && (this.state === FIRMWARE_STATES.READY_DISABLED || this.state === FIRMWARE_STATES.CALIBRATION_HOLD)) {
      this.calibrationHold = false;
      this.state = FIRMWARE_STATES.ENABLED;
    } else if (command === COMMANDS.CLEAR_ERROR && this.estopSafe && this.state === FIRMWARE_STATES.FAULT) {
      this.state = FIRMWARE_STATES.COMMISSIONING_LOCKED;
      this.watchdogTimeout = false;
    } else if (command === COMMANDS.JOG && this.state === FIRMWARE_STATES.ENABLED && this.estopSafe) {
      for (let joint = 0; joint < 6; joint += 1) {
        const affected = (body[37] & (1 << (7 - joint))) !== 0;
        this.velocities[joint] = affected ? decodeSigned24(body, 18 + joint * 3) : 0;
        this.positions[joint] += Math.round(this.velocities[joint] * 0.04);
      }
    } else if (command === COMMANDS.POSITION && this.state === FIRMWARE_STATES.ENABLED && this.estopSafe) {
      for (let joint = 0; joint < 6; joint += 1) {
        if ((body[37] & (1 << (7 - joint))) !== 0) this.positions[joint] = decodeSigned24(body, joint * 3);
      }
      this.velocities.fill(0);
    } else if (command === COMMANDS.DUMMY) {
      this.velocities.fill(0);
    } else if (command !== COMMANDS.ENABLE && command !== COMMANDS.CLEAR_ERROR) {
      this.referencedMask = 0;
      this.calibrationActive = false;
      this.calibrationHold = false;
      this.state = FIRMWARE_STATES.FAULT;
      this.velocities.fill(0);
    }
    this.emitReply();
  }

  private emitReply() {
    const frame = new Uint8Array(60);
    frame.set([255, 255, 255, 56], 0);
    const body = frame.subarray(4);
    for (let joint = 0; joint < 6; joint += 1) {
      encodeSigned24(this.positions[joint], body, joint * 3);
      encodeSigned24(this.velocities[joint], body, 18 + joint * 3);
    }
    body[36] = this.referencedMask;
    if (this.estopSafe) body[37] |= 0x08;
    body[39] = this.state === FIRMWARE_STATES.FAULT ? 0xff : 0;
    body[42] = this.watchdogTimeout ? 1 : 0;
    body[43] = this.state;
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
    this.emit(frame);
  }
}
