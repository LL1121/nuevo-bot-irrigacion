// Dashboard de métricas en tiempo real (solo en desarrollo)
import { useEffect, useState } from 'react';
import { env } from '../config/env';

interface Metric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
}

type WebVitalMetric = {
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
};

export const MetricsDashboard = () => {
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Solo mostrar en desarrollo
    if (env.nodeEnv !== 'development') return;

    // Cargar Web Vitals
    import('web-vitals').then(({ onCLS, onFID, onFCP, onLCP, onTTFB }) => {
      const updateMetric = (name: string, metric: WebVitalMetric) => {
        setMetrics((prev) => {
          const existing = prev.find((m) => m.name === name);
          if (existing) {
            return prev.map((m) =>
              m.name === name
                ? { name, value: metric.value, rating: metric.rating }
                : m
            );
          }
          return [...prev, { name, value: metric.value, rating: metric.rating }];
        });
      };

      onCLS((m) => updateMetric('CLS', m));
      onFID((m) => updateMetric('FID', m));
      onFCP((m) => updateMetric('FCP', m));
      onLCP((m) => updateMetric('LCP', m));
      onTTFB((m) => updateMetric('TTFB', m));
    });

    // Toggle visibility with Ctrl+Shift+M
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'M') {
        setIsVisible((v) => !v);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (env.nodeEnv !== 'development' || !isVisible) return null;

  const getRatingColor = (rating: string) => {
    switch (rating) {
      case 'good':
        return 'bg-green-500';
      case 'needs-improvement':
        return 'bg-yellow-500';
      case 'poor':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const formatValue = (name: string, value: number) => {
    if (name === 'CLS') return (value * 1000).toFixed(3);
    if (name === 'FID' || name === 'FCP' || name === 'LCP' || name === 'TTFB') {
      return `${value.toFixed(0)}ms`;
    }
    return value.toFixed(2);
  };

  return (
    <div className="fixed bottom-4 right-4 z-[9999] bg-black/90 text-white p-4 rounded-lg shadow-2xl border border-white/20 backdrop-blur-sm min-w-[280px]">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-bold">⚡ Web Vitals</h3>
        <button
          onClick={() => setIsVisible(false)}
          className="text-white/60 hover:text-white text-xs"
        >
          ✕
        </button>
      </div>

      {metrics.length === 0 ? (
        <p className="text-xs text-white/60">Loading metrics...</p>
      ) : (
        <div className="space-y-2">
          {metrics.map((metric) => (
            <div key={metric.name} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full ${getRatingColor(
                    metric.rating
                  )}`}
                />
                <span className="text-xs font-mono">{metric.name}</span>
              </div>
              <span className="text-xs font-mono text-white/80">
                {formatValue(metric.name, metric.value)}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-white/10">
        <p className="text-[10px] text-white/40">
          Press <kbd className="px-1 bg-white/10 rounded">Ctrl+Shift+M</kbd> to
          toggle
        </p>
      </div>
    </div>
  );
};

export default MetricsDashboard;
