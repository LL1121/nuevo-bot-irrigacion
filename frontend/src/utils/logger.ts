import { env } from '../config/env';

type SentryLike = {
  captureException?: (error: unknown) => void;
  setContext?: (name: string, context: Record<string, unknown>) => void;
  captureMessage?: (message: string, level?: 'info' | 'warning' | 'error') => void;
};

let _sentry: SentryLike | null = null;

export const initLogger = async () => {
  if (!env.sentryDsn) {
    if (env.enableLogging) console.info('Logger: SENTRY_DSN not provided — Sentry disabled');
    return;
  }

  try {
    const Sentry = await import('@sentry/react');
    const Tracing = await import('@sentry/tracing');
    _sentry = Sentry;
    Sentry.init({
      dsn: env.sentryDsn,
      environment: env.nodeEnv || 'production',
      integrations: [
        new Tracing.Integrations.BrowserTracing({
          tracePropagationTargets: [env.apiUrl, /^\//],
        }),
      ],
      tracesSampleRate: env.nodeEnv === 'production' ? 0.1 : 1.0, // 10% in prod, 100% in dev
      beforeSend(event, hint) {
        // Filter out known errors
        if (event.exception) {
          const error = hint.originalException;
          // Ignore network errors that are expected
          if (error instanceof Error && error.message.includes('Network Error')) {
            return null;
          }
        }
        return event;
      },
    });
    
    // Set default tags
    Sentry.setTag('app_version', env.appVersion || '1.0.0');
    Sentry.setTag('environment', env.nodeEnv || 'production');
    
    console.info('Logger: Sentry initialized');
  } catch (err) {
    console.warn('Logger: @sentry packages are not installed. To enable Sentry, run: npm i @sentry/react @sentry/tracing');
    if (env.enableLogging) console.warn('Logger init error:', err);
  }
};

export const captureException = (err: unknown, ctx?: Record<string, unknown>) => {
  console.error(err, ctx || '');
  try {
    if (_sentry && _sentry.captureException) {
      _sentry.captureException(err);
      if (ctx) _sentry.setContext('logger_ctx', ctx);
    } else if ((window as Window & { Sentry?: SentryLike }).Sentry?.captureException) {
      (window as Window & { Sentry?: SentryLike }).Sentry?.captureException?.(err);
    }
  } catch (e) {
    console.warn('Logger.captureException failed', e);
  }
};

export const captureMessage = (msg: string, level: 'info' | 'warning' | 'error' = 'info') => {
  if (level === 'info') console.info(msg);
  if (level === 'warning') console.warn(msg);
  if (level === 'error') console.error(msg);
  try {
    if (_sentry && _sentry.captureMessage) _sentry.captureMessage(msg, level);
  } catch (_) {}
};

export const logger = {
  debug: (...args: unknown[]) => env.enableLogging && console.debug(...args),
  info: (...args: unknown[]) => console.info(...args),
  warn: (...args: unknown[]) => console.warn(...args),
  error: (err: unknown, ctx?: Record<string, unknown>) => captureException(err, ctx),
};

export default logger;
