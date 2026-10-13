import { useRef, useState } from 'react';
import { Download, FileCheck2, FolderOpen, Pause, Play, Plus, Save, ScanLine, Square, Trash2 } from 'lucide-react';
import { createProgram, ProgramExecutor, robarmProgramSchema, type ProgramExecutionState, type ProgramStep, type RobarmProgram } from '../core/programs';
import type { CommanderRuntime, RuntimeSnapshot } from '../core/runtime';
import { Button, ConfirmAction, EmptyState, Panel, StatusTag } from '../components/ui';

function downloadFile(filename: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function ProgramsPanel({ snapshot, runtime }: { snapshot: RuntimeSnapshot; runtime: CommanderRuntime }) {
  const [program, setProgram] = useState<RobarmProgram>(() => {
    const saved = localStorage.getItem('robarm.commander.program');
    if (saved) {
      const parsed = robarmProgramSchema.safeParse(JSON.parse(saved));
      if (parsed.success) return parsed.data;
    }
    return createProgram('simulation');
  });
  const [executionState, setExecutionState] = useState<ProgramExecutionState>('idle');
  const [executionMessage, setExecutionMessage] = useState('No program running');
  const [calibrationPhrase, setCalibrationPhrase] = useState('');
  const [stepCursor, setStepCursor] = useState(0);
  const executorRef = useRef(new ProgramExecutor());
  const importRef = useRef<HTMLInputElement>(null);

  const updateProgram = (update: Partial<RobarmProgram>) => setProgram((current) => ({ ...current, ...update, updatedAt: new Date().toISOString() }));
  const addStep = (type: ProgramStep['type']) => {
    const step: ProgramStep = type === 'joint-move'
      ? { id: crypto.randomUUID(), type, positions: [...snapshot.simulation.positions], speedScale: 0.25 }
      : type === 'delay'
        ? { id: crypto.randomUUID(), type, durationMs: 1000 }
        : type === 'startup-calibration'
          ? { id: crypto.randomUUID(), type }
          : { id: crypto.randomUUID(), type, text: 'Operator note' };
    updateProgram({ steps: [...program.steps, step] });
  };
  const updateStep = (index: number, step: ProgramStep) => updateProgram({ steps: program.steps.map((current, currentIndex) => currentIndex === index ? step : current) });
  const deleteStep = (index: number) => updateProgram({ steps: program.steps.filter((_, currentIndex) => currentIndex !== index) });
  const run = (dryRun: boolean) => {
    if (program.target !== snapshot.target && !dryRun) {
      setExecutionState('error');
      setExecutionMessage(`Program targets ${program.target}, but the active target is ${snapshot.target}`);
      return;
    }
    void executorRef.current.run(program, {
      moveJoint: (positions, speedScale, signal) => runtime.moveToPositionsAndWait(positions, speedScale, 30_000, signal),
      calibrateStartup: (signal) => runtime.runStartupCalibration(signal)
    }, dryRun, (progress) => {
      setExecutionState(progress.state);
      setExecutionMessage(progress.message);
      if (progress.state === 'stopped' || progress.state === 'error') runtime.stopMotion('Program execution stopped');
    });
  };
  const runOneStep = async () => {
    if (!program.steps.length) return;
    const step = program.steps[stepCursor % program.steps.length];
    if (step.type === 'startup-calibration' && program.target === 'real') {
      setExecutionState('error');
      setExecutionMessage('Physical startup calibration cannot use Step once. Type the confirmation phrase and use Run real.');
      return;
    }
    setExecutionState('running');
    setExecutionMessage(`Stepping ${stepCursor + 1}: ${step.type}`);
    let accepted = true;
    if (step.type === 'joint-move') accepted = await runtime.moveToPositionsAndWait(step.positions, step.speedScale);
    else if (step.type === 'startup-calibration') accepted = await runtime.runStartupCalibration();
    else if (step.type === 'delay') await new Promise((resolve) => setTimeout(resolve, step.durationMs));
    setExecutionState(accepted ? 'paused' : 'error');
    setExecutionMessage(accepted ? `Step ${stepCursor + 1} complete; paused before next step` : `Step ${stepCursor + 1} rejected`);
    if (accepted) setStepCursor((stepCursor + 1) % program.steps.length);
  };
  const hasPhysicalCalibration = program.target === 'real' && program.steps.some((step) => step.type === 'startup-calibration');
  const calibrationPhraseAccepted = !hasPhysicalCalibration || calibrationPhrase === 'CALIBRATE J2 J3 J4';
  const save = () => {
    const parsed = robarmProgramSchema.parse(program);
    localStorage.setItem('robarm.commander.program', JSON.stringify(parsed));
    setExecutionMessage('Program saved to this workspace');
  };
  const importProgram = async (file: File) => {
    const parsed = robarmProgramSchema.safeParse(JSON.parse(await file.text()));
    if (!parsed.success) {
      setExecutionState('error');
      setExecutionMessage(parsed.error.issues[0]?.message ?? 'Invalid program file');
      return;
    }
    setProgram(parsed.data);
    setExecutionMessage('Program imported and validated');
  };

  return (
    <div className="grid min-h-full grid-cols-[310px_minmax(0,1fr)] gap-3 p-3">
      <div className="flex flex-col gap-3">
        <Panel title="Program">
          <div className="space-y-3 p-4">
            <label className="block text-xs text-muted">Name<input className="mt-1 min-h-9 w-full border border-line bg-canvas px-3 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-signal" value={program.name} onChange={(event) => updateProgram({ name: event.target.value })} /></label>
            <label className="block text-xs text-muted">Description<textarea className="mt-1 min-h-20 w-full resize-y border border-line bg-canvas px-3 py-2 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-signal" value={program.description} onChange={(event) => updateProgram({ description: event.target.value })} /></label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-xs text-muted">Target<select className="mt-1 min-h-9 w-full border border-line bg-canvas px-2 text-sm text-ink" value={program.target} onChange={(event) => updateProgram({ target: event.target.value as RobarmProgram['target'] })}><option value="simulation">Simulation</option><option value="real">Real robot</option></select></label>
              <label className="block text-xs text-muted">Loops<input type="number" min={1} max={100} className="mt-1 min-h-9 w-full border border-line bg-canvas px-3 font-mono text-sm tabular-nums text-ink" value={program.loopCount} onChange={(event) => updateProgram({ loopCount: Number(event.target.value) })} /></label>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 border-t border-line p-4">
            <Button onClick={save}><Save className="size-4" />Save</Button>
            <Button onClick={() => downloadFile(`${program.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.robarm-program.json`, JSON.stringify(program, null, 2))}><Download className="size-4" />Export</Button>
            <Button onClick={() => importRef.current?.click()}><FolderOpen className="size-4" />Import</Button>
            <input ref={importRef} type="file" accept=".json,.robarm-program.json" className="hidden" onChange={(event) => event.target.files?.[0] && void importProgram(event.target.files[0])} />
            <ConfirmAction trigger={<Button><Trash2 className="size-4" />New</Button>} title="Replace the current program?" description="Unsaved edits in the current program will be lost. Export or save them before continuing." confirmLabel="Create new program" danger onConfirm={() => setProgram(createProgram('simulation'))} />
          </div>
        </Panel>
        <Panel title="Execution">
          <div className="space-y-3 p-4">
            <StatusTag tone={executionState === 'error' ? 'danger' : executionState === 'completed' ? 'success' : executionState === 'running' ? 'warning' : 'neutral'}>{executionState.toUpperCase()}</StatusTag>
            <p className="text-pretty text-sm text-muted">{executionMessage}</p>
            {hasPhysicalCalibration && <label className="block text-xs text-muted">Type <span className="font-mono text-ink">CALIBRATE J2 J3 J4</span> to arm physical calibration<input className="mt-1 min-h-9 w-full border border-line bg-canvas px-3 font-mono text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-signal" value={calibrationPhrase} onChange={(event) => setCalibrationPhrase(event.target.value)} autoComplete="off" /></label>}
          </div>
          <div className="grid grid-cols-2 gap-2 border-t border-line p-4">
            <Button onClick={() => run(true)}><FileCheck2 className="size-4" />Dry run</Button>
            {program.target === 'real' ? (
              <ConfirmAction trigger={<Button variant="primary" disabled={!calibrationPhraseAccepted}><Play className="size-4" />Run real</Button>} title={hasPhysicalCalibration ? 'Start physical startup calibration?' : 'Run this program on the physical robot?'} description={hasPhysicalCalibration ? 'J2 moves up to its roller, J3 moves down to its roller, then J4 turns clockwise to its proximity sensor. Keep clear and be ready to press E-stop.' : 'Every step still passes through the live safety gateway. The program will stop if target, identity, telemetry, E-stop, enable state, or limits change.'} confirmLabel={hasPhysicalCalibration ? 'Start calibration motion' : 'Run on physical robot'} onConfirm={() => { setCalibrationPhrase(''); run(false); }} />
            ) : <Button variant="primary" onClick={() => run(false)}><Play className="size-4" />Run</Button>}
            <Button onClick={() => { if (executionState === 'paused') { executorRef.current.resume(); setExecutionState('running'); } else { executorRef.current.pause(); setExecutionState('paused'); } }}><Pause className="size-4" />{executionState === 'paused' ? 'Resume' : 'Pause'}</Button>
            <Button onClick={() => void runOneStep()} disabled={!program.steps.length || executionState === 'running'}><Play className="size-4" />Step once</Button>
            <Button onClick={() => { executorRef.current.stop(); void runtime.disable('Program stopped by operator'); }}><Square className="size-4" />Stop</Button>
          </div>
        </Panel>
      </div>
      <Panel title="Program steps" action={<div className="flex gap-2"><Button onClick={() => addStep('startup-calibration')}><ScanLine className="size-4" />Startup calibration</Button><Button onClick={() => addStep('joint-move')}><Plus className="size-4" />Move</Button><Button onClick={() => addStep('delay')}><Plus className="size-4" />Delay</Button><Button onClick={() => addStep('note')}><Plus className="size-4" />Note</Button></div>}>
        {program.steps.length === 0 ? <EmptyState title="No steps yet" description="Capture the current simulated joint pose as a bounded move, or add a delay or operator note." action={<Button variant="primary" onClick={() => addStep('joint-move')}>Add current pose</Button>} /> : (
          <div className="divide-y divide-line">
            {program.steps.map((step, index) => (
              <div key={step.id} className="grid grid-cols-[48px_130px_minmax(0,1fr)_auto] items-start gap-3 p-4">
                <div className="font-mono text-sm tabular-nums text-muted">{String(index + 1).padStart(2, '0')}</div>
                <StatusTag tone={step.type === 'startup-calibration' ? 'danger' : step.type === 'joint-move' ? 'warning' : 'neutral'}>{step.type.toUpperCase()}</StatusTag>
                {step.type === 'joint-move' ? (
                  <div className="grid grid-cols-6 gap-2">
                    {step.positions.map((position, joint) => <label key={joint} className="text-[10px] text-muted">J{joint + 1}<input type="number" className="mt-1 w-full border border-line bg-canvas px-2 py-1 font-mono text-xs tabular-nums text-ink" value={position} onChange={(event) => updateStep(index, { ...step, positions: step.positions.map((value, current) => current === joint ? Number(event.target.value) : value) })} /></label>)}
                  </div>
                ) : step.type === 'startup-calibration' ? <div className="text-pretty text-xs leading-5 text-muted"><span className="font-medium text-ink">J2 up → roller → +90°; J3 down → roller → 0°; J4 clockwise → proximity → 0°.</span><br />J1 is omitted. Completion leaves a calibrated motor hold; explicitly Enable to continue or Disable to invalidate the reference.</div> : step.type === 'delay' ? <label className="text-xs text-muted">Duration (ms)<input type="number" min={10} max={3_600_000} className="ml-2 border border-line bg-canvas px-2 py-1 font-mono text-xs tabular-nums text-ink" value={step.durationMs} onChange={(event) => updateStep(index, { ...step, durationMs: Number(event.target.value) })} /></label> : <input className="w-full border border-line bg-canvas px-3 py-2 text-sm text-ink" value={step.text} onChange={(event) => updateStep(index, { ...step, text: event.target.value })} />}
                <Button variant="quiet" aria-label={`Delete step ${index + 1}`} onClick={() => deleteStep(index)}><Trash2 className="size-4" /></Button>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
