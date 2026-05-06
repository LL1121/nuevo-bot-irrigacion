// PWA Install Prompt Component
import { useState, useEffect } from 'react';
import { isPWA, isMobileDevice, getPlatform } from '../utils/pwa';
import { trackEvent } from '../utils/monitoring';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const InstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [platform, setPlatform] = useState<'ios' | 'android' | 'desktop'>('desktop');

  useEffect(() => {
    // Check if already installed
    if (isPWA()) {
      return;
    }

    // Get platform
    setPlatform(getPlatform());

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      // Don't show immediately - wait for user interaction
      // Or show after delay
      setTimeout(() => {
        setShowPrompt(true);
      }, 30000); // Show after 30 seconds
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Show install prompt
    await deferredPrompt.prompt();

    // Wait for user choice
    const { outcome } = await deferredPrompt.userChoice;

    trackEvent({
      name: 'pwa_install_prompt',
      properties: {
        outcome,
        platform: isMobileDevice() ? 'mobile' : 'desktop',
      },
    });

    if (outcome === 'accepted') {
      console.log('PWA installed');
    }

    // Clear prompt
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    trackEvent({
      name: 'pwa_install_dismissed',
      properties: {
        platform: isMobileDevice() ? 'mobile' : 'desktop',
      },
    });

    // Don't show again for 7 days
    localStorage.setItem('pwa_install_dismissed', Date.now().toString());
  };

  // Check if user dismissed recently
  useEffect(() => {
    const dismissed = localStorage.getItem('pwa_install_dismissed');
    if (dismissed) {
      const dismissedTime = parseInt(dismissed);
      const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);
      
      if (daysSinceDismissed < 7) {
        setShowPrompt(false);
      }
    }
  }, []);

  // iOS specific instructions
  if (platform === 'ios' && !isPWA() && showPrompt) {
    return (
      <div className="fixed bottom-4 left-4 right-4 bg-white dark:bg-gray-800 rounded-lg shadow-xl p-4 z-50 border border-gray-200 dark:border-gray-700">
        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
          aria-label="Close"
        >
          ✕
        </button>
        
        <div className="flex items-start gap-3">
          <span className="text-2xl">📱</span>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
              Instalar App
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
              Instala esta app en tu dispositivo para acceso rápido y offline.
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Toca <strong>Compartir</strong> 
              <span className="mx-1">→</span> 
              <strong>Agregar a pantalla de inicio</strong>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Android/Desktop prompt
  if (!deferredPrompt || !showPrompt || isPWA()) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:w-96 bg-white dark:bg-gray-800 rounded-lg shadow-xl p-4 z-50 border border-gray-200 dark:border-gray-700">
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
        aria-label="Close"
      >
        ✕
      </button>
      
      <div className="flex items-start gap-3">
        <span className="text-2xl">⚡</span>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
            Instalar App
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
            Instala esta app para acceso rápido, notificaciones y modo offline.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleInstallClick}
              className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 text-sm font-medium"
            >
              Instalar
            </button>
            <button
              onClick={handleDismiss}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium"
            >
              Ahora no
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InstallPrompt;
