import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Cable,
  CheckCircle2,
  CircuitBoard,
  ExternalLink,
  FileCheck2,
  Gauge,
  PlugZap,
  Printer,
  ShieldAlert,
  Workflow
} from 'lucide-react';
import {
  axisWiring,
  boardSubsystems,
  diagramNavigation,
  harnessGroups,
  wireLegend,
  wiringChecks,
  wiringSources,
  type AxisWiring,
  type BoardSubsystemStatus,
  type WiringDiagramId
} from './wiringData';

type DiagramTone = 'neutral' | 'power' | 'logic' | 'safety' | 'sensor' | 'motor';

function DiagramBlock({
  x,
  y,
  width,
  height,
  title,
  lines = [],
  tone = 'neutral'
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  lines?: string[];
  tone?: DiagramTone;
}) {
  return (
    <g className={`diagram-block tone-${tone}`}>
      <rect x={x} y={y} width={width} height={height} rx="8" />
      <text className="diagram-block-title" x={x + 16} y={y + 25}>{title}</text>
      {lines.map((line, index) => (
        <text className="diagram-block-copy" x={x + 16} y={y + 47 + index * 18} key={line}>{line}</text>
      ))}
    </g>
  );
}

function DiagramDefinitions() {
  return (
    <defs>
      <marker id="wire-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" />
      </marker>
      <pattern id="danger-hatch" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="10" />
      </pattern>
    </defs>
  );
}

function PowerSafetyDiagram() {
  return (
    <svg className="wiring-svg" viewBox="0 0 1200 660" role="img" aria-labelledby="power-diagram-title power-diagram-desc">
      <title id="power-diagram-title">ROBARM power distribution and emergency-stop wiring</title>
      <desc id="power-diagram-desc">AC mains enters a fused switch and Mean Well power supply. Separate protected 24 volt branches feed controller logic and a contactor-isolated motor supply. A normally closed emergency stop drops the contactor coil.</desc>
      <DiagramDefinitions />

      <rect className="danger-zone" x="28" y="62" width="432" height="300" rx="10" />
      <text className="zone-label danger" x="48" y="91">MAINS / QUALIFIED WIRING</text>
      <DiagramBlock x={58} y={122} width={158} height={106} title="J0 / AC inlet" lines={['C14 switched + fused', '3.15 A time-delay', 'L · N · PE']} tone="power" />
      <DiagramBlock x={270} y={112} width={164} height={126} title="PS1 / EDR-120-24" lines={['90-264 VAC input', '24 VDC · 5 A max', 'PE terminal bonded']} tone="power" />
      <path className="wire mains-live" d="M216 150 H270" markerEnd="url(#wire-arrow)" />
      <path className="wire mains-neutral" d="M216 176 H270" markerEnd="url(#wire-arrow)" />
      <text className="wire-label" x="230" y="143">L</text>
      <text className="wire-label" x="230" y="197">N</text>

      <path className="wire earth" d="M132 228 V326 H1035" />
      <path className="wire earth" d="M352 238 V326" />
      <DiagramBlock x={920} y={278} width={174} height={80} title="PE bond point" lines={['PSU + metal enclosure']} tone="safety" />
      <text className="wire-label" x="480" y="317">GN/YE protective-earth conductor — never switched</text>

      <path className="wire dc-positive" d="M434 152 H512 V118 H745" markerEnd="url(#wire-arrow)" />
      <path className="wire dc-return" d="M434 205 H486 V248 H1072" />
      <text className="wire-label" x="470" y="107">24 V+</text>
      <text className="wire-label" x="470" y="242">0 V common</text>

      <DiagramBlock x={540} y={78} width={150} height={82} title="F2 / logic branch" lines={['2 A starting value', 'Size to conductor']} tone="logic" />
      <DiagramBlock x={760} y={70} width={252} height={114} title="BTT Octopus Pro POWER" lines={['VIN: protected 24 V+', 'GND: 0 V return', 'Logic remains alive on E-stop']} tone="logic" />
      <path className="wire dc-positive" d="M690 118 H760" markerEnd="url(#wire-arrow)" />
      <path className="wire dc-return" d="M886 248 V184" markerEnd="url(#wire-arrow)" />

      <DiagramBlock x={520} y={382} width={150} height={86} title="F1 / motor branch" lines={['≤5 A with this PSU', '18 AWG Cu minimum']} tone="power" />
      <DiagramBlock x={722} y={372} width={166} height={106} title="K1 / DC contactor" lines={['NO power contact', '24 VDC coil', 'Aux contact required']} tone="safety" />
      <DiagramBlock x={956} y={365} width={205} height={122} title="MOTOR_POWER" lines={['Feeds M0-M5 VM', 'Driver jumpers LEFT', 'Disconnected by E-stop']} tone="motor" />
      <path className="wire dc-positive" d="M512 118 V425 H520" markerEnd="url(#wire-arrow)" />
      <path className="wire dc-positive switched" d="M670 425 H722 M888 425 H956" markerEnd="url(#wire-arrow)" />
      <path className="wire dc-return" d="M1062 487 V535 H486 V248" />

      <DiagramBlock x={64} y={440} width={192} height={108} title="S0 / E-stop NC" lines={['COM + NC terminals', 'Push opens coil loop', 'Twist-release to reset']} tone="safety" />
      <DiagramBlock x={314} y={474} width={156} height={76} title="K1 coil + diode" lines={['A1 / A2 · 24 VDC', 'Flyback suppression']} tone="safety" />
      <path className="wire safety-loop" d="M512 118 V395 H160 V440" markerEnd="url(#wire-arrow)" />
      <path className="wire safety-loop" d="M256 500 H314" markerEnd="url(#wire-arrow)" />
      <path className="wire safety-loop" d="M470 512 H802 V478" markerEnd="url(#wire-arrow)" />
      <path className="wire dc-return" d="M802 372 V248" />

      <DiagramBlock x={678} y={560} width={232} height={70} title="K1 auxiliary → STOP7 / PG15" lines={['Closed = motor power enabled', 'Open = E-stop / contactor fault']} tone="logic" />
      <path className="wire signal" d="M836 478 V560" markerEnd="url(#wire-arrow)" />
      <text className="diagram-callout" x="42" y="602">DESIGN RULE</text>
      <text className="diagram-callout-copy" x="42" y="624">The E-stop acts in hardware. Firmware observes the contactor state but is not the only means of stopping torque.</text>
    </svg>
  );
}

function MotionDiagram({ selectedAxis }: { selectedAxis: AxisWiring }) {
  return (
    <svg className="wiring-svg" viewBox="0 0 1200 720" role="img" aria-labelledby="motion-diagram-title motion-diagram-desc">
      <title id="motion-diagram-title">Octopus Pro six-axis driver and motor wiring</title>
      <desc id="motion-diagram-desc">TMC5160 drivers in sockets M0 through M5 control robot joints J1 through J6 using shared SPI and separate chip-select pins.</desc>
      <DiagramDefinitions />
      <DiagramBlock x={46} y={62} width={232} height={170} title="SPI1 shared bus" lines={['SCK · PA5', 'MISO · PA6', 'MOSI · PA7', 'Six individual CS lines']} tone="logic" />
      <DiagramBlock x={46} y={282} width={232} height={116} title="Driver preparation" lines={['TMC5160 Pro modules', 'SPI-mode jumpers fitted', 'VM selector → MOTOR_POWER']} tone="motor" />
      <DiagramBlock x={46} y={448} width={232} height={132} title="Motor phase contract" lines={['A1 → black / A+', 'A2 → green / A-', 'B2 → blue / B-', 'B1 → red / B+']} tone="neutral" />

      <rect className="controller-board" x="342" y="48" width="410" height="616" rx="12" />
      <text className="board-kicker" x="368" y="79">OCTOPUS PRO V1.1 / H723</text>
      <text className="board-title" x="368" y="108">Six installed motion channels</text>

      {axisWiring.map((axis, index) => {
        const y = 136 + index * 82;
        const active = axis.joint === selectedAxis.joint;
        return (
          <g className={active ? 'driver-row active' : 'driver-row'} key={axis.joint}>
            <rect x="366" y={y} width="360" height="66" rx="7" />
            <text className="driver-slot" x="384" y={y + 25}>{axis.slot}</text>
            <text className="driver-joint" x="438" y={y + 25}>{axis.joint}</text>
            <text className="driver-pins" x="496" y={y + 24}>STEP {axis.step} · DIR {axis.direction}</text>
            <text className="driver-pins" x="496" y={y + 45}>EN {axis.enable.split(' ')[0]} · CS {axis.chipSelect}</text>
            <circle className="terminal phase-a-plus" cx="668" cy={y + 17} r="5" />
            <circle className="terminal phase-a-minus" cx="684" cy={y + 17} r="5" />
            <circle className="terminal phase-b-minus" cx="700" cy={y + 17} r="5" />
            <circle className="terminal phase-b-plus" cx="716" cy={y + 17} r="5" />
            <path className={active ? 'wire motor-cable active' : 'wire motor-cable'} d={`M726 ${y + 34} H824`} />
          </g>
        );
      })}

      <path className="wire spi-bus" d="M278 145 H318 V620" />
      {axisWiring.map((axis, index) => <path className="wire spi-drop" d={`M318 ${169 + index * 82} H366`} key={axis.joint} />)}

      {axisWiring.map((axis, index) => {
        const y = 136 + index * 82;
        const active = axis.joint === selectedAxis.joint;
        return (
          <g className={active ? 'motor-node active' : 'motor-node'} key={axis.slot}>
            <rect x="824" y={y - 1} width="326" height="68" rx="34" />
            <circle cx="859" cy={y + 33} r="20" />
            <path d={`M847 ${y + 33} h24 M859 ${y + 21} v24`} />
            <text className="motor-node-title" x="892" y={y + 27}>{axis.joint} · {axis.motor}</text>
            <text className="motor-node-copy" x="892" y={y + 48}>Rated {axis.ratedCurrent} · verify phase continuity</text>
          </g>
        );
      })}
      <text className="diagram-footnote" x="342" y="699">Rated motor current is not the initial driver setting. Begin conservatively and validate temperature, torque and TMC5160 RMS-current semantics.</text>
    </svg>
  );
}

function HomingDiagram({ selectedAxis }: { selectedAxis: AxisWiring }) {
  return (
    <svg className="wiring-svg" viewBox="0 0 1200 720" role="img" aria-labelledby="homing-diagram-title homing-diagram-desc">
      <title id="homing-diagram-title">Six-axis homing sensor interface</title>
      <desc id="homing-diagram-desc">Joints one, four and six use 24 volt NPN sensors through isolated signal conditioners. Joints two, three and five use normally closed mechanical switches. Each goes to a dedicated Octopus STOP input.</desc>
      <DiagramDefinitions />
      <text className="column-heading" x="52" y="52">FIELD DEVICE</text>
      <text className="column-heading" x="388" y="52">INTERFACE / CONTACT</text>
      <text className="column-heading" x="780" y="52">OCTOPUS INPUT</text>
      <text className="column-heading" x="1036" y="52">NORMAL STATE</text>

      {axisWiring.map((axis, index) => {
        const y = 74 + index * 96;
        const inductive = axis.homeCircuit.startsWith('24 V');
        const active = axis.joint === selectedAxis.joint;
        return (
          <g className={active ? 'sensor-row active' : 'sensor-row'} key={axis.joint}>
            <rect className="row-backdrop" x="32" y={y} width="1132" height="78" rx="8" />
            <circle className="joint-badge" cx="70" cy={y + 39} r="23" />
            <text className="joint-badge-label" x="70" y={y + 44}>{axis.joint}</text>
            <text className="sensor-title" x="108" y={y + 30}>{axis.homeDevice}</text>
            <text className="sensor-copy" x="108" y={y + 53}>{inductive ? 'Brown +24 V · Blue 0 V · Black OUT' : 'Use COM + NC · two conductors'}</text>
            <path className={inductive ? 'wire sensor-24' : 'wire signal'} d={`M334 ${y + 39} H386`} markerEnd="url(#wire-arrow)" />
            <rect className={inductive ? 'interface-box isolated' : 'interface-box switch'} x="388" y={y + 12} width="286" height="54" rx="6" />
            <text className="interface-title" x="406" y={y + 34}>{inductive ? '24 V → isolated logic conditioner' : 'NC loop to signal + GND'}</text>
            <text className="interface-copy" x="406" y={y + 54}>{inductive ? 'Output: dry/open-collector logic only' : 'Firmware pull-up · broken wire reports open'}</text>
            <path className="wire signal" d={`M674 ${y + 39} H770`} markerEnd="url(#wire-arrow)" />
            <rect className="stop-box" x="780" y={y + 12} width="208" height="54" rx="6" />
            <text className="stop-title" x="798" y={y + 34}>{axis.stop} · {axis.stopPin}</text>
            <text className="stop-copy" x="798" y={y + 54}>SIG + GND · 5 V pin unused</text>
            <text className="state-label" x="1041" y={y + 32}>{inductive ? 'NOT HOMED' : 'CLOSED / healthy'}</text>
            <text className="state-copy" x="1041" y={y + 54}>{inductive ? 'Conditioner inactive' : 'Input held low'}</text>
          </g>
        );
      })}
      <rect className="diagram-warning-box" x="32" y="666" width="1132" height="38" rx="5" />
      <text className="diagram-warning-text" x="52" y="691">Do not connect a 24 V sensor output directly to STOP0-STOP5. The ordinary STOP headers are MCU inputs, not protected 24 V field inputs.</text>
    </svg>
  );
}

function HarnessDiagram() {
  return (
    <svg className="wiring-svg harness-svg" viewBox="0 0 1200 720" role="img" aria-labelledby="harness-diagram-title harness-diagram-desc">
      <title id="harness-diagram-title">PAROL6 internal harness route adapted for ROBARM</title>
      <desc id="harness-diagram-desc">Two cable groups travel from the wrist through the six joints and leave through two holes in the base. Joint motor and homing leads are allocated to the two exits according to the assembly manual.</desc>
      <DiagramDefinitions />
      <path className="arm-silhouette" d="M896 112 C1014 114 1056 186 994 242 C946 284 868 278 812 244 L694 316 C648 346 620 394 610 448 L594 522 C584 570 540 606 490 606 H254" />
      <circle className="arm-joint" cx="936" cy="174" r="46" />
      <circle className="arm-joint" cx="806" cy="256" r="42" />
      <circle className="arm-joint" cx="694" cy="326" r="40" />
      <circle className="arm-joint" cx="628" cy="420" r="44" />
      <circle className="arm-joint" cx="586" cy="534" r="48" />
      <circle className="arm-joint" cx="472" cy="606" r="52" />
      <text className="arm-label" x="920" y="179">J6</text>
      <text className="arm-label" x="790" y="261">J5</text>
      <text className="arm-label" x="678" y="331">J4</text>
      <text className="arm-label" x="612" y="425">J3</text>
      <text className="arm-label" x="570" y="539">J2</text>
      <text className="arm-label" x="456" y="611">J1</text>

      <path className="wire harness-one" d="M930 160 C900 204 822 238 772 286 S664 380 632 468 S550 566 398 624 H220" />
      <path className="wire harness-two" d="M948 188 C902 238 842 258 794 310 S690 396 658 486 S574 588 420 648 H220" />
      <path className="wire can-pair" d="M943 174 C900 218 832 252 784 300 S676 390 647 479 S568 576 410 638 H220" />

      <DiagramBlock x={42} y={86} width={292} height={190} title="H1 / base hole 1" lines={['Motor phases: J1 · J3 · J5', 'Homing leads: J1 · J2 · J5', 'Wrap as one labelled group', 'Keep away from sharp print edges']} tone="logic" />
      <DiagramBlock x={42} y={322} width={292} height={208} title="H2 / base hole 2" lines={['Motor phases: J2 · J4 · J6', 'Homing leads: J3 · J4 · J6', 'Tool CAN twisted pair', 'Two pneumatic tubes', 'Preserve bend radius at J1']} tone="sensor" />
      <path className="wire harness-one" d="M334 190 H412 V624" />
      <path className="wire harness-two" d="M334 424 H388 V648" />

      <DiagramBlock x={848} y={372} width={308} height={146} title="Preparation lengths" lines={['Every motor: 4 × 1.0 m', 'Every homing device: 1.0 m', 'Tool: 4 × 1.0 m; CAN pair twisted', 'After base exit: retain ≥80 mm', 'Pneumatics after base: retain ≥150 mm']} tone="neutral" />
      <DiagramBlock x={848} y={548} width={308} height={112} title="Service practice" lines={['Label both ends J# / function', 'Cloth-tape after every completed link', 'Continuity-test before closing each cover']} tone="safety" />

      <text className="harness-legend one" x="370" y="96">H1 GROUP</text>
      <text className="harness-legend two" x="500" y="96">H2 GROUP</text>
      <text className="harness-legend can" x="632" y="96">TOOL CAN</text>
      <line className="wire harness-one" x1="370" y1="112" x2="474" y2="112" />
      <line className="wire harness-two" x1="500" y1="112" x2="604" y2="112" />
      <line className="wire can-pair" x1="632" y1="112" x2="736" y2="112" />
    </svg>
  );
}

interface HardwareVisual {
  image: string;
  title: string;
  role: string;
  detail: string;
  terminals: string[];
  reference?: boolean;
}

const motorImageByJoint: Record<AxisWiring['joint'], string> = {
  J1: '/reference/parol-stepper-60mm.jpg',
  J2: '/reference/parol-stepper-60mm.jpg',
  J3: '/reference/parol-stepper-40mm.jpg',
  J4: '/reference/parol-stepper-40mm.jpg',
  J5: '/reference/parol-stepper-40mm.jpg',
  J6: '/reference/parol-stepper-21mm.jpg'
};

function visualHardware(activeDiagram: WiringDiagramId, selectedAxis: AxisWiring): HardwareVisual[] {
  if (activeDiagram === 'power') {
    return [
      {
        image: '/reference/btt-octopus-pro-board.jpg',
        title: 'Octopus Pro V1.1',
        role: 'Controller power input',
        detail: 'The large populated controller board. Find the POWER and MOTOR_POWER screw terminals before landing any 24 V conductors.',
        terminals: ['POWER VIN', 'POWER GND', 'MOTOR_POWER + / -']
      },
      {
        image: '/reference/parol-estop.png',
        title: 'Latching E-stop',
        role: 'Hardware stop loop',
        detail: 'Use the normally-closed contact block. Pressing the red mushroom must open the contactor-coil circuit.',
        terminals: ['COM', 'NC', 'Do not use NO']
      },
      {
        image: '/reference/parol-base-distribution-board.jpg',
        title: 'PAROL6 distribution board',
        role: 'Reference layout only',
        detail: 'This is the upstream PAROL6 board, not the Octopus adaptation. Use it to recognize the base wiring area, not as a terminal map.',
        terminals: ['Visual reference', 'Do not copy pin-for-pin'],
        reference: true
      }
    ];
  }

  if (activeDiagram === 'motion') {
    return [
      {
        image: '/reference/btt-octopus-pro-board.jpg',
        title: 'Octopus Pro driver bank',
        role: `${selectedAxis.slot} drives ${selectedAxis.joint}`,
        detail: 'The removable TMC5160 module plugs into the selected M0-M5 socket. Confirm orientation and the voltage-select jumper before power-up.',
        terminals: [selectedAxis.slot, `STEP ${selectedAxis.step}`, `DIR ${selectedAxis.direction}`, `CS ${selectedAxis.chipSelect}`]
      },
      {
        image: motorImageByJoint[selectedAxis.joint],
        title: `${selectedAxis.joint} stepper motor`,
        role: selectedAxis.motor,
        detail: 'Identify the motor by body depth. Check the two coil pairs with a multimeter before trusting extension-cable colours.',
        terminals: ['A+ black', 'A- green', 'B- blue', 'B+ red']
      },
      {
        image: '/reference/parol-jst-xh.jpg',
        title: 'Motor cable connector',
        role: 'Four-wire phase connection',
        detail: 'The housing shape helps identify the cable, but the pin order must be continuity-tested from driver output to motor coil.',
        terminals: ['A1', 'A2', 'B2', 'B1'],
        reference: true
      }
    ];
  }

  if (activeDiagram === 'homing') {
    const inductive = selectedAxis.homeCircuit.startsWith('24 V');
    return [
      {
        image: selectedAxis.joint === 'J4' ? '/reference/parol-inductive-gx-f8a.png' : inductive ? '/reference/parol-inductive-4mm.png' : '/reference/parol-limit-switch.png',
        title: `${selectedAxis.joint} home device`,
        role: selectedAxis.homeDevice,
        detail: inductive
          ? 'Three-wire 24 V sensor. Its output must pass through an isolated logic conditioner before the controller.'
          : 'Lever microswitch. Wire the common and normally-closed terminals so a broken wire reports a fault.',
        terminals: inductive ? ['Brown +24 V', 'Blue 0 V', 'Black OUT'] : ['COM', 'NC', 'NO unused']
      },
      {
        image: '/reference/parol-limit-switch.png',
        title: 'ZW12 microswitch',
        role: 'Used on J2, J3 and J5',
        detail: 'The roller lever is the moving actuator. COM and NC are the only contacts used in this design.',
        terminals: ['COM', 'NC', 'Signal + GND']
      },
      {
        image: '/reference/parol-inductive-gx-f8a.png',
        title: 'GX-F8A-style sensor',
        role: 'Used on J4',
        detail: 'This flat proximity sensor is electrically different from a dry switch. Never land its 24 V output directly on a STOP header.',
        terminals: ['24 V field side', 'Isolated output side']
      }
    ];
  }

  return [
    {
      image: '/reference/parol-arm.jpg',
      title: 'PAROL6 arm body',
      role: 'Harness travels inside the links',
      detail: 'Use the joint circles in the route drawing to orient this real arm. The two harness groups leave through separate holes in the base.',
      terminals: ['Wrist to base', 'J6 -> J1']
    },
    {
      image: '/reference/parol-cable-assembly.png',
      title: 'Prepared cable bundle',
      role: 'Labelled moving harness',
      detail: 'Bundle only after continuity checks. Preserve service loops and keep sensor conductors separated from motor phases where possible.',
      terminals: ['H1 group', 'H2 group', 'Tool CAN pair']
    },
    {
      image: '/reference/parol-jst-xh.jpg',
      title: 'JST-XH connector family',
      role: 'Motor and board-side plugs',
      detail: 'Match the latch and housing pitch visually, then verify every pin electrically before closing a joint cover.',
      terminals: ['Label both ends', 'Check latch direction'],
      reference: true
    }
  ];
}

function VisualHardwareGuide({ activeDiagram, selectedAxis }: { activeDiagram: WiringDiagramId; selectedAxis: AxisWiring }) {
  const visuals = visualHardware(activeDiagram, selectedAxis);
  const showPinMap = activeDiagram !== 'harness';

  return (
    <section className="visual-hardware-guide" aria-labelledby="visual-hardware-heading">
      <div className="visual-guide-heading">
        <div>
          <span>Visual identification</span>
          <h3 id="visual-hardware-heading">Find these parts before following the lines</h3>
          <p>Match the photograph, then confirm the printed terminal name. Wire colour alone is never enough.</p>
        </div>
        <CircuitBoard size={20} aria-hidden="true" />
      </div>

      <ol className="hardware-visual-sequence">
        {visuals.map((visual, index) => (
          <li key={`${activeDiagram}-${visual.title}`}>
            <figure>
              <div className="hardware-photo">
                <img src={visual.image} alt={visual.title} loading="lazy" />
                <b aria-hidden="true">{index + 1}</b>
                {visual.reference ? <span>reference only</span> : null}
              </div>
              <figcaption>
                <small>{visual.role}</small>
                <strong>{visual.title}</strong>
                <p>{visual.detail}</p>
                <div className="terminal-tags" aria-label={`Terminals for ${visual.title}`}>
                  {visual.terminals.map((terminal) => <span key={terminal}>{terminal}</span>)}
                </div>
              </figcaption>
            </figure>
          </li>
        ))}
      </ol>

      {showPinMap ? (
        <details className="board-pinmap-reference">
          <summary>
            <span><strong>Open the full Octopus Pro V1.1 pin map</strong><small>Use this large board image to locate connectors and printed pin names.</small></span>
            <span aria-hidden="true">View board map</span>
          </summary>
          <figure>
            <img src="/reference/btt-octopus-pro-pinmap.jpg" alt="Official BIGTREETECH Octopus Pro V1.1 annotated pin map" loading="lazy" />
            <figcaption>Official BIGTREETECH V1.1 reference. Confirm the received PCB revision and STM32H723 controller before using the ROBARM schedule.</figcaption>
          </figure>
          <BoardAnatomyGuide />
        </details>
      ) : null}
    </section>
  );
}

const boardStatusLabels: Record<BoardSubsystemStatus, string> = {
  used: 'Used on ROBARM',
  reserved: 'Reserved',
  unused: 'Not used',
  service: 'Service only'
};

function BoardAnatomyGuide() {
  return (
    <section className="board-anatomy" aria-labelledby="board-anatomy-heading">
      <header>
        <div>
          <span>Connector-by-connector reference</span>
          <h4 id="board-anatomy-heading">What every colored board area does</h4>
          <p>The stripe on each card matches the corresponding callout color in the board image above.</p>
        </div>
        <div className="board-status-key" aria-label="ROBARM connector status key">
          {(Object.keys(boardStatusLabels) as BoardSubsystemStatus[]).map((status) => (
            <span className={`status-${status}`} key={status}>{boardStatusLabels[status]}</span>
          ))}
        </div>
      </header>

      <div className="board-anatomy-grid">
        {boardSubsystems.map((subsystem) => (
          <article style={{ borderTopColor: subsystem.mapColor }} key={subsystem.id}>
            <header>
              <i style={{ backgroundColor: subsystem.mapColor }} aria-hidden="true" />
              <div>
                <small>{subsystem.connectors}</small>
                <strong>{subsystem.category}</strong>
              </div>
              <span className={`board-use-status status-${subsystem.status}`}>{boardStatusLabels[subsystem.status]}</span>
            </header>
            <dl>
              <div><dt>What it does</dt><dd>{subsystem.purpose}</dd></div>
              <div><dt>What connects</dt><dd>{subsystem.connects}</dd></div>
              <div className="robarm-assignment"><dt>ROBARM assignment</dt><dd>{subsystem.robarm}</dd></div>
            </dl>
            {subsystem.caution ? <p className="board-caution"><strong>Caution</strong>{subsystem.caution}</p> : null}
          </article>
        ))}
      </div>
    </section>
  );
}

const powerSchedule = [
  ['J0 L', 'AC line', 'Brown / black, certified mains conductor', 'Fused switch → PS1 L'],
  ['J0 N', 'AC neutral', 'Blue / white, certified mains conductor', 'Direct → PS1 N'],
  ['J0 PE', 'Protective earth', 'Green-yellow; ring terminal', 'PS1 PE + enclosure star bond'],
  ['F2', 'Logic 24 V+', '18 AWG stranded copper', 'PS1 V+ → Octopus POWER VIN'],
  ['F1 / K1', 'Motor 24 V+', '18 AWG stranded copper', 'PS1 V+ → fuse → contactor → MOTOR_POWER'],
  ['DC return', '0 V', '18 AWG black stranded copper', 'PS1 V- → POWER GND + MOTOR_POWER GND'],
  ['FAN0', 'Controller cooling', 'Noctua red/black', 'Set VFAN jumper to 5 V before connection']
];

function WiringPageDiagram({ activeDiagram, selectedAxis }: { activeDiagram: WiringDiagramId; selectedAxis: AxisWiring }) {
  if (activeDiagram === 'power') return <PowerSafetyDiagram />;
  if (activeDiagram === 'motion') return <MotionDiagram selectedAxis={selectedAxis} />;
  if (activeDiagram === 'homing') return <HomingDiagram selectedAxis={selectedAxis} />;
  return <HarnessDiagram />;
}

export function WiringPage() {
  const [activeDiagram, setActiveDiagram] = useState<WiringDiagramId>('power');
  const [selectedJoint, setSelectedJoint] = useState<AxisWiring['joint']>('J1');
  const selectedAxis = useMemo(() => axisWiring.find((axis) => axis.joint === selectedJoint) ?? axisWiring[0], [selectedJoint]);
  const activeDefinition = diagramNavigation.find((diagram) => diagram.id === activeDiagram) ?? diagramNavigation[0];

  return (
    <section className="wiring-page" aria-labelledby="wiring-page-title">
      <header className="wiring-hero">
        <div>
          <span className="wiring-kicker"><Cable size={15} /> Electrical integration dossier · revision A</span>
          <h2 id="wiring-page-title">ROBARM wiring diagrams</h2>
          <p>Board-specific field wiring for the Octopus Pro V1.1 H723 adaptation, cross-checked against the official PAROL6 harness and homing layout.</p>
        </div>
        <dl className="wiring-hero-facts">
          <div><dt>Controller</dt><dd>Octopus Pro V1.1</dd></div>
          <div><dt>Motion</dt><dd>6 × TMC5160 Pro</dd></div>
          <div><dt>Power</dt><dd>24 VDC / 5 A</dd></div>
          <div><dt>Drawing</dt><dd>Engineering draft</dd></div>
        </dl>
        <button className="wiring-print" onClick={() => window.print()} aria-label="Print wiring diagrams or save them as PDF">
          <Printer size={16} /> Print / save PDF
        </button>
      </header>

      <div className="wiring-safety-banner" role="note">
        <ShieldAlert size={20} aria-hidden="true" />
        <div><strong>Hardware design gate</strong><span>Do not energize this design until board revision, fuse values, contactor ratings, sensor conditioners, enclosure earth bond and firmware input polarity have been verified on the bench.</span></div>
      </div>

      <div className="wiring-layout">
        <aside className="wiring-index" aria-label="Wiring diagram sections">
          <div className="wiring-index-heading">
            <span>Drawing set</span>
            <strong>4 sheets</strong>
          </div>
          <div className="wiring-sheet-list">
            {diagramNavigation.map((diagram) => (
              <button
                className={activeDiagram === diagram.id ? 'active' : ''}
                key={diagram.id}
                onClick={() => setActiveDiagram(diagram.id)}
                aria-pressed={activeDiagram === diagram.id}
              >
                <span>{diagram.eyebrow}</span>
                <strong>{diagram.label}</strong>
                <small>{diagram.summary}</small>
              </button>
            ))}
          </div>

          <div className="firmware-contract">
            <CircuitBoard size={18} />
            <div><span>Firmware contract</span><strong>H723 · V1.1 pin map</strong><small>V1.0 and non-Pro definitions are explicitly incompatible.</small></div>
          </div>

          <div className="axis-focus" aria-labelledby="axis-focus-title">
            <span id="axis-focus-title">Axis trace</span>
            <div>
              {axisWiring.map((axis) => (
                <button className={selectedJoint === axis.joint ? 'active' : ''} onClick={() => setSelectedJoint(axis.joint)} key={axis.joint}>{axis.joint}</button>
              ))}
            </div>
            <dl>
              <div><dt>Socket</dt><dd>{selectedAxis.slot}</dd></div>
              <div><dt>Home input</dt><dd>{selectedAxis.stop} / {selectedAxis.stopPin}</dd></div>
              <div><dt>Harness</dt><dd>{selectedAxis.route}</dd></div>
            </dl>
          </div>
        </aside>

        <main className="wiring-main">
          <header className="drawing-header">
            <div><span>{activeDefinition.eyebrow}</span><h3>{activeDefinition.label}</h3><p>{activeDefinition.summary}</p></div>
            <div className="drawing-id"><span>ROBARM-E-{String(diagramNavigation.findIndex((entry) => entry.id === activeDiagram) + 1).padStart(2, '0')}</span><b>REV A</b></div>
          </header>

          <VisualHardwareGuide activeDiagram={activeDiagram} selectedAxis={selectedAxis} />

          <div className="diagram-canvas">
            <WiringPageDiagram activeDiagram={activeDiagram} selectedAxis={selectedAxis} />
          </div>

          {activeDiagram === 'motion' || activeDiagram === 'homing' ? (
            <section className="wiring-table-section" aria-labelledby="axis-pin-schedule">
              <div className="wiring-section-heading"><div><span>Connector schedule</span><h3 id="axis-pin-schedule">Six-axis pin assignment</h3></div><Gauge size={18} /></div>
              <div className="wiring-table-scroll">
                <table className="wiring-table">
                  <thead><tr><th>Axis</th><th>Driver</th><th>Motor / rating</th><th>STEP</th><th>DIR</th><th>EN</th><th>SPI CS</th><th>Home input</th><th>Home device</th></tr></thead>
                  <tbody>{axisWiring.map((axis) => (
                    <tr className={selectedJoint === axis.joint ? 'active' : ''} key={axis.joint}>
                      <th scope="row"><button onClick={() => setSelectedJoint(axis.joint)} aria-label={`Highlight ${axis.joint}`}>{axis.joint}</button></th>
                      <td>{axis.slot}</td><td>{axis.motor}<small>{axis.ratedCurrent}</small></td><td>{axis.step}</td><td>{axis.direction}</td><td>{axis.enable}</td><td>{axis.chipSelect}</td><td>{axis.stop}<small>{axis.stopPin}</small></td><td>{axis.homeDevice}<small>{axis.homeCircuit}</small></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </section>
          ) : null}

          {activeDiagram === 'power' ? (
            <section className="wiring-table-section" aria-labelledby="power-termination-schedule">
              <div className="wiring-section-heading"><div><span>Termination schedule</span><h3 id="power-termination-schedule">Power conductors</h3></div><PlugZap size={18} /></div>
              <div className="wiring-table-scroll"><table className="wiring-table compact"><thead><tr><th>Terminal</th><th>Function</th><th>Wire</th><th>Destination</th></tr></thead><tbody>{powerSchedule.map((row) => <tr key={row[0]}>{row.map((cell, index) => index === 0 ? <th scope="row" key={cell}>{cell}</th> : <td key={cell}>{cell}</td>)}</tr>)}</tbody></table></div>
            </section>
          ) : null}

          {activeDiagram === 'harness' ? (
            <section className="harness-schedule" aria-labelledby="harness-schedule-heading">
              <div className="wiring-section-heading"><div><span>Mechanical routing</span><h3 id="harness-schedule-heading">Base exit allocation</h3></div><Workflow size={18} /></div>
              <div className="harness-cards">{harnessGroups.map((group) => <article key={group.exit}><span>{group.exit}</span><dl><div><dt>Motors</dt><dd>{group.motors}</dd></div><div><dt>Homing</dt><dd>{group.sensors}</dd></div><div><dt>Additional</dt><dd>{group.extras}</dd></div></dl><p>{group.note}</p></article>)}</div>
            </section>
          ) : null}

          <section className="wiring-verification" aria-labelledby="verification-heading">
            <div className="wiring-section-heading"><div><span>Commissioning hold points</span><h3 id="verification-heading">Required checks before motion</h3></div><FileCheck2 size={18} /></div>
            <ol>{wiringChecks.map((check, index) => <li key={check}><span>{String(index + 1).padStart(2, '0')}</span><p>{check}</p></li>)}</ol>
          </section>
        </main>

        <aside className="wiring-reference">
          <section>
            <div className="wiring-section-heading"><div><span>Identification</span><h3>Wire legend</h3></div><Cable size={17} /></div>
            <div className="wire-legend">{wireLegend.map((wire) => <div key={wire.label}><i style={{ backgroundColor: wire.color }} /><span><strong>{wire.label}</strong><small>{wire.code} · {wire.use}</small></span></div>)}</div>
          </section>

          <section className="integration-note">
            <AlertTriangle size={18} />
            <div><strong>PAROL6 sensor-label correction</strong><p>The upstream assembly manual places inductive sensors on J1, J4 and J6, with microswitches on J2, J3 and J5. Use the manual allocation shown here even if a shopping-list label says J1/J2/J3.</p></div>
          </section>

          <section>
            <div className="wiring-section-heading"><div><span>Source control</span><h3>Primary references</h3></div><CheckCircle2 size={17} /></div>
            <div className="wiring-sources">{wiringSources.map((source) => <a href={source.url} target="_blank" rel="noreferrer" key={source.label}><span><strong>{source.label}</strong><small>{source.detail}</small></span><ExternalLink size={14} /></a>)}</div>
          </section>

          <section className="design-assumptions">
            <span>Required additions</span>
            <ul>
              <li>One 24 VDC contactor or appropriately rated power relay with auxiliary contact.</li>
              <li>Three channels of 24 V NPN-to-logic isolated input conditioning.</li>
              <li>Flyback suppression for the contactor coil.</li>
              <li>Finger-safe distribution and a bonded control enclosure.</li>
            </ul>
          </section>
        </aside>
      </div>
    </section>
  );
}
