import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import * as bcrypt from 'bcrypt';
import { Client } from 'pg';

loadEnv();

const DEMO_EMAILS = {
  student: 'demo.student@usth.edu.vn',
  staff: 'demo.staff@usth.edu.vn',
  admin: 'demo.admin@usth.edu.vn',
} as const;
const DEMO_RESOURCE_CODES = [
  'DEMO-ROOM-101',
  'DEMO-LAB-201',
  'DEMO-PROJECTOR-01',
];
const DEMO_BUILDING_CODE = 'DEMO';
const CAMPUS_OFFSET = '+07:00';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function campusParts(now = new Date()): { date: string; hour: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).formatToParts(now);
  const value = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return {
    date: `${value.year}-${value.month}-${value.day}`,
    hour: Number(value.hour),
  };
}

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00${CAMPUS_OFFSET}`);
  value.setUTCDate(value.getUTCDate() + days);
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(value);
}

async function clean(client: Client): Promise<void> {
  await client.query('BEGIN');
  try {
    const demoUsers = await client.query<{ id: string }>(
      'SELECT id FROM users WHERE email = ANY($1)',
      [Object.values(DEMO_EMAILS)],
    );
    const userIds = demoUsers.rows.map((row) => row.id);
    const resources = await client.query<{ id: string }>(
      'SELECT id FROM resources WHERE code = ANY($1)',
      [DEMO_RESOURCE_CODES],
    );
    const resourceIds = resources.rows.map((row) => row.id);
    if (resourceIds.length || userIds.length) {
      await client.query(
        `DELETE FROM bookings
         WHERE resource_id = ANY($1)
            OR requester_id = ANY($2)`,
        [resourceIds, userIds],
      );
    }
    if (resourceIds.length) {
      await client.query('DELETE FROM resources WHERE id = ANY($1)', [
        resourceIds,
      ]);
    }
    await client.query('DELETE FROM users WHERE email = ANY($1)', [
      Object.values(DEMO_EMAILS),
    ]);
    await client.query(
      `DELETE FROM buildings WHERE code = $1
       AND NOT EXISTS (SELECT 1 FROM resources WHERE building_id = buildings.id)`,
      [DEMO_BUILDING_CODE],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function seed(client: Client): Promise<void> {
  const password = required('DEMO_PASSWORD');
  if (Buffer.byteLength(password, 'utf8') > 72 || password.length < 8) {
    throw new Error('DEMO_PASSWORD must be 8-72 UTF-8 bytes');
  }
  const rounds = Number(process.env.AUTH_BCRYPT_ROUNDS ?? 12);
  const passwordHash = await bcrypt.hash(password, rounds);
  const { date: today, hour } = campusParts();
  const pendingDate = addDays(today, 2);
  const historyDate = addDays(today, -7);

  await clean(client);
  await client.query('BEGIN');
  try {
    const users = new Map<string, string>();
    for (const [role, email] of Object.entries(DEMO_EMAILS)) {
      const result = await client.query<{ id: string }>(
        `INSERT INTO users (email, password_hash, full_name, role, is_active)
         VALUES ($1, $2, $3, $4::users_role_enum, true)
         RETURNING id`,
        [
          email,
          passwordHash,
          `Demo ${role[0].toUpperCase()}${role.slice(1)}`,
          role,
        ],
      );
      users.set(role, result.rows[0].id);
    }

    const building = await client.query<{ id: string }>(
      `INSERT INTO buildings (code, name, address)
       VALUES ($1, 'Demo Learning Hub', 'USTH Campus, Hanoi') RETURNING id`,
      [DEMO_BUILDING_CODE],
    );
    const buildingId = building.rows[0].id;
    const resources = new Map<string, string>();
    const definitions = [
      [
        'room',
        DEMO_RESOURCE_CODES[0],
        'Demo Collaboration Room',
        'room',
        false,
        10,
        'Ground floor',
        ['whiteboard', 'display'],
      ],
      [
        'lab',
        DEMO_RESOURCE_CODES[1],
        'Demo Teaching Laboratory',
        'laboratory',
        true,
        24,
        'Second floor',
        ['workstations', 'projector'],
      ],
      [
        'equipment',
        DEMO_RESOURCE_CODES[2],
        'Demo Portable Projector',
        'equipment',
        true,
        1,
        'Equipment desk',
        ['hdmi-cable', 'carry-case'],
      ],
    ] as const;
    for (const [
      key,
      code,
      name,
      type,
      approval,
      capacity,
      location,
      amenities,
    ] of definitions) {
      const result = await client.query<{ id: string }>(
        `INSERT INTO resources (
          code, name, description, type, status, capacity, location, amenities,
          requires_approval, operating_days, opens_at, closes_at, building_id
        ) VALUES ($1, $2, $3, $4::resources_type_enum, 'active', $5, $6, $7,
          $8, ARRAY[0,1,2,3,4,5,6]::smallint[], '00:00', '23:00', $9)
        RETURNING id`,
        [
          code,
          name,
          'Disposable local demo data.',
          type,
          capacity,
          location,
          amenities,
          approval,
          buildingId,
        ],
      );
      resources.set(key, result.rows[0].id);
    }

    const studentId = users.get('student') as string;
    const staffId = users.get('staff') as string;
    await client.query(
      `INSERT INTO bookings (
        resource_id, requester_id, booking_date, start_time, end_time, status
      ) VALUES ($1, $2, $3, '10:00', '12:00', 'pending')`,
      [resources.get('lab'), studentId, pendingDate],
    );
    await client.query(
      `INSERT INTO bookings (
        resource_id, requester_id, booking_date, start_time, end_time, status,
        reviewed_at, reviewed_by_id, check_in_code, check_in_requested_at,
        checked_in_at, checked_in_by_id, checked_out_at, checked_out_by_id
      ) VALUES ($1, $2, $3, '09:00', '11:00', 'completed', now(), $4,
        '246810', now(), now(), $4, now(), $4)`,
      [resources.get('room'), studentId, historyDate, staffId],
    );

    if (hour <= 22) {
      const start = `${String(hour).padStart(2, '0')}:00`;
      const end = `${String(hour + 1).padStart(2, '0')}:00`;
      await client.query(
        `INSERT INTO bookings (
          resource_id, requester_id, booking_date, start_time, end_time, status,
          reviewed_at, reviewed_by_id
        ) VALUES ($1, $2, $3, $4, $5, 'confirmed', now(), $6)`,
        [resources.get('equipment'), studentId, today, start, end, staffId],
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }

  console.log('Demo data ready:');
  console.log(`  Student: ${DEMO_EMAILS.student}`);
  console.log(`  Staff:   ${DEMO_EMAILS.staff}`);
  console.log(`  Admin:   ${DEMO_EMAILS.admin}`);
  console.log('  Password: value supplied through DEMO_PASSWORD');
  console.log(`  Pending approval date: ${pendingDate}`);
  console.log(
    hour <= 22
      ? `  Check-in scenario: ${today} ${String(hour).padStart(2, '0')}:00-${String(hour + 1).padStart(2, '0')}:00 ICT`
      : '  Check-in scenario omitted after 23:00 ICT; seed earlier in the day.',
  );
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Demo data commands are disabled when NODE_ENV=production');
  }
  const client = new Client({
    host: required('DB_HOST'),
    port: Number(process.env.DB_PORT ?? 5432),
    user: required('DB_USERNAME'),
    password: process.env.DB_PASSWORD ?? '',
    database: required('DB_NAME'),
  });
  await client.connect();
  try {
    if (process.argv.includes('--clean')) {
      await clean(client);
      console.log('Demo data removed.');
    } else {
      await seed(client);
    }
  } finally {
    await client.end();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
