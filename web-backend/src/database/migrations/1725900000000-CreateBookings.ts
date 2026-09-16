import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBookings1725900000000 implements MigrationInterface {
  name = 'CreateBookings1725900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "btree_gist"`);

    await queryRunner.query(`
      CREATE TYPE "bookings_status_enum" AS ENUM ('pending', 'confirmed')
    `);

    await queryRunner.query(`
      CREATE TABLE "bookings" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "resource_id" uuid NOT NULL,
        "requester_id" uuid NOT NULL,
        "booking_date" date NOT NULL,
        "start_time" TIME WITHOUT TIME ZONE NOT NULL,
        "end_time" TIME WITHOUT TIME ZONE NOT NULL,
        "status" "bookings_status_enum" NOT NULL,
        "booking_period" tsrange GENERATED ALWAYS AS (
          tsrange(
            LEAST(
              "booking_date" + "start_time",
              "booking_date" + "end_time"
            ),
            GREATEST(
              "booking_date" + "start_time",
              "booking_date" + "end_time"
            ),
            '[)'
          )
        ) STORED,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_bookings_id" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_bookings_time_order"
          CHECK ("start_time" < "end_time"),
        CONSTRAINT "CHK_bookings_whole_hour"
          CHECK (
            EXTRACT(MINUTE FROM "start_time") = 0
            AND EXTRACT(SECOND FROM "start_time") = 0
            AND EXTRACT(MINUTE FROM "end_time") = 0
            AND EXTRACT(SECOND FROM "end_time") = 0
          ),
        CONSTRAINT "CHK_bookings_supported_time_range"
          CHECK ("end_time" <= TIME '23:00:00'),
        CONSTRAINT "FK_bookings_resource_id" FOREIGN KEY ("resource_id")
          REFERENCES "resources"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
        CONSTRAINT "FK_bookings_requester_id" FOREIGN KEY ("requester_id")
          REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
        CONSTRAINT "EXCL_bookings_resource_period_blocking"
          EXCLUDE USING gist (
            "resource_id" WITH =,
            "booking_period" WITH &&
          )
          WHERE ("status" IN ('pending', 'confirmed'))
      )
    `);

    await queryRunner.query(`
      INSERT INTO "typeorm_metadata" (
        "type",
        "database",
        "schema",
        "table",
        "name",
        "value"
      ) VALUES (
        'GENERATED_COLUMN',
        current_database(),
        current_schema(),
        'bookings',
        'booking_period',
        'tsrange(LEAST("booking_date" + "start_time", "booking_date" + "end_time"), GREATEST("booking_date" + "start_time", "booking_date" + "end_time"), ''[)'')'
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_bookings_resource_date"
        ON "bookings" ("resource_id", "booking_date")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_bookings_requester_created_at"
        ON "bookings" ("requester_id", "created_at" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "typeorm_metadata"
      WHERE "type" = 'GENERATED_COLUMN'
        AND "database" = current_database()
        AND "schema" = current_schema()
        AND "table" = 'bookings'
        AND "name" = 'booking_period'
    `);
    await queryRunner.query(`DROP INDEX "IDX_bookings_requester_created_at"`);
    await queryRunner.query(`DROP INDEX "IDX_bookings_resource_date"`);
    await queryRunner.query(`DROP TABLE "bookings"`);
    await queryRunner.query(`DROP TYPE "bookings_status_enum"`);
  }
}
