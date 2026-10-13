import { z } from 'zod';
import { JOINTS } from './hardware';
import type { ControlTarget } from './safety';

const jointMoveStepSchema = z.object({
  id: z.string().min(1),
  type: z.literal('joint-move'),
  positions: z.array(z.number().int()).length(6),
  speedScale: z.number().positive().max(1)
});

const delayStepSchema = z.object({
  id: z.string().min(1),
  type: z.literal('delay'),
  durationMs: z.number().int().min(10).max(3_600_000)
});

const noteStepSchema = z.object({
  id: z.string().min(1),
  type: z.literal('note'),
  text: z.string().max(500)
});

const startupCalibrationStepSchema = z.object({
  id: z.string().min(1),
  type: z.literal('startup-calibration')
});

export const programStepSchema = z.discriminatedUnion('type', [jointMoveStepSchema, delayStepSchema, noteStepSchema, startupCalibrationStepSchema]).superRefine((step, context) => {
  if (step.type !== 'joint-move') return;
  step.positions.forEach((position, index) => {
    const joint = JOINTS[index];
    if (position < joint.minSteps || position > joint.maxSteps) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['positions', index], message: `J${index + 1} target is outside configured limits` });
    }
  });
});

export const robarmProgramSchema = z.object({
  schemaVersion: z.literal(2),
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  description: z.string().max(1000),
  target: z.union([z.literal('simulation'), z.literal('real')]),
  loopCount: z.number().int().min(1).max(100),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  steps: z.array(programStepSchema).max(1000)
}).superRefine((program, context) => {
  const calibrationIndexes = program.steps.flatMap((step, index) => step.type === 'startup-calibration' ? [index] : []);
  if (calibrationIndexes.length > 1) context.addIssue({ code: z.ZodIssueCode.custom, path: ['steps'], message: 'A program may contain only one startup calibration step' });
  if (calibrationIndexes.length && program.loopCount !== 1) context.addIssue({ code: z.ZodIssueCode.custom, path: ['loopCount'], message: 'A startup calibration program cannot loop' });
  if (calibrationIndexes.length && program.steps.some((step) => step.type === 'joint-move')) context.addIssue({ code: z.ZodIssueCode.custom, path: ['steps'], message: 'Enable is a separate operator action; do not mix startup calibration and joint moves in one program' });
});

export type ProgramStep = z.infer<typeof programStepSchema>;
export type RobarmProgram = z.infer<typeof robarmProgramSchema>;
export type ProgramExecutionState = 'idle' | 'running' | 'paused' | 'stopped' | 'completed' | 'error';

export interface ProgramAdapter {
  moveJoint(positions: readonly number[], speedScale: number, signal: AbortSignal): Promise<boolean>;
  calibrateStartup(signal: AbortSignal): Promise<boolean>;
}

export interface ProgramProgress {
  state: ProgramExecutionState;
  loop: number;
  step: number;
  message: string;
}

export class ProgramExecutor {
  private abortController: AbortController | null = null;
  private paused = false;
  private resumeListeners: Array<() => void> = [];
  private report: (progress: ProgramProgress) => void = () => undefined;

  async run(programInput: unknown, adapter: ProgramAdapter, dryRun: boolean, onProgress: (progress: ProgramProgress) => void) {
    this.stop();
    this.abortController = new AbortController();
    this.paused = false;
    this.report = onProgress;

    try {
      const program = robarmProgramSchema.parse(programInput);
      this.report({ state: 'running', loop: 0, step: 0, message: dryRun ? 'Dry-run validation started' : 'Program started' });
      for (let loop = 0; loop < program.loopCount; loop += 1) {
        for (let stepIndex = 0; stepIndex < program.steps.length; stepIndex += 1) {
          await this.waitWhilePaused();
          this.throwIfStopped();
          const step = program.steps[stepIndex];
          this.report({ state: 'running', loop, step: stepIndex, message: `${step.type} ${stepIndex + 1}/${program.steps.length}` });
          if (dryRun || step.type === 'note') continue;
          if (step.type === 'joint-move') {
            const accepted = await adapter.moveJoint(step.positions, step.speedScale, this.abortController!.signal);
            if (!accepted) throw new Error(`Step ${stepIndex + 1} was rejected by the safety gateway`);
          } else if (step.type === 'startup-calibration') {
            const accepted = await adapter.calibrateStartup(this.abortController!.signal);
            if (!accepted) throw new Error(`Step ${stepIndex + 1} startup calibration did not complete`);
          } else if (step.type === 'delay') await this.delay(step.durationMs);
        }
      }
      this.report({ state: 'completed', loop: program.loopCount - 1, step: Math.max(0, program.steps.length - 1), message: dryRun ? 'Dry run passed' : 'Program completed' });
    } catch (error) {
      const stopped = this.abortController?.signal.aborted;
      this.report({
        state: stopped ? 'stopped' : 'error',
        loop: 0,
        step: 0,
        message: stopped ? 'Program stopped' : error instanceof Error ? error.message : 'Program failed'
      });
    } finally {
      this.abortController = null;
      this.paused = false;
      this.resumeListeners.splice(0).forEach((resume) => resume());
    }
  }

  pause() {
    if (!this.abortController || this.paused) return;
    this.paused = true;
    this.report({ state: 'paused', loop: 0, step: 0, message: 'Program paused before the next step' });
  }

  resume() {
    if (!this.paused) return;
    this.paused = false;
    this.resumeListeners.splice(0).forEach((resume) => resume());
  }

  stop() {
    this.abortController?.abort();
    this.resumeListeners.splice(0).forEach((resume) => resume());
  }

  private throwIfStopped() {
    if (this.abortController?.signal.aborted) throw new DOMException('Program stopped', 'AbortError');
  }

  private waitWhilePaused() {
    if (!this.paused) return Promise.resolve();
    return new Promise<void>((resolve) => this.resumeListeners.push(resolve));
  }

  private async delay(durationMs: number) {
    const end = Date.now() + durationMs;
    while (Date.now() < end) {
      await this.waitWhilePaused();
      this.throwIfStopped();
      await new Promise((resolve) => setTimeout(resolve, Math.min(50, end - Date.now())));
    }
  }
}

export function createProgram(target: ControlTarget = 'simulation'): RobarmProgram {
  const timestamp = new Date().toISOString();
  return {
    schemaVersion: 2,
    id: crypto.randomUUID(),
    name: 'Untitled program',
    description: '',
    target,
    loopCount: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    steps: []
  };
}
