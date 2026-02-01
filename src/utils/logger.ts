const isDev = __DEV__;

// Placeholder for production error tracking (e.g., Sentry, Bugsnag).
// Replace this with your error tracking service's SDK call.
function trackError(_message: string, _error?: Error): void {
  // Example Sentry integration:
  // if (!isDev && _error) Sentry.captureException(_error);
}

export const logger = {
  log: (...args: any[]) => isDev && console.log(...args),
  error: (...args: any[]) => {
    if (isDev) console.error(...args);
    trackError(String(args[0]), args[1] instanceof Error ? args[1] : undefined);
  },
  warn: (...args: any[]) => isDev && console.warn(...args),
};
