// Service Worker update notification
import { useState, useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { trackEvent } from '../utils/monitoring';

export const UpdatePrompt = () => {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered:', r);
      trackEvent({ name: 'sw_registered' });
    },
    onRegisterError(error) {
      console.log('SW registration error', error);
      trackEvent({ 
        name: 'sw_registration_error',
        properties: { error: error.message }
      });
    },
  });

  const handleUpdate = () => {
    trackEvent({ name: 'sw_update_accepted' });
    updateServiceWorker(true);
  };

  const handleDismiss = () => {
    trackEvent({ name: 'sw_update_dismissed' });
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  if (!offlineReady && !needRefresh) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-white dark:bg-gray-800 rounded-lg shadow-xl p-4 z-50 border border-gray-200 dark:border-gray-700 max-w-sm">
      <div className="flex items-start gap-3">
        <span className="text-2xl">{needRefresh ? '🔄' : '✅'}</span>
        <div className="flex-1">
          {needRefresh ? (
            <>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                Actualización disponible
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                Hay una nueva versión disponible. Recarga para actualizar.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleUpdate}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
                >
                  Actualizar
                </button>
                <button
                  onClick={handleDismiss}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium"
                >
                  Después
                </button>
              </div>
            </>
          ) : (
            <>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                App lista para offline
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                La app está lista para funcionar sin conexión.
              </p>
              <button
                onClick={handleDismiss}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Entendido
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default UpdatePrompt;
