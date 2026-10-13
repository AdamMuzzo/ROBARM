import { describe, expect, it } from 'vitest';
import { JOINTS, STARTUP_CALIBRATION_HOME_STEPS } from '../src/core/hardware';

describe('configuration 6 joint direction convention', () => {
  it('flips J1, J2, J3, J4, and J6 labels while leaving J5 unchanged', () => {
    expect(JOINTS.map((joint) => [joint.directionLabelNegative, joint.directionLabelPositive])).toEqual([
      ['Counterclockwise', 'Clockwise'],
      ['Down', 'Up'],
      ['Down', 'Up'],
      ['Counterclockwise', 'Clockwise'],
      ['Up', 'Down'],
      ['Counterclockwise', 'Clockwise']
    ]);
  });

  it('mirrors the asymmetric J2/J6 coordinate ranges and J2 calibration home', () => {
    expect([JOINTS[1].minSteps, JOINTS[1].maxSteps]).toEqual([1_200, 51_558]);
    expect([JOINTS[5].minSteps, JOINTS[5].maxSteps]).toEqual([-64_000, 0]);
    expect(STARTUP_CALIBRATION_HOME_STEPS).toEqual([0, 32_000, 0, 0, 0, 0]);
  });
});
