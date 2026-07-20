import type {
  AssemblyHardwareItem,
  MechanicalPartId,
  PartAssemblyBreakdown,
  PrintedAssemblyComponent
} from './types';

const rawRoot = 'https://raw.githubusercontent.com/Source-Robotics/PAROL6-Desktop-robot-arm/main/STL';

function sourceUrl(path: string) {
  return `${rawRoot}/${path.split('/').map(encodeURIComponent).join('/')}`;
}

function component(
  id: string,
  name: string,
  path: string,
  step: number,
  manualPages: string,
  description: string,
  hardwareIds: string[],
  optional = false
): PrintedAssemblyComponent {
  return {
    id,
    name,
    sourceFile: path,
    previewFile: path.replace(/\.stl$/i, '.glb'),
    sourceUrl: sourceUrl(path),
    step,
    manualPages,
    description,
    hardwareIds,
    optional
  };
}

const h = (
  id: string,
  name: string,
  specification: string,
  quantity: number,
  kind: AssemblyHardwareItem['kind'],
  note?: string
): AssemblyHardwareItem => ({ id, name, specification, quantity, kind, note });

export const assemblyBreakdowns: Record<MechanicalPartId, PartAssemblyBreakdown> = {
  baseLink: {
    partId: 'baseLink',
    label: 'Base, controller enclosure, and safety station',
    manualSection: 'Base assembly',
    manualPages: '79-92, 99',
    buildOrder: 6,
    note: 'The stock electronics case is sized for the official PAROL6 board. The planned Octopus Pro and DIN power supply still require a separate enclosure.',
    components: [
      component('base-main', 'Main base blocker', 'BASE/main_base_blocker.STL', 1, '80-83', 'Carries the J1 bearing pair, homing sensor, rotation stop, belt, and wire passages.', ['base-bearing3', 'base-sensor3', 'base-stop', 'base-j1-pulley', 'base-j1-belt', 'base-tension']),
      component('base-controller-case', 'Electronics case', 'BASE/Electronics_case_v1_1.STL', 2, '84-90', 'Slides around the official controller board and supports the front-panel connectors.', ['base-controller', 'base-case-screws', 'base-button', 'base-power', 'base-pneumatic']),
      component('base-electronics-lid', 'Electronics lid', 'BASE/lid_electronics.STL', 3, '90-91', 'Closes the controller bay and carries the fan cover.', ['base-lid-screws', 'base-fan']),
      component('base-fan-cover', 'Fan cover', 'BASE/fan_cover.STL', 4, '91', 'Locates the 40 mm cooling fan over the controller airflow opening.', ['base-fan', 'base-fan-screws']),
      component('base-bottom-lid', 'J1 bottom lid', 'BASE/J1_bottom_lid.STL', 5, '92', 'Closes the underside after the wiring and controller checks are complete.', ['base-bottom-screws']),
      component('base-estop-bottom', 'E-stop bottom shell', 'ESTOP/ESTOP_BOTTOM.STL', 6, '99', 'Lower half of the separate emergency-stop enclosure.', ['base-estop', 'base-estop-screws', 'base-inserts', 'base-gland']),
      component('base-estop-top', 'E-stop top shell', 'ESTOP/ESTOP_TOP.STL', 7, '99', 'Top half that captures the mushroom switch and cable gland.', ['base-estop', 'base-estop-screws', 'base-inserts', 'base-gland']),
      component('base-profile-connectors', 'Aluminum-profile connectors', 'UTILITY/connectors_4_alu_profiles.STL', 8, 'Repository utility', 'Optional fixture connectors for mounting four aluminum profiles; not part of the moving arm.', ['base-profiles'], true)
    ],
    hardware: [
      h('base-bearing3', 'J1 tapered bearings', 'NSK HR32907J', 2, 'bearing'),
      h('base-sensor3', 'J1 inductive sensor', 'M5, NPN normally open', 1, 'sensor'),
      h('base-stop', 'J1 rotation-stop screw', 'M3 x 25 mm', 1, 'bolt', 'The manual text also mentions 20 mm; verify engagement before motion.'),
      h('base-j1-pulley', 'J1 motor pulley', 'HTD3M, 15 tooth, 5 mm bore', 1, 'pulley'),
      h('base-j1-belt', 'J1 timing belt', 'HTD3-396, 6 mm wide', 1, 'belt'),
      h('base-tension', 'J1 tension bearings', '3 x 8 x 4 mm / 3 x 10 x 4 mm pair', 2, 'bearing'),
      h('base-controller', 'PAROL6 controller board', 'Official controller footprint', 1, 'controller'),
      h('base-case-screws', 'Controller-case screws', 'M3 x 12 mm', 8, 'bolt'),
      h('base-button', 'Illuminated power button', '12 mm with JST-PH lead', 1, 'switch'),
      h('base-power', 'Arm power connector', 'GX16, 2 pin', 1, 'connector'),
      h('base-pneumatic', 'Base pneumatic fittings', '4 mm push-fit', 2, 'pneumatic'),
      h('base-lid-screws', 'Electronics-lid screws', 'M3 x 8 mm', 8, 'bolt'),
      h('base-fan', 'Cooling fan', '40 x 40 x 20 mm, 5 V', 1, 'fan'),
      h('base-fan-screws', 'Fan-cover screws', 'M3 x 8 mm', 2, 'bolt'),
      h('base-bottom-screws', 'Bottom-lid screws', 'M3 x 8 mm, 2 mm head height', 3, 'bolt'),
      h('base-estop', 'Emergency-stop switch', '19 mm, normally closed', 1, 'switch'),
      h('base-estop-screws', 'E-stop shell screws', 'M3 x 25 mm', 4, 'bolt'),
      h('base-inserts', 'E-stop heat-set inserts', 'M3 x 6 mm', 4, 'insert'),
      h('base-gland', 'E-stop cable gland', 'PG7', 1, 'connector'),
      h('base-profiles', 'Fixture profiles', '20 mm aluminum extrusion', 4, 'tool')
    ]
  },
  link1: {
    partId: 'link1',
    label: 'J1/J2 shoulder turret',
    manualSection: 'Shoulder assembly',
    manualPages: '59-78, 82',
    buildOrder: 5,
    note: 'Apply blue threadlocker wherever a metal coupler clamps a gearbox shaft. The J1 homing screw must protrude far enough to trigger the sensor without striking the base.',
    components: [
      component('shoulder-motor-holder', 'J1 turret motor holder', 'SHOULDER/J1_turret_motor_holder.STL', 1, '60-61', 'Locates the J1 stepper and 20:1 gearbox in the shoulder.', ['shoulder-j1-motor', 'shoulder-gearbox', 'shoulder-holder-m3', 'shoulder-holder-m4']),
      component('shoulder-turret', 'J1 turret', 'SHOULDER/J1_turret_rework_blocker.STL', 2, '62-73', 'Main printed shoulder frame with J1 shaft, J2 bearing seats, and rotation guide rails.', ['shoulder-coupler', 'shoulder-coupler-m4', 'shoulder-turret-m4', 'shoulder-home', 'shoulder-bearing3', 'shoulder-guide-m4']),
      component('shoulder-rotation-shaft', 'J1 rotation shaft', 'SHOULDER/J1_rotation_shaft.STL', 3, '65, 77-78', 'Transfers J1 torque and provides the central passage for every wrist-to-base wire.', ['shoulder-turret-m4', 'shoulder-home']),
      component('shoulder-j2-limit-cover', 'J2 limit-switch cover', 'SHOULDER/J2_limit_switch_cover.STL', 4, '66', 'Holds the J2 mechanical limit switch and closes its wiring pocket.', ['shoulder-j2-motor', 'shoulder-limit', 'shoulder-limit-m2', 'shoulder-j2-m3']),
      component('shoulder-j2-stopper', 'J2 stopper block', 'SHOULDER/J2_stopper_block.STL', 5, '68', 'Mechanical stop block for the shoulder travel limit.', ['shoulder-stopper-m3']),
      component('shoulder-j2-shaft', 'J2 shaft', 'UPPER_ARM/J2_shaft.STL', 6, '75', 'Clamps the upper arm onto the shoulder bearing pair.', ['shoulder-shaft-m4']),
      component('shoulder-j2-backplate', 'J2 bearing backplate', 'UPPER_ARM/J2_bearing_backplate.STL', 7, '76', 'Preloads and retains the outer J2 bearing.', ['shoulder-cover-m3']),
      component('shoulder-j2-cover', 'J2 cover', 'UPPER_ARM/J2_cover.STL', 8, '76, 96', 'Finishes the J2 bearing face and covers the belt-tension hardware.', ['shoulder-cover-m3']),
      component('shoulder-j1-belt-cover', 'J1 belt cover', 'SHOULDER/J1_belt_cover_rework.STL', 9, '77, 81', 'Closes the J1 belt path after the belt is placed around the base.', ['shoulder-belt-cover-m2']),
      component('shoulder-j1-wire-cover', 'J1 wire cover', 'SHOULDER/J1_wires_cover_rework.STL', 10, '77', 'Retains the J1 motor lead before it enters the hollow rotation shaft.', ['shoulder-belt-cover-m2']),
      component('shoulder-j1-backplate', 'J1 backplate', 'SHOULDER/J1_backplate.STL', 11, '82', 'Retains the underside of the shoulder and passes the complete harness into the base.', ['shoulder-backplate-m4'])
    ],
    hardware: [
      h('shoulder-j1-motor', 'J1 stepper motor', 'NEMA 17, 60 mm body', 1, 'motor'),
      h('shoulder-j2-motor', 'J2 stepper motor', 'NEMA 17, 60 mm body', 1, 'motor'),
      h('shoulder-gearbox', 'J1 planetary gearbox', '20:1, NEMA 17', 1, 'gearbox'),
      h('shoulder-holder-m3', 'Motor-to-gearbox screws', 'M3 x 8 mm', 4, 'bolt'),
      h('shoulder-holder-m4', 'Holder-to-gearbox screws', 'M4 x 16 mm', 4, 'bolt'),
      h('shoulder-coupler', 'J1 shaft coupler', '8 mm bore, M4 flange', 1, 'coupler'),
      h('shoulder-coupler-m4', 'Coupler screws', 'M4 x 16 mm', 4, 'bolt'),
      h('shoulder-turret-m4', 'Turret/shaft screws', 'M4 x 16 mm', 6, 'bolt'),
      h('shoulder-home', 'J1 homing screw', 'M4 x 14 mm', 1, 'bolt'),
      h('shoulder-bearing3', 'J2 tapered bearings', 'NSK HR32907J', 2, 'bearing'),
      h('shoulder-guide-m4', 'J1 guide-rail screws', '2 x M4 x 16 mm + 2 x M4 x 14 mm', 4, 'bolt'),
      h('shoulder-limit', 'J2 limit switch', 'ZW12-3', 1, 'switch'),
      h('shoulder-limit-m2', 'Limit-switch screws', 'M2 x 10 mm', 2, 'bolt'),
      h('shoulder-j2-m3', 'J2 motor/cover screws', '4 x M3 x 14 mm + 2 x M3 x 8 mm', 6, 'bolt'),
      h('shoulder-stopper-m3', 'Stopper-block screws', '1 x M3 x 8 mm + 2 x M3 x 12 mm', 3, 'bolt'),
      h('shoulder-shaft-m4', 'J2 shaft screws', 'M4 x 50 mm', 4, 'bolt'),
      h('shoulder-cover-m3', 'J2 cover/backplate screws', 'M3 x 12 mm', 4, 'bolt'),
      h('shoulder-belt-cover-m2', 'J1 cover screws', 'M2 x 10 mm', 2, 'bolt'),
      h('shoulder-backplate-m4', 'J1 backplate screws', 'M4 x 16 mm', 6, 'bolt')
    ]
  },
  link2: {
    partId: 'link2',
    label: 'J2/J3 upper arm',
    manualSection: 'Upper arm assembly',
    manualPages: '48-58, 94-96',
    buildOrder: 4,
    note: 'Route the existing wrist harness through the upper-arm slot before closing the wire cover. Fit the J3 belt only after the shoulder and base are joined.',
    components: [
      component('upper-main', 'Upper arm', 'UPPER_ARM/Upper_arm.STL', 1, '49-56', 'Long load-carrying shell with J2/J3 bearing seats, motor pocket, and wire channel.', ['upper-bearing2', 'upper-motor', 'upper-gearbox', 'upper-drive-screws']),
      component('upper-j3-pulley', 'J3 38-tooth pulley', 'UPPER_ARM/38_pulley_J3.STL', 2, '52', 'Large printed output pulley fixed into the upper-arm bearing stack.', ['upper-pulley-screws']),
      component('upper-motor-pulley', 'J3 42-tooth pulley', 'UPPER_ARM/42_pulley.STL', 3, '94-95', 'Printed motor-side J3 pulley that bolts to the shaft coupler.', ['upper-coupler', 'upper-coupler-screws', 'upper-j3-belt']),
      component('upper-limit-cover', 'J3 limit-switch cover', 'UPPER_ARM/J3_limit_switch_cover.STL', 4, '54', 'Locates the J3 homing switch beside the stepper lead passage.', ['upper-limit', 'upper-limit-m2', 'upper-limit-m3']),
      component('upper-wire-cover', 'Upper-arm wire cover', 'UPPER_ARM/Upper_arm_wires_cover.STL', 5, '57', 'Captures the routed harness inside the long side channel.', ['upper-wire-screws']),
      component('upper-cover', 'Upper-arm cover', 'UPPER_ARM/Upper_arm_cover.STL', 6, '96', 'Closes the J3 belt run and retains its tension-bearing stacks.', ['upper-cover-screws', 'upper-tension'])
    ],
    hardware: [
      h('upper-bearing2', 'J3 tapered bearings', 'NSK HR32906J', 2, 'bearing'),
      h('upper-motor', 'J3 stepper motor', 'NEMA 17, 40 mm body', 1, 'motor'),
      h('upper-gearbox', 'J3 planetary gearbox', '20:1, NEMA 17', 1, 'gearbox'),
      h('upper-drive-screws', 'J3 drive screws', '4 x M3 x 8 mm + 4 x M4 x 16 mm', 8, 'bolt'),
      h('upper-pulley-screws', '38-tooth pulley screws', 'M3 x 35-38 mm', 6, 'bolt'),
      h('upper-limit', 'J3 limit switch', 'ZW12-3', 1, 'switch'),
      h('upper-limit-m2', 'Limit-switch screws', 'M2 x 10 mm', 2, 'bolt'),
      h('upper-limit-m3', 'Limit-cover screws', 'M3 x 8 mm', 3, 'bolt'),
      h('upper-wire-screws', 'Wire-cover screws', 'M3 x 12 mm', 4, 'bolt'),
      h('upper-coupler', 'J3 shaft coupler', '8 mm bore, M4 flange', 1, 'coupler'),
      h('upper-coupler-screws', 'Pulley-to-coupler screws', 'M4 x 10 mm', 4, 'bolt'),
      h('upper-j3-belt', 'J3 timing belt', 'HTD3-342, 6 mm wide', 1, 'belt'),
      h('upper-cover-screws', 'Joint-cover screws', '2 x M3 x 12 mm + 2 x M3 x 8 mm + 8 x M3 x 14 mm', 12, 'bolt'),
      h('upper-tension', 'J3 tension bearings', '3 x 8 x 4 mm, paired', 8, 'bearing')
    ]
  },
  link3: {
    partId: 'link3',
    label: 'J3/J4 elbow transmission',
    manualSection: 'Elbow assembly',
    manualPages: '39-47',
    buildOrder: 3,
    note: 'Pull every existing wire and pneumatic tube through the elbow before fitting the J4 belt. Tension bearings are always installed in pairs.',
    components: [
      component('elbow-main', 'Elbow body', 'ELBOW/Elbow_part.STL', 1, '40-43', 'Main elbow shell containing the J4 stepper, bearing pair, pulley, and cable passage.', ['elbow-bearing2', 'elbow-motor', 'elbow-motor-screws', 'elbow-pulley', 'elbow-belt']),
      component('elbow-limiter', 'J4 limiter', 'ELBOW/J4_limiter.STL', 2, '42', 'Sets the J4 inductive sensor position and mechanical homing relationship.', ['elbow-sensor', 'elbow-limiter-screws']),
      component('elbow-backplate', 'J4 bearing backplate', 'ELBOW/J4_bearing_backplate.STL', 3, '45', 'Retains the J4 output bearing behind the outer lid.', ['elbow-backplate-screws']),
      component('elbow-lid2', 'Elbow lid 2', 'ELBOW/Elbow_lid_2.STL', 4, '45', 'Inner elbow closure around the bearing backplate and cable exit.', ['elbow-backplate-screws']),
      component('elbow-lid1', 'Elbow lid 1', 'ELBOW/Elbow_lid_1.STL', 5, '46', 'Final outer elbow cover installed after checking friction and belt alignment.', ['elbow-lid-screws', 'elbow-tension'])
    ],
    hardware: [
      h('elbow-bearing2', 'J4 tapered bearings', 'NSK HR32906J', 2, 'bearing'),
      h('elbow-motor', 'J4 stepper motor', 'NEMA 17, 40 mm body', 1, 'motor'),
      h('elbow-motor-screws', 'J4 motor screws', 'M3 x 14 mm', 4, 'bolt'),
      h('elbow-sensor', 'J4 inductive sensor', '4 mm, NPN normally open', 1, 'sensor'),
      h('elbow-limiter-screws', 'Limiter/sensor screws', '1 x M3 x 12 mm + 1 x M3 x 8 mm', 2, 'bolt'),
      h('elbow-pulley', 'J4 motor pulley', 'HTD3M, 12 tooth, 5 mm bore', 1, 'pulley'),
      h('elbow-belt', 'J4 timing belt', 'HTD3-201, 6 mm wide', 1, 'belt'),
      h('elbow-tension', 'J4 tension bearings', '3 x 8 x 4 mm / 3 x 10 x 4 mm pair', 2, 'bearing'),
      h('elbow-tension-screws', 'Tension-bearing screws', 'M3 x 15 mm, tapered head', 2, 'bolt'),
      h('elbow-backplate-screws', 'Backplate/lid screws', '2 x M3 x 8 mm + 4 x M3 x 14 mm', 6, 'bolt'),
      h('elbow-lid-screws', 'Outer-lid screws', 'M3 x 8 mm socket head', 4, 'bolt')
    ]
  },
  link4: {
    partId: 'link4',
    label: 'J4/J5 forearm',
    manualSection: 'Forearm assembly',
    manualPages: '24-38, 93',
    buildOrder: 2,
    note: 'The manual image on page 29 shows the motor orientation incorrectly; rotate it 180 degrees so the lead exits through the indicated hole.',
    components: [
      component('forearm-main', 'J5 forearm body', 'FOREARM/J5_part.STL', 1, '25-31', 'Main wrist-pitch housing with the J5 bearing seat, motor pocket, and pneumatic passages.', ['forearm-bearing2', 'forearm-motor', 'forearm-motor-screws', 'forearm-limit', 'forearm-limit-screws', 'forearm-pneumatic']),
      component('forearm-pulley48', 'J5 48-tooth pulley', 'FOREARM/HTD3_48_J5_pulley.STL', 2, '27-28, 93', 'Printed large J5 output pulley; all J6 wires pass through its center.', ['forearm-j5-belt', 'forearm-j5-pulley']),
      component('forearm-j4-output', 'J4 output pulley', 'FOREARM/J4_output_pulley.STL', 3, '36-38', 'Bolts to the forearm body and forms the rotating output of the J4 belt stage.', ['forearm-output-screws', 'forearm-home-screw']),
      component('forearm-electronics-lid', 'J5 electronics lid', 'FOREARM/J5_electronics_lid.STL', 4, '32-34', 'Carries the M8 tool connector and closes the wiring/fitting cavity.', ['forearm-tool-connector', 'forearm-lid-screws']),
      component('forearm-belt-lid', 'J5 belt lid', 'FOREARM/J5_belt_lid.STL', 5, '93, 96', 'Closes the J5 timing-belt path after tension and end-stop checks.', ['forearm-j5-belt', 'forearm-cover-screws'])
    ],
    hardware: [
      h('forearm-bearing2', 'J5 tapered bearing', 'NSK HR32906J', 1, 'bearing'),
      h('forearm-motor', 'J5 stepper motor', 'NEMA 17, 40 mm body', 1, 'motor'),
      h('forearm-motor-screws', 'J5 motor/body screws', '4 x M3 x 25 mm + 4 x M3 x 14 mm', 8, 'bolt'),
      h('forearm-limit', 'J5 limit switch', 'ZW12-3', 1, 'switch'),
      h('forearm-limit-screws', 'J5 limit-switch screws', 'M2 x 10 mm', 2, 'bolt'),
      h('forearm-pneumatic', 'Wrist pneumatic fittings', '4 mm push-fit with supplied nuts', 2, 'pneumatic'),
      h('forearm-tool-connector', 'Electric tool connector', 'M8 female, 4 pin', 1, 'connector'),
      h('forearm-lid-screws', 'Electronics-lid screws', 'M3 x 8 mm', 4, 'bolt'),
      h('forearm-output-screws', 'J4 output-pulley screws', 'M3 x 16 mm', 6, 'bolt'),
      h('forearm-home-screw', 'J4 homing screw', 'M3 x 6 mm', 1, 'bolt'),
      h('forearm-j5-belt', 'J5 timing belt', 'HTD3-246, 6 mm wide', 1, 'belt'),
      h('forearm-j5-pulley', 'J5 motor pulley', 'HTD3M, 12 tooth, 5 mm bore', 1, 'pulley'),
      h('forearm-cover-screws', 'J5 belt-cover screws', 'M3 socket-head assortment', 4, 'bolt')
    ]
  },
  link5: {
    partId: 'link5',
    label: 'J5/J6 wrist drive',
    manualSection: 'Wrist assembly',
    manualPages: '20-23',
    buildOrder: 1,
    note: 'Build this first. The J6 motor and sensor wires must leave through the marked side opening before the wrist is joined to the forearm.',
    components: [
      component('wrist-main', 'Wrist housing', 'WRIST/wrist.STL', 1, '21-23', 'Single printed wrist shell that carries the J6 motor/gearbox, thrust bearing, and homing sensor.', ['wrist-gearbox', 'wrist-motor', 'wrist-m4', 'wrist-m3', 'wrist-sensor', 'wrist-bearing1', 'wrist-sensor-clamp'])
    ],
    hardware: [
      h('wrist-gearbox', 'J6 planetary gearbox', '10:1, NEMA 17', 1, 'gearbox'),
      h('wrist-motor', 'J6 stepper motor', 'NEMA 17, 20 mm body', 1, 'motor'),
      h('wrist-m4', 'Gearbox-to-wrist screws', 'M4 x 10 mm', 3, 'bolt'),
      h('wrist-m3', 'Motor/gearbox screws', 'M3 x 8 mm', 4, 'bolt'),
      h('wrist-sensor', 'J6 inductive sensor', 'GX-F8A flat sensor', 1, 'sensor'),
      h('wrist-bearing1', 'Wrist thrust bearing', 'AXK3552, 35 x 52 x 4 mm with washers', 1, 'bearing'),
      h('wrist-sensor-clamp', 'Optional sensor clamp', 'M3 x 14 mm + M3 nut', 1, 'nut')
    ]
  },
  link6: {
    partId: 'link6',
    label: 'Tool flange and optional printable attachments',
    manualSection: 'Pneumatic gripper',
    manualPages: '97-98',
    buildOrder: 7,
    note: 'These five repository STLs are optional end-effector adapters, not structural arm parts. Use only the attachment that matches the selected gripper.',
    components: [
      component('tool-pneumatic-holder', 'Pneumatic gripper holder', 'GRIPPER_ATTACHMENTS/Pneumatic_gripper_holder.STL', 1, '97-98', 'Standard axial mount for the MHZ2-16D pneumatic gripper.', ['tool-coupler', 'tool-coupler-screws', 'tool-home', 'tool-pneumatic-gripper', 'tool-fittings'], true),
      component('tool-vacuum-holder', 'Vacuum gripper holder', 'GRIPPER_ATTACHMENTS/vacuum_gripper_holder.STL', 2, 'Repository attachment', 'Adapter for a small vacuum pickup and pneumatic generator.', ['tool-coupler', 'tool-vacuum', 'tool-fittings'], true),
      component('tool-gripper-arms', 'Gripper arms', 'GRIPPER_ATTACHMENTS/Gripper_ARMS.STL', 3, 'Repository attachment', 'Printable fingers for the compatible gripper mechanism.', ['tool-finger-screws'], true),
      component('tool-horizontal-custom', 'Horizontal gripper custom holder', 'GRIPPER_ATTACHMENTS/Horizontal pneumatic gripper/Pneumatic_gripper_holder_custom.stl', 4, 'Repository attachment', 'Custom half of the horizontal pneumatic-gripper adapter set.', ['tool-coupler', 'tool-coupler-screws'], true),
      component('tool-horizontal-holder', 'Horizontal pneumatic gripper holder', 'GRIPPER_ATTACHMENTS/Horizontal pneumatic gripper/Pneumatic_gripper_holder_horizontal.stl', 5, 'Repository attachment', 'Horizontal mount that reorients the pneumatic gripper across the J6 axis.', ['tool-pneumatic-gripper', 'tool-fittings', 'tool-coupler-screws'], true)
    ],
    hardware: [
      h('tool-coupler', 'Tool shaft coupler', '8 mm bore, M4 flange', 1, 'coupler'),
      h('tool-coupler-screws', 'Coupler/gripper screws', 'M4 x 10 mm', 4, 'bolt'),
      h('tool-home', 'J6 homing screw', 'M3 x 14 mm', 1, 'bolt'),
      h('tool-pneumatic-gripper', 'Pneumatic gripper', 'MHZ2-16D', 1, 'tool'),
      h('tool-fittings', 'Gripper pneumatic fittings', 'PC4-M5', 2, 'pneumatic'),
      h('tool-vacuum', 'Vacuum pickup set', 'Suction cup + generator', 1, 'tool'),
      h('tool-finger-screws', 'Gripper finger screws', 'Match the selected gripper threads', 4, 'bolt')
    ]
  }
};

export const assemblyBuildOrder = (Object.values(assemblyBreakdowns) as PartAssemblyBreakdown[])
  .filter((assembly) => assembly.partId !== 'link6')
  .sort((a, b) => a.buildOrder - b.buildOrder);

export const printableComponentCount = (Object.values(assemblyBreakdowns) as PartAssemblyBreakdown[])
  .reduce((total, assembly) => total + assembly.components.length, 0);
