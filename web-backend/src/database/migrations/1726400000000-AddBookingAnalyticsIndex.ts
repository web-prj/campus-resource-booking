import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBookingAnalyticsIndex1726400000000 implements MigrationInterface {
  name = 'AddBookingAnalyticsIndex1726400000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_bookings_analytics_date_status_resource" ON "bookings" ("booking_date", "status", "resource_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_resource_closures_date" ON "resource_closures" ("date")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_resource_closures_date"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_bookings_analytics_date_status_resource"`,
    );
  }
}
