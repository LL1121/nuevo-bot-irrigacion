/**
 * Lazy-loaded UI Components
 * Use React.lazy to defer loading heavy component libraries
 * Wrap with Suspense for fallback UI
 */

import { lazy, Suspense } from 'react';

// Lazy load heavy UI component modules
export const LazyImageWithFallback = lazy(() => 
  import('./figma/ImageWithFallback').then(m => ({ default: m.default }))
);

/**
 * Loading fallback component for lazy-loaded sections
 */
export function LazyLoadingFallback() {
  return (
    <div className="flex items-center justify-center p-4">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600" />
    </div>
  );
}

/**
 * Wrapper component for lazy-loaded sections with Suspense
 * Usage: <LazySection fallback={<LazyLoadingFallback />}>...</LazySection>
 */
export function LazySection({ 
  children, 
  fallback = <LazyLoadingFallback /> 
}: { 
  children: React.ReactNode; 
  fallback?: React.ReactNode;
}) {
  return (
    <Suspense fallback={fallback}>
      {children}
    </Suspense>
  );
}
