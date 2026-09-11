import { registerAs } from '@nestjs/config';

export const DATABASE_CONFIG_KEY = 'database';

export const databaseConfig = registerAs(DATABASE_CONFIG_KEY, () => ({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  synchronize: process.env.DB_SYNCHRONIZE === 'true',
  logging: process.env.DB_LOGGING === 'true',
}));
