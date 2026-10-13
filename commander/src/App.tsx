import { useEffect, useSyncExternalStore } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import {
  Activity,
  BookOpenCheck,
  Bot,
  BrainCircuit,
  Cable,
  Command,
  Gamepad2,
  Gauge,
  Octagon,
  Settings,
  SlidersHorizontal,
  Wrench
} from 'lucide-react';
import { commanderRuntime } from './appRuntime';
import { FIRMWARE_STATES, identityMatches } from './core/protocol';
import { Button, ConfirmAction, StatusTag } from './components/ui';
import { ControlPanel } from './features/ControlPanel';
import { SimulatorPanel } from './features/SimulatorPanel';
import { ProgramsPanel } from './features/ProgramsPanel';
import { CommandsPanel } from './features/CommandsPanel';
import { VitalsPanel } from './features/VitalsPanel';
import { CalibrationPanel } from './features/CalibrationPanel';
import { InputsPanel } from './features/InputsPanel';
import { LearningPanel } from './features/LearningPanel';
import { SettingsPanel } from './features/SettingsPanel';

const NAVIGATION = [
  { value: 'control', label: 'Control', icon: SlidersHorizontal },
  { value: 'simulator', label: 'Simulator', icon: Bot },
  { value: 'programs', label: 'Programs', icon: BookOpenCheck },
  { value: 'commands', label: 'Commands', icon: Command },
  { value: 'vitals', label: 'Vitals', icon: Gauge },
  { value: 'calibration', label: 'Calibration', icon: Wrench },
  { value: 'inputs', label: 'Inputs', icon: Gamepad2 },
  { value: 'learning', label: 'Learning', icon: BrainCircuit },
  { value: 'settings', label: 'Settings', icon: Settings }
] as const;

export function App() {
  const snapshot = useSyncExternalStore(commanderRuntime.subscribe, commanderRuntime.getSnapshot);

  useEffect(() => {
    commanderRuntime.start();
    void commanderRuntime.discoverPorts();
    const revokePointer = () => commanderRuntime.stopMotion('Global pointer release');
    const revokeBlur = () => commanderRuntime.stopMotion('Window focus lost');
    const visibility = () => {
      if (document.visibilityState !== 'visible') commanderRuntime.stopMotion('Application hidden');
    };
    const keyboardStop = (event: KeyboardEvent) => {
      if (event.key === 'Escape') commanderRuntime.stopMotion('Escape key released motion lease');
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void commanderRuntime.disable('Keyboard software stop');
      }
    };
    window.addEventListener('pointerup', revokePointer);
    window.addEventListener('pointercancel', revokePointer);
    window.addEventListener('blur', revokeBlur);
    window.addEventListener('keydown', keyboardStop);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('pointerup', revokePointer);
      window.removeEventListener('pointercancel', revokePointer);
      window.removeEventListener('blur', revokeBlur);
      window.removeEventListener('keydown', keyboardStop);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);

  const latestEvent = snapshot.logs.at(-1);
  const realCompatible = snapshot.connectionPhase === 'compatible' && identityMatches(snapshot.telemetry?.identity) && snapshot.telemetryAgeMs !== null && snapshot.telemetryAgeMs <= 120;
  const state = snapshot.target === 'simulation'
    ? snapshot.simulation.enabled ? FIRMWARE_STATES.ENABLED : FIRMWARE_STATES.READY_DISABLED
    : snapshot.telemetry?.state;
  const estopSafe = snapshot.target === 'simulation' ? snapshot.simulation.estopSafe : snapshot.status?.estop_safe === true;

  return (
    <Tabs.Root defaultValue="control" orientation="vertical" className="grid h-dvh min-h-0 grid-cols-[190px_minmax(0,1fr)] grid-rows-[64px_minmax(0,1fr)_34px] overflow-hidden bg-canvas text-ink">
      <header className="col-span-2 grid grid-cols-[190px_minmax(0,1fr)_auto] border-b border-line bg-panel">
        <div className="flex items-center gap-3 border-r border-line px-4">
          <div className="grid size-9 place-items-center border-2 border-signal font-mono text-xs font-medium text-signal">R6</div>
          <div><div className="text-sm font-semibold text-ink">ROBARM</div><div className="font-mono text-[10px] text-muted">COMMANDER / 0.4.1</div></div>
        </div>
        <div className="flex min-w-0 items-center gap-3 px-4">
          <StatusTag tone={snapshot.target === 'real' ? 'danger' : 'success'}>{snapshot.target === 'real' ? 'REAL ROBOT' : 'SIMULATION'}</StatusTag>
          <StatusTag tone={snapshot.connectionPhase === 'compatible' ? 'success' : snapshot.connectionPhase === 'stale' || snapshot.connectionPhase === 'error' || snapshot.connectionPhase === 'incompatible' ? 'danger' : snapshot.connectionPhase === 'verifying' || snapshot.connectionPhase === 'opening' ? 'warning' : 'neutral'}>{snapshot.connectionPhase.toUpperCase()}</StatusTag>
          <span className="h-5 w-px bg-line" />
          <div className="flex min-w-0 items-center gap-2 text-xs text-muted"><Cable className="size-4 shrink-0" /><span className="truncate">{snapshot.selectedPort ?? 'No serial port open'}</span></div>
          <div className="ml-auto flex items-center gap-2">
            <StatusTag tone={estopSafe ? 'success' : 'danger'}>E-STOP {estopSafe ? 'SAFE' : 'UNSAFE'}</StatusTag>
            <StatusTag tone={state === FIRMWARE_STATES.ENABLED ? 'warning' : state === FIRMWARE_STATES.FAULT ? 'danger' : state === FIRMWARE_STATES.CALIBRATING || state === FIRMWARE_STATES.CALIBRATION_HOLD ? 'warning' : 'neutral'}>{state === FIRMWARE_STATES.ENABLED ? 'ENABLED' : state === FIRMWARE_STATES.CALIBRATING ? 'CALIBRATING' : state === FIRMWARE_STATES.CALIBRATION_HOLD ? 'CALIBRATED HOLD' : state === FIRMWARE_STATES.FAULT ? 'FAULT' : 'DISABLED'}</StatusTag>
            {snapshot.target === 'simulation' ? (
              <ConfirmAction
                trigger={<Button disabled={!realCompatible}>Select real robot</Button>}
                title="Switch command target to the physical robot?"
                description="Simulation commands will stop. Real motion still requires explicit Enable, fresh compatible telemetry, safe E-stop feedback, complete prerequisites, and a dead-man input. There is no combined target mode."
                confirmLabel="Select real robot"
                onConfirm={() => commanderRuntime.selectTarget('real')}
              />
            ) : <Button onClick={() => void commanderRuntime.selectTarget('simulation')}>Return to simulation</Button>}
          </div>
        </div>
        <button
          className="flex min-w-44 items-center justify-center gap-3 border-l border-danger bg-danger px-6 text-sm font-semibold text-white outline-none hover:bg-[#e25b4b] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white"
          onClick={() => void commanderRuntime.disable('SOFTWARE STOP pressed')}
          aria-label="Software stop and disable"
        ><Octagon className="size-6" />SOFTWARE STOP</button>
      </header>

      <Tabs.List aria-label="Commander workspaces" className="row-start-2 flex min-h-0 flex-col border-r border-line bg-panel py-2">
        {NAVIGATION.map(({ value, label, icon: Icon }) => (
          <Tabs.Trigger key={value} value={value} className="group flex min-h-11 items-center gap-3 border-l-2 border-transparent px-4 text-left text-sm text-muted outline-none hover:bg-raised hover:text-ink focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-signal data-[state=active]:border-signal data-[state=active]:bg-raised data-[state=active]:text-ink">
            <Icon className="size-4 text-muted group-data-[state=active]:text-signal" />{label}
          </Tabs.Trigger>
        ))}
        <div className="mt-auto border-t border-line px-4 pt-4">
          <div className="flex items-center gap-2 text-xs text-muted"><Activity className="size-4" />Packet link</div>
          <div className="mt-2 font-mono text-[10px] tabular-nums text-muted">RX {snapshot.stats.received} · TX {snapshot.stats.transmitted}</div>
          <div className="mt-1 font-mono text-[10px] tabular-nums text-muted">ERR {snapshot.stats.errors} · BLOCK {snapshot.stats.rejected}</div>
          <div className="mt-3 text-pretty text-[10px] leading-4 text-muted">Ctrl + Shift + S<br />software stop</div>
        </div>
      </Tabs.List>

      <main className="row-start-2 min-h-0 min-w-0 overflow-auto bg-canvas">
        <Tabs.Content value="control" className="min-h-full outline-none"><ControlPanel snapshot={snapshot} runtime={commanderRuntime} /></Tabs.Content>
        <Tabs.Content value="simulator" className="min-h-full outline-none"><SimulatorPanel snapshot={snapshot} runtime={commanderRuntime} /></Tabs.Content>
        <Tabs.Content value="programs" className="min-h-full outline-none"><ProgramsPanel snapshot={snapshot} runtime={commanderRuntime} /></Tabs.Content>
        <Tabs.Content value="commands" className="min-h-full outline-none"><CommandsPanel snapshot={snapshot} runtime={commanderRuntime} /></Tabs.Content>
        <Tabs.Content value="vitals" className="min-h-full outline-none"><VitalsPanel snapshot={snapshot} /></Tabs.Content>
        <Tabs.Content value="calibration" className="min-h-full outline-none"><CalibrationPanel snapshot={snapshot} runtime={commanderRuntime} /></Tabs.Content>
        <Tabs.Content value="inputs" className="min-h-full outline-none"><InputsPanel snapshot={snapshot} runtime={commanderRuntime} /></Tabs.Content>
        <Tabs.Content value="learning" className="min-h-full outline-none"><LearningPanel snapshot={snapshot} runtime={commanderRuntime} /></Tabs.Content>
        <Tabs.Content value="settings" className="min-h-full outline-none"><SettingsPanel snapshot={snapshot} /></Tabs.Content>
      </main>

      <footer className="col-span-2 row-start-3 flex min-w-0 items-center border-t border-line bg-panel px-4 font-mono text-[10px] tabular-nums">
        <span className={latestEvent?.severity === 'danger' ? 'text-[#ef8d82]' : latestEvent?.severity === 'warning' ? 'text-[#e9b85d]' : latestEvent?.severity === 'success' ? 'text-[#9bc79a]' : 'text-muted'}>{latestEvent ? `${new Date(latestEvent.timestamp).toLocaleTimeString()} · ${latestEvent.category.toUpperCase()}` : 'SYSTEM'}</span>
        <span className="mx-3 h-3 w-px bg-line" />
        <span className="truncate text-muted">{latestEvent ? `${latestEvent.message}${latestEvent.details ? ` — ${latestEvent.details}` : ''}` : 'Ready'}</span>
        <span className="ml-auto shrink-0 text-muted">Firmware remains final safety authority</span>
      </footer>
    </Tabs.Root>
  );
}
