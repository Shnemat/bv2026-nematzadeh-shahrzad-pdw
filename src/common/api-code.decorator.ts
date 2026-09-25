import { SetMetadata } from '@nestjs/common';

export const ApiSuccessCode =
  (code: string): MethodDecorator =>
    SetMetadata('api:success-code', code);