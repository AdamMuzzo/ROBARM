import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Box,
  Boxes,
  Cable,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircuitBoard,
  CircleDot,
  Download,
  ExternalLink,
  Gauge,
  Home,
  Info,
  ListChecks,
  ListTree,
  LocateFixed,
  MousePointer2,
  Move3D,
  Pause,
  Play,
  Rotate3D,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Tags,
  Wrench,
  X
} from 'lucide-react';
import { PartViewport } from './PartViewport';
import { RobotViewport } from './RobotViewport';
import { WiringPage } from './WiringPage';
import { assemblyBreakdowns, printableComponentCount } from './assemblyData';
import { clampJoint, formatMillimeters, interpolatePose } from './kinematics';
import { homePose, jointLimits, jointOrder, modelFacts, partCatalog, scriptedPoses } from './robotData';
import { assemblyGuideSteps, diagnosticScenarios } from './serviceData';
import type {
  AssemblyPhase,
  CameraPreset,
  CameraRequest,
  ExplodedPieceInfo,
  JointKey,
  JointState,
  PartCategory,
  PartId,
  RobotCollisionReport,
  TabId,
  ToolPose,
  ViewMode
} from './types';

const poseDurationMs = 2400;

function axisValue(value: number) {
  const rounded = Math.abs(value) < 0.05 ? 0 : value;
  return `${rounded.toFixed(1)}°`;
}

function initialTab(): TabId {
  const requested = new URLSearchParams(window.location.search).get('tab');
  return requested === 'parts' || requested === 'wiring' ? requested : 'simulation';
}

export function App() {
  const [tab, setTab] = useState<TabId>(initialTab);
  const [joints, setJoints] = useState<JointState>(homePose);
  const [selectedPartId, setSelectedPartId] = useState<PartId>('link2');
  const [partCategory, setPartCategory] = useState<PartCategory>('mechanical');
  const [partSearch, setPartSearch] = useState('');
  const [partExplodedProgress, setPartExplodedProgress] = useState(0);
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [showEnvelope, setShowEnvelope] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('solid');
  const [isPlaying, setIsPlaying] = useState(false);
  const [assemblyTarget, setAssemblyTarget] = useState<'assembled' | 'disassembled'>('assembled');
  const [assemblyPhase, setAssemblyPhase] = useState<AssemblyPhase>('assembled');
  const [hoveredExplodedPiece, setHoveredExplodedPiece] = useState<ExplodedPieceInfo | null>(null);
  const [inspectedExplodedPiece, setInspectedExplodedPiece] = useState<ExplodedPieceInfo | null>(null);
  const [explodedCatalog, setExplodedCatalog] = useState<ExplodedPieceInfo[]>([]);
  const [serviceSearch, setServiceSearch] = useState('');
  const [serviceCategory, setServiceCategory] = useState<'all' | ExplodedPieceInfo['category']>('all');
  const [serviceMode, setServiceMode] = useState<'overview' | 'guide' | 'diagnostics'>('overview');
  const [guideStepIndex, setGuideStepIndex] = useState(0);
  const [diagnosticId, setDiagnosticId] = useState(diagnosticScenarios[0].id);
  const [diagnosticLocate, setDiagnosticLocate] = useState(false);
  const [showExplodedLabels, setShowExplodedLabels] = useState(true);
  const [showCableRoutes, setShowCableRoutes] = useState(false);
  const [cameraRequest, setCameraRequest] = useState<CameraRequest>({ id: 0, preset: 'isometric' });
  const [collisionReport, setCollisionReport] = useState<RobotCollisionReport>({ collisions: [], minimumFloorClearanceMm: 999 });
  const [activePoseIndex, setActivePoseIndex] = useState(0);
  const [toolPose, setToolPose] = useState<ToolPose>({ x: 0, y: 0, z: 0, reach: 0 });
  const jointsRef = useRef(joints);
  jointsRef.current = joints;

  const selectedPart = useMemo(
    () => partCatalog.find((part) => part.id === selectedPartId) ?? partCatalog[0],
    [selectedPartId]
  );
  const selectedBreakdown = assemblyBreakdowns[selectedPartId as keyof typeof assemblyBreakdowns];
  const selectedComponent = selectedBreakdown?.components.find((component) => component.id === selectedComponentId) ?? null;
  const displayedHardware = selectedBreakdown?.hardware.filter((item) => !selectedComponent || selectedComponent.hardwareIds.includes(item.id)) ?? [];
  const visibleParts = useMemo(
    () => {
      const query = partSearch.trim().toLowerCase();
      return partCatalog.filter((part) => {
        if (part.category !== partCategory) return false;
        const breakdown = assemblyBreakdowns[part.id as keyof typeof assemblyBreakdowns];
        const breakdownTerms = breakdown
          ? [...breakdown.components.flatMap((component) => [component.name, component.sourceFile]), ...breakdown.hardware.flatMap((item) => [item.name, item.specification])]
          : [];
        return !query || [part.name, part.assemblyRole, part.sourceFile, part.summary, ...breakdownTerms].some((value) => value.toLowerCase().includes(query));
      });
    },
    [partCategory, partSearch]
  );
  const activeGuideStep = assemblyGuideSteps[guideStepIndex];
  const activeDiagnostic = diagnosticScenarios.find((scenario) => scenario.id === diagnosticId) ?? diagnosticScenarios[0];
  const matchedServicePieces = useMemo(() => {
    const query = serviceSearch.trim().toLowerCase();
    return explodedCatalog.filter((piece) => {
      const matchesCategory = serviceCategory === 'all' || piece.category === serviceCategory;
      const matchesQuery = !query || [piece.name, piece.section, piece.category, piece.material].some((value) => value.toLowerCase().includes(query));
      return matchesCategory && matchesQuery;
    });
  }, [explodedCatalog, serviceCategory, serviceSearch]);
  const focusedPieceIds = useMemo(() => {
    if (serviceSearch.trim() || serviceCategory !== 'all') return matchedServicePieces.map((piece) => piece.id);
    if (serviceMode === 'guide') return explodedCatalog.filter((piece) => piece.section === activeGuideStep.section).map((piece) => piece.id);
    if (serviceMode === 'diagnostics' && diagnosticLocate) {
      return explodedCatalog.filter((piece) => {
        const inSection = activeDiagnostic.sections.includes(piece.section);
        const inCategory = !activeDiagnostic.categories?.length || activeDiagnostic.categories.includes(piece.category);
        return inSection && inCategory;
      }).map((piece) => piece.id);
    }
    return null;
  }, [activeDiagnostic, activeGuideStep, diagnosticLocate, explodedCatalog, matchedServicePieces, serviceCategory, serviceMode, serviceSearch]);
  const nearLimitJoints = useMemo(
    () => jointOrder.filter((key) => Math.min(joints[key] - jointLimits[key].min, jointLimits[key].max - joints[key]) <= 8),
    [joints]
  );
  const motionSafety = collisionReport.collisions.length || collisionReport.minimumFloorClearanceMm < -3
    ? 'collision'
    : nearLimitJoints.length || collisionReport.minimumFloorClearanceMm < 15
      ? 'caution'
      : 'clear';

  useEffect(() => {
    if (!isPlaying) return;

    let frame = 0;
    let poseIndex = activePoseIndex;
    let startedAt = performance.now();
    let from = jointsRef.current;
    let to = scriptedPoses[(poseIndex + 1) % scriptedPoses.length].joints;

    const tick = (now: number) => {
      const progress = (now - startedAt) / poseDurationMs;
      if (progress >= 1) {
        poseIndex = (poseIndex + 1) % scriptedPoses.length;
        setActivePoseIndex(poseIndex);
        from = scriptedPoses[poseIndex].joints;
        to = scriptedPoses[(poseIndex + 1) % scriptedPoses.length].joints;
        startedAt = now;
        setJoints(from);
      } else {
        setJoints(interpolatePose(from, to, progress));
      }
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [activePoseIndex, isPlaying]);

  const handleToolPose = useCallback((pose: ToolPose) => {
    setToolPose((current) => {
      const unchanged =
        Math.abs(current.x - pose.x) < 0.0001 &&
        Math.abs(current.y - pose.y) < 0.0001 &&
        Math.abs(current.z - pose.z) < 0.0001;
      return unchanged ? current : pose;
    });
  }, []);

  const handleAssemblyPhaseChange = useCallback((phase: AssemblyPhase) => {
    setAssemblyPhase(phase);
    if (phase !== 'disassembled') setHoveredExplodedPiece(null);
  }, []);

  const handleExplodedPieceHover = useCallback((piece: ExplodedPieceInfo | null) => {
    setHoveredExplodedPiece(piece);
  }, []);

  const handleExplodedPieceSelect = useCallback((piece: ExplodedPieceInfo | null) => {
    setInspectedExplodedPiece(piece);
  }, []);

  const handleExplodedCatalogReady = useCallback((pieces: ExplodedPieceInfo[]) => {
    setExplodedCatalog((current) => current.length === pieces.length ? current : pieces);
  }, []);

  const handleCollisionReport = useCallback((report: RobotCollisionReport) => {
    setCollisionReport((current) => {
      const sameCollisions = current.collisions.join('|') === report.collisions.join('|');
      const sameClearance = Math.abs(current.minimumFloorClearanceMm - report.minimumFloorClearanceMm) < 0.5;
      return sameCollisions && sameClearance ? current : report;
    });
  }, []);

  const toggleAssembly = () => {
    if (assemblyPhase === 'disassembling' || assemblyPhase === 'reassembling') return;
    setIsPlaying(false);
    setShowEnvelope(false);
    setViewMode('solid');
    if (assemblyPhase === 'assembled') {
      setInspectedExplodedPiece(null);
      setJoints(homePose);
      setActivePoseIndex(0);
      setAssemblyTarget('disassembled');
    } else {
      setHoveredExplodedPiece(null);
      setInspectedExplodedPiece(null);
      setAssemblyTarget('assembled');
    }
  };

  const prepareServiceLayout = () => {
    setIsPlaying(false);
    setShowEnvelope(false);
    setViewMode('solid');
    setJoints(homePose);
    setActivePoseIndex(0);
    setAssemblyTarget('disassembled');
  };

  const startAssemblyGuide = () => {
    setServiceMode('guide');
    setGuideStepIndex(0);
    setDiagnosticLocate(false);
    setServiceSearch('');
    setServiceCategory('all');
    setInspectedExplodedPiece(null);
    prepareServiceLayout();
  };

  const locateDiagnosticParts = () => {
    setServiceMode('diagnostics');
    setDiagnosticLocate(true);
    setServiceSearch('');
    setServiceCategory('all');
    setInspectedExplodedPiece(null);
    prepareServiceLayout();
  };

  const finishGuide = () => {
    setServiceMode('overview');
    setGuideStepIndex(0);
    setInspectedExplodedPiece(null);
    setAssemblyTarget('assembled');
  };

  const requestCamera = (preset: CameraPreset) => {
    setCameraRequest((current) => ({ id: current.id + 1, preset }));
  };

  const exportBom = () => {
    const quote = (value: string | number | undefined) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const assemblyRows = Object.values(assemblyBreakdowns).flatMap((assembly) => [
      ...assembly.components.map((component) => ['Printed STL', assembly.label, component.name, component.description, 1, component.sourceFile, `Manual pages ${component.manualPages}`]),
      ...assembly.hardware.map((item) => ['Hardware', assembly.label, item.name, item.specification, item.quantity, '', item.note ?? ''])
    ]);
    const rows = [
      ['Type', 'Assembly', 'Part', 'Role / specification', 'Quantity', 'Source file', 'Reference note'],
      ...partCatalog.map((part) => ['Catalog assembly', part.assemblyRole, part.name, part.summary, part.quantity, part.sourceFile, part.priceCad ?? '']),
      ...assemblyRows
    ];
    const csv = rows.map((row) => row.map(quote).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'ROBARM-PAROL6-BOM.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const assemblyBusy = assemblyPhase === 'disassembling' || assemblyPhase === 'reassembling';
  const motionLocked = assemblyPhase !== 'assembled';
  const assemblyStatusLabel = assemblyPhase === 'assembled'
    ? 'Assembled'
    : assemblyPhase === 'disassembled'
      ? 'Service layout'
      : assemblyPhase === 'disassembling'
        ? 'Disassembling'
        : 'Reassembling';

  const updateJoint = (key: JointKey, value: number) => {
    setIsPlaying(false);
    setJoints((current) => ({ ...current, [key]: clampJoint(key, value) }));
  };

  const applyPose = (index: number) => {
    setIsPlaying(false);
    setActivePoseIndex(index);
    setJoints(scriptedPoses[index].joints);
  };

  const selectPartCategory = (category: PartCategory) => {
    setPartCategory(category);
    setPartSearch('');
    const firstPart = partCatalog.find((part) => part.category === category);
    if (firstPart) {
      setSelectedPartId(firstPart.id);
      setPartExplodedProgress(0);
      setSelectedComponentId(null);
    }
  };

  const selectCatalogPart = (partId: PartId) => {
    setSelectedPartId(partId);
    setPartExplodedProgress(0);
    setSelectedComponentId(null);
  };

  const modelProvenance = selectedPart.modelType === 'glb'
    ? 'Manufacturer CAD'
    : selectedPart.modelType === 'stl'
      ? 'Official assembly mesh'
      : 'Dimensioned component model';

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">R6</span>
          <div>
            <p>ROBARM workspace</p>
            <h1>PAROL6 Simulator</h1>
          </div>
        </div>

        <nav className="tab-switcher" aria-label="Program sections">
          <button className={tab === 'simulation' ? 'active' : ''} onClick={() => setTab('simulation')}>
            <Move3D size={17} />
            Simulator
          </button>
          <button className={tab === 'parts' ? 'active' : ''} onClick={() => setTab('parts')}>
            <Boxes size={17} />
            Parts
          </button>
          <button className={tab === 'wiring' ? 'active' : ''} onClick={() => setTab('wiring')}>
            <Cable size={17} />
            Wiring
          </button>
        </nav>

        <div className="source-status">
          <CircleDot size={15} />
          <span>{tab === 'simulation' ? 'Official URDF geometry' : tab === 'parts' ? 'Mechanical + electronics BOM' : 'Octopus Pro electrical dossier'}</span>
        </div>
      </header>

      {tab === 'simulation' ? (
        <section className="workspace simulation-grid">
          <aside className="tool-panel control-panel">
            <div className="panel-heading">
              <div>
                <span>Motion</span>
                <h2>Joint control</h2>
              </div>
              <SlidersHorizontal size={19} />
            </div>

            <div className="quick-actions">
              <button className="primary-action" onClick={() => setIsPlaying((value) => !value)} disabled={motionLocked}>
                {isPlaying ? <Pause size={17} /> : <Play size={17} />}
                {isPlaying ? 'Pause' : 'Run sequence'}
              </button>
              <button onClick={() => applyPose(0)} disabled={motionLocked}>
                <Home size={17} />
                Home
              </button>
              <button className="assembly-action" onClick={toggleAssembly} disabled={assemblyBusy}>
                {assemblyPhase === 'disassembled' || assemblyPhase === 'reassembling' ? <Wrench size={17} /> : <Boxes size={17} />}
                {assemblyPhase === 'assembled'
                  ? 'Disassemble'
                  : assemblyPhase === 'disassembled'
                    ? 'Reassemble'
                    : assemblyPhase === 'disassembling'
                      ? 'Disassembling...'
                      : 'Reassembling...'}
              </button>
              <button className="guided-action" onClick={startAssemblyGuide} disabled={assemblyBusy}>
                <ListChecks size={17} />
                Guided assembly
              </button>
            </div>

            <div className="joint-stack">
              {jointOrder.map((key, index) => {
                const limit = jointLimits[key];
                const startsGroup = index === 0 || jointLimits[jointOrder[index - 1]].group !== limit.group;
                return (
                  <div className={nearLimitJoints.includes(key) ? 'joint-control is-near-limit' : 'joint-control'} key={key}>
                    {startsGroup ? <h3>{limit.group}</h3> : null}
                    <label htmlFor={`joint-${key}`}>
                      <span>
                        <b>{limit.shortLabel}</b>
                        {limit.label}
                        {nearLimitJoints.includes(key) ? <em>Near limit</em> : null}
                      </span>
                      <output htmlFor={`joint-${key}`}>{axisValue(joints[key])}</output>
                    </label>
                    <input
                      id={`joint-${key}`}
                      type="range"
                      min={limit.min}
                      max={limit.max}
                      step="0.5"
                      value={joints[key]}
                      disabled={motionLocked}
                      onChange={(event) => updateJoint(key, Number(event.target.value))}
                    />
                    <div className="range-limits" aria-hidden="true">
                      <span>{limit.min}°</span>
                      <span>{limit.max}°</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>

          <section className="main-stage" aria-label="PAROL6 three-dimensional simulator">
            <RobotViewport
              joints={joints}
              showEnvelope={showEnvelope}
              viewMode={viewMode}
              assemblyTarget={assemblyTarget}
              inspectedPieceId={inspectedExplodedPiece?.id ?? null}
              focusedPieceIds={focusedPieceIds}
              showExplodedLabels={showExplodedLabels}
              showCableRoutes={showCableRoutes}
              cameraRequest={cameraRequest}
              onToolPose={handleToolPose}
              onCollisionReport={handleCollisionReport}
              onExplodedCatalogReady={handleExplodedCatalogReady}
              onAssemblyPhaseChange={handleAssemblyPhaseChange}
              onExplodedPieceHover={handleExplodedPieceHover}
              onExplodedPieceSelect={handleExplodedPieceSelect}
            />
            <div className="stage-label">
              <strong>{assemblyPhase === 'assembled' ? 'PAROL6' : 'PAROL6 service layout'}</strong>
              <span>{assemblyPhase === 'assembled' ? '6-axis kinematic assembly' : '122 separated solids / mechanical + electronics'}</span>
            </div>
            {assemblyPhase !== 'assembled' ? (
              <div className={`assembly-status ${assemblyBusy ? 'is-moving' : ''}`} role="status" aria-live="polite">
                <span className="assembly-status-mark" aria-hidden="true" />
                <span>
                  <strong>{assemblyStatusLabel}</strong>
                  <small>{assemblyPhase === 'disassembled' ? 'Hover a component, then click to pin its service details' : 'Staging Base, J1-J6, drives and controls'}</small>
                </span>
              </div>
            ) : null}
            {assemblyPhase === 'disassembled' ? (
              <section className="service-finder" aria-label="Exploded component finder">
                <div className="finder-heading">
                  <span><Search size={15} aria-hidden="true" /> Component finder</span>
                  <small>{matchedServicePieces.length} of {explodedCatalog.length}</small>
                </div>
                <label className="search-field">
                  <span className="sr-only">Search exploded components</span>
                  <Search size={15} aria-hidden="true" />
                  <input
                    type="search"
                    value={serviceSearch}
                    onChange={(event) => setServiceSearch(event.target.value)}
                    placeholder="Search motor, pulley, sensor..."
                  />
                </label>
                <label className="category-filter">
                  <span>Filter</span>
                  <select value={serviceCategory} onChange={(event) => setServiceCategory(event.target.value as typeof serviceCategory)}>
                    <option value="all">All component classes</option>
                    <option value="printed structure">Printed structure</option>
                    <option value="drive component">Drive components</option>
                    <option value="bearing and hardware">Bearings + hardware</option>
                    <option value="electronics">Electronics</option>
                    <option value="sensor">Sensors</option>
                    <option value="pneumatics">Pneumatics</option>
                    <option value="controls">Controls</option>
                  </select>
                </label>
                {(serviceSearch.trim() || serviceCategory !== 'all') ? (
                  <div className="finder-results">
                    {matchedServicePieces.slice(0, 4).map((piece) => (
                      <button key={piece.id} onClick={() => setInspectedExplodedPiece(piece)}>
                        <span>{piece.name}</span>
                        <small>{piece.section}</small>
                      </button>
                    ))}
                    {matchedServicePieces.length === 0 ? (
                      <div className="finder-empty"><span>No components found.</span><button onClick={() => { setServiceSearch(''); setServiceCategory('all'); }}>Clear filters</button></div>
                    ) : null}
                  </div>
                ) : null}
              </section>
            ) : null}
            {assemblyPhase === 'disassembled' && hoveredExplodedPiece ? (
              <div className="part-hover-prompt" aria-live="polite">
                <MousePointer2 size={15} aria-hidden="true" />
                <span>
                  <strong>{hoveredExplodedPiece.name}</strong>
                  <small>Click to inspect</small>
                </span>
              </div>
            ) : null}
            {assemblyPhase === 'disassembled' && inspectedExplodedPiece ? (
              <article
                className="exploded-part-inspector"
                aria-label={`Inspecting ${inspectedExplodedPiece.name}`}
                data-selected-piece={inspectedExplodedPiece.id}
              >
                <header>
                  <span className="inspector-icon" aria-hidden="true"><Info size={16} /></span>
                  <span>
                    <small>{inspectedExplodedPiece.section}</small>
                    <h2>{inspectedExplodedPiece.name}</h2>
                  </span>
                  <button
                    type="button"
                    onClick={() => setInspectedExplodedPiece(null)}
                    aria-label="Close part inspection"
                    title="Close inspection"
                  >
                    <X size={16} />
                  </button>
                </header>
                <p>{inspectedExplodedPiece.description}</p>
                <dl>
                  <div><dt>Component class</dt><dd>{inspectedExplodedPiece.category}</dd></div>
                  <div><dt>Typical material</dt><dd>{inspectedExplodedPiece.material}</dd></div>
                  <div><dt>Model source</dt><dd>{inspectedExplodedPiece.source}</dd></div>
                </dl>
              </article>
            ) : null}
            <div className="stage-toolbar" aria-label="Viewport display">
              <button
                className={viewMode === 'solid' ? 'active' : ''}
                onClick={() => setViewMode('solid')}
                aria-label="Show solid model"
                title="Solid model"
              >
                <Box size={17} />
              </button>
              <button
                className={viewMode === 'xray' ? 'active' : ''}
                onClick={() => setViewMode('xray')}
                aria-label="Show X-ray model"
                title="X-ray model"
              >
                <Rotate3D size={17} />
              </button>
              <button
                className={showEnvelope ? 'active' : ''}
                onClick={() => setShowEnvelope((value) => !value)}
                aria-label="Toggle reach envelope"
                title="Reach envelope"
              >
                <CircleDot size={17} />
              </button>
              <button
                className={showCableRoutes ? 'active' : ''}
                onClick={() => setShowCableRoutes((value) => !value)}
                aria-label="Toggle cable routing overlay"
                title="Cable routing"
              >
                <Cable size={17} />
              </button>
              <button
                className={showExplodedLabels ? 'active' : ''}
                onClick={() => setShowExplodedLabels((value) => !value)}
                disabled={assemblyPhase !== 'disassembled'}
                aria-label="Toggle exploded view labels"
                title="Exploded labels"
              >
                <Tags size={17} />
              </button>
            </div>
          </section>

          <aside className="tool-panel telemetry-panel">
            <div className="panel-heading">
              <div>
                <span>Live model</span>
                <h2>Tool position</h2>
              </div>
              <Gauge size={19} />
            </div>

            <dl className="metric-list">
              <div><dt>X</dt><dd>{formatMillimeters(toolPose.x)}</dd></div>
              <div><dt>Y</dt><dd>{formatMillimeters(toolPose.y)}</dd></div>
              <div><dt>Z</dt><dd>{formatMillimeters(toolPose.z)}</dd></div>
              <div><dt>Radial</dt><dd>{formatMillimeters(toolPose.reach)}</dd></div>
            </dl>

            <section className={`safety-card is-${motionSafety}`} aria-label="Motion safety status" aria-live="polite">
              {motionSafety === 'clear' ? <ShieldCheck size={18} /> : <AlertTriangle size={18} />}
              <span>
                <strong>{motionSafety === 'clear' ? 'Motion envelope clear' : motionSafety === 'caution' ? 'Clearance caution' : 'Potential collision'}</strong>
                <small>
                  {collisionReport.collisions[0]
                    ?? (nearLimitJoints.length ? `${nearLimitJoints.map((key) => jointLimits[key].shortLabel).join(', ')} within 8° of travel limit` : `Moving-link floor clearance ${Math.round(collisionReport.minimumFloorClearanceMm)} mm`)}
                </small>
              </span>
            </section>

            <div className="section-heading compact-heading">
              <span>Viewport</span>
              <h3>Camera presets</h3>
            </div>
            <div className="camera-presets" aria-label="Camera presets">
              {([
                ['isometric', 'ISO'],
                ['front', 'Front'],
                ['side', 'Side'],
                ['top', 'Top'],
                ['tool', 'Tool']
              ] as Array<[CameraPreset, string]>).map(([preset, label]) => (
                <button key={preset} onClick={() => requestCamera(preset)} disabled={assemblyBusy} aria-label={`${label} camera view`}>
                  {preset === 'tool' ? <LocateFixed size={14} /> : <Camera size={14} />}
                  <span>{label}</span>
                </button>
              ))}
            </div>

            <div className="section-heading service-heading">
              <span>Practical tools</span>
              <h3>Service workbench</h3>
            </div>
            <div className="service-mode-switch" aria-label="Service workbench mode">
              <button className={serviceMode === 'guide' ? 'active' : ''} onClick={startAssemblyGuide}>
                <ListChecks size={15} /> Guide
              </button>
              <button className={serviceMode === 'diagnostics' ? 'active' : ''} onClick={() => { setServiceMode('diagnostics'); setDiagnosticLocate(false); }}>
                <AlertTriangle size={15} /> Diagnose
              </button>
            </div>

            {serviceMode === 'guide' ? (
              <section className="service-card guide-card" aria-label="Guided assembly step">
                <header>
                  <span>Step {guideStepIndex + 1} / {assemblyGuideSteps.length}</span>
                  <strong>{activeGuideStep.title}</strong>
                </header>
                <progress value={guideStepIndex + 1} max={assemblyGuideSteps.length}>{guideStepIndex + 1}</progress>
                <p>{activeGuideStep.summary}</p>
                <ul>
                  {activeGuideStep.checks.map((check) => <li key={check}>{check}</li>)}
                </ul>
                <div className="service-tool"><Wrench size={14} /><span>{activeGuideStep.tool}</span></div>
                <footer>
                  <button onClick={() => setGuideStepIndex((value) => Math.max(0, value - 1))} disabled={guideStepIndex === 0} aria-label="Previous assembly step">
                    <ChevronLeft size={15} /> Previous
                  </button>
                  {guideStepIndex === assemblyGuideSteps.length - 1 ? (
                    <button className="service-primary" onClick={finishGuide}><CheckCircle2 size={15} /> Finish</button>
                  ) : (
                    <button className="service-primary" onClick={() => setGuideStepIndex((value) => Math.min(assemblyGuideSteps.length - 1, value + 1))}>
                      Next <ChevronRight size={15} />
                    </button>
                  )}
                </footer>
              </section>
            ) : null}

            {serviceMode === 'diagnostics' ? (
              <section className={`service-card diagnostic-card severity-${activeDiagnostic.severity}`} aria-label="Service diagnosis">
                <label>
                  <span>Observed symptom</span>
                  <select value={diagnosticId} onChange={(event) => { setDiagnosticId(event.target.value); setDiagnosticLocate(false); }}>
                    {diagnosticScenarios.map((scenario) => <option key={scenario.id} value={scenario.id}>{scenario.name}</option>)}
                  </select>
                </label>
                <p>{activeDiagnostic.symptom}</p>
                <ol>
                  {activeDiagnostic.checks.map((check) => <li key={check}>{check}</li>)}
                </ol>
                <button className="service-primary locate-button" onClick={locateDiagnosticParts}>
                  <LocateFixed size={15} /> Locate affected parts
                </button>
              </section>
            ) : null}

            <button className={showCableRoutes ? 'route-toggle active' : 'route-toggle'} onClick={() => setShowCableRoutes((value) => !value)}>
              <Cable size={16} />
              <span><strong>Cable routing overlay</strong><small>Motor phases, sensor line and tool harness</small></span>
              <span aria-hidden="true">{showCableRoutes ? 'ON' : 'OFF'}</span>
            </button>

            <div className="section-heading">
              <span>Motion set</span>
              <h3>Poses</h3>
            </div>
            <div className="pose-list">
              {scriptedPoses.map((pose, index) => (
                <button
                  key={pose.name}
                  className={activePoseIndex === index ? 'active' : ''}
                  onClick={() => applyPose(index)}
                  disabled={motionLocked}
                >
                  {String(index + 1).padStart(2, '0')}
                  <span>{pose.name}</span>
                </button>
              ))}
            </div>

            <div className="section-heading model-heading">
              <span>Geometry</span>
              <h3>Source model</h3>
            </div>
            <dl className="fact-list">
              <div><dt>Meshes</dt><dd>{modelFacts.meshCount}</dd></div>
              <div><dt>Triangles</dt><dd>{modelFacts.triangleCount.toLocaleString()}</dd></div>
              <div><dt>Nominal reach</dt><dd>{modelFacts.nominalReachMm} mm</dd></div>
              <div><dt>Frame</dt><dd>ROS URDF</dd></div>
              <div><dt>Assembly</dt><dd>{assemblyStatusLabel}</dd></div>
              <div><dt>Exploded solids</dt><dd>122</dd></div>
            </dl>
          </aside>
        </section>
      ) : tab === 'parts' ? (
        <section className="workspace parts-grid">
          <aside className="tool-panel parts-list">
            <div className="panel-heading">
              <div>
                <span>Inventory</span>
                <h2>Parts catalog</h2>
              </div>
              <Wrench size={19} />
            </div>
            <div className="part-category-switch" aria-label="Part categories">
              <button
                className={partCategory === 'mechanical' ? 'active' : ''}
                onClick={() => selectPartCategory('mechanical')}
              >
                <Box size={16} />
                Mechanical
              </button>
              <button
                className={partCategory === 'electronics' ? 'active' : ''}
                onClick={() => selectPartCategory('electronics')}
              >
                <CircuitBoard size={16} />
                Electronics
              </button>
            </div>
            <div className="catalog-tools">
              <label className="search-field">
                <span className="sr-only">Search parts catalog</span>
                <Search size={15} aria-hidden="true" />
                <input type="search" value={partSearch} onChange={(event) => setPartSearch(event.target.value)} placeholder="Search the BOM..." />
              </label>
              <button onClick={exportBom} aria-label="Export bill of materials as CSV" title="Export BOM">
                <Download size={16} />
                CSV
              </button>
            </div>
            <div className="catalog-summary">
              <span>{visibleParts.length} items shown</span>
              <span>{partCategory === 'mechanical' ? `${printableComponentCount} print files` : `${visibleParts.reduce((total, part) => total + part.quantity, 0)} units`}</span>
            </div>
            <div className="part-rows">
              {visibleParts.map((part, index) => (
                <button
                  key={part.id}
                  className={part.id === selectedPartId ? 'part-row active' : 'part-row'}
                  onClick={() => selectCatalogPart(part.id)}
                >
                  <span className="part-index">{String(index).padStart(2, '0')}</span>
                  <span>
                    <strong>{part.name}</strong>
                    <small>{part.assemblyRole}</small>
                  </span>
                  <span className="part-row-meta">
                    {part.category === 'electronics' ? <CircuitBoard size={15} /> : <Box size={15} />}
                    <small>{assemblyBreakdowns[part.id as keyof typeof assemblyBreakdowns]?.components.length ?? `x${part.quantity}`} {part.category === 'mechanical' ? 'STL' : ''}</small>
                  </span>
                </button>
              ))}
              {visibleParts.length === 0 ? (
                <div className="catalog-empty">
                  <Search size={20} />
                  <span>No BOM items match this search.</span>
                  <button onClick={() => setPartSearch('')}>Clear search</button>
                </div>
              ) : null}
            </div>
          </aside>

          <section className="part-stage" aria-label={`${selectedPart.name} three-dimensional model`}>
            <PartViewport
              partId={selectedPartId}
              viewMode={viewMode}
              explodedProgress={partExplodedProgress / 100}
              selectedComponentId={selectedComponentId}
            />
            <div className="stage-label">
              <strong>{selectedComponent?.sourceFile ?? selectedPart.sourceFile}</strong>
              <span>{selectedBreakdown ? `${selectedBreakdown.components.length} official print files + ${selectedBreakdown.hardware.length} hardware groups` : modelProvenance}</span>
            </div>
            <div className="stage-toolbar" aria-label="Part display">
              <button
                className={viewMode === 'solid' ? 'active' : ''}
                onClick={() => setViewMode('solid')}
                aria-label="Show solid model"
                title="Solid model"
              >
                <Box size={17} />
              </button>
              <button
                className={viewMode === 'xray' ? 'active' : ''}
                onClick={() => setViewMode('xray')}
                aria-label="Show X-ray model"
                title="X-ray model"
              >
                <Rotate3D size={17} />
              </button>
            </div>
            {selectedBreakdown ? (
              <><div className="part-explode-control">
                <div>
                  <span>Assembly separation</span>
                  <strong>{partExplodedProgress === 0 ? 'Assembled' : partExplodedProgress === 100 ? 'Fully disassembled' : `${partExplodedProgress}% separated`}</strong>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={partExplodedProgress}
                  onChange={(event) => setPartExplodedProgress(Number(event.target.value))}
                  aria-label="Assembly separation"
                />
                <div className="explode-presets">
                  <button className={partExplodedProgress === 0 ? 'active' : ''} onClick={() => setPartExplodedProgress(0)}>Assembled</button>
                  <button className={partExplodedProgress === 100 ? 'active' : ''} onClick={() => setPartExplodedProgress(100)}>Exploded</button>
                </div>
              </div>
              <div className="part-color-key" aria-label="Diagram color key">
                <span><i className="structure" />Structure</span>
                <span><i className="cover" />Covers</span>
                <span><i className="drive" />Drive parts</span>
                <span><i className="fixture" />Fixtures</span>
                <span><i className="hardware" />Hardware</span>
              </div></>
            ) : null}
          </section>

          <aside className="tool-panel part-detail">
            <div className="detail-kicker">{selectedPart.assemblyRole}</div>
            <h2>{selectedPart.name}</h2>
            <p>{selectedPart.summary}</p>

            {selectedBreakdown ? (
              <div className="assembly-breakdown">
                <div className="breakdown-stats" aria-label="Assembly breakdown summary">
                  <span><b>{selectedBreakdown.components.length}</b> print files</span>
                  <span><b>{selectedBreakdown.hardware.length}</b> hardware lines</span>
                  <span><b>{selectedBreakdown.buildOrder}</b> build order</span>
                </div>
                <div className="manual-reference">
                  <ListTree size={17} aria-hidden="true" />
                  <span><b>{selectedBreakdown.manualSection}</b>Manual pages {selectedBreakdown.manualPages}</span>
                </div>
                <p className="assembly-note">{selectedBreakdown.note}</p>

                <section className="component-breakdown" aria-labelledby="printed-components-heading">
                  <div className="breakdown-heading">
                    <div>
                      <span>Exploded structure</span>
                      <h3 id="printed-components-heading">Printed components</h3>
                    </div>
                    {selectedComponent ? <button onClick={() => setSelectedComponentId(null)}>Show all</button> : null}
                  </div>
                  <div className="component-list">
                    {selectedBreakdown.components.map((component) => {
                      const componentHardware = selectedBreakdown.hardware.filter((item) => component.hardwareIds.includes(item.id));
                      const isSelected = component.id === selectedComponentId;
                      return (
                        <button
                          key={component.id}
                          className={isSelected ? 'component-row active' : 'component-row'}
                          onClick={() => {
                            setSelectedComponentId(isSelected ? null : component.id);
                            setPartExplodedProgress(100);
                          }}
                          aria-pressed={isSelected}
                        >
                          <span className="component-step">{String(component.step).padStart(2, '0')}</span>
                          <span className="component-copy">
                            <strong>{component.name}{component.optional ? <em>Optional</em> : null}</strong>
                            <small>{component.sourceFile}</small>
                            <small className="component-hardware-summary">
                              {componentHardware.length ? componentHardware.map((item) => `${item.name} ×${item.quantity}`).join(' · ') : 'No separate hardware specified'}
                            </small>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section className="hardware-breakdown" aria-labelledby="hardware-heading">
                  <div className="breakdown-heading">
                    <div>
                      <span>{selectedComponent ? 'Selected component' : 'Complete subassembly'}</span>
                      <h3 id="hardware-heading">Required hardware</h3>
                    </div>
                    <b>{displayedHardware.reduce((total, item) => total + item.quantity, 0)} pcs</b>
                  </div>
                  <div className="hardware-list">
                    {displayedHardware.map((item) => (
                      <div className="hardware-row" key={item.id}>
                        <CircleDot size={14} aria-hidden="true" />
                        <span><strong>{item.name}</strong><small>{item.specification}</small>{item.note ? <small className="hardware-note">{item.note}</small> : null}</span>
                        <b>×{item.quantity}</b>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            ) : null}

            <dl className="detail-list">
              <div>
                <dt>Source file</dt>
                <dd>{selectedPart.sourceFile}</dd>
              </div>
              <div>
                <dt>Bounding size</dt>
                <dd>{selectedPart.dimensionsMm.join(' × ')} mm</dd>
              </div>
              <div>
                <dt>Quantity</dt>
                <dd>{selectedPart.quantity}</dd>
              </div>
              {selectedPart.massKg !== undefined ? (
                <div>
                  <dt>URDF mass</dt>
                  <dd>{selectedPart.massKg.toFixed(3)} kg</dd>
                </div>
              ) : null}
              {selectedPart.joint ? (
                <div>
                  <dt>Driven axis</dt>
                  <dd>{jointLimits[selectedPart.joint].shortLabel}</dd>
                </div>
              ) : null}
              {selectedPart.priceCad ? (
                <div>
                  <dt>Planning cost</dt>
                  <dd>{selectedPart.priceCad}</dd>
                </div>
              ) : null}
              {selectedPart.specifications?.map((specification) => (
                <div key={specification.label}>
                  <dt>{specification.label}</dt>
                  <dd>{specification.value}</dd>
                </div>
              ))}
            </dl>

            <div className="build-note">
              <span>Build note</span>
              <p>{selectedPart.buildNote}</p>
            </div>

            <a className="source-link" href={selectedComponent?.sourceUrl ?? selectedPart.sourceUrl} target="_blank" rel="noreferrer">
              {selectedComponent ? 'Download selected STL' : 'Open source reference'}
              <ExternalLink size={16} />
            </a>
            {selectedBreakdown ? (
              <a className="source-link secondary-source" href="https://github.com/Source-Robotics/PAROL6-Desktop-robot-arm/blob/main/Building%20instructions/Parol%20building%20instructions.pdf" target="_blank" rel="noreferrer">
                Open assembly manual
                <ExternalLink size={16} />
              </a>
            ) : null}
          </aside>
        </section>
      ) : <WiringPage />}
    </main>
  );
}
