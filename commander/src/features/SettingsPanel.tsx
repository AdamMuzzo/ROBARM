import { useState } from 'react';
import { JOINTS } from '../core/hardware';
import type { RuntimeSnapshot } from '../core/runtime';
import { Button, Panel, StatusTag } from '../components/ui';

export function SettingsPanel({ snapshot }: { snapshot: RuntimeSnapshot }) {
  const [workspace, setWorkspace] = useState(() => localStorage.getItem('robarm.commander.workspace') ?? 'ROBARM main');
  const [role, setRole] = useState<'operator' | 'maintainer'>('operator');
  const save = () => localStorage.setItem('robarm.commander.workspace', workspace);
  return (
    <div className="grid min-h-full grid-cols-2 gap-3 p-3">
      <div className="flex flex-col gap-3">
        <Panel title="Workspace and permissions">
          <div className="grid grid-cols-2 gap-4 p-4"><label className="text-xs text-muted">Workspace name<input value={workspace} onChange={(event) => setWorkspace(event.target.value)} className="mt-1 min-h-9 w-full border border-line bg-canvas px-3 text-sm text-ink" /></label><label className="text-xs text-muted">Local role<select value={role} onChange={(event) => setRole(event.target.value as typeof role)} className="mt-1 min-h-9 w-full border border-line bg-canvas px-2 text-sm text-ink"><option value="operator">Operator</option><option value="maintainer">Maintainer</option></select></label><Button onClick={save}>Save workspace</Button></div>
          <p className="border-t border-line p-4 text-pretty text-xs leading-5 text-muted">Local roles organize the interface only; they are not a substitute for OS authentication, physical key control, or a firmware safety gate.</p>
        </Panel>
        <Panel title="Serial and protocol">
          <div className="divide-y divide-line text-sm">{[
            ['Transport', 'USB CDC serial'],
            ['Baud rate', '3,000,000'],
            ['Expected port', 'COM5 (discover; never assume)'],
            ['PC body', '52 bytes'],
            ['Robot body', '56 bytes'],
            ['Identity', 'A6 / RB / protocol 1 / config 6'],
            ['Heartbeat', '40 ms'],
            ['Host freshness', '120 ms'],
            ['Firmware watchdog', '100 ms']
          ].map(([label, value]) => <div key={label} className="flex items-center justify-between px-4 py-3"><span className="text-muted">{label}</span><span className="font-mono text-xs tabular-nums text-ink">{value}</span></div>)}</div>
        </Panel>
        <Panel title="Safety preferences">
          <div className="space-y-4 p-4"><label className="flex items-center justify-between gap-4 text-sm text-muted"><span>Confirm high-risk jog scaling</span><span className="font-mono text-xs text-success">MANDATORY</span></label><label className="block text-xs text-muted">Event retention<input type="number" value={500} disabled className="mt-1 min-h-9 w-full border border-line bg-canvas px-3 font-mono text-sm tabular-nums text-muted opacity-70" /><span className="mt-1 block">Fixed-size in-memory safety log; export before closing for permanent retention.</span></label></div>
          <div className="border-t border-warning/40 bg-warning/10 p-4 text-pretty text-xs leading-5 text-[#e9b85d]">Firmware identity, telemetry freshness, E-stop, prerequisites, target isolation, bounded motion, and dead-man enforcement are mandatory and cannot be disabled in settings.</div>
        </Panel>
      </div>
      <div className="flex flex-col gap-3">
        <Panel title="Verified joint, motor, and sensor map" action={<StatusTag tone="success">CONFIG 6</StatusTag>}>
          <div className="overflow-x-auto"><table className="w-full border-collapse text-left text-xs"><thead className="bg-raised text-muted"><tr><th className="px-3 py-2 font-medium">Joint</th><th className="px-3 py-2 font-medium">Motor</th><th className="px-3 py-2 font-medium">Sensor</th><th className="px-3 py-2 font-medium">Polarity</th><th className="px-3 py-2 font-medium">Home</th><th className="px-3 py-2 font-medium">Status</th></tr></thead><tbody>{JOINTS.map((joint) => <tr key={joint.id} className="border-t border-line"><td className="px-3 py-3 text-ink">J{joint.number} · {joint.name}</td><td className="px-3 py-3 font-mono text-ink">MOTOR{joint.motorPort}</td><td className="px-3 py-3 font-mono text-ink">STOP{joint.stopPort} / {joint.stopPin}</td><td className="px-3 py-3 text-muted">Active {joint.stopActiveLow ? 'low' : 'high'}</td><td className="px-3 py-3 text-muted">{joint.homingDirection ?? 'Unavailable'}</td><td className="px-3 py-3"><StatusTag tone={joint.homingValidated ? 'success' : 'danger'}>{joint.homingValidated ? 'VALIDATED' : 'NON-HOMING'}</StatusTag></td></tr>)}</tbody></table></div>
          <div className="border-t border-line p-4 text-xs text-muted">MOTOR6, MOTOR7, and MOTOR2_2 are unused. PG14 and PG15 are reserved for the On/Off button and LED.</div>
        </Panel>
        <Panel title="Runtime snapshot">
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all p-4 font-mono text-xs leading-6 text-muted">{JSON.stringify({ target: snapshot.target, connection: snapshot.connectionPhase, selectedPort: snapshot.selectedPort, firmware: snapshot.status?.firmware ?? null, state: snapshot.telemetry?.state ?? null, estopSafe: snapshot.status?.estop_safe ?? null, telemetryAgeMs: snapshot.telemetryAgeMs, stats: snapshot.stats }, null, 2)}</pre>
        </Panel>
      </div>
    </div>
  );
}
