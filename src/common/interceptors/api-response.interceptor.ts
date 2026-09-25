import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { ApiResponse } from '../config/api-response';

@Injectable()
export class ApiResponseInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  constructor(private readonly reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T>> {
    const code =
      this.reflector.get<string>(
        'api:success-code',
        context.getHandler(),
      ) ?? 'api.common.success';

    return next.handle().pipe(
      map((data) => ({
        code,
        result: true,
        data,
        validationErrors: [],
      })),
    );
  }
}