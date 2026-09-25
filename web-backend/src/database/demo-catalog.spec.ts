import { ResourceStatus } from '../resources/enums/resource-status.enum';
import { ResourceType } from '../resources/enums/resource-type.enum';
import {
  Catalog,
  CatalogResource,
  DEMO_CATALOG,
  RESERVED_BUILDING_CODES,
  RESERVED_RESOURCE_CODES,
  resolveClosureDate,
  validateCatalog,
  weekdayOf,
} from './demo-catalog';

const { buildings, resources } = DEMO_CATALOG;

function withResource(overrides: Partial<CatalogResource>): Catalog {
  return {
    buildings,
    resources: [{ ...resources[0], ...overrides }, ...resources.slice(1)],
  };
}

describe('DEMO_CATALOG', () => {
  it('passes catalog validation', () => {
    expect(validateCatalog(DEMO_CATALOG)).toEqual([]);
  });

  it('has a demo-sized catalog across several new buildings', () => {
    expect(resources.length).toBeGreaterThanOrEqual(35);
    expect(resources.length).toBeLessThanOrEqual(45);
    expect(buildings.length).toBeGreaterThanOrEqual(4);
    expect(buildings.length).toBeLessThanOrEqual(6);
  });

  it('uses unique codes that do not collide with migration or demo rows', () => {
    const resourceCodes = resources.map((resource) => resource.code);
    const buildingCodes = buildings.map((building) => building.code);
    expect(new Set(resourceCodes).size).toBe(resourceCodes.length);
    expect(new Set(buildingCodes).size).toBe(buildingCodes.length);
    for (const code of resourceCodes) {
      expect(RESERVED_RESOURCE_CODES).not.toContain(code);
      expect(code.startsWith('DEMO-')).toBe(false);
      expect(code.length).toBeLessThanOrEqual(30);
    }
    for (const code of buildingCodes) {
      expect(RESERVED_BUILDING_CODES).not.toContain(code);
      expect(code.length).toBeLessThanOrEqual(20);
    }
  });

  it('respects schema limits for every resource', () => {
    const buildingCodes = new Set(buildings.map((building) => building.code));
    for (const resource of resources) {
      expect(buildingCodes.has(resource.buildingCode)).toBe(true);
      expect(resource.name.length).toBeLessThanOrEqual(120);
      expect(resource.location.length).toBeLessThanOrEqual(120);
      expect(resource.capacity).toBeGreaterThanOrEqual(1);
      expect(resource.capacity).toBeLessThanOrEqual(10000);
      expect(resource.opensAt).toMatch(/^(?:[01]\d|2[0-3]):00$/);
      expect(resource.closesAt).toMatch(/^(?:[01]\d|2[0-3]):00$/);
      expect(resource.opensAt < resource.closesAt).toBe(true);
      expect(resource.closesAt <= '23:00').toBe(true);
      expect(new Set(resource.operatingDays).size).toBe(
        resource.operatingDays.length,
      );
      for (const day of resource.operatingDays) {
        expect(day).toBeGreaterThanOrEqual(0);
        expect(day).toBeLessThanOrEqual(6);
      }
      expect(resource.amenities.length).toBeLessThanOrEqual(20);
      for (const amenity of resource.amenities) {
        // The DTO trims and lowercases; the admin form splits on commas.
        expect(amenity).toBe(amenity.trim().toLowerCase());
        expect(amenity).not.toContain(',');
        expect(amenity.length).toBeGreaterThanOrEqual(1);
        expect(amenity.length).toBeLessThanOrEqual(50);
      }
    }
  });

  it('covers the diversity needed for demos', () => {
    const types = new Set(resources.map((resource) => resource.type));
    expect([...types].sort()).toEqual(Object.values(ResourceType).sort());
    for (const type of Object.values(ResourceType)) {
      expect(
        resources.filter((resource) => resource.type === type).length,
      ).toBeGreaterThanOrEqual(5);
    }

    const approvals = new Set(
      resources.map((resource) => resource.requiresApproval),
    );
    expect(approvals).toEqual(new Set([true, false]));

    const statuses = resources.map((resource) => resource.status);
    expect(statuses).toContain(ResourceStatus.MAINTENANCE);
    expect(statuses).toContain(ResourceStatus.INACTIVE);
    const active = statuses.filter(
      (status) => status === ResourceStatus.ACTIVE,
    );
    expect(active.length).toBeGreaterThan(resources.length * 0.8);

    const capacities = resources.map((resource) => resource.capacity);
    expect(Math.min(...capacities)).toBe(1);
    expect(Math.max(...capacities)).toBeGreaterThanOrEqual(200);

    const dayPatterns = new Set(
      resources.map((resource) => resource.operatingDays.join(',')),
    );
    expect(dayPatterns.size).toBeGreaterThanOrEqual(6);
    expect(dayPatterns).toContain('0,6');
    expect(
      resources.some(
        (resource) =>
          resource.opensAt === '00:00' && resource.closesAt === '23:00',
      ),
    ).toBe(true);
    expect(resources.some((resource) => resource.opensAt <= '06:00')).toBe(
      true,
    );
    expect(
      resources.some(
        (resource) =>
          Number(resource.closesAt.slice(0, 2)) -
            Number(resource.opensAt.slice(0, 2)) <=
          4,
      ),
    ).toBe(true);

    expect(resources.some((resource) => resource.amenities.length === 0)).toBe(
      true,
    );
    expect(resources.some((resource) => resource.description === null)).toBe(
      true,
    );
    expect(
      resources.filter((resource) => resource.closures?.length).length,
    ).toBeGreaterThanOrEqual(3);

    for (const building of buildings) {
      expect(
        resources.some((resource) => resource.buildingCode === building.code),
      ).toBe(true);
    }
  });
});

describe('validateCatalog', () => {
  it.each<[string, Partial<CatalogResource>, RegExp]>([
    ['a lowercase code', { code: 'lhc-aud' }, /code must be/],
    ['an overlong code', { code: `X${'-A'.repeat(15)}` }, /code must be/],
    ['a reserved code', { code: 'ROOM-A101' }, /reserved/],
    ['a demo seed code', { code: 'DEMO-ROOM-101' }, /reserved/],
    ['a duplicate code', { code: resources[1].code }, /duplicate code/],
    ['an untrimmed name', { name: ' Hall ' }, /name must be/],
    ['an empty description', { description: '' }, /description/],
    ['zero capacity', { capacity: 0 }, /capacity/],
    ['excess capacity', { capacity: 10001 }, /capacity/],
    ['fractional capacity', { capacity: 2.5 }, /capacity/],
    ['a short location', { location: 'A' }, /location/],
    ['an uppercase amenity', { amenities: ['Projector'] }, /amenity/],
    ['a comma in an amenity', { amenities: ['a,b'] }, /amenity/],
    ['a long amenity', { amenities: ['a'.repeat(51)] }, /amenity/],
    ['duplicate amenities', { amenities: ['wifi', 'wifi'] }, /duplicate/],
    [
      'too many amenities',
      { amenities: Array.from({ length: 21 }, (_, i) => `item-${i}`) },
      /at most 20/,
    ],
    ['no operating days', { operatingDays: [] }, /operatingDays/],
    ['day 7', { operatingDays: [1, 7] }, /operatingDays/],
    ['duplicate days', { operatingDays: [1, 1] }, /operatingDays/],
    ['a half-hour opening', { opensAt: '08:30' }, /whole hours/],
    ['closing at midnight', { closesAt: '24:00' }, /whole hours/],
    ['reversed hours', { opensAt: '18:00', closesAt: '08:00' }, /before/],
    ['an unknown building', { buildingCode: 'NOPE' }, /unknown building/],
    ['an unknown type', { type: 'desk' as ResourceType }, /unknown type/],
    [
      'an unknown status',
      { status: 'retired' as ResourceStatus },
      /unknown status/,
    ],
    [
      'a past closure',
      { closures: [{ dayOffset: 0, reason: 'Cleaning' }] },
      /dayOffset/,
    ],
    [
      'a blank closure reason',
      { closures: [{ dayOffset: 2, reason: ' ' }] },
      /reason/,
    ],
    [
      'duplicate closure offsets',
      {
        closures: [
          { dayOffset: 2, reason: 'Cleaning' },
          { dayOffset: 2, reason: 'Inspection' },
        ],
      },
      /duplicate closure/,
    ],
  ])('rejects %s', (_label, overrides, message) => {
    const errors = validateCatalog(withResource(overrides));
    expect(errors.some((error) => message.test(error))).toBe(true);
  });

  it('rejects reserved, duplicate, and unused buildings', () => {
    const errors = validateCatalog({
      buildings: [
        ...buildings,
        { code: 'MAIN', name: 'Main', address: 'Somewhere' },
        { ...buildings[0] },
      ],
      resources,
    });
    expect(errors).toEqual(
      expect.arrayContaining([
        'building MAIN: code is reserved',
        `building ${buildings[0].code}: duplicate code`,
        'building MAIN: has no resources',
      ]),
    );
  });
});

describe('resolveClosureDate', () => {
  it('uses Sunday as weekday 0', () => {
    expect(weekdayOf('2026-09-27')).toBe(0);
    expect(weekdayOf('2026-09-26')).toBe(6);
  });

  it('keeps an offset that lands on an operating day', () => {
    expect(resolveClosureDate('2026-09-24', 4, [1, 2, 3, 4, 5])).toBe(
      '2026-09-28',
    );
  });

  it('moves a closure forward to the next operating day', () => {
    // 2026-09-26 is a Saturday; weekdays-only moves to Monday.
    expect(resolveClosureDate('2026-09-24', 2, [1, 2, 3, 4, 5])).toBe(
      '2026-09-28',
    );
    // Tuesday/Thursday only: Friday 2026-09-25 moves to Tuesday.
    expect(resolveClosureDate('2026-09-24', 1, [2, 4])).toBe('2026-09-29');
  });

  it('crosses month and year boundaries', () => {
    expect(resolveClosureDate('2026-12-30', 3, [0, 1, 2, 3, 4, 5, 6])).toBe(
      '2027-01-02',
    );
  });
});
