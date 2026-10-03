import { PinoLogger } from 'nestjs-pino';
import { AppLogger } from './app-logger.service';
import { LogCategory } from './data/enum/log-category.enum';

type MockPinoLogger = {
  info: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
  setContext: jest.Mock;
};

const createMockPinoLogger = (): MockPinoLogger => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  setContext: jest.fn(),
});

describe('AppLogger', () => {
  let pinoLogger: MockPinoLogger;
  let appLogger: AppLogger;

  beforeEach(() => {
    pinoLogger = createMockPinoLogger();
    appLogger = new AppLogger(pinoLogger as unknown as PinoLogger);
  });

  it('writes application events at info level with the application category', () => {
    appLogger.application({ event: 'application.started', port: 3000 });

    expect(pinoLogger.info).toHaveBeenCalledWith(
      {
        category: LogCategory.Application,
        event: 'application.started',
        port: 3000,
      },
      'application.started',
    );
  });

  it('writes security events at warn level with the security category', () => {
    appLogger.security({ event: 'security.authorization.denied' });

    expect(pinoLogger.warn).toHaveBeenCalledWith(
      {
        category: LogCategory.Security,
        event: 'security.authorization.denied',
      },
      'security.authorization.denied',
    );
  });

  it('writes audit events at info level with the audit category', () => {
    appLogger.audit({
      event: 'audit.resource.created',
      resourceId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
    });

    expect(pinoLogger.info).toHaveBeenCalledWith(
      {
        category: LogCategory.Audit,
        event: 'audit.resource.created',
        resourceId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
      },
      'audit.resource.created',
    );
  });

  it('forwards setContext to the underlying PinoLogger', () => {
    appLogger.setContext('ExampleService');

    expect(pinoLogger.setContext).toHaveBeenCalledWith('ExampleService');
  });
});