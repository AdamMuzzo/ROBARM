import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Box,
  Boxes,
  ChevronLeft,
  ChevronRight,
  CircuitBoard,
  CircleDot,
  Crosshair,
  Gauge,
  Home,
  Move3D,
  Pause,
  Play,
  Rotate3D,
  SlidersHorizontal,
  Target,
  Wrench
} from 'lucide-react';
import { RobotViewport } from './RobotViewport';
import { PartViewport } from './PartViewport';
import { armDimensions, homePose, jointLimits, jointOrder, partCatalog, scriptedPoses } from './robotData';
import { clamp, clampJoint, formatMeters, getEndEffectorPose, interpolatePose, solvePlanarTarget } from './kinematics';
import type { JointKey, JointState, PartId, TabId } from './types';

const poseDurationMs = 1800;

function numberInputValue(value: number) {
  return Number.isFinite(value) ? Number(value.toFixed(3)) : 0;
}

function jointValueLabel(key: JointKey, value: number) {
  if (key === 'gripper') return `${Math.round(value)}%`;
  return `${Math.round(value)} deg`;
}

export function App() {
  const [tab, setTab] = useState<TabId>('simulation');
  const [joints, setJoints] = useState<JointState>(homePose);
  const [selectedPartId, setSelectedPartId] = useState<PartId>('upperArm');
  const [showEnvelope, setShowEnvelope] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activePoseIndex, setActivePoseIndex] = useState(0);
  const [target, setTarget] = useState({ x: 0.7, y: 0.42, z: 0 });
  const animationRef = useRef({
    startPose: homePose,
    endPose: scriptedPoses[1].joints,
    startTime: 0,
    poseIndex: 0
  });

  const pose = useMemo(() => getEndEffectorPose(joints), [joints]);
  const selectedPart = partCatalog.find((part) => part.id === selectedPartId) ?? partCatalog[0];
  const mechanicalParts = partCatalog.filter((part) => part.category === 'mechanical');
  const electronicParts = partCatalog.filter((part) => part.category === 'electronics');

  useEffect(() => {
    if (!isPlaying) return;

    let frame = 0;
    animationRef.current = {
      startPose: joints,
      endPose: scriptedPoses[(activePoseIndex + 1) % scriptedPoses.length].joints,
      startTime: performance.now(),
      poseIndex: activePoseIndex
    };

    const tick = (now: number) => {
      const current = animationRef.current;
      const progress = (now - current.startTime) / poseDurationMs;
      if (progress >= 1) {
        const nextIndex = (current.poseIndex + 1) % scriptedPoses.length;
        const nextTargetIndex = (nextIndex + 1) % scriptedPoses.length;
        setActivePoseIndex(nextIndex);
        animationRef.current = {
          startPose: scriptedPoses[nextIndex].joints,
          endPose: scriptedPoses[nextTargetIndex].joints,
          startTime: now,
          poseIndex: nextIndex
        };
        setJoints(scriptedPoses[nextIndex].joints);
      } else {
        setJoints(interpolatePose(current.startPose, current.endPose, progress));
      }
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [activePoseIndex, isPlaying, joints]);

  const updateJoint = (key: JointKey, value: number) => {
    setIsPlaying(false);
    setJoints((current) => ({ ...current, [key]: clampJoint(key, value) }));
  };

  const applyTarget = () => {
    setIsPlaying(false);
    setJoints((current) => solvePlanarTarget(target, current));
  };

  const applyPose = (index: number) => {
    setIsPlaying(false);
    setActivePoseIndex(index);
    setJoints(scriptedPoses[index].joints);
  };

  const nudgeTarget = (axis: 'x' | 'y' | 'z', delta: number) => {
    setTarget((current) => ({
      ...current,
      [axis]: clamp(current[axis] + delta, axis === 'y' ? 0.05 : -1.15, axis === 'y' ? 1.35 : 1.15)
    }));
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">ROBARM robotics lab</p>
          <h1>ROBARM Simulator</h1>
        </div>

        <nav className="tab-switcher" aria-label="Program sections">
          <button className={tab === 'simulation' ? 'active' : ''} onClick={() => setTab('simulation')}>
            <Move3D size={18} />
            Simulation
          </button>
          <button className={tab === 'parts' ? 'active' : ''} onClick={() => setTab('parts')}>
            <Boxes size={18} />
            Parts
          </button>
        </nav>
      </header>

      {tab === 'simulation' ? (
        <section className="workspace simulation-grid">
          <aside className="panel control-panel">
            <div className="panel-heading">
              <SlidersHorizontal size={18} />
              <h2>Joint Controls</h2>
            </div>

            <div className="quick-actions">
              <button onClick={() => setIsPlaying((value) => !value)}>
                {isPlaying ? <Pause size={17} /> : <Play size={17} />}
                {isPlaying ? 'Pause path' : 'Play path'}
              </button>
              <button onClick={() => applyPose(0)}>
                <Home size={17} />
                Home
              </button>
            </div>

            <div className="slider-stack">
              {jointOrder.map((key) => {
                const limit = jointLimits[key];
                return (
                  <label className="joint-slider" key={key}>
                    <span>
                      <strong>{limit.label}</strong>
                      <em>{jointValueLabel(key, joints[key])}</em>
                    </span>
                    <input
                      type="range"
                      min={limit.min}
                      max={limit.max}
                      step={key === 'gripper' ? 1 : 0.5}
                      value={joints[key]}
                      onChange={(event) => updateJoint(key, Number(event.target.value))}
                    />
                  </label>
                );
              })}
            </div>

            <div className="panel-heading compact">
              <Target size={18} />
              <h2>Tool Target</h2>
            </div>
            <div className="target-grid">
              {(['x', 'y', 'z'] as const).map((axis) => (
                <label key={axis}>
                  <span>{axis.toUpperCase()}</span>
                  <input
                    type="number"
                    step="0.01"
                    value={numberInputValue(target[axis])}
                    onChange={(event) =>
                      setTarget((current) => ({ ...current, [axis]: Number(event.target.value) }))
                    }
                  />
                </label>
              ))}
            </div>
            <div className="jog-pad">
              <button onClick={() => nudgeTarget('x', -0.05)} title="Move target -X">
                <ChevronLeft size={16} />
              </button>
              <button onClick={() => nudgeTarget('y', 0.05)} title="Move target +Y">
                <ChevronRight className="rotate-up" size={16} />
              </button>
              <button onClick={() => nudgeTarget('x', 0.05)} title="Move target +X">
                <ChevronRight size={16} />
              </button>
              <button onClick={() => nudgeTarget('z', -0.05)} title="Move target -Z">
                <ChevronLeft className="rotate-down" size={16} />
              </button>
              <button onClick={applyTarget}>
                <Crosshair size={16} />
                Solve
              </button>
              <button onClick={() => nudgeTarget('z', 0.05)} title="Move target +Z">
                <ChevronRight className="rotate-down" size={16} />
              </button>
            </div>
          </aside>

          <section className="main-stage">
            <RobotViewport joints={joints} showEnvelope={showEnvelope} />
            <div className="stage-toolbar">
              <button className={showEnvelope ? 'active' : ''} onClick={() => setShowEnvelope((value) => !value)}>
                <CircleDot size={17} />
                Reach
              </button>
              <button onClick={() => setJoints((current) => ({ ...current, wristRoll: current.wristRoll + 45 }))}>
                <Rotate3D size={17} />
                Roll
              </button>
            </div>
          </section>

          <aside className="panel telemetry-panel">
            <div className="panel-heading">
              <Gauge size={18} />
              <h2>Live Telemetry</h2>
            </div>

            <div className="metric-list">
              <div>
                <span>Tool X</span>
                <strong>{formatMeters(pose.x)}</strong>
              </div>
              <div>
                <span>Tool Y</span>
                <strong>{formatMeters(pose.y)}</strong>
              </div>
              <div>
                <span>Tool Z</span>
                <strong>{formatMeters(pose.z)}</strong>
              </div>
              <div>
                <span>Planar reach</span>
                <strong>{formatMeters(pose.reach)}</strong>
              </div>
            </div>

            <div className="panel-heading compact">
              <Activity size={18} />
              <h2>Motion Presets</h2>
            </div>
            <div className="pose-list">
              {scriptedPoses.map((poseItem, index) => (
                <button
                  key={poseItem.name}
                  className={activePoseIndex === index ? 'active' : ''}
                  onClick={() => applyPose(index)}
                >
                  {poseItem.name}
                </button>
              ))}
            </div>

            <div className="spec-box">
              <h3>Scale Model</h3>
              <dl>
                <div>
                  <dt>Upper arm</dt>
                  <dd>{Math.round(armDimensions.upperArmLength * 1000)} mm</dd>
                </div>
                <div>
                  <dt>Forearm</dt>
                  <dd>{Math.round(armDimensions.forearmLength * 1000)} mm</dd>
                </div>
                <div>
                  <dt>Payload target</dt>
                  <dd>{armDimensions.maxPayloadKg.toFixed(1)} kg</dd>
                </div>
              </dl>
            </div>
          </aside>
        </section>
      ) : (
        <section className="workspace parts-grid">
          <aside className="panel parts-list">
            <div className="panel-heading">
              <Wrench size={18} />
              <h2>Assemblies</h2>
            </div>
            <h3 className="part-group-title">Mechanical</h3>
            {mechanicalParts.map((part) => (
              <button
                key={part.id}
                className={part.id === selectedPartId ? 'part-row active' : 'part-row'}
                onClick={() => setSelectedPartId(part.id)}
              >
                <Box size={18} />
                <span>
                  <strong>{part.name}</strong>
                  <em>{part.dimensions}</em>
                </span>
              </button>
            ))}
            <h3 className="part-group-title">Electronics</h3>
            {electronicParts.map((part) => (
              <button
                key={part.id}
                className={part.id === selectedPartId ? 'part-row active' : 'part-row'}
                onClick={() => setSelectedPartId(part.id)}
              >
                <CircuitBoard size={18} />
                <span>
                  <strong>{part.name}</strong>
                  <em>{part.dimensions}</em>
                </span>
              </button>
            ))}
          </aside>

          <section className="part-stage">
            <PartViewport partId={selectedPartId} />
          </section>

          <aside className="panel part-detail">
            <div className="panel-heading">
              {selectedPart.category === 'electronics' ? <CircuitBoard size={18} /> : <Box size={18} />}
              <h2>{selectedPart.name}</h2>
            </div>
            <span className="part-category">{selectedPart.category}</span>
            <p className="part-summary">{selectedPart.summary}</p>

            <dl className="detail-list">
              <div>
                <dt>Material</dt>
                <dd>{selectedPart.material}</dd>
              </div>
              <div>
                <dt>Dimensions</dt>
                <dd>{selectedPart.dimensions}</dd>
              </div>
              <div>
                <dt>Motion</dt>
                <dd>{selectedPart.motion}</dd>
              </div>
              <div>
                <dt>Build note</dt>
                <dd>{selectedPart.serviceNote}</dd>
              </div>
            </dl>

            {selectedPart.diagram ? (
              <div className="interface-diagram">
                <h3>Interface Diagram</h3>
                {selectedPart.diagram.map((line) => (
                  <span key={line}>{line}</span>
                ))}
              </div>
            ) : null}
          </aside>
        </section>
      )}
    </main>
  );
}
