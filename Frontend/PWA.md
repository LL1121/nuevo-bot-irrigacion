# Progressive Web App (PWA) Guide

## 🎯 Overview

App convertida en **PWA instalable** con soporte offline completo:
- 📱 Instalable en mobile y desktop
- 🔌 Funcionalidad offline con Service Worker
- ⚡ Cache inteligente (API, imágenes, assets)
- 🔄 Auto-update con notificaciones
- 📊 Almacenamiento persistente

## 🚀 Features

### 1. Instalación

**Android/Chrome:**
- Banner automático después de 30 segundos
- Click en "Instalar" → App se agrega a home screen
- Ícono aparece en launcher

**iOS/Safari:**
- Prompt con instrucciones: Share → Add to Home Screen
- No hay banner automático (limitación de iOS)

**Desktop:**
- Ícono de instalación en barra de direcciones
- Menu → Install Bot de Irrigación

### 2. Offline Support

**Cache Strategies:**
- **API calls**: NetworkFirst (intenta red, fallback a cache)
- **Images**: CacheFirst (cache primero, más rápido)
- **Static assets**: CacheFirst (JS, CSS cached por 1 año)

**Offline Fallback:**
- Indicador visual cuando pierde conexión
- Datos cached disponibles mientras está offline
- Auto-sync cuando vuelve la conexión

### 3. Auto-Updates

**Update Flow:**
1. Service Worker detecta nueva versión
2. Descarga en background
3. Muestra prompt: "Actualización disponible"
4. Usuario acepta → Reload automático
5. Nueva versión activada

## 🛠️ Utilities

### Check PWA Status

```typescript
import { isPWA, isServiceWorkerRegistered } from '@/utils/pwa';

if (isPWA()) {
  console.log('Running as installed PWA');
}

if (isServiceWorkerRegistered()) {
  console.log('Service Worker active');
}
```

### Network Detection

```typescript
import { isOnline, onNetworkChange } from '@/utils/pwa';

// Current status
const online = isOnline();

// Listen for changes
const cleanup = onNetworkChange((isOnline) => {
  console.log(isOnline ? 'Online' : 'Offline');
});
```

### Platform Detection

```typescript
import { getPlatform, isMobileDevice } from '@/utils/pwa';

const platform = getPlatform(); // 'ios' | 'android' | 'desktop'
const isMobile = isMobileDevice(); // boolean
```

### Storage Management

```typescript
import { requestPersistentStorage, getStorageQuota } from '@/utils/pwa';

// Request persistent storage (won't be cleared)
const granted = await requestPersistentStorage();

// Check quota
const quota = await getStorageQuota();
// { usage: 1234567, quota: 10000000, percentage: 12.35 }
```

### Cache Management

```typescript
import { clearAllCaches, checkForUpdates } from '@/utils/pwa';

// Clear all caches (useful for debugging)
await clearAllCaches();

// Force check for updates
await checkForUpdates();
```

### Web Share API

```typescript
import { shareContent } from '@/utils/pwa';

const shared = await shareContent({
  title: 'Bot de Irrigación',
  text: 'Check out this app!',
  url: 'https://irrigacion.com.ar',
});
```

## 📦 Components

### InstallPrompt

Automatic install banner with platform-specific UI:

```tsx
import InstallPrompt from '@/components/InstallPrompt';

function App() {
  return (
    <>
      <InstallPrompt />
      {/* Your app */}
    </>
  );
}
```

Features:
- Shows after 30 seconds (configurable)
- Platform-specific instructions (iOS vs Android)
- Dismissible (won't show again for 7 days)
- Tracks install events in Sentry

### UpdatePrompt

Service Worker update notification:

```tsx
import UpdatePrompt from '@/components/UpdatePrompt';

function App() {
  return (
    <>
      <UpdatePrompt />
      {/* Your app */}
    </>
  );
}
```

Features:
- Auto-detects new versions
- "Update" button reloads app
- "Later" dismisses notification
- Tracks update events

### OfflineIndicator

Visual feedback when offline:

```tsx
import OfflineIndicator from '@/components/OfflineIndicator';

function App() {
  return (
    <>
      <OfflineIndicator />
      {/* Your app */}
    </>
  );
}
```

Features:
- Yellow banner at top when offline
- Auto-hides when back online
- Screen reader announcements
- Accessible (role="alert")

## 🔧 Configuration

### manifest.json

Located in `/public/manifest.json`:

```json
{
  "name": "Bot de Irrigación",
  "short_name": "Irrigación",
  "description": "Sistema de gestión de irrigación",
  "theme_color": "#10b981",
  "background_color": "#ffffff",
  "display": "standalone",
  "icons": [
    { "src": "/icons/icon-192x192.png", "sizes": "192x192" },
    { "src": "/icons/icon-512x512.png", "sizes": "512x512" }
  ]
}
```

### vite.config.ts

PWA plugin configuration:

```typescript
VitePWA({
  registerType: 'autoUpdate',
  workbox: {
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/.*\/api\/.*/i,
        handler: 'NetworkFirst', // API calls
        options: {
          cacheName: 'api-cache',
          expiration: { maxAgeSeconds: 86400 } // 24 hours
        }
      }
    ]
  }
})
```

## 📱 Platform-Specific

### iOS Quirks

- No automatic install prompt (Apple restriction)
- Must use Share → Add to Home Screen
- No background sync in Safari
- Limited Service Worker features

**iOS Install Instructions:**
```
1. Tap Share button (square with arrow)
2. Scroll down, tap "Add to Home Screen"
3. Tap "Add" in top right
```

### Android

- Full PWA support
- Install banner after engagement
- Background sync available
- Push notifications supported

### Desktop (Chrome, Edge)

- Install icon in address bar
- Window controls in standalone mode
- Full Service Worker support
- Keyboard shortcuts work

## 🧪 Testing PWA

### Local Testing

```bash
# Build for production
npm run build

# Preview with Service Worker enabled
npm run preview

# Open in browser
http://localhost:4173
```

**Test checklist:**
- [ ] Install prompt appears
- [ ] App installs correctly
- [ ] Offline mode works (disable network)
- [ ] Update prompt shows on new version
- [ ] Cache strategies working
- [ ] Icons display correctly

### Lighthouse PWA Audit

```bash
# Chrome DevTools → Lighthouse → PWA
# Should score 100/100
```

**Key metrics:**
- ✅ Fast and reliable (Service Worker)
- ✅ Installable (manifest.json)
- ✅ PWA optimized (icons, theme)

### DevTools Testing

**Chrome DevTools → Application:**

1. **Service Workers**
   - Check registration status
   - "Update on reload" for testing
   - "Bypass for network" to test offline

2. **Cache Storage**
   - View cached resources
   - Clear individual caches
   - Check cache sizes

3. **Manifest**
   - Validate manifest.json
   - Preview icons
   - Test add to home screen

## 🚨 Troubleshooting

### PWA not installing

**Symptoms:** No install prompt, app doesn't install

**Solutions:**
1. Check HTTPS (required for PWA)
2. Verify manifest.json is valid
3. Check icons exist and are correct size
4. Open DevTools → Application → Manifest for errors

### Service Worker not updating

**Symptoms:** Old version keeps running

**Solutions:**
1. DevTools → Application → Service Workers → "Update on reload"
2. Unregister old Service Worker
3. Clear all caches
4. Hard reload (Ctrl+Shift+R)

### Offline mode not working

**Symptoms:** App doesn't work offline

**Solutions:**
1. Check Service Worker is registered
2. Verify cache strategies in vite.config.ts
3. Check network tab with offline mode
4. Clear caches and re-cache

### iOS issues

**Symptoms:** PWA not working on iOS

**Solutions:**
1. Use Safari (not Chrome iOS)
2. iOS 11.3+ required for PWA support
3. Add to Home Screen manually
4. Check for iOS-specific bugs

## 📊 Monitoring

### PWA Analytics

Track these events in Sentry:

```typescript
import { trackEvent } from '@/utils/monitoring';

// Install events
trackEvent({ name: 'pwa_install_prompt' });
trackEvent({ name: 'pwa_install_accepted' });
trackEvent({ name: 'pwa_install_dismissed' });

// Update events
trackEvent({ name: 'sw_registered' });
trackEvent({ name: 'sw_update_available' });
trackEvent({ name: 'sw_update_accepted' });

// Network events
trackEvent({ name: 'network_offline' });
trackEvent({ name: 'network_online' });
```

### Storage Monitoring

```typescript
import { getStorageQuota } from '@/utils/pwa';

// Check storage usage
const quota = await getStorageQuota();
if (quota && quota.percentage > 80) {
  console.warn('Storage almost full:', quota);
}
```

## 🎨 Icon Generation

**Required sizes:**
- 72x72, 96x96, 128x128, 144x144, 152x152
- 192x192 (Android minimum)
- 512x512 (Android splash)

**Tools:**
- [PWA Asset Generator](https://github.com/elegantapp/pwa-asset-generator)
- [RealFaviconGenerator](https://realfavicongenerator.net/)
- [Favicon.io](https://favicon.io/)

**Generate all sizes:**
```bash
npx pwa-asset-generator logo.svg public/icons --background "#10b981"
```

## 📚 Best Practices

### Do's ✅

- Use HTTPS in production (required)
- Provide all icon sizes
- Cache static assets aggressively
- Use NetworkFirst for API calls
- Show update prompts
- Test on real devices
- Monitor storage quota
- Handle offline gracefully

### Don'ts ❌

- Don't cache authentication tokens
- Don't cache sensitive data
- Don't show install prompt immediately
- Don't force updates without asking
- Don't ignore iOS users
- Don't forget to test offline mode
- Don't cache POST requests
- Don't exceed storage quota

## 🔗 Resources

- [PWA Documentation](https://web.dev/progressive-web-apps/)
- [Workbox Guide](https://developer.chrome.com/docs/workbox/)
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app/)
- [Service Worker Cookbook](https://serviceworke.rs/)
- [Web App Manifest](https://developer.mozilla.org/en-US/docs/Web/Manifest)

## 🎯 Next Steps

1. Generate app icons (72x72 to 512x512)
2. Test installation on real devices
3. Configure push notifications (optional)
4. Set up background sync (optional)
5. Add app shortcuts to manifest
6. Test offline scenarios thoroughly
