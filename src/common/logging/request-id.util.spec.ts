import { ULID_REGEX } from '@common/database';
import { resolveRequestId } from './request-id.util';

describe('resolveRequestId', () => {
  it('accepts a well-formed incoming ULID', () => {
    const validUlid = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
    expect(resolveRequestId(validUlid)).toBe(validUlid);
  });

  it('accepts the first value when the header is repeated', () => {
    const validUlid = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
    expect(resolveRequestId([validUlid, 'ignored'])).toBe(validUlid);
  });

  it('generates a fresh ULID when the header is missing', () => {
    const requestId = resolveRequestId(undefined);
    expect(requestId).toMatch(ULID_REGEX);
  });

  it('generates a fresh ULID when the incoming value is malformed', () => {
    const requestId = resolveRequestId('not-a-ulid; DROP TABLE users;');
    expect(requestId).toMatch(ULID_REGEX);
    expect(requestId).not.toContain('DROP TABLE');
  });

  it('generates a fresh ULID when the incoming value is empty', () => {
    expect(resolveRequestId('')).toMatch(ULID_REGEX);
  });
});