import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createTestApp } from './utils/test-app';

const SEED_RESOURCE_CODES = [
  'ROOM-A101',
  'ROOM-A102',
  'LAB-L201',
  'EQUIP-PROJ-01',
];

type CatalogRow = {
  code: string;
  type: string;
  status: string;
  capacity: number;
  buildingCode: string;
  requiresApproval: boolean;
};

type InvalidCatalogChange = {
  name: string;
  query: string;
  parameters: unknown[];
  errorCode: string;
};

const invalidCatalogChanges: InvalidCatalogChange[] = [
  {
    name: 'duplicate building codes',
    query: `
      INSERT INTO buildings (code, name, address)
      VALUES ($1, $2, $3)
    `,
    parameters: ['MAIN', 'Duplicate building', 'Test address'],
    errorCode: '23505',
  },
  {
    name: 'duplicate resource codes',
    query: `
      INSERT INTO resources (
        code,
        name,
        type,
        capacity,
        location,
        building_id
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `,
    parameters: [
      'ROOM-A101',
      'Duplicate resource',
      'room',
      1,
      'Test location',
      '10000000-0000-4000-8000-000000000001',
    ],
    errorCode: '23505',
  },
  {
    name: 'unknown building references',
    query: `
      INSERT INTO resources (
        code,
        name,
        type,
        capacity,
        location,
        building_id
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `,
    parameters: [
      'UNKNOWN-BUILDING',
      'Invalid resource',
      'room',
      1,
      'Test location',
      '99999999-9999-4999-8999-999999999999',
    ],
    errorCode: '23503',
  },
  {
    name: 'unsupported resource types',
    query: `
      INSERT INTO resources (
        code,
        name,
        type,
        capacity,
        location,
        building_id
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `,
    parameters: [
      'INVALID-TYPE',
      'Invalid resource',
      'vehicle',
      1,
      'Test location',
      '10000000-0000-4000-8000-000000000001',
    ],
    errorCode: '22P02',
  },
  {
    name: 'unsupported resource statuses',
    query: `
      INSERT INTO resources (
        code,
        name,
        type,
        status,
        capacity,
        location,
        building_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `,
    parameters: [
      'INVALID-STATUS',
      'Invalid resource',
      'room',
      'broken',
      1,
      'Test location',
      '10000000-0000-4000-8000-000000000001',
    ],
    errorCode: '22P02',
  },
  {
    name: 'non-positive capacity',
    query: `
      INSERT INTO resources (
        code,
        name,
        type,
        capacity,
        location,
        building_id
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `,
    parameters: [
      'INVALID-CAPACITY',
      'Invalid resource',
      'room',
      0,
      'Test location',
      '10000000-0000-4000-8000-000000000001',
    ],
    errorCode: '23514',
  },
  {
    name: 'deleting buildings that still contain resources',
    query: `DELETE FROM buildings WHERE code = $1`,
    parameters: ['MAIN'],
    errorCode: '23503',
  },
];

describe('Resource catalog (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    app = await createTestApp();
    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  it('loads the initial catalog with every resource type', async () => {
    const rows = await dataSource.query<CatalogRow[]>(
      `
        SELECT
          resources.code,
          resources.type,
          resources.status,
          resources.capacity,
          buildings.code AS "buildingCode",
          resources.requires_approval AS "requiresApproval"
        FROM resources
        INNER JOIN buildings ON buildings.id = resources.building_id
        WHERE resources.code = ANY($1)
        ORDER BY resources.code
      `,
      [SEED_RESOURCE_CODES],
    );

    expect(rows).toHaveLength(SEED_RESOURCE_CODES.length);
    expect(new Set(rows.map((row) => row.type))).toEqual(
      new Set(['room', 'laboratory', 'equipment']),
    );
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'ROOM-A102',
          status: 'maintenance',
          buildingCode: 'MAIN',
        }),
        expect.objectContaining({
          code: 'LAB-L201',
          capacity: 24,
          requiresApproval: true,
        }),
      ]),
    );
  });

  it.each(invalidCatalogChanges)(
    'rejects $name',
    async ({ query, parameters, errorCode }) => {
      await expect(dataSource.query(query, parameters)).rejects.toMatchObject({
        code: errorCode,
      });
    },
  );
});
