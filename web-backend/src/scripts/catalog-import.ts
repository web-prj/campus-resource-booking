import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { Client } from 'pg';
import {
  Catalog,
  DEMO_CATALOG,
  resolveClosureDate,
  validateCatalog,
} from './demo-catalog';

loadEnv();

const CAMPUS_TIME_ZONE = 'Asia/Ho_Chi_Minh';
// Booking statuses that hold a slot; keep in sync with the bookings module.
const ACTIVE_BOOKING_STATUSES = ['pending', 'confirmed', 'checked_in'];

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function campusToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: CAMPUS_TIME_ZONE,
  }).format(now);
}

async function inTransaction(
  client: Client,
  work: () => Promise<void>,
): Promise<void> {
  await client.query('BEGIN');
  try {
    // Blocks concurrent booking writes so the "no active bookings" checks
    // below cannot race with a booking created mid-import.
    await client.query('LOCK TABLE bookings IN SHARE MODE');
    await work();
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function importCatalog(client: Client, catalog: Catalog): Promise<void> {
  const today = campusToday();
  const counts = {
    buildings: 0,
    inserted: 0,
    updated: 0,
    skipped: [] as string[],
    closuresAdded: 0,
    closuresSkipped: 0,
  };

  await inTransaction(client, async () => {
    const buildingIds = new Map<string, string>();
    for (const building of catalog.buildings) {
      const result = await client.query<{ id: string }>(
        `INSERT INTO buildings (code, name, address)
         VALUES ($1, $2, $3)
         ON CONFLICT (code) DO UPDATE
           SET name = EXCLUDED.name,
               address = EXCLUDED.address,
               updated_at = now()
         RETURNING id`,
        [building.code, building.name, building.address],
      );
      buildingIds.set(building.code, result.rows[0].id);
      counts.buildings += 1;
    }

    for (const resource of catalog.resources) {
      const upsert = await client.query<{ id: string; inserted: boolean }>(
        `INSERT INTO resources (
           code, name, description, type, status, capacity, location,
           amenities, requires_approval, operating_days, opens_at, closes_at,
           building_id
         ) VALUES (
           $1, $2, $3, $4::resources_type_enum, $5::resources_status_enum,
           $6, $7, $8::text[], $9, $10::smallint[], $11::time, $12::time, $13
         )
         ON CONFLICT (code) DO UPDATE
           SET name = EXCLUDED.name,
               description = EXCLUDED.description,
               type = EXCLUDED.type,
               status = EXCLUDED.status,
               capacity = EXCLUDED.capacity,
               location = EXCLUDED.location,
               amenities = EXCLUDED.amenities,
               requires_approval = EXCLUDED.requires_approval,
               operating_days = EXCLUDED.operating_days,
               opens_at = EXCLUDED.opens_at,
               closes_at = EXCLUDED.closes_at,
               building_id = EXCLUDED.building_id,
               updated_at = now()
           WHERE NOT EXISTS (
             SELECT 1 FROM bookings
             WHERE bookings.resource_id = resources.id
               AND bookings.status::text = ANY($14::text[])
           )
         RETURNING id, (xmax = 0) AS inserted`,
        [
          resource.code,
          resource.name,
          resource.description,
          resource.type,
          resource.status,
          resource.capacity,
          resource.location,
          [...resource.amenities],
          resource.requiresApproval,
          [...resource.operatingDays],
          resource.opensAt,
          resource.closesAt,
          buildingIds.get(resource.buildingCode),
          ACTIVE_BOOKING_STATUSES,
        ],
      );

      let resourceId: string;
      if (upsert.rows.length) {
        resourceId = upsert.rows[0].id;
        if (upsert.rows[0].inserted) counts.inserted += 1;
        else counts.updated += 1;
      } else {
        const existing = await client.query<{ id: string }>(
          'SELECT id FROM resources WHERE code = $1',
          [resource.code],
        );
        resourceId = existing.rows[0].id;
        counts.skipped.push(resource.code);
      }

      for (const closure of resource.closures ?? []) {
        const date = resolveClosureDate(
          today,
          closure.dayOffset,
          resource.operatingDays,
        );
        const added = await client.query(
          `INSERT INTO resource_closures (resource_id, date, reason)
           SELECT $1::uuid, $2::date, $3::varchar
           WHERE NOT EXISTS (
             SELECT 1 FROM bookings
             WHERE bookings.resource_id = $1::uuid
               AND bookings.booking_date = $2::date
               AND bookings.status::text = ANY($4::text[])
           )
           ON CONFLICT (resource_id, date) DO NOTHING
           RETURNING id`,
          [resourceId, date, closure.reason, ACTIVE_BOOKING_STATUSES],
        );
        if (added.rowCount) counts.closuresAdded += 1;
        else counts.closuresSkipped += 1;
      }
    }
  });

  console.log(`Demo resource catalog imported (campus date ${today}):`);
  console.log(`  Buildings upserted: ${counts.buildings}`);
  console.log(`  Resources inserted: ${counts.inserted}`);
  console.log(`  Resources updated:  ${counts.updated}`);
  console.log(
    `  Resources skipped (active bookings): ${counts.skipped.length}` +
      (counts.skipped.length ? ` [${counts.skipped.join(', ')}]` : ''),
  );
  console.log(`  Closures added: ${counts.closuresAdded}`);
  console.log(
    `  Closures skipped (already present or booked that day): ${counts.closuresSkipped}`,
  );
}

async function cleanCatalog(client: Client, catalog: Catalog): Promise<void> {
  const resourceCodes = catalog.resources.map((resource) => resource.code);
  const buildingCodes = catalog.buildings.map((building) => building.code);
  let removedResources: string[] = [];
  let keptResources: string[] = [];
  let removedBuildings: string[] = [];
  let keptBuildings: string[] = [];

  await inTransaction(client, async () => {
    // Closures cascade with their resource; bookings would block the delete,
    // so resources with any booking history are kept.
    const removed = await client.query<{ code: string }>(
      `DELETE FROM resources
       WHERE code = ANY($1::text[])
         AND NOT EXISTS (
           SELECT 1 FROM bookings WHERE bookings.resource_id = resources.id
         )
       RETURNING code`,
      [resourceCodes],
    );
    removedResources = removed.rows.map((row) => row.code);
    const kept = await client.query<{ code: string }>(
      'SELECT code FROM resources WHERE code = ANY($1::text[]) ORDER BY code',
      [resourceCodes],
    );
    keptResources = kept.rows.map((row) => row.code);

    const removedBuildingRows = await client.query<{ code: string }>(
      `DELETE FROM buildings
       WHERE code = ANY($1::text[])
         AND NOT EXISTS (
           SELECT 1 FROM resources WHERE resources.building_id = buildings.id
         )
       RETURNING code`,
      [buildingCodes],
    );
    removedBuildings = removedBuildingRows.rows.map((row) => row.code);
    const keptBuildingRows = await client.query<{ code: string }>(
      'SELECT code FROM buildings WHERE code = ANY($1::text[]) ORDER BY code',
      [buildingCodes],
    );
    keptBuildings = keptBuildingRows.rows.map((row) => row.code);
  });

  console.log('Demo resource catalog cleaned:');
  console.log(`  Resources removed: ${removedResources.length}`);
  console.log(
    `  Resources kept (have bookings): ${keptResources.length}` +
      (keptResources.length ? ` [${keptResources.join(', ')}]` : ''),
  );
  console.log(`  Buildings removed: ${removedBuildings.length}`);
  console.log(
    `  Buildings kept (still have resources): ${keptBuildings.length}` +
      (keptBuildings.length ? ` [${keptBuildings.join(', ')}]` : ''),
  );
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Demo catalog commands are disabled when NODE_ENV=production',
    );
  }
  const errors = validateCatalog(DEMO_CATALOG);
  if (errors.length) {
    throw new Error(
      `Demo catalog is invalid; nothing was written:\n  ${errors.join('\n  ')}`,
    );
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
      await cleanCatalog(client, DEMO_CATALOG);
    } else {
      await importCatalog(client, DEMO_CATALOG);
    }
  } finally {
    await client.end();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
