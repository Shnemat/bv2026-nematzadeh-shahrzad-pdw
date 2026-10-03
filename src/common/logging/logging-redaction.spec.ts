import { Writable } from 'node:stream';
import pino from 'pino';
import { LOG_REDACTION_PATHS } from './logging-redaction';

const createCapturingLogger = (): {
  logger: pino.Logger;
  readLastEntry: () => Record<string, unknown>;
} => {
  const lines: string[] = [];

  const stream = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      lines.push(chunk.toString());
      callback();
    },
  });

  const logger = pino(
    { redact: { paths: LOG_REDACTION_PATHS, censor: '[REDACTED]' } },
    stream,
  );

  return {
    logger,
    readLastEntry: () =>
      JSON.parse(lines[lines.length - 1]) as Record<string, unknown>,
  };
};

describe('LOG_REDACTION_PATHS', () => {
  it('redacts sensitive request headers', () => {
    const { logger, readLastEntry } = createCapturingLogger();

    logger.info({
      req: {
        headers: {
          authorization: 'Bearer secret-token',
          cookie: 'session=abc',
        },
      },
    });

    const entry = readLastEntry();
    const serialized = JSON.stringify(entry);

    expect(serialized).not.toContain('secret-token');
    expect(serialized).not.toContain('session=abc');
    expect(serialized).toContain('[REDACTED]');
  });

  it('redacts sensitive response headers', () => {
    const { logger, readLastEntry } = createCapturingLogger();

    logger.info({
      res: {
        headers: {
          'set-cookie': 'token=abc; Secure',
        },
      },
    });

    const serialized = JSON.stringify(readLastEntry());

    expect(serialized).not.toContain('token=abc');
  });

  it('redacts sensitive top-level request body fields', () => {
    const { logger, readLastEntry } = createCapturingLogger();

    logger.info({
      req: {
        body: {
          email: 'user@example.com',
          password: 'hunter2',
          accessToken: 'access-token-value',
          apiKey: 'api-key-value',
        },
      },
    });

    const entry = readLastEntry();
    const serialized = JSON.stringify(entry);

    expect(serialized).not.toContain('hunter2');
    expect(serialized).not.toContain('access-token-value');
    expect(serialized).not.toContain('api-key-value');
    expect(serialized).toContain('user@example.com');
  });

  it('redacts sensitive fields nested one level inside the request body', () => {
    const { logger, readLastEntry } = createCapturingLogger();

    logger.info({
      req: {
        body: {
          user: {
            name: 'Ada',
            passwordHash: 'nested-secret',
          },
        },
      },
    });

    const serialized = JSON.stringify(readLastEntry());

    expect(serialized).not.toContain('nested-secret');
    expect(serialized).toContain('Ada');
  });

  it('redacts sensitive request query parameters', () => {
    const { logger, readLastEntry } = createCapturingLogger();

    logger.info({
      req: {
        query: {
          token: 'query-token-value',
        },
      },
    });

    const serialized = JSON.stringify(readLastEntry());

    expect(serialized).not.toContain('query-token-value');
  });

  it('leaves non-sensitive fields untouched', () => {
    const { logger, readLastEntry } = createCapturingLogger();

    logger.info({
      req: {
        body: {
          name: 'Ada',
          age: 36,
        },
      },
    });

    const entry = readLastEntry() as {
      req: {
        body: {
          name: string;
          age: number;
        };
      };
    };

    expect(entry.req.body.name).toBe('Ada');
    expect(entry.req.body.age).toBe(36);
  });
});