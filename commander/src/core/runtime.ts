import { INITIAL_SIMULATION_STEPS, JOINTS, STARTUP_CALIBRATION_HOME_STEPS } from './hardware';
import {
  buildCommanderFrame,
  COMMANDS,
  FIRMWARE_STATES,
  identityMatches,
  makePassiveFrame,
  type FirmwareIdentity,
  type RobotTelemetry
} from './protocol';
import {
  DEFAULT_TELEMETRY_FRESHNESS_MS,
  evaluateSafety,
  type CommandIntent,
  type ControlTarget,
  type FirmwareStatus,
  type SafetyContext
} from './safety';
import { parseAsciiReply } from './status';
import { RobarmStreamParser } from './streamParser';
import { ElectronSerialTransport, type ByteTransport } from './transport';

export type ConnectionPhase = 'disconnected' | 'opening' | 'verifying' | 'compatible' | 'incompatible' | 'stale' | 'error';
export type LogSeverity = 'info' | 'success' | 'warning' | 'danger';
export type InputSource = 'mouse' | 'controller' | 'hand' | 'program';

export interface RuntimeLogEvent {
  id: number;
  timestamp: number;
  severity: LogSeverity;
  category: string;
  message: string;
  details?: string;
}

export interface PacketStatistics {
  transmitted: number;
  received: number;
  errors: number;
  rejected: number;
  connectedAt: number | null;
  lastCommand: string;
}

export interface SimulationState {
  enabled: boolean;
  estopSafe: boolean;
  driverPower: boolean;
  positions: number[];
  velocities: number[];
  sensors: number[];
}

export interface RuntimeSnapshot {
  target: ControlTarget;
  ports: SerialPortDescriptor[];
  selectedPort: string | null;
  connectionPhase: ConnectionPhase;
  transportError: string | null;
  telemetry: RobotTelemetry | null;
  status: FirmwareStatus | null;
  sensors: number[] | null;
  drivers: number[] | null;
  lastTelemetryAt: number | null;
  telemetryAgeMs: number | null;
  deadmanActive: boolean;
  jogAccelerationScale: number;
  simulation: SimulationState;
  stats: PacketStatistics;
  logs: RuntimeLogEvent[];
}

interface ActiveJogAxis {
  joint: number;
  direction: -1 | 1;
  targetScale: number;
  currentScale: number;
}

interface ActiveJog {
  axes: Array<ActiveJogAxis | null>;
  source: InputSource;
}

const BAUD_RATE = 3_000_000;
const HEARTBEAT_MS = 40;
const STATUS_POLL_MS = 1000;
const MAX_LOG_EVENTS = 500;

class UnavailableTransport implements ByteTransport {
  listPorts() { return Promise.resolve([]); }
  open() { return Promise.reject(new Error('Serial control requires the ROBARM Commander desktop application')); }
  close() { return Promise.resolve(); }
  write() { return Promise.reject(new Error('Serial bridge unavailable')); }
  onData() { return () => undefined; }
  onError() { return () => undefined; }
  onClosed() { return () => undefined; }
}

export class CommanderRuntime {
  private snapshot: RuntimeSnapshot;
  private readonly listeners = new Set<() => void>();
  private readonly parser = new RobarmStreamParser();
  private readonly transport: ByteTransport;
  private unsubscribers: Array<() => void> = [];
  private interval: ReturnType<typeof setInterval> | null = null;
  private writeChain: Promise<void> = Promise.resolve();
  private activeJog: ActiveJog | null = null;
  private lastStatusPoll = 0;
  private logSequence = 0;
  private staleDisableSent = false;
  private lastBlockedSignature = '';

  constructor(transport?: ByteTransport) {
    this.transport = transport ?? (window.robarmDesktop ? new ElectronSerialTransport() : new UnavailableTransport());
    this.snapshot = {
      target: 'simulation',
      ports: [],
      selectedPort: null,
      connectionPhase: 'disconnected',
      transportError: null,
      telemetry: null,
      status: null,
      sensors: null,
      drivers: null,
      lastTelemetryAt: null,
      telemetryAgeMs: null,
      deadmanActive: false,
      jogAccelerationScale: 0.5,
      simulation: {
        enabled: false,
        estopSafe: true,
        driverPower: true,
        positions: [...INITIAL_SIMULATION_STEPS],
        velocities: [0, 0, 0, 0, 0, 0],
        sensors: [1, 0, 0, 1, 0, 1, 1, 1]
      },
      stats: {
        transmitted: 0,
        received: 0,
        errors: 0,
        rejected: 0,
        connectedAt: null,
        lastCommand: 'None'
      },
      logs: []
    };
  }

  getSnapshot = () => this.snapshot;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  start() {
    if (this.interval) return;
    this.unsubscribers = [
      this.transport.onData((data) => this.handleData(data)),
      this.transport.onError((message) => this.handleTransportError(message)),
      this.transport.onClosed(() => this.handleClosed())
    ];
    this.interval = setInterval(() => this.tick(), HEARTBEAT_MS);
    this.log('info', 'system', 'Commander initialized in simulation mode');
  }

  async dispose() {
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
    this.unsubscribers.forEach((unsubscribe) => unsubscribe());
    this.unsubscribers = [];
    await this.disconnect();
  }

  async discoverPorts() {
    try {
      const ports = await this.transport.listPorts();
      this.patch({ ports, transportError: null });
      this.log('info', 'transport', ports.length ? `Discovered ${ports.length} serial port${ports.length === 1 ? '' : 's'}` : 'No serial ports detected');
    } catch (error) {
      this.handleTransportError(error instanceof Error ? error.message : 'Port discovery failed');
    }
  }

  async connect(path: string) {
    if (this.snapshot.connectionPhase !== 'disconnected' && this.snapshot.connectionPhase !== 'error') await this.disconnect();
    this.patch({
      selectedPort: path,
      connectionPhase: 'opening',
      transportError: null,
      telemetry: null,
      status: null,
      sensors: null,
      drivers: null,
      lastTelemetryAt: null,
      telemetryAgeMs: null
    });
    this.parser.reset();
    try {
      await this.transport.open(path, BAUD_RATE);
      this.patch({
        connectionPhase: 'verifying',
        stats: { ...this.snapshot.stats, connectedAt: Date.now(), transmitted: 0, received: 0, errors: 0, rejected: 0, lastCommand: 'Verify identity' }
      });
      this.log('info', 'transport', `Opened ${path}; waiting for exact ROBARM identity`);
      await this.writeAscii('STATUS');
      await this.writeBinary(makePassiveFrame(), 'Identity heartbeat');
    } catch (error) {
      this.handleTransportError(error instanceof Error ? error.message : `Could not open ${path}`);
    }
  }

  async disconnect() {
    this.stopMotion('Transport disconnect');
    if (this.isTransportOpen()) await this.writeBinary(makePassiveFrame(COMMANDS.DISABLE), 'Disable before disconnect');
    try {
      await this.transport.close();
    } catch {
      // The state is still cleared locally; the firmware watchdog remains final authority.
    }
    this.handleClosed();
  }

  async selectTarget(target: ControlTarget) {
    if (target === this.snapshot.target) return true;
    this.stopMotion('Target changed');
    if (target === 'real') {
      if (!this.canSelectReal()) {
        this.reject('target', ['compatible fresh ROBARM telemetry is required before selecting the real robot']);
        return false;
      }
      this.patch({ target: 'real' });
      this.log('warning', 'target', 'REAL ROBOT target selected; simulation forwarding remains disabled');
      return true;
    }
    if (this.isTransportOpen()) await this.writeBinary(makePassiveFrame(COMMANDS.DISABLE), 'Disable while returning to simulation');
    this.patch({ target: 'simulation' });
    this.log('info', 'target', 'Simulation target selected');
    return true;
  }

  setSimulationEnabled(enabled: boolean) {
    this.stopMotion(enabled ? 'Simulation enable changed' : 'Simulation disabled');
    this.patchSimulation({ enabled });
    this.log(enabled ? 'success' : 'info', 'simulation', enabled ? 'Simulation enabled' : 'Simulation disabled');
  }

  setSimulationEstopSafe(safe: boolean) {
    this.stopMotion('Simulation E-stop changed');
    this.patchSimulation({ estopSafe: safe, enabled: safe ? this.snapshot.simulation.enabled : false });
    this.log(safe ? 'warning' : 'danger', 'simulation', safe ? 'Simulation E-stop reset; re-enable is required' : 'Simulation E-stop activated');
  }

  setSimulationDriverPower(powered: boolean) {
    this.stopMotion('Simulation driver power changed');
    this.patchSimulation({ driverPower: powered, enabled: powered ? this.snapshot.simulation.enabled : false });
    this.log(powered ? 'warning' : 'danger', 'simulation', powered ? 'Simulation driver power restored; re-enable is required' : 'Simulation driver power removed');
  }

  setSimulationJointPosition(jointIndex: number, steps: number) {
    const joint = JOINTS[jointIndex];
    if (!joint || !Number.isSafeInteger(steps) || steps < joint.minSteps || steps > joint.maxSteps) {
      return this.reject('simulation position', [`J${jointIndex + 1} target is outside the configured limits`]);
    }
    this.stopMotion('Simulation joint position changed');
    const positions = [...this.snapshot.simulation.positions];
    positions[jointIndex] = steps;
    this.patchSimulation({ positions, velocities: [0, 0, 0, 0, 0, 0] });
    return true;
  }

  resetSimulation() {
    this.stopMotion('Simulation reset');
    this.patchSimulation({
      enabled: false,
      estopSafe: true,
      driverPower: true,
      positions: [...INITIAL_SIMULATION_STEPS],
      velocities: [0, 0, 0, 0, 0, 0],
      sensors: [1, 0, 0, 1, 0, 1, 1, 1]
    });
    this.log('info', 'simulation', 'Simulation reset to a disabled neutral state');
  }

  async moveToPositions(positions: readonly number[], speedScale = 0.25) {
    if (!Number.isFinite(speedScale) || speedScale <= 0 || speedScale > 1) {
      return this.reject('position move', ['speed scale must be greater than 0% and at most 100%']);
    }
    const intent: CommandIntent = {
      kind: 'position',
      target: this.snapshot.target,
      positions,
      speeds: JOINTS.map((joint) => Math.round(joint.maxSpeedStepsPerSecond * speedScale)),
      affected: [true, true, true, true, true, true]
    };
    if (this.snapshot.target === 'simulation') {
      if (!this.snapshot.simulation.enabled) return this.reject('position move', ['simulation is disabled']);
      if (!this.snapshot.simulation.estopSafe || !this.snapshot.simulation.driverPower) return this.reject('position move', ['simulation E-stop or driver power is unsafe']);
    }
    const decision = evaluateSafety(this.safetyContext(false), intent);
    if (!decision.allowed) return this.reject('position move', decision.reasons);
    if (this.snapshot.target === 'simulation') {
      this.patchSimulation({ positions: [...positions], velocities: [0, 0, 0, 0, 0, 0] });
      this.log('success', 'motion', `Simulation position move applied at ${Math.round(speedScale * 100)}%`);
      return true;
    }
    await this.writeBinary(buildCommanderFrame({
      position: positions,
      speed: intent.speeds!,
      command: COMMANDS.POSITION,
      affected: intent.affected!
    }), 'Position move');
    this.log('warning', 'motion', `Real position move requested at ${Math.round(speedScale * 100)}%`);
    return true;
  }

  async moveToPositionsAndWait(positions: readonly number[], speedScale = 0.25, timeoutMs = 30_000, signal?: AbortSignal) {
    if (signal?.aborted) return false;
    const accepted = await this.moveToPositions(positions, speedScale);
    if (!accepted || this.snapshot.target === 'simulation') return accepted;
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (signal?.aborted) {
        await this.disable('Program position step aborted');
        return false;
      }
      if (this.snapshot.target !== 'real') return this.reject('program step', ['real target changed while waiting for position']);
      const decision = evaluateSafety(this.safetyContext(false), {
        kind: 'position', target: 'real', positions,
        speeds: JOINTS.map((joint) => Math.round(joint.maxSpeedStepsPerSecond * speedScale)),
        affected: [true, true, true, true, true, true]
      });
      if (!decision.allowed) {
        await this.disable('Program step safety gate failed');
        return this.reject('program step', decision.reasons);
      }
      const telemetry = this.snapshot.telemetry;
      if (telemetry && telemetry.position.every((value, index) => Math.abs(value - positions[index]) <= 2)
          && telemetry.velocity.every((value) => Math.abs(value) <= 1)) return true;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    await this.disable('Program step timed out');
    return this.reject('program step', ['position target was not reached before the timeout']);
  }

  async runStartupCalibration(signal?: AbortSignal, timeoutMs = 10 * 60_000) {
    if (this.snapshot.target === 'simulation') {
      if (!this.snapshot.simulation.enabled) return this.reject('startup calibration', ['simulation is disabled']);
      this.patchSimulation({ positions: [...STARTUP_CALIBRATION_HOME_STEPS], velocities: [0, 0, 0, 0, 0, 0] });
      this.log('success', 'calibration', 'Simulated J2 → J3 → J4 startup calibration completed at configured homes');
      return true;
    }
    const decision = evaluateSafety(this.safetyContext(false), { kind: 'calibration', target: 'real' });
    if (!decision.allowed) return this.reject('startup calibration', decision.reasons);
    if (signal?.aborted) return false;

    await this.writeAscii('CALIBRATE_STARTUP I_UNDERSTAND');
    await this.writeAscii('STATUS');
    this.log('warning', 'calibration', 'Physical startup calibration requested: J2 up → J3 down → J4 clockwise');
    const deadline = Date.now() + timeoutMs;
    const acceptanceDeadline = Date.now() + 3_000;
    let observedStart = false;
    while (Date.now() < deadline) {
      if (signal?.aborted) {
        await this.disable('Startup calibration aborted by program Stop');
        return false;
      }
      if (this.snapshot.target !== 'real' || !this.isTransportOpen()) {
        await this.disable('Startup calibration lost the real target or transport');
        return this.reject('startup calibration', ['real target or serial transport changed']);
      }
      const status = this.snapshot.status;
      if (status?.calibration_active) observedStart = true;
      if (status?.state === FIRMWARE_STATES.FAULT || status?.calibration_phase === 'fault') {
        return this.reject('startup calibration', ['firmware reported a calibration fault']);
      }
      if (status?.calibration_complete && status.calibration_hold && status.state === FIRMWARE_STATES.CALIBRATION_HOLD) {
        this.log('success', 'calibration', 'J2, J3, and J4 referenced; firmware is holding at configured home positions');
        return true;
      }
      if (!observedStart && Date.now() >= acceptanceDeadline) {
        await this.disable('Startup calibration was not accepted by firmware');
        return this.reject('startup calibration', ['firmware did not acknowledge the calibration command within 3 seconds']);
      }
      if (observedStart && !status?.calibration_active) {
        return this.reject('startup calibration', ['calibration stopped before all required joints were referenced']);
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    await this.disable('Startup calibration timed out');
    return this.reject('startup calibration', [`firmware did not complete the bounded sequence before the ${Math.ceil(timeoutMs / 60_000)}-minute timeout`]);
  }

  async sendMaintenanceCommand(command: string) {
    if (!/^(MOTOR_TEST [0-7] [01] (?:[1-9]|[1-9]\d{1,2}|1\d{3}|2000) I_UNDERSTAND|HOME_TEST [1-6] (?:[1-9]|[1-9]\d{1,2}|1\d{3}|2000) I_UNDERSTAND|DISABLE|CLEAR_FAULT)$/.test(command)) {
      return this.reject('maintenance', ['maintenance command format or finite bounds are invalid']);
    }
    if (command === 'DISABLE') {
      await this.writeAscii(command);
      return true;
    }
    const decision = evaluateSafety(this.safetyContext(false), { kind: 'maintenance', target: 'real' });
    if (!decision.allowed) return this.reject('maintenance', decision.reasons);
    await this.writeAscii(command);
    this.log('warning', 'maintenance', command);
    return true;
  }

  async setControllerFan(mode: 'auto' | 'full' | 'off') {
    const decision = evaluateSafety(this.safetyContext(false), { kind: 'fan', target: 'real' });
    if (!decision.allowed) return this.reject('controller fan', decision.reasons);
    await this.writeAscii(`FAN ${mode.toUpperCase()}`);
    await this.writeAscii('STATUS');
    this.log(mode === 'off' ? 'warning' : 'success', 'cooling', `Controller FAN0 mode requested: ${mode.toUpperCase()}`);
    return true;
  }

  async enableReal() {
    const decision = evaluateSafety(this.safetyContext(false), { kind: 'enable', target: 'real' });
    if (!decision.allowed) return this.reject('enable', decision.reasons);
    await this.writeBinary(this.commandFrame(COMMANDS.ENABLE), 'Enable');
    this.log('warning', 'command', 'Enable requested; waiting for firmware state confirmation');
    return true;
  }

  async disable(reason = 'Operator Disable') {
    this.stopMotion(reason);
    if (this.isTransportOpen()) await this.writeBinary(this.commandFrame(COMMANDS.DISABLE), 'Disable');
    if (this.snapshot.target === 'simulation') {
      this.patchSimulation({ enabled: false });
      this.log('info', 'command', this.isTransportOpen() ? 'Simulation disabled; Disable also sent to open real transport' : 'Simulation disabled');
      return true;
    }
    this.log('danger', 'command', reason);
    return true;
  }

  async clearFault() {
    const decision = evaluateSafety(this.safetyContext(false), { kind: 'clear-fault', target: 'real' });
    if (!decision.allowed) return this.reject('clear fault', decision.reasons);
    await this.writeBinary(this.commandFrame(COMMANDS.CLEAR_ERROR), 'Clear fault');
    this.log('warning', 'command', 'Clear Fault requested; waiting for firmware confirmation');
    return true;
  }

  startJog(joint: number, direction: -1 | 1, scale: number, source: InputSource = 'mouse') {
    if (!Number.isInteger(joint) || joint < 0 || joint >= 6 || ![-1, 1].includes(direction)) return false;
    if (!Number.isFinite(scale) || scale <= 0 || scale > 1) return this.reject('jog', ['speed scale must be greater than 0% and at most 100%']);
    const scales = [0, 0, 0, 0, 0, 0];
    scales[joint] = scale * direction;
    return this.startJogVector(scales, source);
  }

  startJogVector(scales: readonly number[], source: InputSource = 'controller') {
    if (scales.length !== 6) return this.reject('jog', ['jog vector must contain six joints']);
    if (scales.some((scale) => !Number.isFinite(scale) || Math.abs(scale) > 1)) {
      return this.reject('jog', ['every jog speed scale must be between -100% and 100%']);
    }
    if (scales.every((scale) => Math.abs(scale) < 0.01)) {
      this.stopMotion('Jog vector returned to zero');
      return true;
    }
    if (this.snapshot.target === 'simulation') {
      if (!this.snapshot.simulation.enabled) return this.reject('jog', ['simulation is disabled']);
      if (!this.snapshot.simulation.estopSafe || !this.snapshot.simulation.driverPower) return this.reject('jog', ['simulation E-stop or driver power is unsafe']);
    }
    const previous = this.activeJog?.source === source ? this.activeJog : null;
    const axes = scales.map((scale, joint): ActiveJogAxis | null => {
      if (Math.abs(scale) < 0.01) return null;
      const direction = Math.sign(scale) as -1 | 1;
      const targetScale = Math.abs(scale);
      const previousAxis = previous?.axes[joint];
      const currentScale = previousAxis?.direction === direction
        ? Math.min(previousAxis.currentScale, targetScale)
        : Math.min(targetScale, 0.05);
      return { joint, direction, targetScale, currentScale };
    });
    this.activeJog = { axes, source };
    this.patch({ deadmanActive: true });
    const intent = this.jogIntent(this.activeJog);
    const decision = evaluateSafety(this.safetyContext(true), intent);
    if (!decision.allowed) {
      this.activeJog = null;
      this.patch({ deadmanActive: false });
      return this.reject('jog', decision.reasons);
    }
    const summary = axes.filter((axis): axis is ActiveJogAxis => axis !== null)
      .map((axis) => `J${axis.joint + 1} ${axis.direction > 0 ? '+' : '−'} ${Math.round(axis.targetScale * 100)}%`)
      .join(', ');
    this.log('success', 'motion', `Dead-man jog vector started: ${summary}`, source);
    return true;
  }

  setJogAccelerationScale(scale: number) {
    if (!Number.isFinite(scale) || scale < 0.1 || scale > 1) return false;
    this.patch({ jogAccelerationScale: scale });
    return true;
  }

  stopMotion(reason = 'Dead-man released') {
    const hadMotion = this.activeJog !== null || this.snapshot.deadmanActive;
    this.activeJog = null;
    this.lastBlockedSignature = '';
    this.patch({ deadmanActive: false });
    this.patchSimulation({ velocities: [0, 0, 0, 0, 0, 0] });
    if (hadMotion) {
      if (this.snapshot.target === 'real' && this.isTransportOpen()) void this.writeBinary(this.commandFrame(COMMANDS.DUMMY), 'Jog stop');
      this.log('info', 'motion', reason);
    }
  }

  async sendReadOnlyCommand(command: 'STATUS' | 'SENSORS' | 'DRIVERS' | `DRIVER_DIAG ${number}`) {
    if (!this.isTransportOpen()) return this.reject('query', ['serial transport is not open']);
    if (!/^(STATUS|SENSORS|DRIVERS|DRIVER_DIAG [0-7])$/.test(command)) return this.reject('query', ['command is not in the read-only allowlist']);
    await this.writeAscii(command);
    this.log('info', 'query', command);
    return true;
  }

  exportLogs() {
    return this.snapshot.logs.map((event) => JSON.stringify(event)).join('\n');
  }

  canSelectReal() {
    const age = this.snapshot.lastTelemetryAt === null ? Infinity : Date.now() - this.snapshot.lastTelemetryAt;
    return this.isTransportOpen()
      && identityMatches(this.snapshot.telemetry?.identity)
      && this.snapshot.status?.firmware === 'ROBARM-OCTOPUS-H723'
      && age <= DEFAULT_TELEMETRY_FRESHNESS_MS;
  }

  private isTransportOpen() {
    return !['disconnected', 'opening', 'error'].includes(this.snapshot.connectionPhase);
  }

  private tick() {
    const now = Date.now();
    const telemetryAgeMs = this.snapshot.lastTelemetryAt === null ? null : Math.max(0, now - this.snapshot.lastTelemetryAt);
    if (telemetryAgeMs !== this.snapshot.telemetryAgeMs) this.patch({ telemetryAgeMs });

    if (this.activeJog) this.advanceJogRamp();
    if (this.snapshot.target === 'simulation' && this.activeJog) this.tickSimulationJog();
    if (!this.isTransportOpen()) return;

    if (now - this.lastStatusPoll >= STATUS_POLL_MS) {
      this.lastStatusPoll = now;
      void this.writeAscii('STATUS');
      void this.writeAscii('SENSORS');
      void this.writeAscii('DRIVERS');
    }

    const stale = telemetryAgeMs === null || telemetryAgeMs > DEFAULT_TELEMETRY_FRESHNESS_MS;
    if (stale && this.snapshot.telemetry) {
      if (this.snapshot.connectionPhase === 'compatible') this.patch({ connectionPhase: 'stale' });
      if (!this.staleDisableSent) {
        this.staleDisableSent = true;
        this.stopMotion('Telemetry stale; motion lease revoked');
        void this.writeBinary(this.commandFrame(COMMANDS.DISABLE), 'Fail-closed stale telemetry Disable');
        this.log('danger', 'safety', 'Validated telemetry became stale; Disable sent');
      }
      return;
    }
    this.staleDisableSent = false;

    if (this.snapshot.target === 'real' && this.activeJog) {
      const intent = this.jogIntent(this.activeJog);
      const decision = evaluateSafety(this.safetyContext(true), intent, now);
      if (decision.allowed) {
        const joints = this.activeJog.axes.filter((axis): axis is ActiveJogAxis => axis !== null).map((axis) => `J${axis.joint + 1}`).join('+');
        void this.writeBinary(this.frameForJog(this.activeJog), `Jog ${joints}`);
      }
      else {
        const signature = decision.reasons.join('|');
        if (signature !== this.lastBlockedSignature) this.reject('jog refresh', decision.reasons);
        this.lastBlockedSignature = signature;
        this.stopMotion('Safety gate revoked the jog lease');
        void this.writeBinary(this.commandFrame(COMMANDS.DISABLE), 'Safety-blocked Disable');
      }
    } else {
      void this.writeBinary(makePassiveFrame(), 'Heartbeat');
    }
  }

  private tickSimulationJog() {
    const jog = this.activeJog!;
    if (!this.snapshot.simulation.enabled || !this.snapshot.simulation.estopSafe) {
      this.stopMotion('Simulation safety gate revoked the jog lease');
      return;
    }
    const positions = [...this.snapshot.simulation.positions];
    const velocities = [0, 0, 0, 0, 0, 0];
    for (const axis of jog.axes) {
      if (!axis) continue;
      const joint = JOINTS[axis.joint];
      const velocity = Math.round(joint.maxSpeedStepsPerSecond * axis.currentScale) * axis.direction;
      const delta = Math.round(velocity * (HEARTBEAT_MS / 1000));
      const next = positions[axis.joint] + delta;
      if (next < joint.minSteps || next > joint.maxSteps) {
        this.stopMotion(`J${joint.number} simulation limit reached; synchronized jog stopped`);
        this.log('warning', 'motion', `All synchronized joints stopped because J${joint.number} reached its configured limit`);
        return;
      }
      positions[axis.joint] = next;
      velocities[axis.joint] = velocity;
    }
    this.patchSimulation({ positions, velocities });
  }

  private advanceJogRamp() {
    const jog = this.activeJog;
    if (!jog) return;
    const increment = 0.04 * this.snapshot.jogAccelerationScale;
    for (const axis of jog.axes) {
      if (!axis || axis.currentScale >= axis.targetScale) continue;
      axis.currentScale = Math.min(axis.targetScale, axis.currentScale + increment);
    }
  }

  private jogIntent(jog: ActiveJog): CommandIntent {
    const speeds = [0, 0, 0, 0, 0, 0];
    const affected = [false, false, false, false, false, false];
    for (const axis of jog.axes) {
      if (!axis) continue;
      speeds[axis.joint] = Math.round(JOINTS[axis.joint].maxSpeedStepsPerSecond * axis.currentScale) * axis.direction;
      affected[axis.joint] = true;
    }
    return { kind: 'jog', target: this.snapshot.target, speeds, affected };
  }

  private frameForJog(jog: ActiveJog) {
    const intent = this.jogIntent(jog);
    return buildCommanderFrame({
      position: this.snapshot.telemetry?.position ?? [0, 0, 0, 0, 0, 0],
      speed: intent.speeds!,
      command: COMMANDS.JOG,
      affected: intent.affected!
    });
  }

  private commandFrame(command: number) {
    return buildCommanderFrame({
      position: this.snapshot.telemetry?.position ?? [0, 0, 0, 0, 0, 0],
      speed: [0, 0, 0, 0, 0, 0],
      command,
      affected: [false, false, false, false, false, false]
    });
  }

  private safetyContext(deadmanActive: boolean): SafetyContext {
    return {
      target: this.snapshot.target,
      transportOpen: this.isTransportOpen(),
      transportError: this.snapshot.transportError,
      identity: this.snapshot.telemetry?.identity ?? null,
      status: this.snapshot.status,
      lastTelemetryAt: this.snapshot.lastTelemetryAt,
      telemetryFreshnessMs: DEFAULT_TELEMETRY_FRESHNESS_MS,
      deadmanActive
    };
  }

  private handleData(data: Uint8Array) {
    for (const event of this.parser.push(data)) {
      if (event.kind === 'telemetry') {
        const compatible = identityMatches(event.telemetry.identity);
        const synchronizedStatus = this.snapshot.status
          ? {
              ...this.snapshot.status,
              state: event.telemetry.state,
              estop_safe: (event.telemetry.ioBits & 0x08) !== 0
            }
          : null;
        this.patch({
          telemetry: event.telemetry,
          status: synchronizedStatus,
          lastTelemetryAt: Date.now(),
          telemetryAgeMs: 0,
          connectionPhase: compatible && this.snapshot.status ? 'compatible' : compatible ? 'verifying' : 'incompatible',
          stats: { ...this.snapshot.stats, received: this.snapshot.stats.received + 1 }
        });
        if (!compatible) this.log('danger', 'identity', 'Binary reply did not match the ROBARM identity tuple');
      } else if (event.kind === 'line') {
        const reply = parseAsciiReply(event.line);
        if (reply.kind === 'status') {
          this.patch({
            status: reply.status,
            connectionPhase: identityMatches(this.snapshot.telemetry?.identity) ? 'compatible' : 'verifying'
          });
        } else if (reply.kind === 'sensors') this.patch({ sensors: reply.ports });
        else if (reply.kind === 'drivers') this.patch({ drivers: reply.connections });
        else if (reply.kind === 'response') this.log(reply.message.startsWith('ERR') ? 'danger' : 'info', 'firmware', reply.message);
        else this.log('warning', 'protocol', reply.message, event.line);
      } else {
        this.patch({ stats: { ...this.snapshot.stats, errors: this.snapshot.stats.errors + 1 } });
        this.log('danger', 'protocol', event.message);
      }
    }
  }

  private writeAscii(command: string) {
    return this.enqueueWrite(new TextEncoder().encode(`${command}\n`), command);
  }

  private writeBinary(frame: Uint8Array, label: string) {
    return this.enqueueWrite(frame, label);
  }

  private enqueueWrite(data: Uint8Array, label: string) {
    this.writeChain = this.writeChain.catch(() => undefined).then(async () => {
      await this.transport.write(data);
      this.patch({ stats: { ...this.snapshot.stats, transmitted: this.snapshot.stats.transmitted + 1, lastCommand: label } });
    }).catch((error) => {
      this.handleTransportError(error instanceof Error ? error.message : 'Serial write failed');
    });
    return this.writeChain;
  }

  private handleTransportError(message: string) {
    this.activeJog = null;
    this.patch({
      connectionPhase: 'error',
      transportError: message,
      deadmanActive: false,
      stats: { ...this.snapshot.stats, errors: this.snapshot.stats.errors + 1 }
    });
    this.log('danger', 'transport', message);
  }

  private handleClosed() {
    const wasDisconnected = this.snapshot.connectionPhase === 'disconnected';
    this.activeJog = null;
    this.parser.reset();
    this.patch({
      target: 'simulation',
      selectedPort: null,
      connectionPhase: 'disconnected',
      transportError: null,
      telemetry: null,
      status: null,
      sensors: null,
      drivers: null,
      lastTelemetryAt: null,
      telemetryAgeMs: null,
      deadmanActive: false
    });
    if (!wasDisconnected) this.log('info', 'transport', 'Serial transport closed; real target cleared');
  }

  private reject(action: string, reasons: string[]) {
    this.patch({ stats: { ...this.snapshot.stats, rejected: this.snapshot.stats.rejected + 1 } });
    this.log('danger', 'safety', `${action} blocked`, reasons.join('; '));
    return false;
  }

  private log(severity: LogSeverity, category: string, message: string, details?: string) {
    const event: RuntimeLogEvent = { id: ++this.logSequence, timestamp: Date.now(), severity, category, message, details };
    this.patch({ logs: [...this.snapshot.logs, event].slice(-MAX_LOG_EVENTS) });
  }

  private patch(update: Partial<RuntimeSnapshot>) {
    this.snapshot = { ...this.snapshot, ...update };
    this.listeners.forEach((listener) => listener());
  }

  private patchSimulation(update: Partial<SimulationState>) {
    this.patch({ simulation: { ...this.snapshot.simulation, ...update } });
  }
}
