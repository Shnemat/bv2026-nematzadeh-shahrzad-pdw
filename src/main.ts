import { Reflector } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { EnvService } from '@common/config/env.service';
import { ApiResponseInterceptor } from '@common/interceptors/api-response.interceptor';
import { ApiExceptionFilter } from '@common/filters/api-exception.filter';
import { AppModule } from '@root/app.module';

const bootstrap = async () => {
  const app = await NestFactory.create(AppModule.register());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

 app.useGlobalInterceptors(
  new ApiResponseInterceptor(app.get(Reflector)),
);

  app.useGlobalFilters(new ApiExceptionFilter());

  const envService: EnvService = app.get(EnvService);

  await app.listen(envService.appPort);
};

bootstrap().catch((err) => {
  console.error('Error starting the application:', err);
  process.exit(1);
});