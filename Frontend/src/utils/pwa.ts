// PWA utilities and helpers
import { env } from '../config/env';

/**
 * Check if app is running as PWA (installed)
 */
export const isPWA = (): boolean => {
  // Check if running in standalone mode
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  
  // Check iOS Safari specific
  const isIOSStandalone = (window.navigator as any).standalone === true;
  
  return isStandalone || isIOSStandalone;
};

/**
 * Check if browser supports PWA installation
 */
export const canInstallPWA = (): boolean => {
  return 'serviceWorker' in navigator && 'BeforeInstallPromptEvent' in window;
};

/**
 * Check if Service Worker is registered
 */
export const isServiceWorkerRegistered = (): boolean => {
  return 'serviceWorker' in navigator && navigator.serviceWorker.controller !== null;
};

/**
 * Get Service Worker registration
 */
export const getServiceWorkerRegistration = async (): Promise<ServiceWorkerRegistration | null> => {
  if (!('serviceWorker' in navigator)) return null;
  
  try {
    return await navigator.serviceWorker.getRegistration();
  } catch (err) {
    console.error('Failed to get Service Worker registration:', err);
    return null;
  }
};

/**
 * Unregister Service Worker (useful for debugging)
 */
export const unregisterServiceWorker = async (): Promise<boolean> => {
  if (!('serviceWorker' in navigator)) return false;
  
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      return await registration.unregister();
    }
    return false;
  } catch (err) {
    console.error('Failed to unregister Service Worker:', err);
    return false;
  }
};

/**
 * Check for Service Worker updates
 */
export const checkForUpdates = async (): Promise<boolean> => {
  const registration = await getServiceWorkerRegistration();
  if (!registration) return false;
  
  try {
    await registration.update();
    return true;
  } catch (err) {
    console.error('Failed to check for updates:', err);
    return false;
  }
};

/**
 * Skip waiting for new Service Worker and activate immediately
 */
export const skipWaitingAndReload = () => {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
    window.location.reload();
  }
};

/**
 * Get network status
 */
export const isOnline = (): boolean => {
  return navigator.onLine;
};

/**
 * Listen for online/offline events
 */
export const onNetworkChange = (callback: (online: boolean) => void) => {
  const handleOnline = () => callback(true);
  const handleOffline = () => callback(false);
  
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  
  // Return cleanup function
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
};

/**
 * Check if device is mobile
 */
export const isMobileDevice = (): boolean => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
};

/**
 * Get platform (iOS, Android, Desktop)
 */
export const getPlatform = (): 'ios' | 'android' | 'desktop' => {
  const userAgent = navigator.userAgent.toLowerCase();
  
  if (/iphone|ipad|ipod/.test(userAgent)) return 'ios';
  if (/android/.test(userAgent)) return 'android';
  return 'desktop';
};

/**
 * Check if browser is Safari
 */
export const isSafari = (): boolean => {
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
};

/**
 * Request persistent storage
 */
export const requestPersistentStorage = async (): Promise<boolean> => {
  if (!navigator.storage || !navigator.storage.persist) {
    return false;
  }
  
  try {
    const isPersisted = await navigator.storage.persisted();
    if (isPersisted) return true;
    
    return await navigator.storage.persist();
  } catch (err) {
    console.error('Failed to request persistent storage:', err);
    return false;
  }
};

/**
 * Get storage quota
 */
export const getStorageQuota = async (): Promise<{
  usage: number;
  quota: number;
  percentage: number;
} | null> => {
  if (!navigator.storage || !navigator.storage.estimate) {
    return null;
  }
  
  try {
    const estimate = await navigator.storage.estimate();
    const usage = estimate.usage || 0;
    const quota = estimate.quota || 0;
    const percentage = quota > 0 ? (usage / quota) * 100 : 0;
    
    return {
      usage,
      quota,
      percentage: Math.round(percentage * 100) / 100,
    };
  } catch (err) {
    console.error('Failed to get storage quota:', err);
    return null;
  }
};

/**
 * Clear all caches
 */
export const clearAllCaches = async (): Promise<boolean> => {
  if (!('caches' in window)) return false;
  
  try {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((name) => caches.delete(name)));
    return true;
  } catch (err) {
    console.error('Failed to clear caches:', err);
    return false;
  }
};

/**
 * Share data using Web Share API
 */
export const shareContent = async (data: {
  title?: string;
  text?: string;
  url?: string;
}): Promise<boolean> => {
  if (!navigator.share) {
    console.warn('Web Share API not supported');
    return false;
  }
  
  try {
    await navigator.share(data);
    return true;
  } catch (err) {
    if ((err as Error).name !== 'AbortError') {
      console.error('Failed to share:', err);
    }
    return false;
  }
};

export default {
  isPWA,
  canInstallPWA,
  isServiceWorkerRegistered,
  getServiceWorkerRegistration,
  unregisterServiceWorker,
  checkForUpdates,
  skipWaitingAndReload,
  isOnline,
  onNetworkChange,
  isMobileDevice,
  getPlatform,
  isSafari,
  requestPersistentStorage,
  getStorageQuota,
  clearAllCaches,
  shareContent,
};
