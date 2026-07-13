import type { ExplodedPieceCategory } from './types';

export interface AssemblyGuideStep {
  title: string;
  section: string;
  summary: string;
  checks: string[];
  tool: string;
}

export const assemblyGuideSteps: AssemblyGuideStep[] = [
  {
    title: 'Prepare the base',
    section: 'Base',
    summary: 'Square the fixed enclosure, safety controls, fan and cable entry before the rotating stack is installed.',
    checks: ['Fan faces the circular side vent', 'E-stop opens the hardware enable loop', 'Base sits flat with no trapped wiring'],
    tool: '2.5 mm hex key + continuity meter'
  },
  {
    title: 'Build the J1 drive',
    section: 'J1 base drive',
    summary: 'Seat the yaw bearings, reducer and motor concentrically, then create a controlled cable service loop through the axis.',
    checks: ['Bearing seats are fully home', 'Gearbox output turns without binding', 'Cable loop clears both J1 limits'],
    tool: 'Hex keys + low-strength removable threadlocker'
  },
  {
    title: 'Install the shoulder',
    section: 'J2 shoulder',
    summary: 'Assemble the high-load shoulder structure and verify its reduction stage before closing the printed covers.',
    checks: ['Shaft and bearings turn freely', 'Pulley faces share one plane', 'Limit switch actuates before the hard stop'],
    tool: 'Caliper + straightedge + hex keys'
  },
  {
    title: 'Complete the elbow',
    section: 'J3 elbow',
    summary: 'Join the upper arm to the elbow transmission while keeping belt tension even across a full hand-driven cycle.',
    checks: ['Belt teeth are fully engaged', 'Tension is firm without bearing preload', 'No fastener enters the belt path'],
    tool: 'Hex keys + belt tension gauge or light finger pressure'
  },
  {
    title: 'Route the forearm',
    section: 'J4 forearm roll',
    summary: 'Install the forearm roll hardware and route motor, sensor and tool lines through the long internal channel.',
    checks: ['Harness follows the marked service route', 'Roll axis has a generous service loop', 'Belt and wiring remain separated'],
    tool: 'Cable sleeve + flush cutters + small zip ties'
  },
  {
    title: 'Assemble wrist pitch',
    section: 'J5 wrist pitch',
    summary: 'Build the compact pitch stage, preserving pulley alignment and cable bend radius at both travel limits.',
    checks: ['48-tooth pulley runs true', 'Cable cannot pinch against the cover', 'Joint reaches both limits by hand'],
    tool: 'Caliper + 2 mm hex key'
  },
  {
    title: 'Finish the tool flange',
    section: 'J6 tool flange',
    summary: 'Install the short motor, output hardware, pneumatic fittings and tool connector around the final roll axis.',
    checks: ['Output flange is concentric', 'Tool connector has strain relief', 'Pneumatic line remains clear through roll'],
    tool: 'Hex keys + small spanner'
  },
  {
    title: 'Wire and prove controls',
    section: 'Control electronics',
    summary: 'Connect the controller, drivers, sensors and safety chain, then commission one unloaded axis at a time.',
    checks: ['Protective earth and fuses are verified', 'Driver current starts conservatively', 'Every axis stops and homes independently'],
    tool: 'Multimeter + insulated terminal tools'
  }
];

export interface DiagnosticScenario {
  id: string;
  name: string;
  symptom: string;
  severity: 'check' | 'warning' | 'stop';
  sections: string[];
  categories?: ExplodedPieceCategory[];
  checks: string[];
}

export const diagnosticScenarios: DiagnosticScenario[] = [
  {
    id: 'axis-stalls',
    name: 'Axis stalls or skips',
    symptom: 'The joint chatters, loses position or stops under a load it should carry.',
    severity: 'warning',
    sections: ['J1 base drive', 'J2 shoulder', 'J3 elbow', 'J4 forearm roll', 'J5 wrist pitch', 'J6 tool flange'],
    categories: ['drive component'],
    checks: ['Power down and move the joint by hand', 'Inspect belt engagement and pulley set screws', 'Verify driver current and motor phase pairing']
  },
  {
    id: 'homing-fails',
    name: 'Homing does not stop',
    symptom: 'An axis reaches its reference sensor but continues toward the mechanical stop.',
    severity: 'stop',
    sections: ['J2 shoulder', 'J3 elbow', 'J4 forearm roll', 'Control electronics'],
    categories: ['sensor', 'electronics'],
    checks: ['Disable motor power before testing continuity', 'Confirm NC/NO logic and input voltage', 'Jog away from the switch before retrying at low speed']
  },
  {
    id: 'controller-hot',
    name: 'Controller or drivers run hot',
    symptom: 'The base electronics become hot, throttle, reset or emit a thermal warning.',
    severity: 'stop',
    sections: ['Base', 'Control electronics'],
    categories: ['electronics'],
    checks: ['Confirm the fan is installed at the circular vent', 'Check airflow direction and blocked wiring', 'Reduce driver current and inspect heatsink contact']
  },
  {
    id: 'belt-noise',
    name: 'Belt clicks or tracks sideways',
    symptom: 'A timing belt rides a pulley flange, clicks under reversal or sheds black dust.',
    severity: 'warning',
    sections: ['J2 shoulder', 'J3 elbow', 'J4 forearm roll', 'J5 wrist pitch'],
    categories: ['drive component'],
    checks: ['Compare pulley faces with a straightedge', 'Inspect printed pulley teeth and belt damage', 'Reset tension without side-loading the bearings']
  },
  {
    id: 'usb-reset',
    name: 'USB disconnects during motion',
    symptom: 'The controller resets or the computer loses its serial connection when motors accelerate.',
    severity: 'stop',
    sections: ['Base', 'Control electronics'],
    categories: ['electronics', 'controls'],
    checks: ['Separate signal and motor-power wiring', 'Verify 24 V branch voltage during acceleration', 'Check earth bonding, fuses and USB strain relief']
  },
  {
    id: 'wrist-cable',
    name: 'Wrist cable catches',
    symptom: 'The harness tightens, rubs or changes the wrist motion near J5/J6 limits.',
    severity: 'warning',
    sections: ['J4 forearm roll', 'J5 wrist pitch', 'J6 tool flange'],
    checks: ['Enable the cable route overlay', 'Check bend radius at both joint limits', 'Add strain relief without shortening the service loop']
  }
];
