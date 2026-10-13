import { afterEach, describe, expect, it, vi } from 'vitest';
import { JOINTS } from '../src/core/hardware';
import { FIRMWARE_STATES } from '../src/core/protocol';
import { CommanderRuntime } from '../src/core/runtime';
import { MockFirmwareTransport } from '../src/core/mockFirmware';

describe('Commander runtime with mock firmware', () => {
  let runtime: CommanderRuntime | null = null;

  afterEach(async () => {
    vi.useRealTimers();
    if (runtime) await runtime.dispose();
    runtime = null;
  });

  it('starts in simulation and verifies identity without enabling', async () => {
    const mock = new MockFirmwareTransport();
    runtime = new CommanderRuntime(mock);
    runtime.start();
    await runtime.discoverPorts();
    await runtime.connect('MOCK:ROBARM');
    await vi.waitFor(() => expect(runtime!.getSnapshot().connectionPhase).toBe('compatible'));
    expect(runtime.getSnapshot().target).toBe('simulation');
    expect(runtime.getSnapshot().status?.state).toBe(FIRMWARE_STATES.COMMISSIONING_LOCKED);
    expect(runtime.getSnapshot().status?.calibration_complete).toBe(false);
  });

  it('requires explicit real selection and enable before jog', async () => {
    const mock = new MockFirmwareTransport();
    runtime = new CommanderRuntime(mock);
    runtime.start();
    await runtime.connect('MOCK:ROBARM');
    await vi.waitFor(() => expect(runtime!.getSnapshot().connectionPhase).toBe('compatible'));
    expect(await runtime.selectTarget('real')).toBe(true);
    expect(runtime.startJog(0, 1, 0.2)).toBe(false);
    expect(await runtime.enableReal()).toBe(false);
    expect(await runtime.runStartupCalibration()).toBe(true);
    expect(runtime.getSnapshot().status?.state).toBe(FIRMWARE_STATES.CALIBRATION_HOLD);
    expect(await runtime.enableReal()).toBe(true);
    await vi.waitFor(() => expect(runtime!.getSnapshot().telemetry?.state).toBe(FIRMWARE_STATES.ENABLED));
    expect(runtime.startJog(0, 1, 0.2)).toBe(true);
    runtime.stopMotion();
    expect(runtime.getSnapshot().deadmanActive).toBe(false);
  });

  it('blocks motion and faults when mock E-stop power is lost', async () => {
    const mock = new MockFirmwareTransport();
    runtime = new CommanderRuntime(mock);
    runtime.start();
    await runtime.connect('MOCK:ROBARM');
    await vi.waitFor(() => expect(runtime!.getSnapshot().connectionPhase).toBe('compatible'));
    await runtime.selectTarget('real');
    expect(await runtime.runStartupCalibration()).toBe(true);
    await runtime.enableReal();
    await vi.waitFor(() => expect(runtime!.getSnapshot().telemetry?.state).toBe(FIRMWARE_STATES.ENABLED));
    mock.setEstopSafe(false);
    await runtime.sendReadOnlyCommand('STATUS');
    await vi.waitFor(() => expect(runtime!.getSnapshot().status?.estop_safe).toBe(false));
    expect(runtime.startJog(0, 1, 0.2)).toBe(false);
    expect(runtime.getSnapshot().logs.at(-1)?.details).toContain('E-stop');
  });

  it('ramps simulation jog velocity instead of stepping immediately to target speed', async () => {
    vi.useFakeTimers();
    runtime = new CommanderRuntime(new MockFirmwareTransport());
    runtime.start();
    runtime.setSimulationEnabled(true);
    runtime.setJogAccelerationScale(0.5);
    expect(runtime.startJog(0, 1, 1)).toBe(true);
    await vi.advanceTimersByTimeAsync(40);
    const initialVelocity = runtime.getSnapshot().simulation.velocities[0];
    await vi.advanceTimersByTimeAsync(400);
    const rampedVelocity = runtime.getSnapshot().simulation.velocities[0];
    expect(initialVelocity).toBeGreaterThan(0);
    expect(rampedVelocity).toBeGreaterThan(initialVelocity);
    expect(rampedVelocity).toBeLessThan(JOINTS[0].maxSpeedStepsPerSecond);
  });

  it('ramps and stops a synchronized multi-joint simulation jog as one lease', async () => {
    vi.useFakeTimers();
    runtime = new CommanderRuntime(new MockFirmwareTransport());
    runtime.start();
    runtime.setSimulationEnabled(true);
    runtime.setJogAccelerationScale(0.5);

    expect(runtime.startJogVector([0.4, -0.3, 0, 0.2, 0, 0], 'controller')).toBe(true);
    await vi.advanceTimersByTimeAsync(80);
    const moving = runtime.getSnapshot().simulation.velocities;
    expect(moving[0]).toBeGreaterThan(0);
    expect(moving[1]).toBeLessThan(0);
    expect(moving[2]).toBe(0);
    expect(moving[3]).toBeGreaterThan(0);

    runtime.stopMotion('Controller dead-man released');
    expect(runtime.getSnapshot().simulation.velocities).toEqual([0, 0, 0, 0, 0, 0]);
    expect(runtime.getSnapshot().deadmanActive).toBe(false);
  });

  it('sends simultaneous real-joint velocities in one firmware-supported jog vector', async () => {
    const mock = new MockFirmwareTransport();
    runtime = new CommanderRuntime(mock);
    runtime.start();
    await runtime.connect('MOCK:ROBARM');
    await vi.waitFor(() => expect(runtime!.getSnapshot().connectionPhase).toBe('compatible'));
    await runtime.selectTarget('real');
    expect(await runtime.runStartupCalibration()).toBe(true);
    expect(await runtime.enableReal()).toBe(true);
    await vi.waitFor(() => expect(runtime!.getSnapshot().telemetry?.state).toBe(FIRMWARE_STATES.ENABLED));

    expect(runtime.startJogVector([0.2, -0.15, 0, 0.1, 0, 0], 'controller')).toBe(true);
    await vi.waitFor(() => {
      const velocity = runtime!.getSnapshot().telemetry?.velocity ?? [];
      expect(velocity[0]).toBeGreaterThan(0);
      expect(velocity[1]).toBeLessThan(0);
      expect(velocity[3]).toBeGreaterThan(0);
    });
    runtime.stopMotion('Controller dead-man released');
    await vi.waitFor(() => expect(runtime!.getSnapshot().telemetry?.velocity).toEqual([0, 0, 0, 0, 0, 0]));
  });

  it('sends Disable to an open real transport even while Simulation is selected', async () => {
    runtime = new CommanderRuntime(new MockFirmwareTransport());
    runtime.start();
    await runtime.connect('MOCK:ROBARM');
    await vi.waitFor(() => expect(runtime!.getSnapshot().connectionPhase).toBe('compatible'));
    expect(runtime.getSnapshot().target).toBe('simulation');
    await runtime.disable('Global software stop');
    expect(runtime.getSnapshot().stats.lastCommand).toBe('Disable');
    expect(runtime.getSnapshot().simulation.enabled).toBe(false);
  });

  it('previews startup calibration only in simulation memory', async () => {
    runtime = new CommanderRuntime(new MockFirmwareTransport());
    runtime.start();
    runtime.setSimulationEnabled(true);
    expect(await runtime.runStartupCalibration()).toBe(true);
    expect(runtime.getSnapshot().simulation.positions.slice(1, 4)).toEqual([32_000, 0, 0]);
    expect(runtime.getSnapshot().target).toBe('simulation');
  });

  it('controls physical FAN0 auto, off, and full modes independently of motor enable', async () => {
    runtime = new CommanderRuntime(new MockFirmwareTransport());
    runtime.start();
    await runtime.connect('MOCK:ROBARM');
    await vi.waitFor(() => expect(runtime!.getSnapshot().connectionPhase).toBe('compatible'));
    await runtime.selectTarget('real');
    expect(runtime.getSnapshot().status?.fan_on).toBe(true);
    expect(runtime.getSnapshot().status?.fan_mode).toBe('auto');
    expect(runtime.getSnapshot().status?.fan_speed_percent).toBe(70);
    expect(await runtime.setControllerFan('off')).toBe(true);
    await vi.waitFor(() => expect(runtime!.getSnapshot().status?.fan_on).toBe(false));
    expect(await runtime.setControllerFan('full')).toBe(true);
    await vi.waitFor(() => expect(runtime!.getSnapshot().status?.fan_on).toBe(true));
    expect(runtime.getSnapshot().status?.fan_speed_percent).toBe(100);
    expect(await runtime.setControllerFan('auto')).toBe(true);
    await vi.waitFor(() => expect(runtime!.getSnapshot().status?.fan_mode).toBe('auto'));
  });
});
