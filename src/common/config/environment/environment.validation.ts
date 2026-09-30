import { z } from 'zod';
import { AppMode } from '../data/enum/app-mode.enum';
import { DatabaseType } from '../data/enum/database-type.enum';
import { LogLevel } from '../data/enum/log-level.enum';

const booleanFromStringSchema = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true');

const nonEmptyStringSchema = z.string().trim().min(1);

const appModeSchema = z
  .enum(['DEV', 'TEST', 'PROD', 'development', 'test', 'production'])
  .transform((value) => {
    if (value === 'development') {
      return AppMode.Dev;
    }

    if (value === 'test') {
      return AppMode.Test;
    }

    if (value === 'production') {
      return AppMode.Prod;
    }

    return value as AppMode;
  });

const corsOriginsSchema = nonEmptyStringSchema.transform((value, context) => {
  const origins = value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (origins.length === 0 || origins.includes('*')) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        'APP_CORS_ORIGIN must be an explicit allowlist and cannot use *',
    });

    return z.NEVER;
  }

  return origins;
});

const environmentSchema = z
  .object({
    NODE_ENV: appModeSchema,
    APP_NAME: nonEmptyStringSchema,
    APP_PORT: z.coerce.number().int().min(1).max(65535),
    APP_BASE_URL: nonEmptyStringSchema
      .regex(/^[a-zA-Z0-9][a-zA-Z0-9/_-]*$/)
      .transform((value) => value.replace(/^\/+|\/+$/g, '')),
    APP_CORS_ORIGIN: corsOriginsSchema,
    APP_TRUST_PROXY: booleanFromStringSchema,
    APP_HTTP_PAYLOAD_ERROR_CODE: z.coerce.number().int().min(400).max(499),
    LOG_LEVEL: z.nativeEnum(LogLevel),
    SWAGGER_ENABLED: booleanFromStringSchema,
    SWAGGER_TITLE: nonEmptyStringSchema,
    SWAGGER_DESCRIPTION: nonEmptyStringSchema,
    SWAGGER_VERSION: nonEmptyStringSchema,
    SWAGGER_PATH: nonEmptyStringSchema
      .regex(/^[a-zA-Z0-9][a-zA-Z0-9/_-]*$/)
      .transform((value) => value.replace(/^\/+|\/+$/g, '')),

    DB_TYPE: z.nativeEnum(DatabaseType),
    DB_HOST: nonEmptyStringSchema,
    DB_PORT: z.coerce.number().int().min(1).max(65535),
    DB_USER: nonEmptyStringSchema,
    DB_PASSWORD: nonEmptyStringSchema,
    DB_DATABASE: nonEmptyStringSchema,
    DB_SYNC: booleanFromStringSchema,
    DB_MIGRATION: booleanFromStringSchema,
    DB_LOG: booleanFromStringSchema,
    DB_SCHEMA: z
      .string()
      .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/)
      .default('public'),

    AUTH_PASSWORD_MIN_LENGTH: z.coerce.number().int().min(1).default(15),
    AUTH_PASSWORD_MAX_LENGTH: z.coerce
      .number()
      .int()
      .min(64)
      .max(1024)
      .default(128),
    AUTH_PASSWORD_ARGON2_MEMORY_COST: z.coerce
      .number()
      .int()
      .min(19456)
      .default(19456),
    AUTH_PASSWORD_ARGON2_TIME_COST: z.coerce.number().int().min(2).default(2),
    AUTH_PASSWORD_ARGON2_PARALLELISM: z.coerce.number().int().min(1).default(1),
    AUTH_PASSWORD_MAX_ATTEMPTS: z.coerce
      .number()
      .int()
      .min(1)
      .max(100)
      .default(5),
    AUTH_PASSWORD_LOCKOUT_SECONDS: z.coerce
      .number()
      .int()
      .min(1)
      .default(900),
    AUTH_ACCESS_TOKEN_TTL_SECONDS: z.coerce
      .number()
      .int()
      .min(1)
      .max(600)
      .default(600),
    AUTH_REFRESH_TOKEN_TTL_SECONDS: z.coerce
      .number()
      .int()
      .min(1)
      .default(604800),
    AUTH_SESSION_ABSOLUTE_TTL_SECONDS: z.coerce
      .number()
      .int()
      .min(1)
      .default(2592000),
    AUTH_REFRESH_TOKEN_PEPPER: z.string().default(''),
    AUTH_JWT_ACTIVE_KID: z.string().default('dev-active'),
    AUTH_JWT_PRIVATE_KEY_BASE64: z.string().default(''),
    AUTH_JWT_PUBLIC_KEYS_JSON: z.string().default('{}'),
    AUTH_TEST_REFRESH_FAILURE_POINT: z
      .enum([
        '',
        'after-successor-persistence',
        'after-consumed',
        'during-session-revocation',
        'during-family-revocation',
      ])
      .default(''),
  })
  .superRefine((environment, context) => {
    if (environment.NODE_ENV === AppMode.Prod && environment.DB_SYNC) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['DB_SYNC'],
        message: 'DB_SYNC=true is not allowed in production',
      });
    }

    if (
      environment.AUTH_PASSWORD_MIN_LENGTH >
      environment.AUTH_PASSWORD_MAX_LENGTH
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['AUTH_PASSWORD_MIN_LENGTH'],
        message:
          'AUTH_PASSWORD_MIN_LENGTH cannot exceed AUTH_PASSWORD_MAX_LENGTH',
      });
    }

    if (
      environment.AUTH_REFRESH_TOKEN_TTL_SECONDS >
      environment.AUTH_SESSION_ABSOLUTE_TTL_SECONDS
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['AUTH_REFRESH_TOKEN_TTL_SECONDS'],
        message: 'Refresh token TTL cannot exceed absolute session TTL',
      });
    }

    if (environment.NODE_ENV === AppMode.Prod) {
      if (!environment.AUTH_REFRESH_TOKEN_PEPPER) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['AUTH_REFRESH_TOKEN_PEPPER'],
          message: 'Production refresh token pepper is required',
        });
      }

      if (environment.AUTH_TEST_REFRESH_FAILURE_POINT) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['AUTH_TEST_REFRESH_FAILURE_POINT'],
          message: 'Test failure injection is forbidden in production',
        });
      }

      if (
        !environment.AUTH_JWT_PRIVATE_KEY_BASE64 ||
        !environment.AUTH_JWT_PUBLIC_KEYS_JSON
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['AUTH_JWT_PRIVATE_KEY_BASE64'],
          message: 'Production JWT key material is required',
        });
      }
    }
  });

export type ValidatedEnvironment = z.infer<typeof environmentSchema>;

export const validateEnvironment = (
  config: Record<string, unknown>,
): ValidatedEnvironment => {
  const result = environmentSchema.safeParse(config);

  if (!result.success) {
    const message = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');

    throw new Error(`Invalid environment configuration: ${message}`);
  }

  return result.data;
};