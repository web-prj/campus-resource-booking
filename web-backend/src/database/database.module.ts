import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatabaseConfig, databaseConfig } from '../config';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      ...databaseConfig.asProvider(),
      useFactory: (config: DatabaseConfig) => ({
        type: 'postgres' as const,
        host: config.host,
        port: config.port,
        username: config.username,
        password: config.password,
        database: config.database,
        autoLoadEntities: true,
        // Schema changes go through migrations; synchronize stays off.
        synchronize: config.synchronize,
        logging: config.logging,
        migrations: [__dirname + '/migrations/*{.ts,.js}'],
      }),
    }),
  ],
})
export class DatabaseModule {}
