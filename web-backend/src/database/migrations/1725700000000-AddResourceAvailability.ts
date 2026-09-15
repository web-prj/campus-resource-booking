import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddResourceAvailability1725700000000 implements MigrationInterface {
  name = 'AddResourceAvailability1725700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "resources"
        ADD "operating_days" smallint array NOT NULL DEFAULT '{1,2,3,4,5,6}',
        ADD "opens_at" TIME WITHOUT TIME ZONE NOT NULL DEFAULT '08:00',
        ADD "closes_at" TIME WITHOUT TIME ZONE NOT NULL DEFAULT '18:00',
        ADD CONSTRAINT "CHK_resources_operating_days_not_empty"
          CHECK (cardinality("operating_days") > 0),
        ADD CONSTRAINT "CHK_resources_operating_days_range"
          CHECK ("operating_days" <@ ARRAY[0,1,2,3,4,5,6]::smallint[]),
        ADD CONSTRAINT "CHK_resources_operating_hours_order"
          CHECK ("opens_at" < "closes_at")
    `);

    await queryRunner.query(`
      CREATE TABLE "resource_closures" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "resource_id" uuid NOT NULL,
        "date" date NOT NULL,
        "reason" character varying(255) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_resource_closures_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_resource_closures_resource_id" FOREIGN KEY ("resource_id")
          REFERENCES "resources"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_resource_closures_resource_date"
        ON "resource_closures" ("resource_id", "date")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_resources_operating_days"
        ON "resources" USING GIN ("operating_days")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_resources_operating_days"`);
    await queryRunner.query(`DROP INDEX "IDX_resource_closures_resource_date"`);
    await queryRunner.query(`DROP TABLE "resource_closures"`);
    await queryRunner.query(`
      ALTER TABLE "resources"
        DROP CONSTRAINT "CHK_resources_operating_hours_order",
        DROP CONSTRAINT "CHK_resources_operating_days_range",
        DROP CONSTRAINT "CHK_resources_operating_days_not_empty",
        DROP COLUMN "closes_at",
        DROP COLUMN "opens_at",
        DROP COLUMN "operating_days"
    `);
  }
}
