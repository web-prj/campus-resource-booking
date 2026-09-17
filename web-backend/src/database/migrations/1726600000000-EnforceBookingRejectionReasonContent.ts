import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnforceBookingRejectionReasonContent1726600000000 implements MigrationInterface {
  name = 'EnforceBookingRejectionReasonContent1726600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const invalid = (await queryRunner.query(`
      SELECT "id"
      FROM "bookings"
      WHERE "status" = 'rejected'
        AND char_length(btrim("rejection_reason")) NOT BETWEEN 3 AND 500
      LIMIT 10
    `)) as unknown as { id: string }[];
    if (invalid.length) {
      throw new Error(
        `Cannot enforce rejection reason content while incompatible bookings exist: ${invalid
          .map(({ id }) => id)
          .join(', ')}`,
      );
    }

    await queryRunner.query(`
      ALTER TABLE "bookings"
        ADD CONSTRAINT "CHK_bookings_rejection_reason_content"
        CHECK (
          "status" <> 'rejected'
          OR char_length(btrim("rejection_reason")) BETWEEN 3 AND 500
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "bookings"
        DROP CONSTRAINT "CHK_bookings_rejection_reason_content"
    `);
  }
}
