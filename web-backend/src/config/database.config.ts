import { registerAs } from '@nestjs/config';
import { DEFAULT_DB_PORT } from './defaults';

export const DATABASE_CONFIG_KEY = 'database';

export const databaseConfig = registerAs(DATABASE_CONFIG_KEY, () => ({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? DEFAULT_DB_PORT),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  synchronize: process.env.DB_SYNCHRONIZE === 'true',
  logging: process.env.DB_LOGGING === 'true',
}));
