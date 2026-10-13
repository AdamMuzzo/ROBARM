import { describe, expect, it } from 'vitest';
import { DEFAULT_CONTROLLER_PROFILE, loadControllerProfile, mapControllerAxes, mapControllerInput, type ControllerProfile } from '../src/core/inputPlugins';

describe('controller axis mapping', () => {
  it('combines simultaneous Xbox stick axes into one six-joint vector', () => {
    const scales = mapControllerAxes([0.8, -0.8, 0.7, -0.7], DEFAULT_CONTROLLER_PROFILE);

    expect(scales[0]).toBeGreaterThan(0);
    expect(scales[1]).toBeGreaterThan(0);
    expect(scales[2]).toBeGreaterThan(0);
    expect(scales[3]).toBeGreaterThan(0);
    expect(scales.slice(4)).toEqual([0, 0]);
  });

  it('keeps axes inside their configured dead zones at zero', () => {
    expect(mapControllerAxes([0.1, -0.1, 0.1, -0.1], DEFAULT_CONTROLLER_PROFILE)).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it('uses the strongest active mapping when two axes target the same joint', () => {
    const profile: ControllerProfile = {
      ...DEFAULT_CONTROLLER_PROFILE,
      mappings: [
        { axis: 0, joint: 0, deadZone: 0.1, sensitivity: 1, invert: false, speedScale: 0.2 },
        { axis: 1, joint: 0, deadZone: 0.1, sensitivity: 1, invert: false, speedScale: 0.8 }
      ]
    };

    const scales = mapControllerAxes([0.9, -0.9], profile);
    expect(scales[0]).toBeLessThan(0);
    expect(Math.abs(scales[0])).toBeGreaterThan(0.5);
  });
});

describe('controller button mapping', () => {
  it('maps simultaneous buttons and axes to independent joints', () => {
    const profile: ControllerProfile = {
      ...DEFAULT_CONTROLLER_PROFILE,
      buttonMappings: [
        { button: 0, joint: 4, direction: 'negative', activationThreshold: 0.1, speedScale: 0.4 },
        { button: 3, joint: 5, direction: 'positive', activationThreshold: 0.1, speedScale: 0.7 }
      ]
    };
    const buttons = Array.from({ length: 17 }, () => ({ pressed: false, value: 0 }));
    buttons[0] = { pressed: true, value: 1 };
    buttons[3] = { pressed: true, value: 1 };

    const scales = mapControllerInput([0.8, 0, 0, 0], buttons, profile);
    expect(scales[0]).toBeGreaterThan(0);
    expect(scales[4]).toBeCloseTo(-0.4);
    expect(scales[5]).toBeCloseTo(0.7);
  });

  it('preserves analog trigger travel above its configurable threshold', () => {
    const profile: ControllerProfile = {
      ...DEFAULT_CONTROLLER_PROFILE,
      mappings: [],
      buttonMappings: [
        { button: 7, joint: 4, direction: 'positive', activationThreshold: 0.1, speedScale: 1 }
      ]
    };
    const buttons = Array.from({ length: 8 }, () => ({ pressed: false, value: 0 }));
    buttons[7] = { pressed: false, value: 0.55 };
    expect(mapControllerInput([], buttons, profile)[4]).toBeCloseTo(0.5);
  });

  it('migrates saved schema-1 axis profiles without losing assignments', () => {
    const migrated = loadControllerProfile({ ...DEFAULT_CONTROLLER_PROFILE, schemaVersion: 1, buttonMappings: undefined });
    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.mappings).toHaveLength(DEFAULT_CONTROLLER_PROFILE.mappings.length);
    expect(migrated.buttonMappings).toEqual([]);
  });
});
