import { useMemo, useState } from 'react';
import * as Select from '@radix-ui/react-select';
import * as Slider from '@radix-ui/react-slider';
import { Check, ChevronDown, CircleAlert, Fan, Minus, Plus, RefreshCw, Unplug, Usb } from 'lucide-react';
import { JOINTS, stepsToDegrees } from '../core/hardware';
import { FIRMWARE_STATES, identityMatches } from '../core/protocol';
import type { CommanderRuntime, RuntimeSnapshot } from '../core/runtime';
import { Button, ConfirmAction, Metric, Panel, StatusTag } from '../components/ui';
import { Parol6Viewport } from '../simulator/Parol6Viewport';

function phaseTone(phase: RuntimeSnapshot['connectionPhase']) {
  if (phase === 'compatible') return 'success' as const;
  if (phase === 'opening' || phase === 'verifying') return 'warning' as const;
  if (phase === 'incompatible' || phase === 'stale' || phase === 'error') return 'danger' as const;
  return 'neutral' as const;
}

function PortSelect({ ports, value, onValueChange }: { ports: SerialPortDescriptor[]; value: string; onValueChange: (value: string) => void }) {
  return (
    <Select.Root value={value || undefined} onValueChange={onValueChange}>
      <Select.Trigger aria-label="Serial port" className="flex min-h-9 min-w-52 items-center justify-between gap-3 border border-line bg-canvas px-3 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-signal disabled:opacity-40">
        <Select.Value placeholder="Select a COM port" />
        <Select.Icon><ChevronDown className="size-4 text-muted" /></Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content className="z-50 min-w-64 border border-line bg-raised p-1 shadow-lg">
          <Select.Viewport>
            {ports.map((port) => (
              <Select.Item key={port.path} value={port.path} className="relative flex cursor-default select-none items-center gap-2 px-8 py-2 text-sm text-ink outline-none data-[highlighted]:bg-signal data-[highlighted]:text-canvas">
                <Select.ItemIndicator className="absolute left-2"><Check className="size-4" /></Select.ItemIndicator>
                <Select.ItemText>{port.path} · {port.friendlyName ?? port.manufacturer ?? 'Serial device'}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}

export function ControlPanel({ snapshot, runtime }: { snapshot: RuntimeSnapshot; runtime: CommanderRuntime }) {
  const [selectedPort, setSelectedPort] = useState('');
  const [speedPercent, setSpeedPercent] = useState(20);
  const [highRiskUnlocked, setHighRiskUnlocked] = useState(false);
  const [selectedJoint, setSelectedJoint] = useState<number | null>(null);
  const positions = snapshot.target === 'simulation' ? snapshot.simulation.positions : snapshot.telemetry?.position ?? [0, 0, 0, 0, 0, 0];
  const velocities = snapshot.target === 'simulation' ? snapshot.simulation.velocities : snapshot.telemetry?.velocity ?? [0, 0, 0, 0, 0, 0];
  const connected = snapshot.connectionPhase !== 'disconnected' && snapshot.connectionPhase !== 'error';
  const state = snapshot.target === 'simulation'
    ? snapshot.simulation.enabled ? FIRMWARE_STATES.ENABLED : FIRMWARE_STATES.READY_DISABLED
    : snapshot.telemetry?.state;
  const enabled = state === FIRMWARE_STATES.ENABLED;
  const estopSafe = snapshot.target === 'simulation' ? snapshot.simulation.estopSafe : snapshot.status?.estop_safe === true;

  const readiness = useMemo(() => [
    { label: 'Exact ROBARM identity', ok: snapshot.target === 'simulation' || identityMatches(snapshot.telemetry?.identity) },
    { label: 'Fresh validated telemetry', ok: snapshot.target === 'simulation' || (snapshot.telemetryAgeMs !== null && snapshot.telemetryAgeMs <= 120) },
    { label: 'E-stop / driver power safe', ok: estopSafe },
    { label: 'Mapping and prerequisites', ok: snapshot.target === 'simulation' || (snapshot.status?.mapping_verified === true && snapshot.status?.motion_prerequisites === true) },
    { label: 'J2–J4 startup reference', ok: snapshot.target === 'simulation' || snapshot.status?.calibration_complete === true },
    { label: 'Control target enabled', ok: enabled }
  ], [enabled, estopSafe, snapshot]);

  const startJog = (joint: number, direction: -1 | 1, event: React.PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedJoint(joint);
    runtime.startJog(joint, direction, speedPercent / 100, 'mouse');
  };
  const stopJog = () => {
    setSelectedJoint(null);
    runtime.stopMotion('Mouse dead-man released');
  };

  return (
    <div className="grid min-h-full grid-cols-[minmax(620px,1.25fr)_minmax(390px,0.75fr)] gap-3 p-3">
      <div className="flex min-w-0 flex-col gap-3">
        <Panel title="Robot connection">
          <div className="flex flex-wrap items-center gap-2 p-4">
            <PortSelect ports={snapshot.ports} value={selectedPort} onValueChange={setSelectedPort} />
            <Button aria-label="Refresh serial ports" onClick={() => void runtime.discoverPorts()}><RefreshCw className="size-4" />Discover</Button>
            {!connected ? (
              <Button variant="primary" disabled={!selectedPort || snapshot.connectionPhase === 'opening'} onClick={() => void runtime.connect(selectedPort)}><Usb className="size-4" />Connect</Button>
            ) : (
              <Button onClick={() => void runtime.disconnect()}><Unplug className="size-4" />Disconnect</Button>
            )}
            <StatusTag tone={phaseTone(snapshot.connectionPhase)}>{snapshot.connectionPhase.replace('-', ' ')}</StatusTag>
          </div>
          {snapshot.transportError ? <div className="border-t border-danger/40 bg-danger/10 px-4 py-2 text-sm text-[#ef8d82]">{snapshot.transportError}</div> : null}
        </Panel>

        <Panel title="Joint dead-man jog" action={<StatusTag tone={snapshot.deadmanActive ? 'warning' : 'neutral'}>{snapshot.deadmanActive ? 'LEASE ACTIVE' : 'RELEASED'}</StatusTag>}>
          <div className="grid grid-cols-[1fr_auto] gap-4 border-b border-line p-4">
            <div className="grid grid-cols-2 gap-5">
              <div>
              <div className="flex items-center justify-between text-xs text-muted"><span>Speed scale</span><span className="font-mono tabular-nums text-ink">{speedPercent}%</span></div>
              <Slider.Root
                className="relative mt-3 flex h-5 touch-none select-none items-center"
                min={5}
                max={highRiskUnlocked ? 100 : 50}
                step={1}
                value={[speedPercent]}
                onValueChange={([value]) => setSpeedPercent(value)}
                aria-label="Jog speed scaling"
              >
                <Slider.Track className="relative h-1 grow bg-line"><Slider.Range className="absolute h-full bg-signal" /></Slider.Track>
                <Slider.Thumb className="block size-4 border-2 border-signal bg-canvas outline-none focus-visible:ring-2 focus-visible:ring-signal" />
              </Slider.Root>
              </div>
              <div>
                <div className="flex items-center justify-between text-xs text-muted"><span>Host acceleration ramp</span><span className="font-mono tabular-nums text-ink">{Math.round(snapshot.jogAccelerationScale * 100)}%</span></div>
                <Slider.Root
                  className="relative mt-3 flex h-5 touch-none select-none items-center"
                  min={10}
                  max={100}
                  step={5}
                  value={[Math.round(snapshot.jogAccelerationScale * 100)]}
                  onValueChange={([value]) => runtime.setJogAccelerationScale(value / 100)}
                  aria-label="Host jog acceleration ramp"
                >
                  <Slider.Track className="relative h-1 grow bg-line"><Slider.Range className="absolute h-full bg-signal" /></Slider.Track>
                  <Slider.Thumb className="block size-4 border-2 border-signal bg-canvas outline-none focus-visible:ring-2 focus-visible:ring-signal" />
                </Slider.Root>
              </div>
            </div>
            {!highRiskUnlocked ? (
              <ConfirmAction
                trigger={<Button>Unlock 100%</Button>}
                title="Unlock higher jog scaling?"
                description="Higher scaling increases stopping distance and mechanical risk. Keep the physical E-stop within reach and verify the work envelope first. This unlock lasts only for the current app session."
                confirmLabel="Unlock higher scaling"
                onConfirm={() => setHighRiskUnlocked(true)}
              />
            ) : <StatusTag tone="warning">HIGH SCALE UNLOCKED</StatusTag>}
          </div>
          <div className="divide-y divide-line">
            {JOINTS.map((joint, index) => {
              const degrees = stepsToDegrees(positions[index], joint);
              const range = joint.maxSteps - joint.minSteps;
              const progress = Math.max(0, Math.min(100, ((positions[index] - joint.minSteps) / range) * 100));
              return (
                <div key={joint.id} className="grid grid-cols-[minmax(170px,1fr)_116px_116px_100px] items-center gap-2 px-4 py-3" onMouseEnter={() => setSelectedJoint(index)} onMouseLeave={() => !snapshot.deadmanActive && setSelectedJoint(null)}>
                  <div className="min-w-0">
                    <div className="flex items-baseline justify-between gap-2"><span className="truncate text-sm font-medium text-ink">J{joint.number} · {joint.name}</span><span className="font-mono text-xs tabular-nums text-muted">{degrees.toFixed(2)}°</span></div>
                    <div className="mt-2 h-1 bg-line"><div className="h-full bg-signal" style={{ transform: `scaleX(${progress / 100})`, transformOrigin: 'left' }} /></div>
                    <div className="mt-1 flex justify-between font-mono text-[10px] tabular-nums text-muted"><span>{stepsToDegrees(joint.minSteps, joint).toFixed(1)}°</span><span>{stepsToDegrees(joint.maxSteps, joint).toFixed(1)}°</span></div>
                  </div>
                  <button
                    className="flex min-h-12 items-center justify-center gap-2 border border-line bg-raised px-2 text-xs text-ink outline-none hover:border-signal focus-visible:ring-2 focus-visible:ring-signal disabled:opacity-40"
                    disabled={!enabled || !estopSafe}
                    onPointerDown={(event) => startJog(index, -1, event)}
                    onPointerUp={stopJog}
                    onPointerCancel={stopJog}
                    onLostPointerCapture={stopJog}
                    onContextMenu={(event) => event.preventDefault()}
                  ><Minus className="size-4" />{joint.directionLabelNegative}</button>
                  <button
                    className="flex min-h-12 items-center justify-center gap-2 border border-line bg-raised px-2 text-xs text-ink outline-none hover:border-signal focus-visible:ring-2 focus-visible:ring-signal disabled:opacity-40"
                    disabled={!enabled || !estopSafe}
                    onPointerDown={(event) => startJog(index, 1, event)}
                    onPointerUp={stopJog}
                    onPointerCancel={stopJog}
                    onLostPointerCapture={stopJog}
                    onContextMenu={(event) => event.preventDefault()}
                  ><Plus className="size-4" />{joint.directionLabelPositive}</button>
                  <div className="text-right font-mono text-xs tabular-nums text-muted">{velocities[index]}<div className="text-[10px]">steps/s</div></div>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel title="Cartesian jog">
          <div className="flex items-start gap-3 p-4 text-sm text-muted">
            <CircleAlert className="mt-0.5 size-5 shrink-0 text-warning" />
            <p className="text-pretty">Cartesian jog remains safety-blocked until the numerical IK, singularity detection, and full-workspace collision tests are verified against this hardware. Joint jog and simulation program preview remain available.</p>
          </div>
        </Panel>
      </div>

      <div className="flex min-w-0 flex-col gap-3">
        <Panel className="min-h-[430px] flex-1" title="Live robot model" action={<StatusTag tone={snapshot.target === 'real' ? 'danger' : 'success'}>{snapshot.target === 'real' ? 'REAL TELEMETRY' : 'SIMULATION'}</StatusTag>}>
          <div className="h-[390px]"><Parol6Viewport positions={positions} sensorStates={snapshot.target === 'simulation' ? snapshot.simulation.sensors : snapshot.sensors} selectedJoint={selectedJoint} /></div>
        </Panel>

        <Panel title="Controller cooling" action={<StatusTag tone={snapshot.target === 'real' && snapshot.status?.fan_on ? 'success' : 'neutral'}>{snapshot.target === 'real' ? `FAN0 ${snapshot.status?.fan_speed_percent ?? 0}%` : 'REAL ONLY'}</StatusTag>}>
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 p-4">
            <Fan className={`size-5 ${snapshot.status?.fan_on ? 'text-signal' : 'text-muted'}`} />
            <div><div className="text-sm text-ink">5 V enclosure fan · PA8 / FAN0</div><div className="mt-1 text-pretty text-xs leading-5 text-muted">AUTO: full kick-start, 70% idle, 100% while motors are energized. Commanded duty is shown; this two-wire connection has no RPM feedback.</div></div>
            <div className="flex gap-2">
              <Button variant={snapshot.status?.fan_mode === 'auto' ? 'primary' : undefined} disabled={snapshot.target !== 'real' || !snapshot.status?.fan_supported || snapshot.status?.fan_mode === 'auto'} onClick={() => void runtime.setControllerFan('auto')}>Auto</Button>
              <Button variant={snapshot.status?.fan_mode === 'full' ? 'primary' : undefined} disabled={snapshot.target !== 'real' || !snapshot.status?.fan_supported || snapshot.status?.fan_mode === 'full'} onClick={() => void runtime.setControllerFan('full')}>Full</Button>
              <ConfirmAction trigger={<Button disabled={snapshot.target !== 'real' || !snapshot.status?.fan_supported || snapshot.status?.fan_mode === 'off'}>Off</Button>} title="Turn controller cooling off?" description="FAN0 will remain off until you select Auto or Full, or reset the board. Motor activation will not override an explicit Off command." confirmLabel="Turn fan off" onConfirm={() => runtime.setControllerFan('off')} />
            </div>
          </div>
        </Panel>

        <Panel title="Motion authorization">
          <div className="grid grid-cols-2 gap-4 border-b border-line p-4">
            <Metric label="Firmware state" value={state === FIRMWARE_STATES.ENABLED ? 'ENABLED' : state === FIRMWARE_STATES.CALIBRATING ? 'CALIBRATING' : state === FIRMWARE_STATES.CALIBRATION_HOLD ? 'CALIBRATED HOLD' : state === FIRMWARE_STATES.READY_DISABLED ? 'DISABLED' : state === FIRMWARE_STATES.FAULT ? 'FAULT' : 'LOCKED'} tone={state === FIRMWARE_STATES.ENABLED ? 'success' : state === FIRMWARE_STATES.FAULT ? 'danger' : 'warning'} />
            <Metric label="Telemetry age" value={snapshot.target === 'simulation' ? 'local' : snapshot.telemetryAgeMs ?? '—'} unit={snapshot.target === 'real' ? 'ms' : undefined} tone={snapshot.target === 'real' && (snapshot.telemetryAgeMs ?? Infinity) > 120 ? 'danger' : 'success'} />
          </div>
          <div className="divide-y divide-line">
            {readiness.map((item) => <div key={item.label} className="flex items-center justify-between px-4 py-2 text-sm"><span className="text-muted">{item.label}</span><StatusTag tone={item.ok ? 'success' : 'danger'}>{item.ok ? 'PASS' : 'BLOCKED'}</StatusTag></div>)}
          </div>
          <div className="grid grid-cols-3 gap-2 border-t border-line p-4">
            {snapshot.target === 'simulation' ? (
              <Button variant="primary" disabled={snapshot.simulation.enabled || !snapshot.simulation.estopSafe} onClick={() => runtime.setSimulationEnabled(true)}>Enable simulation</Button>
            ) : (
              <ConfirmAction
                trigger={<Button variant="primary" disabled={snapshot.status?.state !== FIRMWARE_STATES.READY_DISABLED && snapshot.status?.state !== FIRMWARE_STATES.CALIBRATION_HOLD}>Enable robot</Button>}
                title="Enable physical ROBARM?"
                description="This can energize all six mapped drivers. Confirm the arm is supported, the work envelope is clear, and the physical E-stop is within reach. No motion command is sent by enabling alone."
                confirmLabel="Enable physical robot"
                onConfirm={() => runtime.enableReal()}
              />
            )}
            <Button onClick={() => void runtime.disable('Operator Disable')}>Disable</Button>
            {snapshot.target === 'real' ? (
              <ConfirmAction
                trigger={<Button disabled={snapshot.status?.state !== FIRMWARE_STATES.FAULT}>Clear fault</Button>}
                title="Clear the firmware fault?"
                description="Fault clearing is accepted only when E-stop feedback is safe and no available home sensor is active. The robot remains disabled after a successful clear."
                confirmLabel="Clear fault"
                onConfirm={() => runtime.clearFault()}
              />
            ) : <Button disabled>Clear fault</Button>}
          </div>
        </Panel>
      </div>
    </div>
  );
}
