import { useState } from 'react';
import { Download, FlaskConical, Save, ScanLine, ShieldAlert } from 'lucide-react';
import { JOINTS, stepsToDegrees } from '../core/hardware';
import type { CommanderRuntime, RuntimeSnapshot } from '../core/runtime';
import { Button, ConfirmAction, Metric, Panel, StatusTag } from '../components/ui';

interface JointCalibrationProfile {
  joint: number;
  seekDirection: string;
  sensorPolarity: 'active-low' | 'active-high';
  maxSeekSteps: number;
  maximumTravelDegrees: number;
  backoffDegrees: number;
  debounceMs: number;
  qualificationMs: number;
  status: 'validated' | 'uncalibrated' | 'unavailable';
}

function defaultProfiles(): JointCalibrationProfile[] {
  return JOINTS.map((joint) => ({
    joint: joint.number,
    seekDirection: joint.homingDirection ?? 'Unavailable',
    sensorPolarity: joint.stopActiveLow ? 'active-low' : 'active-high',
    maxSeekSteps: 200,
    maximumTravelDegrees: Math.abs(stepsToDegrees(joint.maxSteps - joint.minSteps, joint)),
    backoffDegrees: 10,
    debounceMs: 25,
    qualificationMs: 25,
    status: joint.homingAvailable ? joint.homingValidated ? 'validated' : 'uncalibrated' : 'unavailable'
  }));
}

function downloadProfile(profiles: JointCalibrationProfile[]) {
  const payload = { schemaVersion: 1, robot: 'ROBARM-PAROL6', createdAt: new Date().toISOString(), profiles };
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'robarm.robarm-calibration.json';
  anchor.click();
  URL.revokeObjectURL(url);
}

function calibrationPhaseTone(phase: string | undefined): 'neutral' | 'success' | 'warning' {
  if (!phase || phase === 'inactive') return 'neutral';
  return phase === 'complete' ? 'success' : 'warning';
}

export function CalibrationPanel({ snapshot, runtime }: { snapshot: RuntimeSnapshot; runtime: CommanderRuntime }) {
  const [profiles, setProfiles] = useState<JointCalibrationProfile[]>(() => {
    const saved = localStorage.getItem('robarm.commander.calibration');
    return saved ? JSON.parse(saved) : defaultProfiles();
  });
  const [selectedJoint, setSelectedJoint] = useState(1);
  const [typedConfirmation, setTypedConfirmation] = useState('');
  const [sensorLog, setSensorLog] = useState<Array<{ time: number; values: number[] }>>([]);
  const [startupConfirmation, setStartupConfirmation] = useState('');
  const profile = profiles[selectedJoint - 1];
  const joint = JOINTS[selectedJoint - 1];
  const update = (changes: Partial<JointCalibrationProfile>) => setProfiles((current) => current.map((item) => item.joint === selectedJoint ? { ...item, ...changes } : item));
  const sensors = snapshot.target === 'simulation' ? snapshot.simulation.sensors : snapshot.sensors;
  const save = () => localStorage.setItem('robarm.commander.calibration', JSON.stringify(profiles));

  return (
    <div className="grid min-h-full grid-cols-[320px_minmax(0,1fr)] gap-3 p-3">
      <div className="flex flex-col gap-3">
        <Panel title="Joint calibration status">
          <div className="divide-y divide-line">
            {profiles.map((item) => <button key={item.joint} className={`flex w-full items-center justify-between px-4 py-3 text-left outline-none hover:bg-raised focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-signal ${selectedJoint === item.joint ? 'bg-raised' : ''}`} onClick={() => { setSelectedJoint(item.joint); setTypedConfirmation(''); }}><span><span className="block text-sm font-medium text-ink">J{item.joint} · {JOINTS[item.joint - 1].name}</span><span className="mt-1 block text-xs text-muted">STOP{JOINTS[item.joint - 1].stopPort} / {JOINTS[item.joint - 1].stopPin}</span></span><StatusTag tone={item.status === 'validated' ? 'success' : item.status === 'unavailable' ? 'danger' : 'warning'}>{item.status.toUpperCase()}</StatusTag></button>)}
          </div>
        </Panel>
        <Panel title="Profile files">
          <div className="grid grid-cols-2 gap-2 p-4"><Button onClick={save}><Save className="size-4" />Save local</Button><Button onClick={() => downloadProfile(profiles)}><Download className="size-4" />Export</Button></div>
          <p className="border-t border-line p-4 text-pretty text-xs leading-5 text-muted">Profiles are reversible application data. Saving a profile does not modify firmware or make an unvalidated mechanical system safe.</p>
        </Panel>
      </div>
      <div className="flex min-w-0 flex-col gap-3">
        <Panel title="Simultaneous J2 + J3 + J4 startup calibration" action={<StatusTag tone={snapshot.status?.calibration_phase === 'fault' ? 'danger' : snapshot.status?.calibration_complete ? 'success' : snapshot.status?.calibration_active ? 'warning' : 'neutral'}>{snapshot.target === 'simulation' ? 'SIMULATION' : (snapshot.status?.calibration_phase ?? 'UNAVAILABLE').toUpperCase()}</StatusTag>}>
          <div className="grid grid-cols-3 divide-x divide-line border-b border-line">
            <div className="p-4"><div className="flex items-center justify-between gap-2"><div className="text-xs text-muted">J2 shoulder</div><StatusTag tone={calibrationPhaseTone(snapshot.status?.calibration_joint_phases[0])}>{snapshot.status?.calibration_joint_phases[0]?.replace('_', ' ').toUpperCase() ?? '—'}</StatusTag></div><div className="mt-2 text-sm text-ink">Up → roller → +90°</div></div>
            <div className="p-4"><div className="flex items-center justify-between gap-2"><div className="text-xs text-muted">J3 elbow</div><StatusTag tone={calibrationPhaseTone(snapshot.status?.calibration_joint_phases[1])}>{snapshot.status?.calibration_joint_phases[1]?.replace('_', ' ').toUpperCase() ?? '—'}</StatusTag></div><div className="mt-2 text-sm text-ink">Down → roller → 0°</div></div>
            <div className="p-4"><div className="flex items-center justify-between gap-2"><div className="text-xs text-muted">J4 forearm</div><StatusTag tone={calibrationPhaseTone(snapshot.status?.calibration_joint_phases[2])}>{snapshot.status?.calibration_joint_phases[2]?.replace('_', ' ').toUpperCase() ?? '—'}</StatusTag></div><div className="mt-2 text-sm text-ink">Clockwise → proximity → 0°</div></div>
          </div>
          <div className="grid grid-cols-[1fr_auto] items-end gap-3 p-4">
            {snapshot.target === 'real' ? <label className="text-xs text-muted">Type CALIBRATE J2 J3 J4 to arm the sequence<input value={startupConfirmation} onChange={(event) => setStartupConfirmation(event.target.value)} disabled={snapshot.status?.calibration_active} className="mt-1 min-h-9 w-full border border-line bg-canvas px-3 font-mono text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-danger" /></label> : <p className="text-pretty text-xs leading-5 text-muted">Simulation preview moves directly to the configured home pose without pretending that virtual sensors establish a physical reference.</p>}
            {snapshot.target === 'real' ? <ConfirmAction
              trigger={<Button variant="danger" disabled={startupConfirmation !== 'CALIBRATE J2 J3 J4' || !snapshot.status?.calibration_supported || snapshot.status?.calibration_active}><ScanLine className="size-4" />Run startup calibration</Button>}
              title="Calibrate J2, J3, and J4 on the physical robot?"
              description="This first energizes all six mapped joints at the verified commissioning current so non-target joints hold still. J2 then moves upward, J3 downward, and J4 clockwise at the same time. Each joint stops independently at its own sensor; after all three sensors qualify, all three move concurrently to their configured homes. Support the arm, clear the combined-motion envelope, and keep the physical E-stop in hand. J1 will hold but will not rotate."
              confirmLabel="Start physical calibration"
              danger
              onConfirm={() => { setStartupConfirmation(''); void runtime.runStartupCalibration(); }}
            /> : <Button variant="primary" disabled={!snapshot.simulation.enabled} onClick={() => void runtime.runStartupCalibration()}><ScanLine className="size-4" />Preview sequence</Button>}
          </div>
          {snapshot.target === 'real' ? <div className="grid grid-cols-4 gap-4 border-t border-line p-4"><Metric label="Active joints" value={snapshot.status?.calibration_active ? 'J2 + J3 + J4' : '—'} /><Metric label="Phase" value={snapshot.status?.calibration_phase ?? '—'} /><Metric label="Referenced mask" value={snapshot.status ? `0x${snapshot.status.referenced_mask.toString(16).padStart(2, '0')}` : '—'} /><Metric label="Combined steps remaining" value={snapshot.status?.calibration_steps_remaining ?? '—'} /></div> : null}
          <div className="border-t border-warning/40 bg-warning/10 p-4 text-pretty text-xs leading-5 text-[#e9b85d]">A successful sequence leaves J2–J4 energized in CALIBRATED HOLD. Choose Enable to transfer into normal control without dropping the reference. Disable, E-stop, fault, reset, or power loss invalidates it and requires recalibration.</div>
        </Panel>
        <Panel title={`J${selectedJoint} · ${joint.name}`} action={<StatusTag tone={profile.status === 'validated' ? 'success' : profile.status === 'unavailable' ? 'danger' : 'warning'}>{profile.status.toUpperCase()}</StatusTag>}>
          {!joint.homingAvailable ? <div className="border-b border-danger/40 bg-danger/10 p-4 text-sm text-[#ef8d82]">The wrist attachment and mechanical sensor target are not installed. J{selectedJoint} is intentionally non-homing and cannot be trained or marked calibrated from software.</div> : null}
          <div className="grid grid-cols-3 gap-4 p-4">
            <label className="text-xs text-muted">Seek direction<input value={profile.seekDirection} readOnly className="mt-1 min-h-9 w-full border border-line bg-canvas px-3 text-sm text-ink" /></label>
            <label className="text-xs text-muted">Sensor polarity<select disabled={!joint.homingAvailable} value={profile.sensorPolarity} onChange={(event) => update({ sensorPolarity: event.target.value as JointCalibrationProfile['sensorPolarity'] })} className="mt-1 min-h-9 w-full border border-line bg-canvas px-2 text-sm text-ink"><option value="active-low">Active low</option><option value="active-high">Active high</option></select></label>
            <label className="text-xs text-muted">Maximum seek (steps)<input disabled={!joint.homingAvailable} type="number" min={1} max={2000} value={profile.maxSeekSteps} onChange={(event) => update({ maxSeekSteps: Number(event.target.value) })} className="mt-1 min-h-9 w-full border border-line bg-canvas px-3 font-mono text-sm tabular-nums text-ink" /></label>
            <label className="text-xs text-muted">Maximum travel (degrees)<input disabled={!joint.homingAvailable} type="number" min={1} value={profile.maximumTravelDegrees.toFixed(2)} onChange={(event) => update({ maximumTravelDegrees: Number(event.target.value) })} className="mt-1 min-h-9 w-full border border-line bg-canvas px-3 font-mono text-sm tabular-nums text-ink" /></label>
            <label className="text-xs text-muted">Backoff (degrees)<input disabled={!joint.homingAvailable} type="number" min={0.1} max={30} step={0.1} value={profile.backoffDegrees} onChange={(event) => update({ backoffDegrees: Number(event.target.value) })} className="mt-1 min-h-9 w-full border border-line bg-canvas px-3 font-mono text-sm tabular-nums text-ink" /></label>
            <label className="text-xs text-muted">Debounce (ms)<input disabled={!joint.homingAvailable} type="number" min={1} max={1000} value={profile.debounceMs} onChange={(event) => update({ debounceMs: Number(event.target.value) })} className="mt-1 min-h-9 w-full border border-line bg-canvas px-3 font-mono text-sm tabular-nums text-ink" /></label>
            <label className="text-xs text-muted">Qualification (ms)<input disabled={!joint.homingAvailable} type="number" min={1} max={1000} value={profile.qualificationMs} onChange={(event) => update({ qualificationMs: Number(event.target.value) })} className="mt-1 min-h-9 w-full border border-line bg-canvas px-3 font-mono text-sm tabular-nums text-ink" /></label>
          </div>
          <div className="grid grid-cols-[1fr_auto] items-end gap-3 border-t border-line p-4">
            <label className="text-xs text-muted">Type J{selectedJoint} to arm one bounded test<input disabled={!joint.homingAvailable} value={typedConfirmation} onChange={(event) => setTypedConfirmation(event.target.value)} className="mt-1 min-h-9 w-full border border-line bg-canvas px-3 font-mono text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-danger" /></label>
            <ConfirmAction
              trigger={<Button variant="danger" disabled={!joint.homingAvailable || typedConfirmation !== `J${selectedJoint}`}><FlaskConical className="size-4" />Test before commit</Button>}
              title={`Run the J${selectedJoint} training test?`}
              description={`This invokes the firmware's bounded HOME_TEST for up to ${profile.maxSeekSteps} microsteps. Firmware configuration, not this local profile, controls the actual 25 ms qualification and ten-degree backoff. The driver holds afterward until Disable.`}
              confirmLabel="Run finite test"
              danger
              onConfirm={() => runtime.sendMaintenanceCommand(`HOME_TEST ${selectedJoint} ${profile.maxSeekSteps} I_UNDERSTAND`)}
            />
          </div>
        </Panel>
        <div className="grid grid-cols-[0.8fr_1.2fr] gap-3">
          <Panel title="Live sensor monitor">
            <div className="grid grid-cols-4 gap-px bg-line">
              {Array.from({ length: 8 }, (_, port) => <div key={port} className="bg-panel p-3"><div className="font-mono text-xs text-muted">STOP{port}</div><div className="mt-2 font-mono text-lg tabular-nums text-ink">{sensors?.[port] ?? '—'}</div></div>)}
            </div>
            <Button className="m-4" disabled={!sensors} onClick={() => sensors && setSensorLog((current) => [...current, { time: Date.now(), values: [...sensors] }])}>Log activation snapshot</Button>
          </Panel>
          <Panel title="Sensor activation log">
            {sensorLog.length === 0 ? <div className="p-6 text-center text-sm text-muted">Capture a sensor snapshot before and after manual movement to document activation.</div> : <div className="max-h-52 overflow-auto divide-y divide-line font-mono text-xs">{sensorLog.slice().reverse().map((entry) => <div key={entry.time} className="grid grid-cols-[100px_1fr] gap-3 px-4 py-2"><span className="text-muted">{new Date(entry.time).toLocaleTimeString()}</span><span className="text-ink">[{entry.values.join(', ')}]</span></div>)}</div>}
          </Panel>
        </div>
        <Panel title="Training safety boundary">
          <div className="grid grid-cols-[auto_1fr] gap-3 p-4"><ShieldAlert className="size-5 text-warning" /><div><p className="text-pretty text-sm text-ink">Calibration is evidence, not authorization.</p><p className="mt-1 text-pretty text-xs leading-5 text-muted">A local profile can record observed direction, polarity, travel, and activation. Firmware constants and mechanical validation remain authoritative. J5/J6 stay unavailable until their targets exist and are physically tested.</p></div></div>
          <div className="grid grid-cols-4 gap-4 border-t border-line p-4"><Metric label="Available joints" value="4 / 6" /><Metric label="Validated joints" value="4 / 4" tone="success" /><Metric label="Firmware backoff" value="10°" /><Metric label="Qualification" value="25 ms" /></div>
        </Panel>
      </div>
    </div>
  );
}
