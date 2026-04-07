import { useEffect } from 'react';
import { trackPageView } from '../utils/monitoring';
import { useLocation } from 'react-router-dom'; // If using React Router

/**
 * Hook to automatically track page views
 * 
 * @example
 * function App() {
 *   usePageTracking();
 *   return <Routes>...</Routes>;
 * }
 */
export const usePageTracking = () => {
  const location = useLocation?.() || { pathname: window.location.pathname };

  useEffect(() => {
    trackPageView(location.pathname, document.title);
  }, [location.pathname]);
};

export default usePageTracking;
