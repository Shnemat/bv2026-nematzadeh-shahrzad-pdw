import { ArgumentMetadata, HttpStatus } from '@nestjs/common';
import { ApiException } from '@common/api';
import { ParseUlidPipe } from './parse-ulid.pipe';

describe('ParseUlidPipe', () => {
  const pipe = new ParseUlidPipe();

  const metadata: ArgumentMetadata = {
    type: 'param',
    data: 'id',
  };

  it('should accept a valid ULID', () => {
    const value = '01ARZ3NDEKTSV4RRFFQ69G5FAV';

    expect(pipe.transform(value, metadata)).toBe(value);
  });

  it('should reject an invalid ULID', () => {
    const value = 'invalid-ulid';

    expect(() => pipe.transform(value, metadata)).toThrow(ApiException);

    try {
      pipe.transform(value, metadata);
    } catch (error) {
      expect(error).toBeInstanceOf(ApiException);

      const exception = error as ApiException;

      expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST);
      expect(exception.apiCode).toBe('api.common.invalid-identifier');
    }
  });

  it('should reject an ULID with an invalid length', () => {
    const value = '01ARZ3NDEKTSV4RRFFQ69G5';

    expect(() => pipe.transform(value, metadata)).toThrow(ApiException);
  });
});