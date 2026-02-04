import { useEffect } from 'react';
import { trackComponentRender } from '../utils/monitoring';

interface UsePerformanceOptions {
  componentName: string;
  threshold?: number; // Log warning if render exceeds this (ms)
}

/**
 * Hook to track component render performance
 * 
 * @example
 * function MyComponent() {
 *   usePerformance({ componentName: 'MyComponent', threshold: 100 });
 *   return <div>Content</div>;
 * }
 */
export const usePerformance = ({ componentName, threshold = 100 }: UsePerformanceOptions) => {
  useEffect(() => {
    const startTime = performance.now();

    return () => {
      const duration = performance.now() - startTime;
      trackComponentRender(componentName, duration);

      if (duration > threshold) {
        console.warn(`⚠️ Slow render: ${componentName} took ${duration.toFixed(2)}ms`);
      }
    };
  }, [componentName, threshold]);
};

export default usePerformance;
