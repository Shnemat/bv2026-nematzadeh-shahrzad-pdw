import { DynamicModule, Module } from '@nestjs/common';
import { ApiInterceptor, HttpExceptionFilter } from '@common/api';
import { AppConfigModule } from '@common/config';
import { DatabaseModule } from '@common/database';
import { LoggingModule } from '@common/logging';
import { HealthModule } from '@core/health';

@Module({})
export class AppModule {
  static register(): DynamicModule {
    return {
      module: AppModule,
      imports: [
        AppConfigModule.register(),
        LoggingModule,
        DatabaseModule,
        HealthModule,
      ],
      providers: [
        ApiInterceptor,
        HttpExceptionFilter,
      ],
    };
  }
}