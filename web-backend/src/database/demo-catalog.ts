import { ResourceStatus } from '../resources/enums/resource-status.enum';
import { ResourceType } from '../resources/enums/resource-type.enum';

/*
 * Demo resource catalog imported by `npm run catalog:import`.
 *
 * All buildings and resources are fictional demo data for USTH Campus
 * Resource Booking; names and addresses do not describe real facilities.
 * Weekdays use the campus convention where Sunday is 0 and Saturday is 6.
 */

export interface CatalogBuilding {
  code: string;
  name: string;
  address: string;
}

export interface CatalogClosure {
  /** Days after "today" in Asia/Ho_Chi_Minh; moved to the next operating day. */
  dayOffset: number;
  reason: string;
}

export interface CatalogResource {
  code: string;
  name: string;
  description: string | null;
  type: ResourceType;
  status: ResourceStatus;
  capacity: number;
  location: string;
  amenities: readonly string[];
  requiresApproval: boolean;
  operatingDays: readonly number[];
  opensAt: string;
  closesAt: string;
  buildingCode: string;
  closures?: readonly CatalogClosure[];
}

export interface Catalog {
  buildings: readonly CatalogBuilding[];
  resources: readonly CatalogResource[];
}

const WEEKDAYS = [1, 2, 3, 4, 5];
const MON_SAT = [1, 2, 3, 4, 5, 6];
const ALL_WEEK = [0, 1, 2, 3, 4, 5, 6];
const WEEKEND = [0, 6];
const TUE_THU = [2, 4];
const MON_WED_FRI = [1, 3, 5];
const FRI_SAT = [5, 6];

const { ROOM, LABORATORY, EQUIPMENT } = ResourceType;
const { ACTIVE, MAINTENANCE, INACTIVE } = ResourceStatus;

export const DEMO_CATALOG: Catalog = {
  buildings: [
    {
      code: 'LHC',
      name: 'Lecture Hall Complex',
      address: 'Lecture Hall Complex, USTH Campus, Hanoi',
    },
    {
      code: 'LCM',
      name: 'Learning Commons',
      address: 'Learning Commons, USTH Campus, Hanoi',
    },
    {
      code: 'SIC',
      name: 'Science and Innovation Centre',
      address: 'Science and Innovation Centre, USTH Campus, Hanoi',
    },
    {
      code: 'EWB',
      name: 'Engineering Workshop Block',
      address: 'Engineering Workshop Block, USTH Campus, Hanoi',
    },
    {
      code: 'SEO',
      name: 'Space and Earth Observation Centre',
      address: 'Space and Earth Observation Centre, USTH Campus, Hanoi',
    },
    {
      code: 'SMH',
      name: 'Student Media and Equipment Hub',
      address: 'Student Media and Equipment Hub, USTH Campus, Hanoi',
    },
  ],
  resources: [
    // Lecture Hall Complex: large teaching and event rooms.
    {
      code: 'LHC-AUD',
      name: 'Grand Auditorium',
      description:
        'Tiered auditorium for conferences, guest lectures, and ceremonies. Bookings are reviewed by campus operations.',
      type: ROOM,
      status: ACTIVE,
      capacity: 450,
      location: 'Ground floor, main entrance',
      amenities: [
        'stage-lighting',
        'dual-projectors',
        'wireless-microphones',
        'lecture-capture',
        'hearing-loop',
        'wheelchair-seating',
      ],
      requiresApproval: true,
      operatingDays: MON_SAT,
      opensAt: '07:00',
      closesAt: '22:00',
      buildingCode: 'LHC',
      closures: [{ dayOffset: 14, reason: 'Graduation ceremony rehearsal' }],
    },
    {
      code: 'LHC-H101',
      name: 'Lecture Hall H101',
      description: 'Tiered lecture hall with a lectern and document camera.',
      type: ROOM,
      status: ACTIVE,
      capacity: 220,
      location: 'First floor, east wing',
      amenities: [
        'projector',
        'pa-system',
        'document-camera',
        'tiered-seating',
      ],
      requiresApproval: false,
      operatingDays: WEEKDAYS,
      opensAt: '07:00',
      closesAt: '19:00',
      buildingCode: 'LHC',
      closures: [{ dayOffset: 10, reason: 'Mid-term examination period' }],
    },
    {
      code: 'LHC-H102',
      name: 'Lecture Hall H102',
      description:
        'Mid-sized lecture hall used for evening courses and review sessions.',
      type: ROOM,
      status: ACTIVE,
      capacity: 160,
      location: 'First floor, west wing',
      amenities: ['projector', 'pa-system', 'lecture-capture'],
      requiresApproval: false,
      operatingDays: MON_SAT,
      opensAt: '07:00',
      closesAt: '21:00',
      buildingCode: 'LHC',
      closures: [{ dayOffset: 11, reason: 'Mid-term examination period' }],
    },
    {
      code: 'LHC-C201',
      name: 'Classroom C201',
      description: 'Flexible classroom with movable desks for group work.',
      type: ROOM,
      status: ACTIVE,
      capacity: 48,
      location: 'Second floor',
      amenities: ['whiteboard', 'projector', 'movable-desks'],
      requiresApproval: false,
      operatingDays: WEEKDAYS,
      opensAt: '08:00',
      closesAt: '18:00',
      buildingCode: 'LHC',
    },
    {
      code: 'LHC-C202',
      name: 'Classroom C202',
      description:
        'Standard classroom. Temporarily unavailable while the air-conditioning is replaced.',
      type: ROOM,
      status: MAINTENANCE,
      capacity: 40,
      location: 'Second floor',
      amenities: ['whiteboard', 'projector'],
      requiresApproval: false,
      operatingDays: WEEKDAYS,
      opensAt: '08:00',
      closesAt: '18:00',
      buildingCode: 'LHC',
    },
    {
      code: 'LHC-C203',
      name: 'Language Practice Classroom C203',
      description:
        'Afternoon-only classroom with headsets for language and pronunciation practice.',
      type: ROOM,
      status: ACTIVE,
      capacity: 30,
      location: 'Second floor',
      amenities: ['headsets', 'audio-console', 'whiteboard'],
      requiresApproval: false,
      operatingDays: MON_SAT,
      opensAt: '13:00',
      closesAt: '17:00',
      buildingCode: 'LHC',
    },
    {
      code: 'LHC-S301',
      name: 'Seminar Room S301',
      description: 'Round-table seminar room with hybrid meeting equipment.',
      type: ROOM,
      status: ACTIVE,
      capacity: 24,
      location: 'Third floor',
      amenities: ['round-table', 'smart-display', 'video-conferencing'],
      requiresApproval: false,
      operatingDays: MON_SAT,
      opensAt: '08:00',
      closesAt: '20:00',
      buildingCode: 'LHC',
    },
    {
      code: 'LHC-ATRIUM',
      name: 'Atrium Multipurpose Event Space',
      description:
        'Open atrium for exhibitions, club fairs, and receptions. Layout and catering requests are confirmed during approval.',
      type: ROOM,
      status: ACTIVE,
      capacity: 250,
      location: 'Ground floor atrium',
      amenities: [
        'modular-staging',
        'pa-system',
        'led-wall',
        'catering-area',
        'flexible-seating',
      ],
      requiresApproval: true,
      operatingDays: ALL_WEEK,
      opensAt: '08:00',
      closesAt: '23:00',
      buildingCode: 'LHC',
    },

    // Learning Commons: small study, meeting, and quiet spaces.
    {
      code: 'LCM-G01',
      name: 'Group Study Room G01',
      description: 'Late-opening group study room close to the library desk.',
      type: ROOM,
      status: ACTIVE,
      capacity: 6,
      location: 'Ground floor, library side',
      amenities: ['whiteboard', 'display'],
      requiresApproval: false,
      operatingDays: ALL_WEEK,
      opensAt: '07:00',
      closesAt: '23:00',
      buildingCode: 'LCM',
      closures: [{ dayOffset: 3, reason: 'Deep cleaning of carpets' }],
    },
    {
      code: 'LCM-G02',
      name: 'Group Study Room G02',
      description: 'Compact study room for pairs and small project teams.',
      type: ROOM,
      status: ACTIVE,
      capacity: 4,
      location: 'Ground floor, library side',
      amenities: ['whiteboard'],
      requiresApproval: false,
      operatingDays: ALL_WEEK,
      opensAt: '07:00',
      closesAt: '22:00',
      buildingCode: 'LCM',
    },
    {
      code: 'LCM-G03',
      name: 'Group Study Room G03',
      description: null,
      type: ROOM,
      status: ACTIVE,
      capacity: 8,
      location: 'First floor',
      amenities: [],
      requiresApproval: false,
      operatingDays: MON_SAT,
      opensAt: '07:00',
      closesAt: '22:00',
      buildingCode: 'LCM',
    },
    {
      code: 'LCM-POD1',
      name: 'Quiet Study Pod 1',
      description:
        'Enclosed single-person pod for focused study or online interviews.',
      type: ROOM,
      status: ACTIVE,
      capacity: 1,
      location: 'Second floor, silent zone',
      amenities: ['desk-lamp', 'power-outlet', 'noise-dampening'],
      requiresApproval: false,
      operatingDays: ALL_WEEK,
      opensAt: '06:00',
      closesAt: '23:00',
      buildingCode: 'LCM',
    },
    {
      code: 'LCM-POD2',
      name: 'Quiet Study Pod 2',
      description:
        'Single-person pod retired from service pending replacement.',
      type: ROOM,
      status: INACTIVE,
      capacity: 1,
      location: 'Second floor, silent zone',
      amenities: ['desk-lamp', 'power-outlet'],
      requiresApproval: false,
      operatingDays: ALL_WEEK,
      opensAt: '06:00',
      closesAt: '23:00',
      buildingCode: 'LCM',
    },
    {
      code: 'LCM-M01',
      name: 'Meeting Room M01',
      description:
        'Meeting room for student clubs and project reviews. Requests are approved by Learning Commons staff.',
      type: ROOM,
      status: ACTIVE,
      capacity: 12,
      location: 'First floor',
      amenities: ['conference-phone', 'smart-display', 'whiteboard'],
      requiresApproval: true,
      operatingDays: WEEKDAYS,
      opensAt: '08:00',
      closesAt: '17:00',
      buildingCode: 'LCM',
    },
    {
      code: 'LCM-REC',
      name: 'Recording Booth',
      description:
        'Acoustically treated booth for podcasts and voice-overs, open to students on weekends.',
      type: ROOM,
      status: ACTIVE,
      capacity: 3,
      location: 'Basement, media corridor',
      amenities: [
        'condenser-microphones',
        'audio-interface',
        'acoustic-panels',
      ],
      requiresApproval: true,
      operatingDays: WEEKEND,
      opensAt: '09:00',
      closesAt: '18:00',
      buildingCode: 'LCM',
    },

    // Science and Innovation Centre: wet and physical science laboratories.
    {
      code: 'SIC-CHEM1',
      name: 'General Chemistry Laboratory',
      description:
        'Teaching laboratory for practical chemistry sessions. Lab coat and goggles required.',
      type: LABORATORY,
      status: ACTIVE,
      capacity: 30,
      location: 'First floor, room 110',
      amenities: [
        'fume-hoods',
        'safety-shower',
        'eyewash-station',
        'analytical-balances',
      ],
      requiresApproval: true,
      operatingDays: WEEKDAYS,
      opensAt: '08:00',
      closesAt: '17:00',
      buildingCode: 'SIC',
      closures: [
        { dayOffset: 7, reason: 'Annual fume hood safety inspection' },
      ],
    },
    {
      code: 'SIC-BIO1',
      name: 'Molecular Biology Laboratory',
      description:
        'Supervised laboratory for DNA extraction, PCR, and electrophoresis.',
      type: LABORATORY,
      status: ACTIVE,
      capacity: 20,
      location: 'Second floor, room 205',
      amenities: [
        'biosafety-cabinet',
        'pcr-thermocycler',
        'centrifuge',
        'ultra-low-freezer',
      ],
      requiresApproval: true,
      operatingDays: WEEKDAYS,
      opensAt: '07:00',
      closesAt: '18:00',
      buildingCode: 'SIC',
    },
    {
      code: 'SIC-MICRO',
      name: 'Microbiology Laboratory',
      description:
        'Containment laboratory for culture work. Closed while biosafety cabinets are recertified.',
      type: LABORATORY,
      status: MAINTENANCE,
      capacity: 16,
      location: 'Second floor, room 212',
      amenities: ['biosafety-cabinet', 'autoclave', 'incubators'],
      requiresApproval: true,
      operatingDays: WEEKDAYS,
      opensAt: '08:00',
      closesAt: '17:00',
      buildingCode: 'SIC',
    },
    {
      code: 'SIC-PHYS',
      name: 'Physics and Optics Laboratory',
      description:
        'Optics benches and a darkroom for interference and spectroscopy experiments.',
      type: LABORATORY,
      status: ACTIVE,
      capacity: 24,
      location: 'Third floor, room 301',
      amenities: ['optical-tables', 'laser-safety-eyewear', 'darkroom'],
      requiresApproval: true,
      operatingDays: MON_WED_FRI,
      opensAt: '08:00',
      closesAt: '17:00',
      buildingCode: 'SIC',
    },
    {
      code: 'SIC-PHARM',
      name: 'Pharmacology Laboratory',
      description:
        'Morning-only sessions for formulation and dissolution practicals.',
      type: LABORATORY,
      status: ACTIVE,
      capacity: 18,
      location: 'Third floor, room 315',
      amenities: ['hplc-system', 'dissolution-tester', 'laminar-flow-hood'],
      requiresApproval: true,
      operatingDays: TUE_THU,
      opensAt: '08:00',
      closesAt: '12:00',
      buildingCode: 'SIC',
    },
    {
      code: 'SIC-MAT',
      name: 'Materials Characterisation Laboratory',
      description:
        'Sample preparation and mechanical testing for materials science projects.',
      type: LABORATORY,
      status: ACTIVE,
      capacity: 12,
      location: 'Ground floor, room 020',
      amenities: ['tensile-tester', 'polishing-station', 'hardness-tester'],
      requiresApproval: true,
      operatingDays: WEEKDAYS,
      opensAt: '09:00',
      closesAt: '17:00',
      buildingCode: 'SIC',
    },
    {
      code: 'SIC-ENV',
      name: 'Environmental and Water Quality Laboratory',
      description:
        'Water sampling and analysis laboratory with Saturday access for field campaigns.',
      type: LABORATORY,
      status: ACTIVE,
      capacity: 16,
      location: 'Ground floor, room 030',
      amenities: [
        'water-sampling-kits',
        'ph-meters',
        'turbidity-meters',
        'field-coolers',
      ],
      requiresApproval: true,
      operatingDays: MON_SAT,
      opensAt: '07:00',
      closesAt: '16:00',
      buildingCode: 'SIC',
    },
    {
      code: 'SIC-ENERGY',
      name: 'Renewable Energy Laboratory',
      description:
        'Photovoltaic and battery testing benches for energy engineering courses.',
      type: LABORATORY,
      status: ACTIVE,
      capacity: 20,
      location: 'Fourth floor, room 402',
      amenities: ['solar-simulator', 'battery-test-bench', 'power-analyzers'],
      requiresApproval: true,
      operatingDays: WEEKDAYS,
      opensAt: '08:00',
      closesAt: '18:00',
      buildingCode: 'SIC',
    },
    {
      code: 'SIC-MICROSCOPE-01',
      name: 'Fluorescence Microscope',
      description:
        'Research-grade fluorescence microscope. Training sign-off required before first use.',
      type: EQUIPMENT,
      status: ACTIVE,
      capacity: 1,
      location: 'Imaging room 214',
      amenities: ['camera-module', 'image-analysis-software'],
      requiresApproval: true,
      operatingDays: WEEKDAYS,
      opensAt: '09:00',
      closesAt: '17:00',
      buildingCode: 'SIC',
    },
    {
      code: 'SIC-SPEC-01',
      name: 'UV-Vis Spectrophotometer',
      description: 'Benchtop spectrophotometer for absorbance measurements.',
      type: EQUIPMENT,
      status: ACTIVE,
      capacity: 1,
      location: 'Instrument room 118',
      amenities: ['quartz-cuvettes', 'analysis-software'],
      requiresApproval: true,
      operatingDays: MON_SAT,
      opensAt: '08:00',
      closesAt: '17:00',
      buildingCode: 'SIC',
    },

    // Engineering Workshop Block: computing, electronics, and fabrication.
    {
      code: 'EWB-CL1',
      name: 'Computer Laboratory CL1',
      description:
        'Open-access computer laboratory with programming and data science software.',
      type: LABORATORY,
      status: ACTIVE,
      capacity: 60,
      location: 'Ground floor',
      amenities: ['workstations', 'dual-monitors', 'projector', 'printing'],
      requiresApproval: false,
      operatingDays: ALL_WEEK,
      opensAt: '07:00',
      closesAt: '23:00',
      buildingCode: 'EWB',
      closures: [
        { dayOffset: 5, reason: 'Software image update and deep cleaning' },
      ],
    },
    {
      code: 'EWB-CL2',
      name: 'Computer Laboratory CL2',
      description: 'Linux teaching laboratory for systems and networking.',
      type: LABORATORY,
      status: ACTIVE,
      capacity: 40,
      location: 'First floor',
      amenities: ['workstations', 'linux-images', 'network-rack', 'projector'],
      requiresApproval: false,
      operatingDays: MON_SAT,
      opensAt: '08:00',
      closesAt: '20:00',
      buildingCode: 'EWB',
    },
    {
      code: 'EWB-ELEC',
      name: 'Electronics Laboratory',
      description: 'Circuit prototyping benches with soldering and test gear.',
      type: LABORATORY,
      status: ACTIVE,
      capacity: 28,
      location: 'Second floor',
      amenities: [
        'soldering-stations',
        'bench-power-supplies',
        'function-generators',
        'esd-mats',
      ],
      requiresApproval: true,
      operatingDays: WEEKDAYS,
      opensAt: '08:00',
      closesAt: '18:00',
      buildingCode: 'EWB',
    },
    {
      code: 'EWB-ROBO',
      name: 'Robotics and Automation Laboratory',
      description:
        'Robot arms and a fenced test arena for automation and control projects.',
      type: LABORATORY,
      status: ACTIVE,
      capacity: 15,
      location: 'Ground floor, high bay',
      amenities: ['robot-arms', 'motion-capture', 'test-arena'],
      requiresApproval: true,
      operatingDays: MON_SAT,
      opensAt: '09:00',
      closesAt: '21:00',
      buildingCode: 'EWB',
    },
    {
      code: 'EWB-MAKER',
      name: 'Maker Space',
      description:
        'Open fabrication space with hand tools and laser cutting for student projects.',
      type: LABORATORY,
      status: ACTIVE,
      capacity: 20,
      location: 'Ground floor, workshop',
      amenities: ['laser-cutter', 'hand-tools', 'workbenches'],
      requiresApproval: false,
      operatingDays: ALL_WEEK,
      opensAt: '10:00',
      closesAt: '22:00',
      buildingCode: 'EWB',
    },
    {
      code: 'EWB-3DP-01',
      name: 'Resin 3D Printer',
      description:
        'High-detail resin printer. Staff review print files before approval.',
      type: EQUIPMENT,
      status: ACTIVE,
      capacity: 1,
      location: 'Maker Space fabrication bay',
      amenities: ['wash-station', 'uv-curing-unit'],
      requiresApproval: true,
      operatingDays: ALL_WEEK,
      opensAt: '08:00',
      closesAt: '22:00',
      buildingCode: 'EWB',
    },
    {
      code: 'EWB-OSC-01',
      name: 'Digital Oscilloscope',
      description: 'Four-channel oscilloscope available for bench loans.',
      type: EQUIPMENT,
      status: ACTIVE,
      capacity: 1,
      location: 'Electronics Laboratory store',
      amenities: ['passive-probes', 'usb-logging'],
      requiresApproval: false,
      operatingDays: WEEKDAYS,
      opensAt: '08:00',
      closesAt: '18:00',
      buildingCode: 'EWB',
    },

    // Space and Earth Observation Centre.
    {
      code: 'SEO-RS',
      name: 'Remote Sensing Laboratory',
      description:
        'GIS workstations for satellite image processing and mapping projects.',
      type: LABORATORY,
      status: ACTIVE,
      capacity: 22,
      location: 'First floor',
      amenities: [
        'gis-workstations',
        'satellite-data-access',
        'large-format-display',
      ],
      requiresApproval: true,
      operatingDays: WEEKDAYS,
      opensAt: '08:00',
      closesAt: '17:00',
      buildingCode: 'SEO',
    },
    {
      code: 'SEO-GS',
      name: 'Ground Station Control Room',
      description:
        'Control room for tracking satellite passes, available around the clock by approval.',
      type: LABORATORY,
      status: ACTIVE,
      capacity: 8,
      location: 'Rooftop level',
      amenities: ['tracking-antenna', 'sdr-receivers', 'telemetry-consoles'],
      requiresApproval: true,
      operatingDays: ALL_WEEK,
      opensAt: '00:00',
      closesAt: '23:00',
      buildingCode: 'SEO',
      closures: [{ dayOffset: 21, reason: 'Antenna calibration' }],
    },
    {
      code: 'SEO-CLEAN',
      name: 'CubeSat Integration Cleanroom',
      description:
        'Cleanroom for small-satellite assembly. Gowning briefing required.',
      type: LABORATORY,
      status: ACTIVE,
      capacity: 6,
      location: 'Ground floor, integration hall',
      amenities: ['iso-7-cleanroom', 'esd-protection', 'thermal-chamber'],
      requiresApproval: true,
      operatingDays: TUE_THU,
      opensAt: '09:00',
      closesAt: '16:00',
      buildingCode: 'SEO',
    },
    {
      code: 'SEO-OBS',
      name: 'Rooftop Observatory Deck',
      description:
        'Evening observing sessions for astronomy courses and clubs, weather permitting.',
      type: LABORATORY,
      status: ACTIVE,
      capacity: 10,
      location: 'Roof terrace',
      amenities: ['telescope-mounts', 'red-light-kit'],
      requiresApproval: true,
      operatingDays: FRI_SAT,
      opensAt: '18:00',
      closesAt: '23:00',
      buildingCode: 'SEO',
    },

    // Student Media and Equipment Hub: loanable equipment.
    {
      code: 'SMH-PROJ-4K',
      name: 'Portable 4K Projector',
      description: 'Compact projector for presentations outside lecture halls.',
      type: EQUIPMENT,
      status: ACTIVE,
      capacity: 1,
      location: 'Equipment loan desk',
      amenities: ['hdmi-cable', 'usb-c-adapter', 'carry-case'],
      requiresApproval: false,
      operatingDays: WEEKDAYS,
      opensAt: '08:00',
      closesAt: '18:00',
      buildingCode: 'SMH',
    },
    {
      code: 'SMH-CAM-01',
      name: 'Mirrorless Camera Kit',
      description: 'Camera kit for photo and video coursework.',
      type: EQUIPMENT,
      status: ACTIVE,
      capacity: 1,
      location: 'Equipment loan desk',
      amenities: ['zoom-lens', 'tripod', 'spare-batteries', 'sd-cards'],
      requiresApproval: true,
      operatingDays: MON_SAT,
      opensAt: '08:00',
      closesAt: '20:00',
      buildingCode: 'SMH',
    },
    {
      code: 'SMH-DRONE-01',
      name: 'Survey Drone',
      description:
        'Mapping drone for supervised field surveys. A trained pilot must attend each flight.',
      type: EQUIPMENT,
      status: ACTIVE,
      capacity: 1,
      location: 'Secure equipment cage',
      amenities: ['rtk-module', 'spare-propellers', 'flight-case'],
      requiresApproval: true,
      operatingDays: WEEKDAYS,
      opensAt: '08:00',
      closesAt: '16:00',
      buildingCode: 'SMH',
      closures: [
        { dayOffset: 4, reason: 'Firmware update and airworthiness check' },
      ],
    },
    {
      code: 'SMH-VR-SET',
      name: 'VR Headset Set',
      description: 'Set of six standalone VR headsets for immersive teaching.',
      type: EQUIPMENT,
      status: ACTIVE,
      capacity: 6,
      location: 'Equipment loan desk',
      amenities: ['six-headsets', 'charging-case', 'hygiene-covers'],
      requiresApproval: true,
      operatingDays: MON_SAT,
      opensAt: '09:00',
      closesAt: '19:00',
      buildingCode: 'SMH',
    },
    {
      code: 'SMH-LAPTOP-CART',
      name: 'Laptop Cart',
      description:
        'Mobile cart of thirty laptops for in-class assessments and workshops.',
      type: EQUIPMENT,
      status: ACTIVE,
      capacity: 30,
      location: 'Equipment store, ground floor',
      amenities: ['thirty-laptops', 'charging-cart', 'preconfigured-wifi'],
      requiresApproval: false,
      operatingDays: WEEKDAYS,
      opensAt: '07:00',
      closesAt: '18:00',
      buildingCode: 'SMH',
    },
    {
      code: 'SMH-PA-01',
      name: 'Portable PA System',
      description: 'Battery-powered speaker set for outdoor and club events.',
      type: EQUIPMENT,
      status: ACTIVE,
      capacity: 1,
      location: 'Equipment loan desk',
      amenities: ['wireless-microphones', 'speaker-stands', 'mixer'],
      requiresApproval: false,
      operatingDays: ALL_WEEK,
      opensAt: '07:00',
      closesAt: '23:00',
      buildingCode: 'SMH',
    },
  ],
};

/** Codes that belong to migrations or the `demo:seed` script. */
export const RESERVED_BUILDING_CODES: readonly string[] = [
  'MAIN',
  'LAB',
  'DEMO',
];
export const RESERVED_RESOURCE_CODES: readonly string[] = [
  'ROOM-A101',
  'ROOM-A102',
  'LAB-L201',
  'EQUIP-PROJ-01',
];
const RESERVED_RESOURCE_PREFIX = 'DEMO-';

// Mirrors CreateResourceDto and the resources/buildings schema constraints.
const CODE_PATTERN = /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/;
const HOUR_PATTERN = /^(?:[01]\d|2[0-3]):00$/;
// Lowercase kebab-case keeps amenities trimmed, lowercased (as the DTO
// normalizes them), and comma-free (the admin form splits on commas).
const AMENITY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_AMENITIES = 20;
const MAX_CLOSURE_OFFSET_DAYS = 365;

function hasText(value: unknown, min: number, max: number): boolean {
  return (
    typeof value === 'string' &&
    !value.includes('\0') &&
    value === value.trim() &&
    value.length >= min &&
    value.length <= max
  );
}

/**
 * Returns human-readable problems with the catalog; an empty array means the
 * catalog satisfies the DTO rules and database constraints.
 */
export function validateCatalog(catalog: Catalog): string[] {
  const errors: string[] = [];
  const buildingCodes = new Set<string>();

  for (const building of catalog.buildings) {
    const label = `building ${building.code}`;
    if (!hasText(building.code, 2, 20) || !CODE_PATTERN.test(building.code)) {
      errors.push(`${label}: code must be 2-20 uppercase letters/digits`);
    }
    if (RESERVED_BUILDING_CODES.includes(building.code)) {
      errors.push(`${label}: code is reserved`);
    }
    if (buildingCodes.has(building.code)) {
      errors.push(`${label}: duplicate code`);
    }
    buildingCodes.add(building.code);
    if (!hasText(building.name, 2, 120)) {
      errors.push(`${label}: name must be 2-120 trimmed characters`);
    }
    if (!hasText(building.address, 2, 255)) {
      errors.push(`${label}: address must be 2-255 trimmed characters`);
    }
  }

  const resourceCodes = new Set<string>();
  const usedBuildings = new Set<string>();
  for (const resource of catalog.resources) {
    const label = `resource ${resource.code}`;
    if (!hasText(resource.code, 2, 30) || !CODE_PATTERN.test(resource.code)) {
      errors.push(
        `${label}: code must be 2-30 uppercase letters, digits, and single hyphens`,
      );
    }
    if (
      RESERVED_RESOURCE_CODES.includes(resource.code) ||
      resource.code.startsWith(RESERVED_RESOURCE_PREFIX)
    ) {
      errors.push(`${label}: code is reserved`);
    }
    if (resourceCodes.has(resource.code)) {
      errors.push(`${label}: duplicate code`);
    }
    resourceCodes.add(resource.code);
    if (!hasText(resource.name, 2, 120)) {
      errors.push(`${label}: name must be 2-120 trimmed characters`);
    }
    if (
      resource.description !== null &&
      !hasText(resource.description, 1, 1000)
    ) {
      errors.push(`${label}: description must be null or 1-1000 characters`);
    }
    if (!Object.values(ResourceType).includes(resource.type)) {
      errors.push(`${label}: unknown type`);
    }
    if (!Object.values(ResourceStatus).includes(resource.status)) {
      errors.push(`${label}: unknown status`);
    }
    if (
      !Number.isInteger(resource.capacity) ||
      resource.capacity < 1 ||
      resource.capacity > 10000
    ) {
      errors.push(`${label}: capacity must be an integer from 1 to 10000`);
    }
    if (!hasText(resource.location, 2, 120)) {
      errors.push(`${label}: location must be 2-120 trimmed characters`);
    }
    if (resource.amenities.length > MAX_AMENITIES) {
      errors.push(`${label}: at most ${MAX_AMENITIES} amenities`);
    }
    if (new Set(resource.amenities).size !== resource.amenities.length) {
      errors.push(`${label}: duplicate amenities`);
    }
    for (const amenity of resource.amenities) {
      if (!hasText(amenity, 1, 50) || !AMENITY_PATTERN.test(amenity)) {
        errors.push(
          `${label}: amenity "${amenity}" must be 1-50 lowercase kebab-case characters`,
        );
      }
    }
    if (typeof resource.requiresApproval !== 'boolean') {
      errors.push(`${label}: requiresApproval must be a boolean`);
    }
    const days = resource.operatingDays;
    if (
      days.length < 1 ||
      days.length > 7 ||
      new Set(days).size !== days.length ||
      !days.every((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    ) {
      errors.push(
        `${label}: operatingDays must be 1-7 unique integers from 0 (Sunday) to 6`,
      );
    }
    if (
      !HOUR_PATTERN.test(resource.opensAt) ||
      !HOUR_PATTERN.test(resource.closesAt)
    ) {
      errors.push(`${label}: opensAt/closesAt must be whole hours 00:00-23:00`);
    } else if (resource.opensAt >= resource.closesAt) {
      errors.push(`${label}: opensAt must be before closesAt`);
    }
    if (!buildingCodes.has(resource.buildingCode)) {
      errors.push(`${label}: unknown building ${resource.buildingCode}`);
    }
    usedBuildings.add(resource.buildingCode);

    const offsets = new Set<number>();
    for (const closure of resource.closures ?? []) {
      if (
        !Number.isInteger(closure.dayOffset) ||
        closure.dayOffset < 1 ||
        closure.dayOffset > MAX_CLOSURE_OFFSET_DAYS
      ) {
        errors.push(
          `${label}: closure dayOffset must be an integer from 1 to ${MAX_CLOSURE_OFFSET_DAYS}`,
        );
      }
      if (offsets.has(closure.dayOffset)) {
        errors.push(`${label}: duplicate closure dayOffset`);
      }
      offsets.add(closure.dayOffset);
      if (!hasText(closure.reason, 2, 255)) {
        errors.push(
          `${label}: closure reason must be 2-255 trimmed characters`,
        );
      }
    }
  }

  for (const code of buildingCodes) {
    if (!usedBuildings.has(code)) {
      errors.push(`building ${code}: has no resources`);
    }
  }
  return errors;
}

/** Weekday of a YYYY-MM-DD campus date, where Sunday is 0. */
export function weekdayOf(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days))
    .toISOString()
    .slice(0, 10);
}

/**
 * Resolves a closure offset against a campus date, moving it forward to the
 * resource's next operating day so the closure is visible in availability.
 */
export function resolveClosureDate(
  today: string,
  dayOffset: number,
  operatingDays: readonly number[],
): string {
  let date = addDays(today, dayOffset);
  for (let step = 0; step < 7; step += 1) {
    if (operatingDays.includes(weekdayOf(date))) return date;
    date = addDays(date, 1);
  }
  return addDays(today, dayOffset);
}
