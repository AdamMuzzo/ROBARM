import { describe, expect, it, vi } from 'vitest';
import { createProgram, ProgramExecutor, robarmProgramSchema } from '../src/core/programs';

describe('ROBARM programs', () => {
  it('validates explicit target and bounded joint steps', () => {
    const program = createProgram('simulation');
    program.steps.push({ id: 'move', type: 'joint-move', positions: [0, 2000, 0, 0, 0, -100], speedScale: 0.25 });
    expect(robarmProgramSchema.parse(program).target).toBe('simulation');
    program.steps[0] = { id: 'bad', type: 'joint-move', positions: [14001, 2000, 0, 0, 0, -100], speedScale: 0.25 };
    expect(() => robarmProgramSchema.parse(program)).toThrow();
  });

  it('dry-run validates without calling the motion adapter', async () => {
    const program = createProgram('simulation');
    program.steps.push({ id: 'move', type: 'joint-move', positions: [0, 2000, 0, 0, 0, -100], speedScale: 0.25 });
    const moveJoint = vi.fn(async () => true);
    const calibrateStartup = vi.fn(async () => true);
    const states: string[] = [];
    await new ProgramExecutor().run(program, { moveJoint, calibrateStartup }, true, (progress) => states.push(progress.state));
    expect(moveJoint).not.toHaveBeenCalled();
    expect(states.at(-1)).toBe('completed');
  });

  it('supports one non-looping startup calibration command without joint moves', async () => {
    const program = createProgram('real');
    program.steps.push({ id: 'calibrate', type: 'startup-calibration' });
    expect(robarmProgramSchema.parse(program).steps[0].type).toBe('startup-calibration');
    program.loopCount = 2;
    expect(() => robarmProgramSchema.parse(program)).toThrow('cannot loop');
  });

  it('reports invalid startup calibration programs instead of rejecting silently', async () => {
    const program = createProgram('real');
    program.loopCount = 2;
    program.steps.push({ id: 'calibrate', type: 'startup-calibration' });
    const states: string[] = [];
    const messages: string[] = [];
    await expect(new ProgramExecutor().run(program, {
      moveJoint: vi.fn(async () => true),
      calibrateStartup: vi.fn(async () => true)
    }, false, (progress) => {
      states.push(progress.state);
      messages.push(progress.message);
    })).resolves.toBeUndefined();
    expect(states.at(-1)).toBe('error');
    expect(messages.at(-1)).toContain('cannot loop');
  });
});
