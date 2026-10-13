import { useEffect, useRef, useState } from 'react';
import { BrainCircuit, CircleDot, Download, Play, ShieldCheck, Square, Upload } from 'lucide-react';
import { datasetManifestSchema, modelMetadataSchema, type DatasetManifest, type ModelMetadata } from '../core/learning';
import type { CommanderRuntime, RuntimeSnapshot } from '../core/runtime';
import { Button, ConfirmAction, EmptyState, Metric, Panel, StatusTag } from '../components/ui';

function downloadJson(filename: string, value: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function newDataset(): DatasetManifest {
  return { schemaVersion: 1, id: crypto.randomUUID(), name: 'Movement dataset', label: '', createdAt: new Date().toISOString(), samplePeriodMs: 100, split: { train: 0.7, validation: 0.15, test: 0.15 }, samples: [] };
}

export function LearningPanel({ snapshot, runtime }: { snapshot: RuntimeSnapshot; runtime: CommanderRuntime }) {
  const [dataset, setDataset] = useState<DatasetManifest>(newDataset);
  const [recording, setRecording] = useState(false);
  const [playbackIndex, setPlaybackIndex] = useState(0);
  const [models, setModels] = useState<ModelMetadata[]>(() => {
    const saved = localStorage.getItem('robarm.commander.models');
    return saved ? JSON.parse(saved) : [];
  });
  const [modelName, setModelName] = useState('Imitation policy');
  const [modelVersion, setModelVersion] = useState('0.1.0');
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;

  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => {
      const current = snapshotRef.current;
      const positions = current.target === 'simulation' ? current.simulation.positions : current.telemetry?.position;
      const velocities = current.target === 'simulation' ? current.simulation.velocities : current.telemetry?.velocity;
      if (!positions || !velocities) return;
      setDataset((manifest) => ({ ...manifest, samples: [...manifest.samples, { timestamp: Date.now(), target: current.target, positions: [...positions], velocities: [...velocities], sensors: current.target === 'simulation' ? [...current.simulation.sensors] : current.sensors ? [...current.sensors] : null, lastCommand: current.stats.lastCommand, cameraFrame: null }] }));
    }, dataset.samplePeriodMs);
    return () => window.clearInterval(timer);
  }, [dataset.samplePeriodMs, recording]);

  const addModel = () => {
    if (!dataset.samples.length) return;
    const model = modelMetadataSchema.parse({ schemaVersion: 1, id: crypto.randomUUID(), name: modelName, version: modelVersion, datasetId: dataset.id, framework: 'External trainer required', task: 'Movement imitation', createdAt: new Date().toISOString(), evaluation: 'Not evaluated', deployment: 'not-tested' });
    const next = [...models, model];
    setModels(next);
    localStorage.setItem('robarm.commander.models', JSON.stringify(next));
  };
  const previewSample = () => {
    const sample = dataset.samples[playbackIndex];
    if (!sample) return;
    void runtime.selectTarget('simulation').then(() => {
      runtime.setSimulationEnabled(true);
      void runtime.moveToPositions(sample.positions, 0.15);
    });
  };
  const validateDataset = () => datasetManifestSchema.safeParse(dataset).success;

  return (
    <div className="grid min-h-full grid-cols-[1.1fr_0.9fr] gap-3 p-3">
      <div className="flex flex-col gap-3">
        <Panel title="Movement recorder" action={<StatusTag tone={recording ? 'danger' : 'neutral'}>{recording ? 'RECORDING' : 'IDLE'}</StatusTag>}>
          <div className="grid grid-cols-2 gap-4 p-4">
            <label className="text-xs text-muted">Dataset name<input value={dataset.name} onChange={(event) => setDataset({ ...dataset, name: event.target.value })} className="mt-1 min-h-9 w-full border border-line bg-canvas px-3 text-sm text-ink" /></label>
            <label className="text-xs text-muted">Label<input value={dataset.label} onChange={(event) => setDataset({ ...dataset, label: event.target.value })} className="mt-1 min-h-9 w-full border border-line bg-canvas px-3 text-sm text-ink" placeholder="e.g. reach and place" /></label>
            <label className="text-xs text-muted">Sample period (ms)<input type="number" min={20} max={10000} value={dataset.samplePeriodMs} onChange={(event) => setDataset({ ...dataset, samplePeriodMs: Number(event.target.value) })} className="mt-1 min-h-9 w-full border border-line bg-canvas px-3 font-mono text-sm tabular-nums text-ink" /></label>
            <div className="grid grid-cols-3 gap-2"><label className="text-[10px] text-muted">Train<input type="number" min={0} max={1} step={0.05} value={dataset.split.train} onChange={(event) => setDataset({ ...dataset, split: { ...dataset.split, train: Number(event.target.value) } })} className="mt-1 min-h-9 w-full border border-line bg-canvas px-2 font-mono text-xs text-ink" /></label><label className="text-[10px] text-muted">Validation<input type="number" min={0} max={1} step={0.05} value={dataset.split.validation} onChange={(event) => setDataset({ ...dataset, split: { ...dataset.split, validation: Number(event.target.value) } })} className="mt-1 min-h-9 w-full border border-line bg-canvas px-2 font-mono text-xs text-ink" /></label><label className="text-[10px] text-muted">Test<input type="number" min={0} max={1} step={0.05} value={dataset.split.test} onChange={(event) => setDataset({ ...dataset, split: { ...dataset.split, test: Number(event.target.value) } })} className="mt-1 min-h-9 w-full border border-line bg-canvas px-2 font-mono text-xs text-ink" /></label></div>
          </div>
          <div className="grid grid-cols-4 gap-4 border-y border-line p-4"><Metric label="Samples" value={dataset.samples.length} /><Metric label="Duration" value={(dataset.samples.length * dataset.samplePeriodMs / 1000).toFixed(1)} unit="s" /><Metric label="Camera frames" value="0" /><Metric label="Source" value={snapshot.target.toUpperCase()} /></div>
          <div className="flex gap-2 p-4"><Button variant={recording ? 'danger' : 'primary'} onClick={() => setRecording(!recording)}>{recording ? <Square className="size-4" /> : <CircleDot className="size-4" />}{recording ? 'Stop recording' : 'Start recording'}</Button><Button onClick={() => downloadJson(`${dataset.name}.robarm-dataset.json`, dataset)} disabled={!validateDataset()}><Download className="size-4" />Export dataset</Button><ConfirmAction trigger={<Button>Clear samples</Button>} title="Clear every recorded sample?" description="This removes the current in-memory recording. Export it first if it must be retained." confirmLabel="Clear samples" danger onConfirm={() => setDataset({ ...dataset, samples: [] })} /></div>
          <p className="border-t border-line p-4 text-pretty text-xs leading-5 text-muted">Each sample records timestamp, target, six positions, six velocities, last command, and the eight sensor states when available. Camera frames remain null until a camera provider is installed; missing camera data is never fabricated.</p>
        </Panel>
        <Panel title="Dataset playback">
          {dataset.samples.length === 0 ? <EmptyState title="No movement samples" description="Record simulation or real telemetry to create a labeled dataset. Playback always previews through simulation first." action={<Button variant="primary" onClick={() => setRecording(true)}>Start recording</Button>} /> : <div className="p-4"><input type="range" min={0} max={dataset.samples.length - 1} value={playbackIndex} onChange={(event) => setPlaybackIndex(Number(event.target.value))} className="w-full accent-[#e8a72c]" aria-label="Dataset playback sample" /><div className="mt-3 flex items-center justify-between"><span className="font-mono text-xs tabular-nums text-muted">Sample {playbackIndex + 1} / {dataset.samples.length}</span><Button onClick={previewSample}><Play className="size-4" />Preview in simulation</Button></div></div>}
        </Panel>
      </div>
      <div className="flex flex-col gap-3">
        <Panel title="Model registry" action={<StatusTag tone="warning">SIMULATION FIRST</StatusTag>}>
          <div className="grid grid-cols-2 gap-3 border-b border-line p-4"><label className="text-xs text-muted">Model name<input value={modelName} onChange={(event) => setModelName(event.target.value)} className="mt-1 min-h-9 w-full border border-line bg-canvas px-3 text-sm text-ink" /></label><label className="text-xs text-muted">Version<input value={modelVersion} onChange={(event) => setModelVersion(event.target.value)} className="mt-1 min-h-9 w-full border border-line bg-canvas px-3 font-mono text-sm text-ink" /></label><Button variant="primary" className="col-span-2" disabled={!dataset.samples.length} onClick={addModel}><BrainCircuit className="size-4" />Register training run metadata</Button></div>
          {models.length === 0 ? <EmptyState title="No registered models" description="Create a dataset, then register model metadata for an external training run. Commander does not pretend that metadata creation trains a model." /> : <div className="divide-y divide-line">{models.slice().reverse().map((model) => <div key={model.id} className="p-4"><div className="flex items-center justify-between"><div><span className="text-sm font-medium text-ink">{model.name}</span><span className="ml-2 font-mono text-xs text-muted">v{model.version}</span></div><StatusTag tone="warning">{model.deployment.toUpperCase()}</StatusTag></div><div className="mt-2 text-xs text-muted">{model.framework} · {model.evaluation}</div><div className="mt-3 flex gap-2"><Button onClick={() => downloadJson(`${model.name}-${model.version}.robarm-model.json`, model)}><Download className="size-4" />Export</Button><Button disabled><Upload className="size-4" />Deploy to real robot</Button></div></div>)}</div>}
        </Panel>
        <Panel title="Deployment approval gate">
          <div className="flex items-start gap-3 p-4"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-warning" /><div><p className="text-pretty text-sm text-ink">Model output is never a privileged command source.</p><p className="mt-1 text-pretty text-xs leading-5 text-muted">A future model adapter must pass the same identity, telemetry, E-stop, state, bounds, collision, target, and dead-man gates as manual motion. Simulation evaluation and recorded human approval are required before the real-deployment control can be enabled.</p></div></div>
        </Panel>
      </div>
    </div>
  );
}
