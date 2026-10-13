import { useEffect, useRef, useState } from 'react';
import { Gamepad2, Hand, Plus, RotateCcw, Save, Trash2, Unplug } from 'lucide-react';
import {
  controllerProfileSchema,
  DEFAULT_CONTROLLER_PROFILE,
  gamepadAxisLabel,
  gamepadButtonLabel,
  loadControllerProfile,
  mapControllerInput,
  type ControllerProfile,
  type HandControlConfiguration
} from '../core/inputPlugins';
import { JOINTS } from '../core/hardware';
import type { CommanderRuntime, RuntimeSnapshot } from '../core/runtime';
import { Button, Panel, StatusTag } from '../components/ui';
import { XboxControllerInspector, type LiveGamepadState } from './XboxControllerInspector';

const BUTTON_OPTIONS = Array.from({ length: 32 }, (_, index) => index);
const AXIS_OPTIONS = Array.from({ length: 32 }, (_, index) => index);

function readSavedProfile() {
  try {
    const saved = localStorage.getItem('robarm.commander.controller');
    return saved ? loadControllerProfile(JSON.parse(saved)) : DEFAULT_CONTROLLER_PROFILE;
  } catch {
    return DEFAULT_CONTROLLER_PROFILE;
  }
}

export function InputsPanel({ snapshot, runtime }: { snapshot: RuntimeSnapshot; runtime: CommanderRuntime }) {
  const [profile, setProfile] = useState<ControllerProfile>(readSavedProfile);
  const [gamepads, setGamepads] = useState<Gamepad[]>([]);
  const [selectedGamepad, setSelectedGamepad] = useState<number | null>(null);
  const [controllerEnabled, setControllerEnabled] = useState(false);
  const [liveState, setLiveState] = useState<LiveGamepadState | null>(null);
  const [profileMessage, setProfileMessage] = useState('Click a controller label to assign it');
  const [handConfig, setHandConfig] = useState<HandControlConfiguration>({ provider: 'disabled', deadmanGesture: 'physical-enable', positionMapping: 'cartesian', pinchAction: 'none', wristRotationAction: 'none', deadZone: 0.12, motionScale: 0.2, smoothing: 0.7, timeoutMs: 250 });
  const lastControllerSignature = useRef('');
  const previousDisable = useRef(false);

  const discoverGamepads = () => {
    const discovered = Array.from(navigator.getGamepads?.() ?? []).filter((gamepad): gamepad is Gamepad => Boolean(gamepad));
    setGamepads(discovered);
    setSelectedGamepad((current) => current ?? discovered[0]?.index ?? null);
  };

  useEffect(() => {
    discoverGamepads();
    const connected = () => discoverGamepads();
    window.addEventListener('gamepadconnected', connected);
    window.addEventListener('gamepaddisconnected', connected);
    return () => {
      window.removeEventListener('gamepadconnected', connected);
      window.removeEventListener('gamepaddisconnected', connected);
    };
  }, []);

  useEffect(() => {
    if (selectedGamepad === null) {
      setLiveState(null);
      return;
    }
    if (controllerEnabled) runtime.setJogAccelerationScale(profile.accelerationScale);
    const timer = window.setInterval(() => {
      const gamepad = navigator.getGamepads?.()[selectedGamepad];
      if (!gamepad) {
        setLiveState(null);
        if (controllerEnabled) {
          runtime.stopMotion('Controller disconnected; motion lease revoked');
          setControllerEnabled(false);
        }
        return;
      }
      setLiveState({
        id: gamepad.id,
        mapping: gamepad.mapping,
        axes: Array.from(gamepad.axes),
        buttons: gamepad.buttons.map((button) => ({ pressed: button.pressed, touched: button.touched, value: button.value })),
        timestamp: gamepad.timestamp
      });
      if (!controllerEnabled) return;

      const deadman = gamepad.buttons[profile.deadmanButton]?.pressed === true;
      const disablePressed = gamepad.buttons[profile.disableButton]?.pressed === true;
      const chordPressed = profile.stopChord.length >= 2 && profile.stopChord.every((button) => gamepad.buttons[button]?.pressed === true);
      if ((disablePressed && !previousDisable.current) || chordPressed) {
        void runtime.disable(chordPressed ? 'Controller stop chord' : 'Controller Disable button');
        lastControllerSignature.current = '';
      }
      previousDisable.current = disablePressed;
      if (!deadman) {
        if (lastControllerSignature.current) runtime.stopMotion('Controller dead-man released');
        lastControllerSignature.current = '';
        return;
      }
      const jointScales = mapControllerInput(gamepad.axes, gamepad.buttons, profile);
      if (jointScales.every((scale) => Math.abs(scale) < 0.01)) {
        if (lastControllerSignature.current) runtime.stopMotion('Controller returned to neutral');
        lastControllerSignature.current = '';
        return;
      }
      const signature = jointScales.map((scale) => Math.round(scale * 100)).join(':');
      if (signature !== lastControllerSignature.current) {
        runtime.startJogVector(jointScales, 'controller');
        lastControllerSignature.current = signature;
      }
    }, 33);
    return () => {
      window.clearInterval(timer);
      if (controllerEnabled) runtime.stopMotion('Controller input stopped');
    };
  }, [controllerEnabled, profile, runtime, selectedGamepad]);

  const updateAxisMapping = (index: number, changes: Partial<ControllerProfile['mappings'][number]>) => setProfile((current) => ({ ...current, mappings: current.mappings.map((mapping, currentIndex) => currentIndex === index ? { ...mapping, ...changes } : mapping) }));
  const updateButtonMapping = (index: number, changes: Partial<ControllerProfile['buttonMappings'][number]>) => setProfile((current) => ({ ...current, buttonMappings: current.buttonMappings.map((mapping, currentIndex) => currentIndex === index ? { ...mapping, ...changes } : mapping) }));
  const addAxisMapping = (axis = 0) => {
    setProfile((current) => ({ ...current, mappings: [...current.mappings, { axis, joint: 0, deadZone: 0.18, sensitivity: 1, invert: false, speedScale: 0.25 }] }));
    setProfileMessage(`${gamepadAxisLabel(axis)} mapping added`);
  };
  const addButtonMapping = (button = 0) => {
    setProfile((current) => ({ ...current, buttonMappings: [...current.buttonMappings, { button, joint: 4, direction: 'positive', activationThreshold: 0.1, speedScale: 0.25 }] }));
    setProfileMessage(`${gamepadButtonLabel(button)} → J5 wrist mapping added`);
  };
  const saveProfile = () => {
    const parsed = controllerProfileSchema.safeParse(profile);
    if (!parsed.success) {
      setProfileMessage(parsed.error.issues[0]?.message ?? 'Profile is invalid');
      return;
    }
    localStorage.setItem('robarm.commander.controller', JSON.stringify(parsed.data));
    setProfileMessage('Profile saved locally');
  };

  return (
    <div className="flex min-h-full flex-col gap-3 p-3">
      <Panel title="Xbox controller workbench" action={<StatusTag tone={controllerEnabled ? 'success' : liveState ? 'warning' : 'neutral'}>{controllerEnabled ? 'ROBOT INPUT ACTIVE' : liveState ? 'LIVE MONITOR' : 'DISCONNECTED'}</StatusTag>}>
        <div className="flex items-center gap-2 border-b border-line p-3">
          <Button onClick={discoverGamepads}><Gamepad2 className="size-4" />Discover</Button>
          <select aria-label="Controller" className="min-h-9 min-w-64 flex-1 border border-line bg-canvas px-2 text-sm text-ink" value={selectedGamepad ?? ''} onChange={(event) => setSelectedGamepad(event.target.value === '' ? null : Number(event.target.value))}>
            <option value="">Select controller</option>
            {gamepads.map((gamepad) => <option key={gamepad.index} value={gamepad.index}>{gamepad.id}</option>)}
          </select>
          <Button variant={controllerEnabled ? 'danger' : 'primary'} disabled={selectedGamepad === null} onClick={() => setControllerEnabled(!controllerEnabled)}>
            {controllerEnabled ? <Unplug className="size-4" /> : <Gamepad2 className="size-4" />}{controllerEnabled ? 'Stop robot input' : 'Start robot input'}
          </Button>
        </div>
        <div className="grid grid-cols-[minmax(640px,1.45fr)_minmax(420px,1fr)]">
          <XboxControllerInspector state={liveState} profile={profile} onAddAxis={addAxisMapping} onAddButton={addButtonMapping} />
          <div className="border-l border-line bg-panel">
            <div className="border-b border-line px-4 py-3">
              <div className="text-sm font-semibold text-ink">System bindings</div>
              <p className="mt-1 text-pretty text-xs leading-5 text-muted">Every physical control can be reassigned. One control may drive multiple joints, and multiple controls may drive the same joint. Firmware limits and the physical E-stop remain authoritative.</p>
            </div>
            <div className="grid grid-cols-2 gap-3 p-4">
              <label className="text-xs text-muted">Profile name<input value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} className="mt-1 min-h-9 w-full border border-line bg-canvas px-3 text-sm text-ink" /></label>
              <label className="text-xs text-muted">Acceleration scale<input type="number" min={0.1} max={1} step={0.05} value={profile.accelerationScale} onChange={(event) => setProfile({ ...profile, accelerationScale: Number(event.target.value) })} className="mt-1 min-h-9 w-full border border-line bg-canvas px-3 font-mono text-sm tabular-nums text-ink" /></label>
              <label className="text-xs text-muted">Dead-man control<select value={profile.deadmanButton} onChange={(event) => setProfile({ ...profile, deadmanButton: Number(event.target.value) })} className="mt-1 min-h-9 w-full border border-line bg-canvas px-2 text-sm text-ink">{BUTTON_OPTIONS.map((button) => <option key={button} value={button}>{gamepadButtonLabel(button)}</option>)}</select></label>
              <label className="text-xs text-muted">Disable control<select value={profile.disableButton} onChange={(event) => setProfile({ ...profile, disableButton: Number(event.target.value) })} className="mt-1 min-h-9 w-full border border-line bg-canvas px-2 text-sm text-ink">{BUTTON_OPTIONS.map((button) => <option key={button} value={button}>{gamepadButtonLabel(button)}</option>)}</select></label>
              <label className="col-span-2 text-xs text-muted">Software-stop chord (button indexes separated by +)<input value={profile.stopChord.join('+')} onChange={(event) => setProfile({ ...profile, stopChord: event.target.value.split('+').map((value) => Number(value.trim())).filter(Number.isInteger) })} className="mt-1 min-h-9 w-full border border-line bg-canvas px-3 font-mono text-sm text-ink" /></label>
            </div>
            <div className="border-y border-line px-4 py-3">
              <div className="font-mono text-[10px] text-muted">LIVE RAW VALUES</div>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 p-4 font-mono text-[10px] tabular-nums">
              {(liveState?.axes ?? [0, 0, 0, 0]).map((value, axis) => <div key={`axis-${axis}`} className="flex justify-between gap-2"><span className={Math.abs(value) > 0.08 ? 'text-signal' : 'text-muted'}>{gamepadAxisLabel(axis)}</span><span className="text-ink">{value.toFixed(3)}</span></div>)}
              {(liveState?.buttons ?? Array.from({ length: 17 }, () => ({ pressed: false, value: 0 }))).map((button, index) => <div key={`button-${index}`} className="flex justify-between gap-2"><span className={button.pressed || button.value > 0.08 ? 'text-signal' : 'text-muted'}>{gamepadButtonLabel(index)}</span><span className="text-ink">{button.value.toFixed(2)}</span></div>)}
            </div>
          </div>
        </div>
      </Panel>

      <div className="grid grid-cols-2 gap-3">
        <Panel title="Joystick axis mappings" action={<Button onClick={() => addAxisMapping()}><Plus className="size-4" />Axis mapping</Button>}>
          <div className="max-h-[420px] divide-y divide-line overflow-auto">
            {profile.mappings.length === 0 ? <p className="p-4 text-sm text-muted">No axes assigned. Click an axis beneath the controller or add one here.</p> : profile.mappings.map((mapping, index) => (
              <div key={index} className="grid grid-cols-[minmax(150px,1.2fr)_minmax(120px,1fr)_70px_70px_72px_auto] items-end gap-2 p-3">
                <label className="text-[10px] text-muted">Physical axis<select value={mapping.axis} onChange={(event) => updateAxisMapping(index, { axis: Number(event.target.value) })} className="mt-1 min-h-8 w-full border border-line bg-canvas px-2 text-xs text-ink">{AXIS_OPTIONS.map((axis) => <option key={axis} value={axis}>{gamepadAxisLabel(axis)}</option>)}</select></label>
                <label className="text-[10px] text-muted">Robot joint<select value={mapping.joint} onChange={(event) => updateAxisMapping(index, { joint: Number(event.target.value) })} className="mt-1 min-h-8 w-full border border-line bg-canvas px-2 text-xs text-ink">{JOINTS.map((joint) => <option key={joint.id} value={joint.number - 1}>J{joint.number} · {joint.name}</option>)}</select></label>
                <label className="text-[10px] text-muted">Dead zone<input type="number" min={0} max={0.95} step={0.01} value={mapping.deadZone} onChange={(event) => updateAxisMapping(index, { deadZone: Number(event.target.value) })} className="mt-1 min-h-8 w-full border border-line bg-canvas px-2 font-mono text-xs text-ink" /></label>
                <label className="text-[10px] text-muted">Curve<input type="number" min={0.1} max={4} step={0.1} value={mapping.sensitivity} onChange={(event) => updateAxisMapping(index, { sensitivity: Number(event.target.value) })} className="mt-1 min-h-8 w-full border border-line bg-canvas px-2 font-mono text-xs text-ink" /></label>
                <label className="text-[10px] text-muted">Speed<input type="number" min={0.01} max={1} step={0.01} value={mapping.speedScale} onChange={(event) => updateAxisMapping(index, { speedScale: Number(event.target.value) })} className="mt-1 min-h-8 w-full border border-line bg-canvas px-2 font-mono text-xs text-ink" /></label>
                <div className="flex items-center gap-1"><label className="flex min-h-8 items-center gap-2 px-1 text-xs text-muted"><input type="checkbox" checked={mapping.invert} onChange={(event) => updateAxisMapping(index, { invert: event.target.checked })} />Invert</label><Button variant="quiet" aria-label={`Delete axis mapping ${index + 1}`} onClick={() => setProfile({ ...profile, mappings: profile.mappings.filter((_, current) => current !== index) })}><Trash2 className="size-4" /></Button></div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Button and trigger mappings" action={<Button onClick={() => addButtonMapping()}><Plus className="size-4" />Button mapping</Button>}>
          <div className="max-h-[420px] divide-y divide-line overflow-auto">
            {profile.buttonMappings.length === 0 ? <p className="p-4 text-sm text-muted">No joint buttons assigned. Click any labeled controller button to add it—new assignments default to J5 wrist pitch.</p> : profile.buttonMappings.map((mapping, index) => {
              const joint = JOINTS[mapping.joint];
              return (
                <div key={index} className="grid grid-cols-[minmax(135px,1.1fr)_minmax(110px,1fr)_minmax(110px,1fr)_72px_72px_auto] items-end gap-2 p-3">
                  <label className="text-[10px] text-muted">Physical control<select value={mapping.button} onChange={(event) => updateButtonMapping(index, { button: Number(event.target.value) })} className="mt-1 min-h-8 w-full border border-line bg-canvas px-2 text-xs text-ink">{BUTTON_OPTIONS.map((button) => <option key={button} value={button}>{gamepadButtonLabel(button)}</option>)}</select></label>
                  <label className="text-[10px] text-muted">Robot joint<select value={mapping.joint} onChange={(event) => updateButtonMapping(index, { joint: Number(event.target.value) })} className="mt-1 min-h-8 w-full border border-line bg-canvas px-2 text-xs text-ink">{JOINTS.map((item) => <option key={item.id} value={item.number - 1}>J{item.number} · {item.name}</option>)}</select></label>
                  <label className="text-[10px] text-muted">Direction<select value={mapping.direction} onChange={(event) => updateButtonMapping(index, { direction: event.target.value as 'negative' | 'positive' })} className="mt-1 min-h-8 w-full border border-line bg-canvas px-2 text-xs text-ink"><option value="negative">− {joint.directionLabelNegative}</option><option value="positive">+ {joint.directionLabelPositive}</option></select></label>
                  <label className="text-[10px] text-muted">Threshold<input type="number" min={0} max={1} step={0.01} value={mapping.activationThreshold} onChange={(event) => updateButtonMapping(index, { activationThreshold: Number(event.target.value) })} className="mt-1 min-h-8 w-full border border-line bg-canvas px-2 font-mono text-xs text-ink" /></label>
                  <label className="text-[10px] text-muted">Speed<input type="number" min={0.01} max={1} step={0.01} value={mapping.speedScale} onChange={(event) => updateButtonMapping(index, { speedScale: Number(event.target.value) })} className="mt-1 min-h-8 w-full border border-line bg-canvas px-2 font-mono text-xs text-ink" /></label>
                  <Button variant="quiet" aria-label={`Delete button mapping ${index + 1}`} onClick={() => setProfile({ ...profile, buttonMappings: profile.buttonMappings.filter((_, current) => current !== index) })}><Trash2 className="size-4" /></Button>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      <div className="flex items-center justify-between border border-line bg-panel p-3">
        <span className="font-mono text-xs text-muted">{profileMessage}</span>
        <div className="flex gap-2"><Button onClick={() => { setProfile(DEFAULT_CONTROLLER_PROFILE); setProfileMessage('Defaults restored; save to keep them'); }}><RotateCcw className="size-4" />Restore defaults</Button><Button variant="primary" onClick={saveProfile}><Save className="size-4" />Save profile</Button></div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Panel title="Hand-control provider" action={<StatusTag tone={handConfig.provider === 'disabled' ? 'neutral' : 'warning'}>{handConfig.provider.toUpperCase()}</StatusTag>}>
          <div className="grid grid-cols-2 gap-4 p-4">
            <label className="text-xs text-muted">Provider<select value={handConfig.provider} onChange={(event) => setHandConfig({ ...handConfig, provider: event.target.value as HandControlConfiguration['provider'] })} className="mt-1 min-h-9 w-full border border-line bg-canvas px-2 text-sm text-ink"><option value="disabled">Disabled</option><option value="mediapipe">MediaPipe plugin</option><option value="openxr">OpenXR plugin</option></select></label>
            <label className="text-xs text-muted">Dead-man requirement<select value={handConfig.deadmanGesture} onChange={(event) => setHandConfig({ ...handConfig, deadmanGesture: event.target.value as HandControlConfiguration['deadmanGesture'] })} className="mt-1 min-h-9 w-full border border-line bg-canvas px-2 text-sm text-ink"><option value="physical-enable">Physical enable input</option><option value="pinch-hold">Pinch and hold</option><option value="open-palm">Open palm</option></select></label>
          </div>
          <div className="flex items-start gap-3 border-t border-warning/40 bg-warning/10 p-4"><Hand className="mt-0.5 size-5 shrink-0 text-warning" /><p className="text-pretty text-sm text-[#e9b85d]">The hand-control contract is installed, but no camera provider is bundled yet. Motion remains disabled until a provider reports a fresh tracked hand and a separate dead-man condition.</p></div>
        </Panel>
        <Panel title="Input safety summary">
          <div className="divide-y divide-line text-sm">{[
            ['Active target', snapshot.target.toUpperCase()],
            ['Controller link', liveState ? 'live input visible' : 'not selected'],
            ['Robot input', controllerEnabled ? 'active' : 'monitor only'],
            ['Motion arbitration', 'all mapped joints simultaneous'],
            ['Dead-man', gamepadButtonLabel(profile.deadmanButton)],
            ['Lost-input action', 'zero jog + revoke lease'],
            ['Firmware boundary', 'limits and E-stop cannot be remapped']
          ].map(([label, value]) => <div key={label} className="flex items-center justify-between px-4 py-3"><span className="text-muted">{label}</span><span className="font-mono text-xs text-ink">{value}</span></div>)}</div>
        </Panel>
      </div>
    </div>
  );
}
