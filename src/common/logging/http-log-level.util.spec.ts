import { resolveHttpLogLevel } from './http-log-level.util';

describe('resolveHttpLogLevel', () => {
  it('silences successful liveness/readiness probes', () => {
    expect(resolveHttpLogLevel('/health/live', 200, false)).toBe('silent');
    expect(resolveHttpLogLevel('/health/ready', 200, false)).toBe('silent');
  });

  it('keeps failed health probes visible', () => {
    expect(resolveHttpLogLevel('/health/ready', 503, false)).toBe('error');
    expect(resolveHttpLogLevel('/health/live', 500, true)).toBe('error');
    expect(resolveHttpLogLevel('/health/ready', 400, false)).toBe('warn');
  });

  it('ignores a query string when matching a health path', () => {
    expect(resolveHttpLogLevel('/health/live?probe=1', 200, false)).toBe(
      'silent',
    );
  });

  it('logs ordinary successful requests at info', () => {
    expect(resolveHttpLogLevel('/api/auth/login', 200, false)).toBe('info');
  });

  it('logs client errors at warn and server errors at error', () => {
    expect(resolveHttpLogLevel('/api/auth/register', 422, false)).toBe('warn');
    expect(resolveHttpLogLevel('/api/auth/refresh', 500, false)).toBe('error');
  });

  it('logs at error level whenever pino-http reports an error, regardless of path', () => {
    expect(resolveHttpLogLevel('/health/live', 200, true)).toBe('error');
  });
});