import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnforceResourceCapacityLimit1726500000000 implements MigrationInterface {
  name = 'EnforceResourceCapacityLimit1726500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM "resources" WHERE "capacity" > 10000) THEN
          RAISE EXCEPTION
            'Resource capacity must not exceed the supported maximum of 10000';
        END IF;
      END
      $$
    `);

    await queryRunner.query(`
      ALTER TABLE "resources"
        DROP CONSTRAINT "CHK_resources_capacity_positive",
        ADD CONSTRAINT "CHK_resources_capacity_supported"
          CHECK ("capacity" BETWEEN 1 AND 10000)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "resources"
        DROP CONSTRAINT "CHK_resources_capacity_supported",
        ADD CONSTRAINT "CHK_resources_capacity_positive"
          CHECK ("capacity" > 0)
    `);
  }
}
