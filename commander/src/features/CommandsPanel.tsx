import { useMemo, useState } from 'react';
import { Download, Save, Search, Send, ShieldAlert, TerminalSquare, Trash2 } from 'lucide-react';
import { JOINTS } from '../core/hardware';
import type { CommanderRuntime, RuntimeSnapshot } from '../core/runtime';
import { Button, ConfirmAction, EmptyState, Panel, StatusTag } from '../components/ui';

const READ_ONLY_COMMANDS = [
  { command: 'STATUS' as const, description: 'Identity, state, prerequisites, homing, E-stop, and commissioning gates' },
  { command: 'SENSORS' as const, description: 'Raw levels for STOP0 through STOP7' },
  { command: 'DRIVERS' as const, description: 'TMC connection results for all eight physical motor ports' },
  { command: 'DRIVER_DIAG 0' as const, description: 'Read-only TMC register snapshot for one port' }
];

type ReadOnlyCommand = 'STATUS' | 'SENSORS' | 'DRIVERS' | `DRIVER_DIAG ${number}`;

function isReadOnlyCommand(value: string): value is ReadOnlyCommand {
  return /^(STATUS|SENSORS|DRIVERS|DRIVER_DIAG [0-7])$/.test(value.trim());
}

function loadSavedQueries() {
  try {
    const value = JSON.parse(localStorage.getItem('robarm.commander.queries') ?? '[]');
    return Array.isArray(value) ? value.filter((item): item is ReadOnlyCommand => typeof item === 'string' && isReadOnlyCommand(item)) : [];
  } catch {
    return [];
  }
}

function downloadLogs(content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'application/x-ndjson' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `robarm-${new Date().toISOString().replace(/[:.]/g, '-')}.robarm-log.jsonl`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function CommandsPanel({ snapshot, runtime }: { snapshot: RuntimeSnapshot; runtime: CommanderRuntime }) {
  const [filter, setFilter] = useState('');
  const [joint, setJoint] = useState(1);
  const [steps, setSteps] = useState(200);
  const [typedConfirmation, setTypedConfirmation] = useState('');
  const [query, setQuery] = useState('STATUS');
  const [savedQueries, setSavedQueries] = useState<ReadOnlyCommand[]>(loadSavedQueries);
  const filteredLogs = useMemo(() => snapshot.logs.filter((event) => `${event.category} ${event.message} ${event.details ?? ''}`.toLowerCase().includes(filter.toLowerCase())), [filter, snapshot.logs]);
  const rawFrame = snapshot.telemetry?.raw ? Array.from(snapshot.telemetry.raw).map((byte) => byte.toString(16).padStart(2, '0')).join(' ') : '';
  const selectedJoint = JOINTS[joint - 1];
  const maintenanceReady = snapshot.target === 'real' && selectedJoint.homingAvailable && typedConfirmation === `J${joint}`;
  const queryValid = isReadOnlyCommand(query);
  const persistQueries = (next: ReadOnlyCommand[]) => {
    setSavedQueries(next);
    localStorage.setItem('robarm.commander.queries', JSON.stringify(next));
  };
  const saveQuery = () => {
    if (!queryValid) return;
    const normalized = query.trim() as ReadOnlyCommand;
    if (!savedQueries.includes(normalized)) persistQueries([...savedQueries, normalized]);
  };

  return (
    <div className="grid min-h-full grid-cols-[370px_minmax(0,1fr)] gap-3 p-3">
      <div className="flex flex-col gap-3">
        <Panel title="Read-only command catalog" action={<StatusTag tone="success">NO MOTION</StatusTag>}>
          <div className="divide-y divide-line">
            {READ_ONLY_COMMANDS.map(({ command, description }) => (
              <button key={command} className="block w-full px-4 py-3 text-left outline-none hover:bg-raised focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-signal" onClick={() => void runtime.sendReadOnlyCommand(command)}>
                <span className="font-mono text-sm text-signal">{command}</span>
                <span className="mt-1 block text-pretty text-xs leading-5 text-muted">{description}</span>
              </button>
            ))}
          </div>
          <div className="space-y-2 border-t border-line p-3">
            <label className="block text-[10px] uppercase tracking-wide text-muted">Validated query shortcut</label>
            <div className="flex gap-2"><input value={query} onChange={(event) => setQuery(event.target.value.toUpperCase())} className="min-h-9 min-w-0 flex-1 border border-line bg-canvas px-3 font-mono text-xs text-ink outline-none focus-visible:ring-2 focus-visible:ring-signal" aria-invalid={!queryValid} /><Button disabled={!queryValid} onClick={() => void runtime.sendReadOnlyCommand(query.trim() as ReadOnlyCommand)}><Send className="size-4" />Run</Button><Button disabled={!queryValid} onClick={saveQuery}><Save className="size-4" />Save</Button></div>
            {!queryValid ? <p className="text-xs text-[#ef8d82]">Allowed: STATUS, SENSORS, DRIVERS, or DRIVER_DIAG 0-7.</p> : null}
            {savedQueries.length ? <div className="space-y-1 pt-1">{savedQueries.map((saved) => <div key={saved} className="flex items-center gap-1"><button className="min-h-8 min-w-0 flex-1 truncate border border-line bg-canvas px-2 text-left font-mono text-xs text-signal outline-none hover:border-signal focus-visible:ring-2 focus-visible:ring-signal" onClick={() => { setQuery(saved); void runtime.sendReadOnlyCommand(saved); }}>{saved}</button><Button variant="quiet" aria-label={`Delete saved query ${saved}`} onClick={() => persistQueries(savedQueries.filter((item) => item !== saved))}><Trash2 className="size-4" /></Button></div>)}</div> : null}
          </div>
        </Panel>
        <Panel title="Bounded maintenance command" action={<StatusTag tone="danger">PHYSICAL MOTION</StatusTag>}>
          <div className="space-y-3 p-4">
            <p className="text-pretty text-xs leading-5 text-muted">HOME_TEST is separate from normal Home. It seeks one available sensor for a finite number of microsteps, backs off ten degrees, then intentionally holds that driver until Disable.</p>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-muted">Joint<select className="mt-1 min-h-9 w-full border border-line bg-canvas px-2 text-sm text-ink" value={joint} onChange={(event) => { setJoint(Number(event.target.value)); setTypedConfirmation(''); }}>{JOINTS.map((item) => <option key={item.id} value={item.number}>J{item.number} · {item.homingAvailable ? item.name : 'Unavailable'}</option>)}</select></label>
              <label className="text-xs text-muted">Maximum steps<input type="number" min={1} max={2000} value={steps} onChange={(event) => setSteps(Number(event.target.value))} className="mt-1 min-h-9 w-full border border-line bg-canvas px-3 font-mono text-sm tabular-nums text-ink" /></label>
            </div>
            <label className="block text-xs text-muted">Type J{joint} to arm this one test<input value={typedConfirmation} onChange={(event) => setTypedConfirmation(event.target.value)} className="mt-1 min-h-9 w-full border border-line bg-canvas px-3 font-mono text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-danger" /></label>
            {!selectedJoint.homingAvailable ? <div className="border border-danger/40 bg-danger/10 p-3 text-xs text-[#ef8d82]">J{joint} is explicitly non-homing because its mechanical sensor target is not installed.</div> : null}
            <ConfirmAction
              trigger={<Button variant="danger" className="w-full" disabled={!maintenanceReady || steps < 1 || steps > 2000}><ShieldAlert className="size-4" />Run finite HOME_TEST</Button>}
              title={`Run HOME_TEST on J${joint}?`}
              description={`The firmware may physically move J${joint} up to ${steps} microsteps toward ${selectedJoint.homingDirection}, back off ten degrees after a qualified sensor, and hold the driver at commissioning current. Support the joint and keep the E-stop within reach.`}
              confirmLabel="Run bounded test"
              danger
              onConfirm={() => runtime.sendMaintenanceCommand(`HOME_TEST ${joint} ${steps} I_UNDERSTAND`)}
            />
            <Button className="w-full" onClick={() => void runtime.sendMaintenanceCommand('DISABLE')}>Release commissioning hold / Disable</Button>
          </div>
        </Panel>
      </div>
      <div className="flex min-w-0 flex-col gap-3">
        <Panel title="Response and safety log" action={<Button onClick={() => downloadLogs(runtime.exportLogs())}><Download className="size-4" />Export</Button>}>
          <div className="flex items-center gap-2 border-b border-line p-3"><Search className="size-4 text-muted" /><input className="min-h-9 flex-1 border border-line bg-canvas px-3 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-signal" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter commands, responses, and safety blocks" /></div>
          <div className="h-[390px] overflow-y-auto font-mono text-xs">
            {filteredLogs.length === 0 ? <EmptyState title="No matching events" description="Run a read-only query or clear the filter to see the append-only event stream." action={<Button onClick={() => void runtime.sendReadOnlyCommand('STATUS')}><Send className="size-4" />Query status</Button>} /> : filteredLogs.slice().reverse().map((event) => (
              <div key={event.id} className="grid grid-cols-[92px_84px_minmax(0,1fr)] gap-3 border-b border-line px-4 py-2">
                <span className="tabular-nums text-muted">{new Date(event.timestamp).toLocaleTimeString()}</span>
                <span className={event.severity === 'danger' ? 'text-[#ef8d82]' : event.severity === 'warning' ? 'text-[#e9b85d]' : event.severity === 'success' ? 'text-[#9bc79a]' : 'text-muted'}>{event.category}</span>
                <span className="break-words text-ink">{event.message}{event.details ? <span className="mt-1 block text-muted">{event.details}</span> : null}</span>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Raw packet view" action={<StatusTag tone={rawFrame ? 'success' : 'neutral'}>{rawFrame ? '60 BYTES' : 'NO FRAME'}</StatusTag>}>
          <div className="p-4">
            <div className="mb-2 flex items-center gap-2 text-xs text-muted"><TerminalSquare className="size-4" />Latest validated robot-to-PC frame</div>
            <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all border border-line bg-canvas p-3 font-mono text-xs leading-6 text-ink">{rawFrame || 'Connect to compatible ROBARM firmware to inspect raw framed telemetry.'}</pre>
          </div>
        </Panel>
      </div>
    </div>
  );
}
