import { MigrationInterface, QueryRunner } from 'typeorm';

export class HardenResourceAvailability1725800000000 implements MigrationInterface {
  name = 'HardenResourceAvailability1725800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM "resources"
          WHERE EXTRACT(MINUTE FROM "opens_at") <> 0
            OR EXTRACT(SECOND FROM "opens_at") <> 0
            OR EXTRACT(MINUTE FROM "closes_at") <> 0
            OR EXTRACT(SECOND FROM "closes_at") <> 0
            OR "closes_at" > TIME '23:00:00'
        ) THEN
          RAISE EXCEPTION
            'Resource schedules must use supported whole-hour times from 00:00 through 23:00';
        END IF;

        IF EXISTS (
          SELECT 1
          FROM "resources"
          WHERE cardinality(array_positions("operating_days", 0)) > 1
            OR cardinality(array_positions("operating_days", 1)) > 1
            OR cardinality(array_positions("operating_days", 2)) > 1
            OR cardinality(array_positions("operating_days", 3)) > 1
            OR cardinality(array_positions("operating_days", 4)) > 1
            OR cardinality(array_positions("operating_days", 5)) > 1
            OR cardinality(array_positions("operating_days", 6)) > 1
        ) THEN
          RAISE EXCEPTION 'Resource operating days must not contain duplicates';
        END IF;

        IF EXISTS (
          SELECT 1
          FROM "resource_closures"
          WHERE char_length(
            regexp_replace("reason", '^[[:space:]]+|[[:space:]]+$', '', 'g')
          ) < 2
        ) THEN
          RAISE EXCEPTION
            'Resource closure reasons must contain at least two non-space characters';
        END IF;
      END
      $$
    `);

    await queryRunner.query(`
      ALTER TABLE "resources"
        DROP CONSTRAINT IF EXISTS "CHK_resources_operating_hours_whole_hour",
        ADD CONSTRAINT "CHK_resources_operating_hours_whole_hour"
          CHECK (
            EXTRACT(MINUTE FROM "opens_at") = 0
            AND EXTRACT(SECOND FROM "opens_at") = 0
            AND EXTRACT(MINUTE FROM "closes_at") = 0
            AND EXTRACT(SECOND FROM "closes_at") = 0
          ),
        ADD CONSTRAINT "CHK_resources_operating_hours_supported_range"
          CHECK ("closes_at" <= TIME '23:00:00'),
        ADD CONSTRAINT "CHK_resources_operating_days_unique"
          CHECK (
            cardinality(array_positions("operating_days", 0)) <= 1
            AND cardinality(array_positions("operating_days", 1)) <= 1
            AND cardinality(array_positions("operating_days", 2)) <= 1
            AND cardinality(array_positions("operating_days", 3)) <= 1
            AND cardinality(array_positions("operating_days", 4)) <= 1
            AND cardinality(array_positions("operating_days", 5)) <= 1
            AND cardinality(array_positions("operating_days", 6)) <= 1
          )
    `);

    await queryRunner.query(`
      ALTER TABLE "resource_closures"
        ADD CONSTRAINT "CHK_resource_closures_reason_length"
          CHECK (
            char_length(
              regexp_replace("reason", '^[[:space:]]+|[[:space:]]+$', '', 'g')
            ) >= 2
          )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "resource_closures"
        DROP CONSTRAINT "CHK_resource_closures_reason_length"
    `);

    await queryRunner.query(`
      ALTER TABLE "resources"
        DROP CONSTRAINT "CHK_resources_operating_days_unique",
        DROP CONSTRAINT "CHK_resources_operating_hours_supported_range",
        DROP CONSTRAINT "CHK_resources_operating_hours_whole_hour"
    `);
  }
}
