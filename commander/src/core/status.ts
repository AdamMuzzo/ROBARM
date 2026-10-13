import { z } from 'zod';
import type { FirmwareStatus } from './safety';

const booleanField = z.boolean();

export const firmwareStatusSchema = z.object({
  firmware: z.literal('ROBARM-OCTOPUS-H723'),
  protocol_signature: z.literal('RB'),
  protocol_version: z.literal(1),
  config_version: z.literal(11),
  state: z.number().int(),
  mapping_verified: booleanField,
  motion_prerequisites: booleanField,
  homing_validated: booleanField,
  calibration_supported: z.literal(true),
  calibration_active: booleanField,
  calibration_hold: booleanField,
  calibration_complete: booleanField,
  calibration_joint: z.number().int().min(0).max(6),
  calibration_phase: z.enum(['idle', 'preparing_hold', 'settling_hold', 'seeking', 'moving_home', 'complete', 'fault']),
  calibration_joint_phases: z.array(z.enum(['inactive', 'seeking', 'qualifying', 'sensor_qualified', 'moving_home', 'complete'])).length(3),
  referenced_mask: z.number().int().min(0).max(255),
  calibration_required_mask: z.number().int().min(0).max(255),
  calibration_steps_taken: z.number().int().nonnegative(),
  calibration_steps_remaining: z.number().int().nonnegative(),
  calibration_home_steps: z.array(z.number().int()).length(6),
  full_motion: booleanField,
  commissioning_motion: booleanField,
  commissioning_hold: booleanField,
  holding_joint: z.number().int().min(0).max(6),
  hardware_estop_motor_cut: booleanField,
  estop_configured: booleanField,
  estop_feedback: z.string(),
  estop_safe: booleanField,
  fan_supported: z.literal(true),
  fan_on: booleanField,
  fan_mode: z.enum(['auto', 'full', 'off']),
  fan_speed_percent: z.number().int().min(0).max(100),
  fan_tach_supported: z.literal(false),
  fan_startup_default_on: z.literal(true)
});

const sensorSchema = z.object({
  raw_high_mask: z.number().int().min(0).max(255),
  ports: z.array(z.union([z.literal(0), z.literal(1)])).length(8)
});

const driverSchema = z.object({
  tmc_connection: z.array(z.number().int()).length(8)
});

export type ParsedAsciiReply =
  | { kind: 'status'; status: FirmwareStatus }
  | { kind: 'sensors'; ports: number[]; rawHighMask: number }
  | { kind: 'drivers'; connections: number[] }
  | { kind: 'response'; message: string }
  | { kind: 'invalid'; message: string };

export function parseAsciiReply(line: string): ParsedAsciiReply {
  if (!line.startsWith('{')) return { kind: 'response', message: line };
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return { kind: 'invalid', message: 'Firmware returned malformed JSON' };
  }

  const status = firmwareStatusSchema.safeParse(value);
  if (status.success) return { kind: 'status', status: status.data };
  const sensors = sensorSchema.safeParse(value);
  if (sensors.success) return { kind: 'sensors', ports: sensors.data.ports, rawHighMask: sensors.data.raw_high_mask };
  const drivers = driverSchema.safeParse(value);
  if (drivers.success) return { kind: 'drivers', connections: drivers.data.tmc_connection };
  return { kind: 'invalid', message: 'Firmware returned an unrecognized JSON object' };
}
