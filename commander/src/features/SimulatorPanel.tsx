import { useState } from 'react';
import * as Slider from '@radix-ui/react-slider';
import { Power, RotateCcw, ShieldAlert, Zap } from 'lucide-react';
import { JOINTS, stepsToDegrees } from '../core/hardware';
import type { CommanderRuntime, RuntimeSnapshot } from '../core/runtime';
import { Button, ConfirmAction, Metric, Panel, StatusTag } from '../components/ui';
import { Parol6Viewport } from '../simulator/Parol6Viewport';

export function SimulatorPanel({ snapshot, runtime }: { snapshot: RuntimeSnapshot; runtime: CommanderRuntime }) {
  const [selectedJoint, setSelectedJoint] = useState(0);
  const [collision, setCollision] = useState(false);
  const simulation = snapshot.simulation;
  return (
    <div className="grid min-h-full grid-cols-[minmax(0,1fr)_370px] gap-3 p-3">
      <Panel className="min-h-0 overflow-hidden" title="Integrated PAROL6 simulator" action={<div className="flex gap-2"><StatusTag tone={collision ? 'danger' : 'success'}>{collision ? 'COLLISION / FLOOR' : 'CLEAR'}</StatusTag><StatusTag tone={simulation.enabled ? 'success' : 'warning'}>{simulation.enabled ? 'ENABLED' : 'DISABLED'}</StatusTag></div>}>
        <div className="h-[calc(100dvh-180px)] min-h-[560px]"><Parol6Viewport positions={simulation.positions} sensorStates={simulation.sensors} selectedJoint={selectedJoint} onCollisionChange={setCollision} /></div>
      </Panel>
      <div className="flex min-h-0 flex-col gap-3 overflow-y-auto">
        <Panel title="Simulation safety">
          <div className="grid grid-cols-2 gap-4 border-b border-line p-4"><Metric label="E-stop model" value={simulation.estopSafe ? 'SAFE' : 'ACTIVE'} tone={simulation.estopSafe ? 'success' : 'danger'} /><Metric label="Driver power" value={simulation.driverPower ? 'ON' : 'OFF'} tone={simulation.driverPower ? 'success' : 'danger'} /></div>
          <div className="grid grid-cols-2 gap-2 p-4">
            <Button variant={simulation.enabled ? 'default' : 'primary'} onClick={() => runtime.setSimulationEnabled(!simulation.enabled)}><Power className="size-4" />{simulation.enabled ? 'Disable' : 'Enable'}</Button>
            <Button variant={simulation.estopSafe ? 'danger' : 'default'} onClick={() => runtime.setSimulationEstopSafe(!simulation.estopSafe)}><ShieldAlert className="size-4" />{simulation.estopSafe ? 'Trip E-stop' : 'Reset E-stop'}</Button>
            <Button onClick={() => runtime.setSimulationDriverPower(!simulation.driverPower)}><Zap className="size-4" />Driver power {simulation.driverPower ? 'off' : 'on'}</Button>
            <ConfirmAction trigger={<Button><RotateCcw className="size-4" />Reset</Button>} title="Reset simulation?" description="This clears simulated enable, E-stop, driver, joint, and sensor state. It cannot affect the real transport." confirmLabel="Reset simulation" onConfirm={() => runtime.resetSimulation()} />
          </div>
        </Panel>
        <Panel title="Joint state">
          <div className="divide-y divide-line">
            {JOINTS.map((joint, index) => (
              <div key={joint.id} className="p-4" onMouseEnter={() => setSelectedJoint(index)}>
                <div className="flex items-center justify-between gap-3"><span className="text-sm font-medium text-ink">J{joint.number} · {joint.name}</span><span className="font-mono text-xs tabular-nums text-ink">{stepsToDegrees(simulation.positions[index], joint).toFixed(2)}°</span></div>
                <Slider.Root
                  className="relative mt-3 flex h-5 touch-none select-none items-center"
                  min={joint.minSteps}
                  max={joint.maxSteps}
                  step={1}
                  value={[simulation.positions[index]]}
                  onValueChange={([value]) => runtime.setSimulationJointPosition(index, value)}
                  aria-label={`J${joint.number} simulated position`}
                >
                  <Slider.Track className="relative h-1 grow bg-line"><Slider.Range className="absolute h-full bg-signal" /></Slider.Track>
                  <Slider.Thumb className="block size-4 border-2 border-signal bg-canvas outline-none focus-visible:ring-2 focus-visible:ring-signal" />
                </Slider.Root>
                <div className="mt-1 flex justify-between font-mono text-[10px] tabular-nums text-muted"><span>{joint.minSteps}</span><span>{joint.maxSteps} steps</span></div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

