import { AppLogger } from './app-logger.service';
import { ApplicationLifecycleLogger } from './application-lifecycle.logger';

type MockAppLogger = {
  setContext: jest.Mock;
  application: jest.Mock;
};

describe('ApplicationLifecycleLogger', () => {
  it('logs a structured application.stopped event on shutdown', () => {
    const mockAppLogger: MockAppLogger = {
      setContext: jest.fn(),
      application: jest.fn(),
    };

    const lifecycleLogger = new ApplicationLifecycleLogger(
      mockAppLogger as unknown as AppLogger,
    );

    lifecycleLogger.onApplicationShutdown('SIGTERM');

    expect(mockAppLogger.setContext).toHaveBeenCalledWith(
      'ApplicationLifecycleLogger',
    );

    expect(mockAppLogger.application).toHaveBeenCalledWith({
      event: 'application.stopped',
      signal: 'SIGTERM',
    });
  });
});