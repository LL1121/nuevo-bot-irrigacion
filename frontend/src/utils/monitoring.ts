// Web Vitals and Performance Monitoring
import { env } from '../config/env';

type UnknownRecord = Record<string, unknown>;

type SentryTransaction = {
  finish?: () => void;
};

type SentryLike = {
  captureMessage?: (message: string, captureContext?: unknown) => void;
  setMeasurement?: (name: string, value: number, unit?: string) => void;
  addBreadcrumb?: (breadcrumb: {
    type?: string;
    category?: string;
    message?: string;
    data?: UnknownRecord;
    timestamp?: number;
    level?: 'debug' | 'info' | 'warning' | 'error' | 'fatal';
  }) => void;
  startTransaction?: (context: { name: string; op: string }) => SentryTransaction;
  setUser?: (user: { id: string; username?: string; email?: string } | null) => void;
  setTag?: (key: string, value: string) => void;
  setContext?: (name: string, context: UnknownRecord) => void;
};

let _sentry: SentryLike | null = null;

export interface PerformanceMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta?: number;
}

export interface CustomEvent {
  name: string;
  properties?: UnknownRecord;
  timestamp?: number;
}

/**
 * Initialize performance monitoring with Sentry
 */
export const initPerformanceMonitoring = async () => {
  if (!env.sentryDsn || !env.enableSentry) {
    if (env.enableLogging) console.info('Performance monitoring disabled (Sentry not configured)');
    return;
  }

  try {
    const Sentry = await import('@sentry/react');
    _sentry = Sentry;

    // Track Web Vitals
    const { onCLS, onFID, onFCP, onLCP, onTTFB } = await import('web-vitals');
    
    onCLS((metric) => sendWebVital('CLS', metric));
    onFID((metric) => sendWebVital('FID', metric));
    onFCP((metric) => sendWebVital('FCP', metric));
    onLCP((metric) => sendWebVital('LCP', metric));
    onTTFB((metric) => sendWebVital('TTFB', metric));

    console.info('Performance monitoring initialized');
  } catch (err) {
    if (env.enableLogging) console.warn('Failed to initialize performance monitoring:', err);
  }
};

/**
 * Send Web Vital metric to Sentry
 */
type WebVitalMetric = PerformanceMetric & { id?: string };

const sendWebVital = (name: string, metric: WebVitalMetric) => {
  const value = Math.round(name === 'CLS' ? metric.value * 1000 : metric.value);
  
  if (_sentry && _sentry.captureMessage) {
    _sentry.captureMessage(`Web Vital: ${name}`, {
      level: 'info',
      tags: {
        metric_name: name,
        metric_rating: metric.rating,
      },
      contexts: {
        performance: {
          name,
          value,
          rating: metric.rating,
          delta: metric.delta,
          id: metric.id,
        },
      },
    });
  }

  // Also track as custom measurement
  if (_sentry && _sentry.setMeasurement) {
    _sentry.setMeasurement(name, value, 'millisecond');
  }

  if (env.enableLogging) {
    console.debug(`Web Vital [${name}]:`, {
      value,
      rating: metric.rating,
    });
  }
};

/**
 * Track custom analytics event
 */
export const trackEvent = (event: CustomEvent) => {
  const timestamp = event.timestamp || Date.now();
  
  if (_sentry && _sentry.addBreadcrumb) {
    _sentry.addBreadcrumb({
      type: 'user',
      category: 'analytics',
      message: event.name,
      data: event.properties,
      timestamp: timestamp / 1000, // Sentry uses seconds
      level: 'info',
    });
  }

  if (env.enableLogging) {
    console.debug('Event tracked:', event.name, event.properties);
  }
};

/**
 * Track page view
 */
export const trackPageView = (path: string, title?: string) => {
  trackEvent({
    name: 'page_view',
    properties: {
      path,
      title: title || document.title,
      referrer: document.referrer,
    },
  });
};

/**
 * Track user action
 */
export const trackAction = (action: string, properties?: UnknownRecord) => {
  trackEvent({
    name: `action_${action}`,
    properties,
  });
};

/**
 * Track API call performance
 */
export const trackApiCall = (endpoint: string, duration: number, status: number) => {
  trackEvent({
    name: 'api_call',
    properties: {
      endpoint,
      duration_ms: duration,
      status,
      success: status >= 200 && status < 300,
    },
  });

  // Set custom measurement for Sentry performance
  if (_sentry && _sentry.setMeasurement) {
    _sentry.setMeasurement(`api_${endpoint}`, duration, 'millisecond');
  }
};

/**
 * Track WebSocket events
 */
export const trackSocketEvent = (event: string, data?: UnknownRecord) => {
  trackEvent({
    name: `socket_${event}`,
    properties: {
      event_type: event,
      ...data,
    },
  });
};

/**
 * Start performance transaction (Sentry APM)
 */
export const startTransaction = (name: string, op: string = 'custom') => {
  if (!_sentry || !_sentry.startTransaction) {
    return null;
  }

  const transaction = _sentry.startTransaction({
    name,
    op,
  });

  return transaction;
};

/**
 * Track component render time
 */
export const trackComponentRender = (componentName: string, duration: number) => {
  if (_sentry && _sentry.setMeasurement) {
    _sentry.setMeasurement(`render_${componentName}`, duration, 'millisecond');
  }

  if (env.enableLogging && duration > 100) {
    console.warn(`Slow render: ${componentName} took ${duration}ms`);
  }
};

/**
 * Track error recovery
 */
export const trackErrorRecovery = (error: string, strategy: string) => {
  trackEvent({
    name: 'error_recovery',
    properties: {
      error,
      recovery_strategy: strategy,
    },
  });
};

/**
 * Track feature usage
 */
export const trackFeatureUsage = (feature: string, metadata?: UnknownRecord) => {
  trackEvent({
    name: `feature_${feature}`,
    properties: metadata,
  });
};

/**
 * Set user context for monitoring
 */
export const setUserContext = (
  userId: string,
  operador?: { nombre?: string; email?: string } | null
) => {
  if (_sentry && _sentry.setUser) {
    _sentry.setUser({
      id: userId,
      username: operador?.nombre,
      email: operador?.email,
    });
  }

  if (env.enableLogging) {
    console.debug('User context set:', userId);
  }
};

/**
 * Clear user context (on logout)
 */
export const clearUserContext = () => {
  if (_sentry && _sentry.setUser) {
    _sentry.setUser(null);
  }
};

/**
 * Add custom tag for filtering
 */
export const addTag = (key: string, value: string) => {
  if (_sentry && _sentry.setTag) {
    _sentry.setTag(key, value);
  }
};

/**
 * Add custom context
 */
export const addContext = (name: string, context: UnknownRecord) => {
  if (_sentry && _sentry.setContext) {
    _sentry.setContext(name, context);
  }
};

export default {
  initPerformanceMonitoring,
  trackEvent,
  trackPageView,
  trackAction,
  trackApiCall,
  trackSocketEvent,
  startTransaction,
  trackComponentRender,
  trackErrorRecovery,
  trackFeatureUsage,
  setUserContext,
  clearUserContext,
  addTag,
  addContext,
};
