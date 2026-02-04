// Offline indicator component
import { useState, useEffect } from 'react';
import { isOnline, onNetworkChange } from '../utils/pwa';
import { announceToScreenReader } from '../utils/accessibility';

export const OfflineIndicator = () => {
  const [online, setOnline] = useState(isOnline());

  useEffect(() => {
    const cleanup = onNetworkChange((isOnline) => {
      setOnline(isOnline);
      
      // Announce to screen readers
      announceToScreenReader(
        isOnline ? 'Conexión restablecida' : 'Sin conexión a internet',
        'assertive'
      );
    });

    return cleanup;
  }, []);

  if (online) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 bg-amber-500 text-white px-4 py-2 text-sm text-center z-50"
      role="alert"
      aria-live="assertive"
    >
      <span className="font-medium">⚠️ Sin conexión</span> — Algunos datos pueden estar desactualizados
    </div>
  );
};

export default OfflineIndicator;
