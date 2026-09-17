import { MigrationInterface, QueryRunner } from 'typeorm';

export class HardenCheckInLifecycle1726700000000 implements MigrationInterface {
  name = 'HardenCheckInLifecycle1726700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const invalid = (await queryRunner.query(`
      SELECT "id"
      FROM "bookings"
      WHERE
        ("status" = 'confirmed' AND "check_in_requested_at" IS NOT NULL
          AND ("check_in_code" IS NULL
            OR "check_in_code" !~ '^[0-9]{6}$'))
        OR ("check_in_requested_at" IS NOT NULL AND (
          "check_in_requested_at" <
            (("booking_date" + "start_time") AT TIME ZONE 'Asia/Ho_Chi_Minh')
              - INTERVAL '15 minutes'
          OR "check_in_requested_at" >=
            (("booking_date" + "end_time") AT TIME ZONE 'Asia/Ho_Chi_Minh')
        ))
        OR ("status" IN ('checked_in', 'completed')
          AND ("check_in_requested_at" IS NULL
            OR "checked_in_at" < "check_in_requested_at"
            OR "checked_in_at" <
              (("booking_date" + "start_time") AT TIME ZONE 'Asia/Ho_Chi_Minh')
                - INTERVAL '15 minutes'
            OR "checked_in_at" >=
              (("booking_date" + "end_time") AT TIME ZONE 'Asia/Ho_Chi_Minh')))
        OR ("status" = 'completed' AND "checked_out_at" < "checked_in_at")
        OR ("status" = 'no_show' AND "no_show_at" <
          (("booking_date" + "end_time") AT TIME ZONE 'Asia/Ho_Chi_Minh'))
      LIMIT 10
    `)) as unknown as { id: string }[];
    if (invalid.length) {
      throw new Error(
        `Cannot harden check-in lifecycle while incompatible bookings exist: ${invalid
          .map(({ id }) => id)
          .join(', ')}`,
      );
    }

    await queryRunner.query(`
      ALTER TABLE "bookings"
        DROP CONSTRAINT "CHK_bookings_checked_in_state",
        DROP CONSTRAINT "CHK_bookings_check_in_request"
    `);
    await queryRunner.query(`
      UPDATE "bookings"
      SET "check_in_code" = NULL
      WHERE "status" IN ('checked_in', 'completed', 'no_show')
    `);
    await queryRunner.query(`
      ALTER TABLE "bookings"
        ADD CONSTRAINT "CHK_bookings_check_in_request"
          CHECK (
            ("check_in_requested_at" IS NULL AND "check_in_code" IS NULL)
            OR (
              "check_in_requested_at" IS NOT NULL
              AND (
                ("status" = 'confirmed' AND "check_in_code" ~ '^[0-9]{6}$')
                OR ("status" IN ('checked_in', 'completed', 'no_show')
                  AND "check_in_code" IS NULL)
              )
            )
          ),
        ADD CONSTRAINT "CHK_bookings_checked_in_state"
          CHECK (
            ("status" IN ('checked_in', 'completed')
              AND "check_in_requested_at" IS NOT NULL
              AND "checked_in_at" IS NOT NULL
              AND "checked_in_by_id" IS NOT NULL)
            OR ("status" NOT IN ('checked_in', 'completed')
              AND "checked_in_at" IS NULL
              AND "checked_in_by_id" IS NULL)
          ),
        ADD CONSTRAINT "CHK_bookings_check_in_timeline"
          CHECK (
            ("check_in_requested_at" IS NULL OR (
              "check_in_requested_at" >=
                (("booking_date" + "start_time") AT TIME ZONE 'Asia/Ho_Chi_Minh')
                  - INTERVAL '15 minutes'
              AND "check_in_requested_at" <
                (("booking_date" + "end_time") AT TIME ZONE 'Asia/Ho_Chi_Minh')
            ))
            AND ("checked_in_at" IS NULL OR (
              "check_in_requested_at" IS NOT NULL
              AND "checked_in_at" >= "check_in_requested_at"
              AND "checked_in_at" >=
                (("booking_date" + "start_time") AT TIME ZONE 'Asia/Ho_Chi_Minh')
                  - INTERVAL '15 minutes'
              AND "checked_in_at" <
                (("booking_date" + "end_time") AT TIME ZONE 'Asia/Ho_Chi_Minh')
            ))
            AND ("checked_out_at" IS NULL
              OR "checked_out_at" >= "checked_in_at")
          ),
        ADD CONSTRAINT "CHK_bookings_no_show_timeline"
          CHECK (
            "no_show_at" IS NULL
            OR "no_show_at" >=
              (("booking_date" + "end_time") AT TIME ZONE 'Asia/Ho_Chi_Minh')
          )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const consumed = (await queryRunner.query(`
      SELECT "id"
      FROM "bookings"
      WHERE "check_in_requested_at" IS NOT NULL
        AND "check_in_code" IS NULL
      LIMIT 10
    `)) as unknown as { id: string }[];
    if (consumed.length) {
      throw new Error(
        `Cannot revert check-in lifecycle hardening after codes were consumed: ${consumed
          .map(({ id }) => id)
          .join(', ')}`,
      );
    }

    await queryRunner.query(`
      ALTER TABLE "bookings"
        DROP CONSTRAINT "CHK_bookings_no_show_timeline",
        DROP CONSTRAINT "CHK_bookings_check_in_timeline",
        DROP CONSTRAINT "CHK_bookings_checked_in_state",
        DROP CONSTRAINT "CHK_bookings_check_in_request",
        ADD CONSTRAINT "CHK_bookings_check_in_request"
          CHECK (
            ("check_in_code" IS NULL AND "check_in_requested_at" IS NULL)
            OR ("check_in_code" ~ '^[0-9]{6}$'
              AND "check_in_requested_at" IS NOT NULL)
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
          )
    `);
  }
}
