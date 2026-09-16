import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateResourceCatalog1725600000000 implements MigrationInterface {
  name = 'CreateResourceCatalog1725600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "resources_type_enum" AS ENUM (
        'room',
        'laboratory',
        'equipment'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "resources_status_enum" AS ENUM (
        'active',
        'maintenance',
        'inactive'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "buildings" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "code" character varying(20) NOT NULL,
        "name" character varying(120) NOT NULL,
        "address" character varying(255) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_buildings_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_buildings_code" ON "buildings" ("code")
    `);

    await queryRunner.query(`
      CREATE TABLE "resources" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "code" character varying(30) NOT NULL,
        "name" character varying(120) NOT NULL,
        "description" text,
        "type" "resources_type_enum" NOT NULL,
        "status" "resources_status_enum" NOT NULL DEFAULT 'active',
        "capacity" integer NOT NULL,
        "location" character varying(120) NOT NULL,
        "amenities" text array NOT NULL DEFAULT '{}',
        "requires_approval" boolean NOT NULL DEFAULT false,
        "building_id" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_resources_capacity_positive" CHECK ("capacity" > 0),
        CONSTRAINT "PK_resources_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_resources_building_id" FOREIGN KEY ("building_id")
          REFERENCES "buildings"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_resources_code" ON "resources" ("code")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_resources_building_id" ON "resources" ("building_id")
    `);

    await queryRunner.query(`
      INSERT INTO "buildings" ("id", "code", "name", "address") VALUES
        (
          '10000000-0000-4000-8000-000000000001',
          'MAIN',
          'Main Academic Building',
          'USTH Campus, Hanoi'
        ),
        (
          '10000000-0000-4000-8000-000000000002',
          'LAB',
          'Laboratory Building',
          'USTH Campus, Hanoi'
        )
    `);

    await queryRunner.query(`
      INSERT INTO "resources" (
        "id",
        "code",
        "name",
        "description",
        "type",
        "status",
        "capacity",
        "location",
        "amenities",
        "requires_approval",
        "building_id"
      ) VALUES
        (
          '20000000-0000-4000-8000-000000000001',
          'ROOM-A101',
          'Study Room A101',
          'A group study room for students.',
          'room',
          'active',
          8,
          'First floor',
          ARRAY['whiteboard', 'display'],
          false,
          '10000000-0000-4000-8000-000000000001'
        ),
        (
          '20000000-0000-4000-8000-000000000002',
          'ROOM-A102',
          'Study Room A102',
          'A quiet study room currently under maintenance.',
          'room',
          'maintenance',
          6,
          'First floor',
          ARRAY['whiteboard'],
          false,
          '10000000-0000-4000-8000-000000000001'
        ),
        (
          '20000000-0000-4000-8000-000000000003',
          'LAB-L201',
          'Teaching Laboratory L201',
          'A supervised laboratory for scheduled practical sessions.',
          'laboratory',
          'active',
          24,
          'Second floor',
          ARRAY['workstations', 'projector'],
          true,
          '10000000-0000-4000-8000-000000000002'
        ),
        (
          '20000000-0000-4000-8000-000000000004',
          'EQUIP-PROJ-01',
          'Portable Projector 01',
          'A portable projector available from the equipment desk.',
          'equipment',
          'active',
          1,
          'Equipment desk',
          ARRAY['hdmi-cable', 'carry-case'],
          true,
          '10000000-0000-4000-8000-000000000001'
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_resources_building_id"`);
    await queryRunner.query(`DROP INDEX "IDX_resources_code"`);
    await queryRunner.query(`DROP TABLE "resources"`);
    await queryRunner.query(`DROP INDEX "IDX_buildings_code"`);
    await queryRunner.query(`DROP TABLE "buildings"`);
    await queryRunner.query(`DROP TYPE "resources_status_enum"`);
    await queryRunner.query(`DROP TYPE "resources_type_enum"`);
  }
}
