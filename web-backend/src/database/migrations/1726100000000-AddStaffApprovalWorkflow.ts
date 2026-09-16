import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStaffApprovalWorkflow1726100000000 implements MigrationInterface {
  name = 'AddStaffApprovalWorkflow1726100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "bookings"
        DROP CONSTRAINT "EXCL_bookings_resource_period_blocking",
        DROP CONSTRAINT "CHK_bookings_cancellation_state"
    `);
    await queryRunner.query(`
      ALTER TYPE "bookings_status_enum" RENAME TO "bookings_status_enum_old"
    `);
    await queryRunner.query(`
      CREATE TYPE "bookings_status_enum" AS ENUM (
        'pending',
        'confirmed',
        'rejected',
        'cancelled'
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "bookings"
        ALTER COLUMN "status" TYPE "bookings_status_enum"
          USING "status"::text::"bookings_status_enum",
        ADD "reviewed_at" TIMESTAMP WITH TIME ZONE,
        ADD "reviewed_by_id" uuid,
        ADD "rejection_reason" varchar(500),
        ADD CONSTRAINT "FK_bookings_reviewed_by_id"
          FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT,
        ADD CONSTRAINT "CHK_bookings_cancellation_state"
          CHECK (
            ("status" = 'cancelled' AND "cancelled_at" IS NOT NULL)
            OR ("status" <> 'cancelled' AND "cancelled_at" IS NULL)
          ),
        ADD CONSTRAINT "CHK_bookings_review_pair"
          CHECK (
            ("reviewed_at" IS NULL AND "reviewed_by_id" IS NULL)
            OR ("reviewed_at" IS NOT NULL AND "reviewed_by_id" IS NOT NULL)
          ),
        ADD CONSTRAINT "CHK_bookings_rejection_state"
          CHECK (
            ("status" = 'rejected' AND "rejection_reason" IS NOT NULL
              AND "reviewed_at" IS NOT NULL)
            OR ("status" <> 'rejected' AND "rejection_reason" IS NULL)
          ),
        ADD CONSTRAINT "CHK_bookings_pending_unreviewed"
          CHECK ("status" <> 'pending' OR "reviewed_at" IS NULL),
        ADD CONSTRAINT "EXCL_bookings_resource_period_blocking"
          EXCLUDE USING gist (
            "resource_id" WITH =,
            "booking_period" WITH &&
          )
          WHERE ("status" IN ('pending', 'confirmed'))
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_bookings_pending_created_at"
        ON "bookings" ("created_at") WHERE "status" = 'pending'
    `);
    await queryRunner.query(`DROP TYPE "bookings_status_enum_old"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const [{ count }] = await queryRunner.query(
      `SELECT count(*)::text AS count FROM "bookings"
       WHERE "status" = 'rejected' OR "reviewed_at" IS NOT NULL`,
    );
    if (count !== '0') {
      throw new Error(
        'Cannot revert staff approval workflow while reviewed bookings exist',
      );
    }

    await queryRunner.query(`DROP INDEX "IDX_bookings_pending_created_at"`);
    await queryRunner.query(`
      ALTER TABLE "bookings"
        DROP CONSTRAINT "EXCL_bookings_resource_period_blocking",
        DROP CONSTRAINT "CHK_bookings_pending_unreviewed",
        DROP CONSTRAINT "CHK_bookings_rejection_state",
        DROP CONSTRAINT "CHK_bookings_review_pair",
        DROP CONSTRAINT "CHK_bookings_cancellation_state",
        DROP CONSTRAINT "FK_bookings_reviewed_by_id",
        DROP COLUMN "rejection_reason",
        DROP COLUMN "reviewed_by_id",
        DROP COLUMN "reviewed_at"
    `);
    await queryRunner.query(`
      ALTER TYPE "bookings_status_enum" RENAME TO "bookings_status_enum_new"
    `);
    await queryRunner.query(`
      CREATE TYPE "bookings_status_enum" AS ENUM (
        'pending', 'confirmed', 'cancelled'
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
        ADD CONSTRAINT "EXCL_bookings_resource_period_blocking"
          EXCLUDE USING gist (
            "resource_id" WITH =,
            "booking_period" WITH &&
          )
          WHERE ("status" IN ('pending', 'confirmed'))
    `);
    await queryRunner.query(`DROP TYPE "bookings_status_enum_new"`);
  }
}
