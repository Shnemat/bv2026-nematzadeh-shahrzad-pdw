import { json, urlencoded } from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import {
  INestApplication,
  RequestMethod,
  ValidationPipe,
} from '@nestjs/common';
import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import { NestExpressApplication } from '@nestjs/platform-express';
import {
  ApiInterceptor,
  HttpExceptionFilter,
  ValidationException,
} from '@common/api';
import { setupSwagger } from '@common/api/swagger/setup-swagger';
import { EnvService } from '@common/config';

export const configureApplication = (app: INestApplication): void => {
  const envService = app.get(EnvService);

  configureHttp(app, envService);

  app.setGlobalPrefix(envService.appBaseUrl, {
    exclude: [
      { path: 'health/live', method: RequestMethod.GET },
      { path: 'health/ready', method: RequestMethod.GET },
    ],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      transform: true,
      exceptionFactory: (errors) =>
        ValidationException.fromClassValidatorErrors(
          errors,
          envService.httpPayloadErrorStatusCode,
        ),
    }),
  );

  app.useGlobalFilters(app.get(HttpExceptionFilter));
  app.useGlobalInterceptors(app.get(ApiInterceptor));

  setupSwagger(app);
};

const configureHttp = (
  app: INestApplication,
  envService: EnvService,
): void => {
  app.use(json({ limit: '1mb' }));
  app.use(urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser());
  app.use(helmet());

  const corsOptions: CorsOptions = {
    origin: (origin, callback) => {
      if (!origin || envService.corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('Origin is not allowed by CORS'), false);
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept', 'X-CSRF-Token'],
    maxAge: 600,
  };

  app.enableCors(corsOptions);

  (app as NestExpressApplication).set(
    'trust proxy',
    envService.trustProxy,
  );
};