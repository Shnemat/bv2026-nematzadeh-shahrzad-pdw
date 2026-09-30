export type HttpLogLevel = 'info' | 'warn' | 'error' | 'silent';

const HTTP_STATUS_BAD_REQUEST = 400;
const HTTP_STATUS_INTERNAL_SERVER_ERROR = 500;

const HEALTH_CHECK_LOG_PATHS = new Set([
  '/health/live',
  '/health/ready',
]);

export const resolveHttpLogLevel = (
  path: string | undefined,
  statusCode: number,
  hasError: boolean,
): HttpLogLevel => {
  const normalizedPath = path?.split('?')[0];

  if (
    !hasError &&
    statusCode < HTTP_STATUS_BAD_REQUEST &&
    normalizedPath !== undefined &&
    HEALTH_CHECK_LOG_PATHS.has(normalizedPath)
  ) {
    return 'silent';
  }

  if (hasError || statusCode >= HTTP_STATUS_INTERNAL_SERVER_ERROR) {
    return 'error';
  }

  if (statusCode >= HTTP_STATUS_BAD_REQUEST) {
    return 'warn';
  }

  return 'info';
};