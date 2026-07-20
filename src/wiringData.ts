export type WiringDiagramId = 'power' | 'motion' | 'homing' | 'harness';

export interface AxisWiring {
  joint: `J${1 | 2 | 3 | 4 | 5 | 6}`;
  slot: `M${0 | 1 | 2 | 3 | 4 | 5}`;
  motor: string;
  ratedCurrent: string;
  step: string;
  direction: string;
  enable: string;
  chipSelect: string;
  stop: string;
  stopPin: string;
  homeDevice: string;
  homeCircuit: '24 V NPN + isolated conditioner' | 'NC microswitch';
  route: 'Base hole 1' | 'Base hole 2';
}

export type BoardSubsystemStatus = 'used' | 'reserved' | 'unused' | 'service';

export interface BoardSubsystem {
  id: string;
  mapColor: string;
  category: string;
  connectors: string;
  purpose: string;
  connects: string;
  robarm: string;
  status: BoardSubsystemStatus;
  caution?: string;
}

export const axisWiring: AxisWiring[] = [
  { joint: 'J1', slot: 'M0', motor: '17HS24-2104S / 60 mm', ratedCurrent: '2.1 A/phase', step: 'PF13', direction: 'PF12', enable: 'PF14 (active low)', chipSelect: 'PC4', stop: 'STOP0', stopPin: 'PG6', homeDevice: '4 mm NPN inductive', homeCircuit: '24 V NPN + isolated conditioner', route: 'Base hole 1' },
  { joint: 'J2', slot: 'M1', motor: '17HS24-2104S / 60 mm', ratedCurrent: '2.1 A/phase', step: 'PG0', direction: 'PG1', enable: 'PF15 (active low)', chipSelect: 'PD11', stop: 'STOP1', stopPin: 'PG9', homeDevice: 'ZW12 NC microswitch', homeCircuit: 'NC microswitch', route: 'Base hole 2' },
  { joint: 'J3', slot: 'M2', motor: '17HS16-2004S1 / 40 mm', ratedCurrent: '2.0 A/phase', step: 'PF11', direction: 'PG3', enable: 'PG5 (active low)', chipSelect: 'PC6', stop: 'STOP2', stopPin: 'PG10', homeDevice: 'ZW12 NC microswitch', homeCircuit: 'NC microswitch', route: 'Base hole 1' },
  { joint: 'J4', slot: 'M3', motor: '17HS16-2004S1 / 40 mm', ratedCurrent: '2.0 A/phase', step: 'PG4', direction: 'PC1', enable: 'PA2 (active low)', chipSelect: 'PC7', stop: 'STOP3', stopPin: 'PG11', homeDevice: 'GX-F8A-style NPN inductive', homeCircuit: '24 V NPN + isolated conditioner', route: 'Base hole 2' },
  { joint: 'J5', slot: 'M4', motor: '17HS16-2004S1 / 40 mm', ratedCurrent: '2.0 A/phase', step: 'PF9', direction: 'PF10', enable: 'PG2 (active low)', chipSelect: 'PF2', stop: 'STOP4', stopPin: 'PG12', homeDevice: 'ZW12 NC microswitch', homeCircuit: 'NC microswitch', route: 'Base hole 1' },
  { joint: 'J6', slot: 'M5', motor: '17HS08-1004S / 20 mm', ratedCurrent: '1.0 A/phase', step: 'PC13', direction: 'PF0', enable: 'PF1 (active low)', chipSelect: 'PE4', stop: 'STOP5', stopPin: 'PG13', homeDevice: 'M5 NPN inductive', homeCircuit: '24 V NPN + isolated conditioner', route: 'Base hole 2' }
];

export const diagramNavigation: Array<{ id: WiringDiagramId; label: string; eyebrow: string; summary: string }> = [
  { id: 'power', label: 'Power + E-stop', eyebrow: '01 / energy', summary: 'AC entry, protective earth, 24 V distribution and hardware motor isolation.' },
  { id: 'motion', label: 'Six-axis motion', eyebrow: '02 / drivers', summary: 'M0-M5 driver sockets, SPI control pins, phase order and motor assignments.' },
  { id: 'homing', label: 'Homing + I/O', eyebrow: '03 / signals', summary: 'NC switches, conditioned 24 V NPN sensors and firmware input states.' },
  { id: 'harness', label: 'Arm harness', eyebrow: '04 / routing', summary: 'One-metre joint leads, two base exits, service loops and reserved tool CAN.' }
];

export const wireLegend = [
  { label: '24 VDC+', color: '#c44f2b', code: 'RD', use: 'Motor/logic distribution after protection' },
  { label: '0 VDC', color: '#202629', code: 'BK', use: 'DC return; bond to control reference only as designed' },
  { label: 'Protective earth', color: '#769342', code: 'GN/YE', use: 'PSU PE and metal enclosure bond' },
  { label: 'Phase A+', color: '#292d30', code: 'BK', use: 'Motor output A1 to motor black' },
  { label: 'Phase A-', color: '#618454', code: 'GN', use: 'Motor output A2 to motor green' },
  { label: 'Phase B+', color: '#b44e43', code: 'RD', use: 'Motor output B1 to motor red' },
  { label: 'Phase B-', color: '#527f9e', code: 'BU', use: 'Motor output B2 to motor blue' },
  { label: 'Sensor signal', color: '#d0942f', code: 'YL', use: 'Conditioned logic input or switch signal' },
  { label: 'CAN pair', color: '#4c7693', code: 'WH/BU', use: 'Twisted pair; reserved tool bus' }
];

export const harnessGroups = [
  { exit: 'Base hole 1', motors: 'J1, J3, J5', sensors: 'J1, J2, J5', extras: 'None', note: 'Keep motor phase bundles separated from sensor conductors where the geometry allows.' },
  { exit: 'Base hole 2', motors: 'J2, J4, J6', sensors: 'J3, J4, J6', extras: 'CAN pair + pneumatic tubes', note: 'The CAN pair must stay twisted through the moving harness and into the tool connector.' }
];

export const wiringChecks = [
  'Verify the received board is Octopus Pro V1.1 with the STM32H723 before using this pin schedule.',
  'With all power removed, set M0-M5 driver-voltage jumpers to MOTOR_POWER and install the SPI-mode jumpers.',
  'Identify every motor phase pair with a multimeter; never trust extension-cable colours without a continuity check.',
  'Measure each conditioned sensor output before connecting a STOP header: the MCU signal must remain within the board logic range.',
  'Prove the E-stop drops the motor contactor while the controller remains powered and reports the safety-open state.',
  'Home one unloaded axis at reduced current and speed before connecting the remaining five motors.'
];

export const wiringSources = [
  { label: 'PAROL6 assembly manual', detail: 'Harness lengths, base-hole routing, sensor allocation and stock connector practice', url: 'https://github.com/Source-Robotics/PAROL6-Desktop-robot-arm/blob/main/Building%20instructions/Parol%20building%20instructions.pdf' },
  { label: 'Octopus Pro V1.1 pin map', detail: 'Board connectors, STOP inputs, SPI bus and fan voltage headers', url: 'https://github.com/bigtreetech/BIGTREETECH-OCTOPUS-Pro/blob/master/Hardware/BIGTREETECH%20Octopus%20Pro%20V1.1-Pin.jpg' },
  { label: 'BIGTREETECH Octopus Pro manual', detail: 'Power domains, SPI jumper mode, motor-voltage selection and protected probe input', url: 'https://github.com/bigtreetech/BIGTREETECH-OCTOPUS-Pro/blob/master/BTT_Octopus_pro_EN.pdf' },
  { label: 'Klipper V1.1 reference pin map', detail: 'Independent cross-check of step, direction, enable, chip-select and endstop MCU pins', url: 'https://github.com/Klipper3d/klipper/blob/master/config/generic-bigtreetech-octopus-pro-v1.1.cfg' },
  { label: 'StepperOnline motor specifications', detail: 'Phase colour order and rated phase current for the selected NEMA 17 motors', url: 'https://www.omc-stepperonline.com/nema-17-bipolar-45ncm-64oz-in-2a-42x42x40mm-4-wires-w-1m-cable-connector-17hs16-2004s1' }
];

export const boardSubsystems: BoardSubsystem[] = [
  {
    id: 'power-domains',
    mapColor: '#df2029',
    category: 'Power domains',
    connectors: 'MOTOR_POWER / POWER / BED_POWER / BED_OUT',
    purpose: 'Brings DC energy onto the board and separates the controller supply, high-voltage driver supply and heated-bed circuit.',
    connects: 'Fused 24 VDC supply, motor contactor output and heavy-gauge DC returns.',
    robarm: 'POWER remains energized for logic. MOTOR_POWER is switched by K1. BED_POWER and BED_OUT are not used.',
    status: 'used',
    caution: 'These screw terminals are not interchangeable. Verify polarity and the selected driver-voltage jumper before energizing.'
  },
  {
    id: 'motor-outputs',
    mapColor: '#a348a7',
    category: 'Motor phase outputs',
    connectors: 'M0-M7 / A1 A2 B2 B1',
    purpose: 'Carries the two bipolar stepper-motor phase pairs from each plug-in driver to a motor.',
    connects: 'One four-conductor motor cable per socket.',
    robarm: 'M0-M5 drive J1-J6. M6 and M7 remain empty and available for future tooling.',
    status: 'used',
    caution: 'Identify both coil pairs with a multimeter. A colour mismatch can produce vibration, reverse motion or no torque.'
  },
  {
    id: 'driver-sockets',
    mapColor: '#20a8d2',
    category: 'Driver sockets + SPI jumpers',
    connectors: 'M0-M7 driver sockets / PA5 PA6 PA7 / CS',
    purpose: 'Holds the TMC5160 modules and routes shared SPI plus a separate chip-select signal to each driver.',
    connects: 'Six TMC5160 Pro modules installed in M0-M5 with SPI-mode jumpers fitted.',
    robarm: 'Used for all six robot axes; the firmware pin schedule is listed on the motion sheet.',
    status: 'used',
    caution: 'Match module orientation exactly. Never insert or remove a driver while any board power is present.'
  },
  {
    id: 'driver-control',
    mapColor: '#ef7b23',
    category: 'STEP / DIR / ENABLE control',
    connectors: 'M0DIAG-M7DIAG / STEP / DIR / EN / CS pins',
    purpose: 'Carries internal MCU timing and direction signals to each driver channel.',
    connects: 'No external harness connection; these are board traces and firmware pin assignments.',
    robarm: 'M0-M5 are configured as J1-J6. Use the six-axis pin table rather than adding jumper wires.',
    status: 'used'
  },
  {
    id: 'stop-inputs',
    mapColor: '#ef7b23',
    category: 'Endstop inputs',
    connectors: 'STOP0-STOP7 / SIG 5V GND',
    purpose: 'Reads homing switches, conditioned proximity sensors and safety-state feedback.',
    connects: 'Dry NC microswitches or isolated logic-conditioner outputs to SIG and GND.',
    robarm: 'STOP0-STOP5 read J1-J6 homes. STOP7 reads the K1 auxiliary contact. STOP6 is spare.',
    status: 'used',
    caution: 'Do not connect a raw 24 V sensor output to STOP0-STOP7. The 5 V header pin is unused for ROBARM homing.'
  },
  {
    id: 'fan-outputs',
    mapColor: '#416db7',
    category: 'Fan outputs',
    connectors: 'FAN0-FAN7 / VF0-VF7 / VFAN selector',
    purpose: 'Provides eight firmware-controlled fan outputs with a selectable fan supply voltage.',
    connects: 'Two-wire or controlled fan loads sized within the board output rating.',
    robarm: 'FAN0 powers the 5 V Noctua controller fan. FAN1-FAN7 are currently unused.',
    status: 'used',
    caution: 'Set the VFAN selector to 5 V before connecting the Noctua fan; the wrong selection can destroy it.'
  },
  {
    id: 'heater-outputs',
    mapColor: '#df2029',
    category: 'Heater outputs',
    connectors: 'HE0-HE3 / BED_OUT',
    purpose: 'Switches high-current heater loads in the board\'s original 3D-printer application.',
    connects: 'Printer heaters or other qualified resistive loads only.',
    robarm: 'Not used. ROBARM motors must never be powered from a heater output.',
    status: 'unused',
    caution: 'These outputs can switch substantial current and may energize unexpectedly if firmware is configured incorrectly.'
  },
  {
    id: 'temperature-inputs',
    mapColor: '#6f1e24',
    category: 'Temperature inputs',
    connectors: 'TB / T0 / T1 / T2 / T3',
    purpose: 'Measures low-voltage thermistor signals for bed and hot-end temperature channels.',
    connects: 'Passive thermistors referenced to board ground.',
    robarm: 'Not used in the current controller enclosure.',
    status: 'unused',
    caution: 'These are analog sensor inputs, not general-purpose 5 V or 24 V inputs.'
  },
  {
    id: 'probe-control',
    mapColor: '#e58bb5',
    category: 'Probe + power control',
    connectors: 'PROBE / PS-ON / POWER-DET',
    purpose: 'Supports a printer probe, optional PSU control and external power-loss detection.',
    connects: 'Qualified probe circuitry, a PSU-control interface or a logic-level power detector.',
    robarm: 'Not used; the six home devices use dedicated STOP inputs and the E-stop operates through K1 hardware.',
    status: 'unused',
    caution: 'Do not substitute these headers for the hardware E-stop circuit.'
  },
  {
    id: 'can-bus',
    mapColor: '#e8cf20',
    category: 'CAN bus',
    connectors: 'CAN H / CAN L / 120R termination',
    purpose: 'Provides a differential communications link for a remote tool or expansion node.',
    connects: 'A twisted CAN-H/CAN-L pair plus a shared reference and separately protected node power as required.',
    robarm: 'Reserved for a future wrist tool board and routed through base hole 2.',
    status: 'reserved',
    caution: 'Fit the 120-ohm terminator only when this board is physically at one end of the CAN bus.'
  },
  {
    id: 'usb-serial',
    mapColor: '#ef7b23',
    category: 'USB + serial host links',
    connectors: 'USB-C / USB-A / TFT UART / Raspberry Pi header',
    purpose: 'Connects the controller MCU to a host computer or serial display and exposes auxiliary host interfaces.',
    connects: 'ROBARM host computer by USB; optional serial or SBC wiring only when deliberately configured.',
    robarm: 'USB is the primary controller link. TFT, USB host and Raspberry Pi headers are unused.',
    status: 'used',
    caution: 'Avoid powering the board from multiple 5 V sources unless the power path has been explicitly reviewed.'
  },
  {
    id: 'storage-display',
    mapColor: '#69b84c',
    category: 'Storage + display expansion',
    connectors: 'microSD / EXP1 / EXP2',
    purpose: 'Stores firmware update files and supports legacy printer-display modules.',
    connects: 'A microSD card for service; compatible display ribbon cables only if their pinout is verified.',
    robarm: 'microSD is used for firmware service. EXP1 and EXP2 remain disconnected.',
    status: 'service',
    caution: 'EXP headers share signals with other functions; an attached display can conflict with SPI peripherals.'
  },
  {
    id: 'low-speed-expansion',
    mapColor: '#d5d926',
    category: 'I2C + RGB expansion',
    connectors: 'I2C SCL/SDA / RGB',
    purpose: 'Provides low-speed peripheral communication and an addressable-light output.',
    connects: 'Compatible 3.3 V/5 V I2C peripherals or a supported RGB device.',
    robarm: 'Not used in revision A.',
    status: 'unused',
    caution: 'Verify voltage levels and pull-ups before attaching any I2C module.'
  },
  {
    id: 'rtd-interface',
    mapColor: '#78bd36',
    category: 'MAX31865 RTD interface',
    connectors: 'FORCE-P / RTDIN-P / RTDIN-N / FORCE-N / SPI',
    purpose: 'Interfaces a PT100 or PT1000 resistance-temperature detector through the MAX31865 circuit.',
    connects: 'A correctly configured two-wire or four-wire RTD sensor.',
    robarm: 'Not used.',
    status: 'unused'
  },
  {
    id: 'service-controls',
    mapColor: '#8b623f',
    category: 'Boot + debug controls',
    connectors: 'BOOT0 / RESET / SWD',
    purpose: 'Forces bootloader mode, resets the MCU and exposes low-level programming/debug signals.',
    connects: 'Service tools only; normally nothing remains connected during operation.',
    robarm: 'Used only for firmware recovery or engineering diagnostics.',
    status: 'service',
    caution: 'Do not operate BOOT0 or attach a debugger while the robot is moving.'
  }
];
