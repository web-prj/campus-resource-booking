import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStudentBookingManagement1726000000000 implements MigrationInterface {
  name = 'AddStudentBookingManagement1726000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "bookings"
        DROP CONSTRAINT "EXCL_bookings_resource_period_blocking"
    `);
    await queryRunner.query(`
      ALTER TYPE "bookings_status_enum" RENAME TO "bookings_status_enum_old"
    `);
    await queryRunner.query(`
      CREATE TYPE "bookings_status_enum" AS ENUM (
        'pending',
        'confirmed',
        'cancelled'
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "bookings"
        ALTER COLUMN "status" TYPE "bookings_status_enum"
        USING "status"::text::"bookings_status_enum",
        ADD "cancelled_at" TIMESTAMP WITH TIME ZONE,
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
    await queryRunner.query(`DROP TYPE "bookings_status_enum_old"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const [{ count }] = await queryRunner.query(
      `SELECT count(*)::text AS count FROM "bookings" WHERE "status" = 'cancelled'`,
    );
    if (count !== '0') {
      throw new Error(
        'Cannot revert student booking management while cancelled bookings exist',
      );
    }

    await queryRunner.query(`
      ALTER TABLE "bookings"
        DROP CONSTRAINT "EXCL_bookings_resource_period_blocking",
        DROP CONSTRAINT "CHK_bookings_cancellation_state",
        DROP COLUMN "cancelled_at"
    `);
    await queryRunner.query(`
      ALTER TYPE "bookings_status_enum" RENAME TO "bookings_status_enum_new"
    `);
    await queryRunner.query(`
      CREATE TYPE "bookings_status_enum" AS ENUM ('pending', 'confirmed')
    `);
    await queryRunner.query(`
      ALTER TABLE "bookings"
        ALTER COLUMN "status" TYPE "bookings_status_enum"
        USING "status"::text::"bookings_status_enum",
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
