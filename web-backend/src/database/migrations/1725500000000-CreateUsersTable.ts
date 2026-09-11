import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsersTable1725500000000 implements MigrationInterface {
  name = 'CreateUsersTable1725500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // gen_random_uuid() ships with PostgreSQL 13+; pgcrypto is not needed.
    await queryRunner.query(`
      CREATE TYPE "users_role_enum" AS ENUM ('student', 'staff', 'admin')
    `);

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "email" character varying(255) NOT NULL,
        "password_hash" character varying(72) NOT NULL,
        "full_name" character varying(120) NOT NULL,
        "role" "users_role_enum" NOT NULL DEFAULT 'student',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users_id" PRIMARY KEY ("id")
      )
    `);

    // Backs both the uniqueness guarantee and the login lookup by email.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_users_email" ON "users" ("email")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_users_email"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "users_role_enum"`);
  }
}
