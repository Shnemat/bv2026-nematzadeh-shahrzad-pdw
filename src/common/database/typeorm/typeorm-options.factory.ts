import { join } from 'node:path';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSourceOptions } from 'typeorm';
import { AppMode, EnvService, ValidatedEnvironment } from '../../config';

export const createNestTypeOrmOptions = (
  envService: EnvService,
): TypeOrmModuleOptions => {
  return {
    ...createTypeOrmDataSourceOptions({
      NODE_ENV: envService.appMode,
      DB_TYPE: envService.databaseType,
      DB_HOST: envService.databaseHost,
      DB_PORT: envService.databasePort,
      DB_USER: envService.databaseUser,
      DB_PASSWORD: envService.databasePassword,
      DB_DATABASE: envService.databaseName,
      DB_SYNC: envService.databaseSynchronize,
      DB_MIGRATION: envService.databaseMigrationsRun,
      DB_LOG: envService.databaseLogging,
      DB_SCHEMA: envService.databaseSchema,
    }),
    autoLoadEntities: true,
    manualInitialization: envService.isTest,
    retryAttempts: envService.isTest ? 0 : 3,
    retryDelay: 1000,
  };
};

export const createTypeOrmDataSourceOptions = (
  environment: Pick<
    ValidatedEnvironment,
    | 'NODE_ENV'
    | 'DB_TYPE'
    | 'DB_HOST'
    | 'DB_PORT'
    | 'DB_USER'
    | 'DB_PASSWORD'
    | 'DB_DATABASE'
    | 'DB_SYNC'
    | 'DB_MIGRATION'
    | 'DB_LOG'
    | 'DB_SCHEMA'
  >,
): DataSourceOptions => {
  return {
    type: environment.DB_TYPE,
    host: environment.DB_HOST,
    port: environment.DB_PORT,
    username: environment.DB_USER,
  password: environment.DB_PASSWORD as string,
   database: environment.DB_DATABASE as string,
    synchronize: environment.DB_SYNC as boolean,
migrationsRun: environment.DB_MIGRATION as boolean,
logging: environment.DB_LOG as boolean,
   schema: environment.DB_SCHEMA as string,
    extra:
      environment.DB_SCHEMA === 'public'
        ? undefined
        : { options: `-c search_path="${environment.DB_SCHEMA}",public` },
    entities: [join(__dirname, '..', '..', '..', '**', '*.entity.{ts,js}')],
    migrations: [
      join(
        __dirname,
        '..',
        '..',
        '..',
        '..',
        'database',
        'migrations',
        '*.{ts,js}',
      ),
    ],
  };
};