import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCheckInCheckoutWorkflow1726200000000 implements MigrationInterface {
  name = 'AddCheckInCheckoutWorkflow1726200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_bookings_pending_created_at"`);
    await queryRunner.query(`
      ALTER TABLE "bookings"
        DROP CONSTRAINT "EXCL_bookings_resource_period_blocking",
        DROP CONSTRAINT "CHK_bookings_cancellation_state",
        DROP CONSTRAINT "CHK_bookings_pending_unreviewed",
        DROP CONSTRAINT "CHK_bookings_rejection_state"
    `);
    await queryRunner.query(`
      ALTER TYPE "bookings_status_enum" RENAME TO "bookings_status_enum_old"
    `);
    await queryRunner.query(`
      CREATE TYPE "bookings_status_enum" AS ENUM (
        'pending', 'confirmed', 'checked_in', 'completed',
        'no_show', 'rejected', 'cancelled'
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "bookings"
        ALTER COLUMN "status" TYPE "bookings_status_enum"
          USING "status"::text::"bookings_status_enum",
        ADD "check_in_code" varchar(6),
        ADD "check_in_requested_at" TIMESTAMP WITH TIME ZONE,
        ADD "checked_in_at" TIMESTAMP WITH TIME ZONE,
        ADD "checked_in_by_id" uuid,
        ADD "checked_out_at" TIMESTAMP WITH TIME ZONE,
        ADD "checked_out_by_id" uuid,
        ADD "no_show_at" TIMESTAMP WITH TIME ZONE,
        ADD "no_show_by_id" uuid,
        ADD CONSTRAINT "CHK_bookings_cancellation_state"
          CHECK (
            ("status" = 'cancelled' AND "cancelled_at" IS NOT NULL)
            OR ("status" <> 'cancelled' AND "cancelled_at" IS NULL)
          ),
        ADD CONSTRAINT "CHK_bookings_pending_unreviewed"
          CHECK ("status" <> 'pending' OR "reviewed_at" IS NULL),
        ADD CONSTRAINT "CHK_bookings_rejection_state"
          CHECK (
            ("status" = 'rejected' AND "rejection_reason" IS NOT NULL
              AND "reviewed_at" IS NOT NULL)
            OR ("status" <> 'rejected' AND "rejection_reason" IS NULL)
          ),
        ADD CONSTRAINT "FK_bookings_checked_in_by_id"
          FOREIGN KEY ("checked_in_by_id") REFERENCES "users"("id") ON DELETE RESTRICT,
        ADD CONSTRAINT "FK_bookings_checked_out_by_id"
          FOREIGN KEY ("checked_out_by_id") REFERENCES "users"("id") ON DELETE RESTRICT,
        ADD CONSTRAINT "FK_bookings_no_show_by_id"
          FOREIGN KEY ("no_show_by_id") REFERENCES "users"("id") ON DELETE RESTRICT,
        ADD CONSTRAINT "CHK_bookings_check_in_request"
          CHECK (
            ("check_in_code" IS NULL AND "check_in_requested_at" IS NULL)
            OR ("check_in_code" ~ '^[0-9]{6}$' AND "check_in_requested_at" IS NOT NULL)
          ),
        ADD CONSTRAINT "CHK_bookings_checked_in_state"
          CHECK (
            ("status" IN ('checked_in', 'completed')
              AND "check_in_code" IS NOT NULL
              AND "checked_in_at" IS NOT NULL
              AND "checked_in_by_id" IS NOT NULL)
            OR ("status" NOT IN ('checked_in', 'completed')
              AND "checked_in_at" IS NULL
              AND "checked_in_by_id" IS NULL)
          ),
        ADD CONSTRAINT "CHK_bookings_checkout_state"
          CHECK (
            ("status" = 'completed'
              AND "checked_out_at" IS NOT NULL
              AND "checked_out_by_id" IS NOT NULL)
            OR ("status" <> 'completed'
              AND "checked_out_at" IS NULL
              AND "checked_out_by_id" IS NULL)
          ),
        ADD CONSTRAINT "CHK_bookings_no_show_state"
          CHECK (
            ("status" = 'no_show'
              AND "no_show_at" IS NOT NULL
              AND "no_show_by_id" IS NOT NULL)
            OR ("status" <> 'no_show'
              AND "no_show_at" IS NULL
              AND "no_show_by_id" IS NULL)
          ),
        ADD CONSTRAINT "EXCL_bookings_resource_period_blocking"
          EXCLUDE USING gist (
            "resource_id" WITH =,
            "booking_period" WITH &&
          )
          WHERE ("status" IN ('pending', 'confirmed', 'checked_in'))
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_bookings_pending_created_at"
        ON "bookings" ("created_at") WHERE "status" = 'pending'
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_bookings_operations_date_status"
        ON "bookings" ("booking_date", "start_time", "status")
        WHERE "status" IN ('confirmed', 'checked_in')
    `);
    await queryRunner.query(`DROP TYPE "bookings_status_enum_old"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const [{ count }] = await queryRunner.query(
      `SELECT count(*)::text AS count FROM "bookings"
       WHERE "status" IN ('checked_in', 'completed', 'no_show')
          OR "check_in_requested_at" IS NOT NULL`,
    );
    if (count !== '0') {
      throw new Error(
        'Cannot revert check-in workflow while check-in records exist',
      );
    }

    await queryRunner.query(`DROP INDEX "IDX_bookings_operations_date_status"`);
    await queryRunner.query(`DROP INDEX "IDX_bookings_pending_created_at"`);
    await queryRunner.query(`
      ALTER TABLE "bookings"
        DROP CONSTRAINT "EXCL_bookings_resource_period_blocking",
        DROP CONSTRAINT "CHK_bookings_no_show_state",
        DROP CONSTRAINT "CHK_bookings_checkout_state",
        DROP CONSTRAINT "CHK_bookings_checked_in_state",
        DROP CONSTRAINT "CHK_bookings_check_in_request",
        DROP CONSTRAINT "CHK_bookings_rejection_state",
        DROP CONSTRAINT "CHK_bookings_pending_unreviewed",
        DROP CONSTRAINT "CHK_bookings_cancellation_state",
        DROP CONSTRAINT "FK_bookings_no_show_by_id",
        DROP CONSTRAINT "FK_bookings_checked_out_by_id",
        DROP CONSTRAINT "FK_bookings_checked_in_by_id",
        DROP COLUMN "no_show_by_id",
        DROP COLUMN "no_show_at",
        DROP COLUMN "checked_out_by_id",
        DROP COLUMN "checked_out_at",
        DROP COLUMN "checked_in_by_id",
        DROP COLUMN "checked_in_at",
        DROP COLUMN "check_in_requested_at",
        DROP COLUMN "check_in_code"
    `);
    await queryRunner.query(`
      ALTER TYPE "bookings_status_enum" RENAME TO "bookings_status_enum_new"
    `);
    await queryRunner.query(`
      CREATE TYPE "bookings_status_enum" AS ENUM (
        'pending', 'confirmed', 'rejected', 'cancelled'
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "bookings"
        ALTER COLUMN "status" TYPE "bookings_status_enum"
          USING "status"::text::"bookings_status_enum",
        ADD CONSTRAINT "CHK_bookings_cancellation_state"
          CHECK (
            ("status" = 'cancelled' AND "cancelled_at" IS NOT NULL)
            OR ("status" <> 'cancelled' AND "cancelled_at" IS NULL)
          ),
        ADD CONSTRAINT "CHK_bookings_pending_unreviewed"
          CHECK ("status" <> 'pending' OR "reviewed_at" IS NULL),
        ADD CONSTRAINT "CHK_bookings_rejection_state"
          CHECK (
            ("status" = 'rejected' AND "rejection_reason" IS NOT NULL
              AND "reviewed_at" IS NOT NULL)
            OR ("status" <> 'rejected' AND "rejection_reason" IS NULL)
          ),
        ADD CONSTRAINT "EXCL_bookings_resource_period_blocking"
          EXCLUDE USING gist (
            "resource_id" WITH =,
            "booking_period" WITH &&
          )
          WHERE ("status" IN ('pending', 'confirmed'))
    `);
    await queryRunner.query(`DROP TYPE "bookings_status_enum_new"`);
    await queryRunner.query(`
      CREATE INDEX "IDX_bookings_pending_created_at"
        ON "bookings" ("created_at") WHERE "status" = 'pending'
    `);
  }
}
