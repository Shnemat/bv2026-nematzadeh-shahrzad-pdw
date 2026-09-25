import { HttpException, HttpStatus } from '@nestjs/common';

export class ApiException extends HttpException {
  constructor(
    apiCode: string,
    statusCode: HttpStatus,
    data: unknown = null,
    validationErrors: unknown[] = [],
  ) {
    super(
      {
        code: apiCode,
        result: false,
        data,
        validationErrors,
      },
      statusCode,
    );
  }
}