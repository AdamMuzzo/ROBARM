import { FIRMWARE_STATES, identityMatches, type FirmwareIdentity } from './protocol';
import { JOINTS } from './hardware';

export type ControlTarget = 'simulation' | 'real';
export type IntentKind = 'query' | 'disable' | 'clear-fault' | 'enable' | 'jog' | 'position' | 'maintenance' | 'calibration' | 'fan';

export interface FirmwareStatus {
  firmware: string;
  protocol_signature: string;
  protocol_version: number;
  config_version: number;
  state: number;
  mapping_verified: boolean;
  motion_prerequisites: boolean;
  homing_validated: boolean;
  calibration_supported: boolean;
  calibration_active: boolean;
  calibration_hold: boolean;
  calibration_complete: boolean;
  calibration_joint: number;
  calibration_phase: 'idle' | 'preparing_hold' | 'settling_hold' | 'seeking' | 'moving_home' | 'complete' | 'fault';
  calibration_joint_phases: Array<'inactive' | 'seeking' | 'qualifying' | 'sensor_qualified' | 'moving_home' | 'complete'>;
  referenced_mask: number;
  calibration_required_mask: number;
  calibration_steps_taken: number;
  calibration_steps_remaining: number;
  calibration_home_steps: number[];
  full_motion: boolean;
  commissioning_motion: boolean;
  commissioning_hold: boolean;
  holding_joint: number;
  hardware_estop_motor_cut: boolean;
  estop_configured: boolean;
  estop_feedback: string;
  estop_safe: boolean;
  fan_supported: boolean;
  fan_on: boolean;
  fan_mode: 'auto' | 'full' | 'off';
  fan_speed_percent: number;
  fan_tach_supported: boolean;
  fan_startup_default_on: boolean;
}

export interface SafetyContext {
  target: ControlTarget;
  transportOpen: boolean;
  transportError: string | null;
  identity: FirmwareIdentity | null;
  status: FirmwareStatus | null;
  lastTelemetryAt: number | null;
  telemetryFreshnessMs: number;
  deadmanActive: boolean;
}

export interface CommandIntent {
  kind: IntentKind;
  target: ControlTarget;
  positions?: readonly number[];
  speeds?: readonly number[];
  affected?: readonly boolean[];
}

export interface SafetyDecision {
  allowed: boolean;
  reasons: string[];
  telemetryAgeMs: number | null;
}

export const DEFAULT_TELEMETRY_FRESHNESS_MS = 120;

function validateMotionBounds(intent: CommandIntent, reasons: string[]) {
  if (intent.positions) {
    if (intent.positions.length !== 6) reasons.push('position vector must contain six joints');
    else intent.positions.forEach((position, index) => {
      const joint = JOINTS[index];
      if (!Number.isSafeInteger(position) || position < joint.minSteps || position > joint.maxSteps) {
        reasons.push(`J${joint.number} target is outside the configured step limits`);
      }
    });
  }
  if (intent.speeds) {
    if (intent.speeds.length !== 6) reasons.push('speed vector must contain six joints');
    else intent.speeds.forEach((speed, index) => {
      const joint = JOINTS[index];
      if (!Number.isFinite(speed) || Math.abs(speed) > joint.maxSpeedStepsPerSecond) {
        reasons.push(`J${joint.number} speed exceeds the configured limit`);
      }
    });
  }
  if (intent.affected && intent.affected.length !== 6) {
    reasons.push('affected-joint vector must contain six joints');
  }
}

function statusIdentityMatches(status: FirmwareStatus | null) {
  return status?.firmware === 'ROBARM-OCTOPUS-H723'
    && status.protocol_signature === 'RB'
    && status.protocol_version === 1
    && status.config_version === 11;
}

export function evaluateSafety(context: SafetyContext, intent: CommandIntent, now = Date.now()): SafetyDecision {
  const reasons: string[] = [];
  const telemetryAgeMs = context.lastTelemetryAt === null ? null : now - context.lastTelemetryAt;

  if (intent.kind === 'disable') return { allowed: true, reasons, telemetryAgeMs };

  if (intent.target === 'simulation') {
    if (context.target !== 'simulation') reasons.push('simulation is not the active target');
    if (intent.kind === 'jog' && !context.deadmanActive) reasons.push('dead-man input is not active');
    if (intent.kind === 'jog' || intent.kind === 'position') validateMotionBounds(intent, reasons);
    return { allowed: reasons.length === 0, reasons, telemetryAgeMs };
  }

  if (context.target !== 'real') reasons.push('real robot is not the active target');
  if (!context.transportOpen) reasons.push('serial transport is not open');
  if (context.transportError) reasons.push(`serial transport error: ${context.transportError}`);
  if (!identityMatches(context.identity)) reasons.push('binary firmware identity is not compatible');
  if (!statusIdentityMatches(context.status)) reasons.push('status firmware identity is not compatible');
  if (telemetryAgeMs === null || telemetryAgeMs < 0 || telemetryAgeMs > context.telemetryFreshnessMs) {
    reasons.push('validated telemetry is stale');
  }

  if (intent.kind === 'query') return { allowed: context.transportOpen && !context.transportError, reasons: context.transportOpen && !context.transportError ? [] : reasons, telemetryAgeMs };

  const status = context.status;
  if (intent.kind === 'fan') {
    if (!status?.fan_supported) reasons.push('controller fan control is not supported by this firmware');
    return { allowed: reasons.length === 0, reasons, telemetryAgeMs };
  }
  if (!status?.mapping_verified) reasons.push('firmware mapping is not verified');
  if (!status?.estop_configured) reasons.push('E-stop feedback is not configured');
  if (!status?.estop_safe) reasons.push('E-stop or driver-power feedback is unsafe');

  if (intent.kind === 'enable') {
    if (!status?.motion_prerequisites) reasons.push('firmware motion prerequisites are incomplete');
    if (!status?.full_motion) reasons.push('firmware full-motion gate is disabled');
    if (status?.state !== FIRMWARE_STATES.READY_DISABLED && status?.state !== FIRMWARE_STATES.CALIBRATION_HOLD) reasons.push('firmware is not ready or in calibrated hold');
  } else if (intent.kind === 'clear-fault') {
    if (status?.state !== FIRMWARE_STATES.FAULT) reasons.push('firmware is not in the fault state');
  } else if (intent.kind === 'jog' || intent.kind === 'position') {
    if (!status?.motion_prerequisites) reasons.push('firmware motion prerequisites are incomplete');
    if (!status?.full_motion) reasons.push('firmware full-motion gate is disabled');
    if (status?.state !== FIRMWARE_STATES.ENABLED) reasons.push('firmware is not enabled');
    if (intent.kind === 'jog' && !context.deadmanActive) reasons.push('dead-man input is not active');
    validateMotionBounds(intent, reasons);
  } else if (intent.kind === 'maintenance') {
    if (!status?.commissioning_motion) reasons.push('commissioning motion is not available');
    if (status?.commissioning_hold || status?.calibration_hold) reasons.push('a commissioning or calibrated hold is already active');
    if (status?.state === FIRMWARE_STATES.ENABLED) reasons.push('firmware must be disabled before maintenance motion');
  } else if (intent.kind === 'calibration') {
    if (!status?.calibration_supported) reasons.push('startup calibration is not supported by this firmware');
    if (!status?.commissioning_motion) reasons.push('commissioning motion is not available');
    if (status?.calibration_active) reasons.push('startup calibration is already active');
    if (status?.calibration_hold || status?.commissioning_hold) reasons.push('a calibrated or commissioning hold is already active');
    if (status?.state === FIRMWARE_STATES.ENABLED) reasons.push('firmware must be disabled before startup calibration');
    if (status?.state === FIRMWARE_STATES.FAULT) reasons.push('firmware fault must be cleared before startup calibration');
  }

  return { allowed: reasons.length === 0, reasons, telemetryAgeMs };
}
