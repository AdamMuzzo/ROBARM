import { describe, expect, it } from 'vitest';
import { EXPECTED_IDENTITY, FIRMWARE_STATES } from '../src/core/protocol';
import { DEFAULT_TELEMETRY_FRESHNESS_MS, evaluateSafety, type FirmwareStatus, type SafetyContext } from '../src/core/safety';

const now = 1_000_000;
const readyStatus: FirmwareStatus = {
  firmware: 'ROBARM-OCTOPUS-H723',
  protocol_signature: 'RB',
  protocol_version: 1,
  config_version: 11,
  state: FIRMWARE_STATES.ENABLED,
  mapping_verified: true,
  motion_prerequisites: true,
  homing_validated: true,
  calibration_supported: true,
  calibration_active: false,
  calibration_hold: false,
  calibration_complete: true,
  calibration_joint: 0,
  calibration_phase: 'complete',
  calibration_joint_phases: ['complete', 'complete', 'complete'],
  referenced_mask: 0x70,
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
  estop_safe: true,
  fan_supported: true,
  fan_on: true,
  fan_mode: 'auto',
  fan_speed_percent: 100,
  fan_tach_supported: false,
  fan_startup_default_on: true
};

function context(overrides: Partial<SafetyContext> = {}): SafetyContext {
  return {
    target: 'real',
    transportOpen: true,
    transportError: null,
    identity: { ...EXPECTED_IDENTITY },
    status: { ...readyStatus },
    lastTelemetryAt: now - 20,
    telemetryFreshnessMs: DEFAULT_TELEMETRY_FRESHNESS_MS,
    deadmanActive: true,
    ...overrides
  };
}

describe('central safety policy', () => {
  it('allows a bounded jog only when every gate passes', () => {
    const decision = evaluateSafety(context(), {
      kind: 'jog', target: 'real', positions: [0, 2000, 0, 0, 0, -100],
      speeds: [100, 0, 0, 0, 0, 0], affected: [true, false, false, false, false, false]
    }, now);
    expect(decision).toEqual({ allowed: true, reasons: [], telemetryAgeMs: 20 });
  });

  it('fails closed on stale telemetry', () => {
    const decision = evaluateSafety(context({ lastTelemetryAt: now - 121 }), {
      kind: 'jog', target: 'real', speeds: [100, 0, 0, 0, 0, 0]
    }, now);
    expect(decision.allowed).toBe(false);
    expect(decision.reasons).toContain('validated telemetry is stale');
  });

  it('fails closed when E-stop feedback is unsafe', () => {
    const decision = evaluateSafety(context({ status: { ...readyStatus, estop_safe: false } }), {
      kind: 'position', target: 'real', positions: [0, 2000, 0, 0, 0, -100]
    }, now);
    expect(decision.allowed).toBe(false);
    expect(decision.reasons).toContain('E-stop or driver-power feedback is unsafe');
  });

  it('requires a dead-man for continuous motion', () => {
    const decision = evaluateSafety(context({ deadmanActive: false }), {
      kind: 'jog', target: 'real', speeds: [100, 0, 0, 0, 0, 0]
    }, now);
    expect(decision.allowed).toBe(false);
    expect(decision.reasons).toContain('dead-man input is not active');
  });

  it('always permits Disable even without a connection', () => {
    expect(evaluateSafety(context({ transportOpen: false, identity: null, status: null }), {
      kind: 'disable', target: 'real'
    }, now).allowed).toBe(true);
  });

  it('rejects targets outside firmware limits rather than clamping', () => {
    const decision = evaluateSafety(context(), {
      kind: 'position', target: 'real', positions: [14_001, 2000, 0, 0, 0, -100]
    }, now);
    expect(decision.allowed).toBe(false);
    expect(decision.reasons).toContain('J1 target is outside the configured step limits');
  });

  it('allows startup calibration before dynamic motion prerequisites are complete', () => {
    const status: FirmwareStatus = { ...readyStatus, state: FIRMWARE_STATES.COMMISSIONING_LOCKED, motion_prerequisites: false, calibration_complete: false, calibration_phase: 'idle', referenced_mask: 0 };
    const decision = evaluateSafety(context({ status }), { kind: 'calibration', target: 'real' }, now);
    expect(decision).toEqual({ allowed: true, reasons: [], telemetryAgeMs: 20 });
  });

  it('blocks normal Enable until startup calibration establishes the reference', () => {
    const status: FirmwareStatus = { ...readyStatus, state: FIRMWARE_STATES.COMMISSIONING_LOCKED, motion_prerequisites: false, calibration_complete: false, calibration_phase: 'idle', referenced_mask: 0 };
    const decision = evaluateSafety(context({ status }), { kind: 'enable', target: 'real' }, now);
    expect(decision.allowed).toBe(false);
    expect(decision.reasons).toContain('firmware motion prerequisites are incomplete');
  });

  it('allows cooling control while motor-power E-stop feedback is unsafe', () => {
    const decision = evaluateSafety(context({ status: { ...readyStatus, estop_safe: false } }), {
      kind: 'fan', target: 'real'
    }, now);
    expect(decision).toEqual({ allowed: true, reasons: [], telemetryAgeMs: 20 });
  });
});
