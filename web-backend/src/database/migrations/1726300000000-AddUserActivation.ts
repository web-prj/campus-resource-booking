import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserActivation1726300000000 implements MigrationInterface {
  name = 'AddUserActivation1726300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN "is_active" boolean NOT NULL DEFAULT true
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_users_role_active" ON "users" ("role", "is_active")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_users_role_active"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "is_active"`);
  }
}
