import { Activity, AlertTriangle, CheckCircle2, Gauge, Radio, Thermometer } from 'lucide-react';
import { JOINTS, stepsToDegrees } from '../core/hardware';
import { FIRMWARE_STATES } from '../core/protocol';
import type { RuntimeSnapshot } from '../core/runtime';
import { EmptyState, Metric, Panel, StatusTag } from '../components/ui';

export function VitalsPanel({ snapshot }: { snapshot: RuntimeSnapshot }) {
  const telemetry = snapshot.telemetry;
  const status = snapshot.status;
  const positions = snapshot.target === 'simulation' ? snapshot.simulation.positions : telemetry?.position;
  const velocities = snapshot.target === 'simulation' ? snapshot.simulation.velocities : telemetry?.velocity;
  const sensors = snapshot.target === 'simulation' ? snapshot.simulation.sensors : snapshot.sensors;
  const drivers = snapshot.target === 'simulation' ? [0, 0, 0, 0, 0, 0, 2, 2] : snapshot.drivers;
  const state = snapshot.target === 'simulation' ? snapshot.simulation.enabled ? FIRMWARE_STATES.ENABLED : FIRMWARE_STATES.READY_DISABLED : telemetry?.state;
  return (
    <div className="space-y-3 p-3">
      <div className="grid grid-cols-6 gap-3">
        <Panel className="p-4"><Metric label="Firmware state" value={state === FIRMWARE_STATES.ENABLED ? 'ENABLED' : state === FIRMWARE_STATES.CALIBRATING ? 'CALIBRATING' : state === FIRMWARE_STATES.CALIBRATION_HOLD ? 'CALIBRATED HOLD' : state === FIRMWARE_STATES.READY_DISABLED ? 'DISABLED' : state === FIRMWARE_STATES.COMMISSIONING_LOCKED ? 'REFERENCE REQUIRED' : state === FIRMWARE_STATES.FAULT ? 'FAULT' : '—'} tone={state === FIRMWARE_STATES.FAULT ? 'danger' : state === FIRMWARE_STATES.ENABLED ? 'success' : 'warning'} /></Panel>
        <Panel className="p-4"><Metric label="E-stop" value={snapshot.target === 'simulation' ? snapshot.simulation.estopSafe ? 'SAFE' : 'ACTIVE' : status?.estop_safe ? 'SAFE' : 'UNSAFE'} tone={snapshot.target === 'simulation' ? snapshot.simulation.estopSafe ? 'success' : 'danger' : status?.estop_safe ? 'success' : 'danger'} /></Panel>
        <Panel className="p-4"><Metric label="Telemetry age" value={snapshot.target === 'simulation' ? 'local' : snapshot.telemetryAgeMs ?? '—'} unit={snapshot.target === 'real' ? 'ms' : undefined} tone={snapshot.target === 'real' && (snapshot.telemetryAgeMs ?? Infinity) > 120 ? 'danger' : 'success'} /></Panel>
        <Panel className="p-4"><Metric label="Packets RX / TX" value={`${snapshot.stats.received} / ${snapshot.stats.transmitted}`} /></Panel>
        <Panel className="p-4"><Metric label="Packet errors" value={snapshot.stats.errors} tone={snapshot.stats.errors ? 'danger' : 'success'} /></Panel>
        <Panel className="p-4"><Metric label="Rejected commands" value={snapshot.stats.rejected} tone={snapshot.stats.rejected ? 'warning' : 'success'} /></Panel>
      </div>
      <div className="grid grid-cols-[1.3fr_0.7fr] gap-3">
        <Panel title="Joint position and velocity" action={<Activity className="size-4 text-muted" />}>
          {!positions || !velocities ? <EmptyState title="No joint telemetry" description="Connect to compatible firmware or switch to the simulator to populate live joint values." /> : (
            <div className="divide-y divide-line">
              {JOINTS.map((joint, index) => {
                const percent = ((positions[index] - joint.minSteps) / (joint.maxSteps - joint.minSteps)) * 100;
                return <div key={joint.id} className="grid grid-cols-[180px_minmax(180px,1fr)_120px_120px] items-center gap-4 px-4 py-3"><div><div className="text-sm font-medium text-ink">J{joint.number} · {joint.name}</div><div className="mt-1 text-xs text-muted">MOTOR{joint.motorPort} · STOP{joint.stopPort}</div></div><div className="h-1 bg-line"><div className="h-full bg-signal" style={{ transform: `scaleX(${Math.max(0, Math.min(1, percent / 100))})`, transformOrigin: 'left' }} /></div><div className="font-mono text-sm tabular-nums text-ink">{stepsToDegrees(positions[index], joint).toFixed(3)}°<div className="text-[10px] text-muted">{positions[index]} steps</div></div><div className="font-mono text-sm tabular-nums text-ink">{velocities[index]}<div className="text-[10px] text-muted">steps/s</div></div></div>;
              })}
            </div>
          )}
        </Panel>
        <Panel title="Firmware and watchdog" action={<Radio className="size-4 text-muted" />}>
          <div className="divide-y divide-line text-sm">
            {[
              ['Firmware', status?.firmware ?? (snapshot.target === 'simulation' ? 'Simulator' : 'not reported')],
              ['Protocol', status ? `${status.protocol_signature} v${status.protocol_version}` : 'not reported'],
              ['Config', status?.config_version ?? 'not reported'],
              ['Mapping verified', status?.mapping_verified ?? (snapshot.target === 'simulation')],
              ['Motion prerequisites', status?.motion_prerequisites ?? (snapshot.target === 'simulation')],
              ['Homing validated', status?.homing_validated ?? (snapshot.target === 'simulation')],
              ['Startup calibration', status?.calibration_phase ?? (snapshot.target === 'simulation' ? 'simulated' : 'not reported')],
              ['Calibrated hold', status?.calibration_hold ?? false],
              ['Referenced mask', status ? `0x${status.referenced_mask.toString(16).padStart(2, '0')}` : 'not reported'],
              ['Required mask', status ? `0x${status.calibration_required_mask.toString(16).padStart(2, '0')}` : 'not reported'],
              ['Calibration joints', status?.calibration_active ? 'J2 + J3 + J4 concurrent' : 'None'],
              ['Calibration remaining', status?.calibration_steps_remaining ?? 'not reported'],
              ['Commissioning hold', status?.commissioning_hold ?? false],
              ['Holding joint', status?.holding_joint || 'None'],
              ['Watchdog fault', telemetry?.watchdogTimeout ?? false],
              ['Controller FAN0 command', status?.fan_speed_percent === undefined ? 'not reported' : `${status.fan_speed_percent}% (${status.fan_mode})`],
              ['Fan RPM feedback', status?.fan_tach_supported ? 'AVAILABLE' : 'not installed'],
              ['Fan startup default', status?.fan_startup_default_on ? 'ON' : 'not reported'],
              ['Board uptime', 'not reported']
            ].map(([label, value]) => <div key={String(label)} className="flex items-center justify-between px-4 py-2"><span className="text-muted">{label}</span><span className="font-mono text-xs tabular-nums text-ink">{typeof value === 'boolean' ? value ? 'YES' : 'NO' : String(value)}</span></div>)}
          </div>
        </Panel>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Panel title="Motor drivers" action={<Gauge className="size-4 text-muted" />}>
          <div className="grid grid-cols-4 gap-px bg-line">
            {Array.from({ length: 8 }, (_, port) => {
              const result = drivers?.[port];
              const installedJoint = JOINTS.find((joint) => joint.motorPort === port);
              const unused = !installedJoint;
              return <div key={port} className="bg-panel p-4"><div className="flex items-center justify-between"><span className="font-mono text-sm text-ink">MOTOR{port}</span>{unused ? <StatusTag>UNUSED</StatusTag> : <StatusTag tone={result === 0 ? 'success' : 'danger'}>{result === 0 ? 'OK' : result === 1 ? 'NO POWER' : result === 2 ? 'NO COMMS' : '—'}</StatusTag>}</div><div className="mt-3 text-xs text-muted">{installedJoint ? `J${installedJoint.number} · ${installedJoint.currentMa} mA configured` : 'No mapped joint'}</div><div className="mt-2 flex items-center gap-2 text-xs text-muted"><Thermometer className="size-3" />Temperature: not reported</div></div>;
            })}
          </div>
        </Panel>
        <Panel title="Sensor inputs" action={<CheckCircle2 className="size-4 text-muted" />}>
          <div className="grid grid-cols-4 gap-px bg-line">
            {Array.from({ length: 8 }, (_, port) => {
              const joint = JOINTS.find((item) => item.stopPort === port);
              const reserved = port === 6 || port === 7;
              const rawHigh = sensors?.[port];
              const active = joint ? joint.stopActiveLow ? rawHigh === 0 : rawHigh === 1 : false;
              return <div key={port} className="bg-panel p-4"><div className="flex items-center justify-between"><span className="font-mono text-sm text-ink">STOP{port}</span>{reserved ? <StatusTag tone="warning">RESERVED</StatusTag> : <StatusTag tone={active ? 'warning' : 'success'}>{rawHigh === undefined ? '—' : active ? 'ACTIVE' : 'CLEAR'}</StatusTag>}</div><div className="mt-3 text-xs text-muted">{reserved ? port === 6 ? 'PG14 · On/Off button' : 'PG15 · button LED' : joint ? `J${joint.number} · ${joint.stopPin} · active ${joint.stopActiveLow ? 'LOW' : 'HIGH'}` : 'Unmapped'}</div></div>;
            })}
          </div>
          {snapshot.target === 'real' && !sensors ? <div className="flex items-center gap-2 border-t border-warning/40 bg-warning/10 p-3 text-xs text-[#e9b85d]"><AlertTriangle className="size-4" />Full sensor telemetry requires a successful SENSORS query.</div> : null}
        </Panel>
      </div>
      <Panel title="Current adjustment policy">
        <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 p-4 text-sm text-muted"><AlertTriangle className="size-5 text-warning" /><p className="text-pretty">The current firmware reports configured currents but does not expose a reversible runtime current-setting command. ROBARM Commander therefore shows current values read from the audited configuration and does not invent an unsafe adjustment control. A future protocol capability must return current and proposed values before this surface can be enabled.</p></div>
      </Panel>
    </div>
  );
}
