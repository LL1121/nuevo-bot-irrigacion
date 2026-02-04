# Bot de Irrigación — Frontend

Interface React/TypeScript built with Vite, Tailwind, and Radix UI to manage irrigation conversations, attachments, and controls with a branded, theme-aware login experience.

## Stack
- React 18 + TypeScript + Vite
- Tailwind CSS + tailwind-merge + tailwindcss-animate
- Radix primitives (dialogs, menus, forms, navigation, etc.)
- Axios for API calls, socket.io-client for realtime updates, react-hook-form for forms, recharts for data viz

## Features
- Auth guard with branded login; theme and dark-mode aware backgrounds, cards, inputs, and error states.
- Global bearer token headers for chats/messages/control actions; logout clears client state and disconnects sockets.
- Chat window with attachments, audio controls, emoji support, and sidebar navigation.
- Configurable theme tokens (emerald, blue, violet, amber) with gradient backgrounds and persisted dark mode.

## Quick Start (Local Development)

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Setup environment variables**
   ```bash
   # Copy example file
   cp .env.example .env.local
   # Modify if backend is not on localhost:3000
   ```

3. **Start dev server**
   ```bash
   npm run dev
   ```
   Visit `http://localhost:5175` (or port suggested by Vite)

## Environment Configuration

### Local Development (`.env.local`)
```
VITE_API_URL=http://localhost:3000
VITE_SOCKET_URL=http://localhost:3000
VITE_ENABLE_LOGGING=true
VITE_ENABLE_SENTRY=false
```

### Production (`.env.production`)
```
VITE_API_URL=https://api.irrigacion.com.ar
VITE_SOCKET_URL=https://api.irrigacion.com.ar
VITE_ENABLE_SENTRY=true
VITE_SENTRY_DSN=<your-sentry-dsn>
```

### Sentry (Error tracking)

This project supports Sentry for centralized error tracking. To enable it in production:

- Install Sentry packages (already added to `package.json`):

```bash
npm install @sentry/react @sentry/tracing
```

- Provide your DSN in `.env.production`:

```bash
VITE_SENTRY_DSN=https://<PUBLIC_KEY>@o0.ingest.sentry.io/<PROJECT_ID>
VITE_ENABLE_SENTRY=true
```

- The app initializes Sentry at startup (see `src/utils/logger.ts`). Errors and unhandled rejections will be reported automatically.

Testing Sentry locally:

```bash
# set VITE_ENABLE_SENTRY=true and VITE_SENTRY_DSN to a test DSN, then:
npm run dev
# throw an error in the console or use the ErrorBoundary fallback to validate events in Sentry
```

### CI / Release: upload source maps to Sentry

To get meaningful stack traces in Sentry you should upload source maps during your release pipeline. Example CI steps (GitHub Actions / any bash-capable runner):

1. Ensure these environment variables are set in CI with secrets:
   - `SENTRY_AUTH_TOKEN` (from Sentry)
   - `SENTRY_ORG` (your Sentry org slug)
   - `SENTRY_PROJECT` (your Sentry project slug)
   - `SENTRY_RELEASE` (a release identifier, e.g. `frontend@${{ github.sha }}`)

2. Example commands (bash) to run after `npm run build`:

```bash
# propose or set a release identifier
export SENTRY_RELEASE=frontend@${GITHUB_SHA}

# create release if needed, upload sourcemaps and finalize
npm run sentry:upload-sourcemaps
```

Notes:
- The `sentry:upload-sourcemaps` script uses `sentry-cli` and expects `SENTRY_RELEASE` env var to be set (CI should set it).
- On GitHub Actions you can use `sentry-cli` with the official `getsentry/action-release` action or call the script above in a bash step.
- Uploading source maps lets Sentry map minified production stack traces back to original TypeScript/JS sources.

**Automatic selection**: 
- `npm run dev` uses `.env.local`
- `npm run build` uses `.env.production`

See `.env.example` for all available variables.

## Available Scripts
- `npm run dev` — Start dev server (port 5175)
- `npm run build` — Build for production → `dist/` folder
- `npm run preview` — Preview production build
- `npm run lint` — Run ESLint

## Project Structure
- [src/main.tsx](src/main.tsx) bootstraps React and providers
- [src/App.tsx](src/App.tsx) manages auth guard, theme props, and layout
- [src/config/](src/config/) centralized configuration
  - [config/env.ts](src/config/env.ts) environment variables
  - [config/auth.ts](src/config/auth.ts) auth utilities
- [src/components](src/components) UI composition:
  - [components/Login.tsx](src/components/Login.tsx) themed/dark-mode-aware login
  - [components/ui](src/components/ui) shared Radix-based primitives

## Production Deployment

### Build
```bash
npm run build
```

### Deploy
- Upload `dist/` to your hosting (Netlify, Vercel, AWS S3, etc.)
- Configure server to serve SPA (rewrite all routes to `index.html`)
- Ensure `.env.production` variables are set correctly

### Requirements
- HTTPS enabled
- CORS configured on backend
- Backend health check at `GET /api/health`
- Optional: Sentry for error tracking
- [src/styles/global.css](src/styles/global.css) Tailwind base styles

## Security

### HTTPS Only (Production)
- Deploy only over HTTPS. Set `Strict-Transport-Security` header on your server:
  ```
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  ```
- This forces all traffic to HTTPS for 1 year (31536000 seconds).

### CORS (Backend Configuration)
The frontend expects the backend to allow CORS requests from your domain. Backend should respond with:
```
Access-Control-Allow-Origin: https://yourdomain.com
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

See backend docs for CORS setup.

### Input Sanitization
- The app validates and sanitizes user inputs on the client (see `src/utils/sanitize.ts`).
- **Always validate and sanitize on the backend as well.** Client-side validation is only for UX.
- Utilities available: `sanitizeString()`, `sanitizePhone()`, `sanitizeEmail()`, `sanitizeUsername()`, `sanitizeMessage()`.

### XSS Protection
- React escapes text content by default, preventing most XSS attacks.
- Never use `dangerouslySetInnerHTML` without sanitizing.
- All user inputs are escaped before display.

### Rate Limiting
- Client-side rate limiting (10 requests per 60s per endpoint) is implemented in `src/utils/axiosInterceptor.ts` to prevent accidental DDoS.
- **Server-side rate limiting is essential:** implement stricter limits per IP/user at the API gateway or backend.

### CSRF Protection
- This app uses JWT tokens (Bearer auth), which are not vulnerable to CSRF attacks (unlike cookie-based auth).
- If your backend uses sessions, ensure CSRF tokens are included; backend should validate them.

### Token Security
- JWT tokens are stored in `localStorage` (accessible to XSS if not careful).
- Access tokens auto-refresh before expiry (5 min before) via the interceptor.
- Refresh tokens are stored separately and only sent to `/api/auth/refresh`.
- On logout, all tokens are cleared and session is invalidated on the backend.

## Testing

### Unit Tests (Vitest)
Test utility functions, component logic, and auth flows:

```bash
# Run tests once
npm run test -- --run

# Run tests in watch mode
npm run test

# Generate coverage report
npm run test:coverage

# Run tests with UI
npm run test:ui
```

#### Test Coverage
- **95+ tests** across 6 files
- **Utilities**: `sanitize.ts` (33 tests), `jwt.ts` (19 tests), `logger.ts` (11 tests)
- **Config**: `auth.ts` (13 tests), `env.ts` (14 tests)
- **Components**: `ErrorBoundary.tsx` (5 tests)
- **Target**: >80% coverage for utilities and components

#### Test Examples
```typescript
// Sanitization tests
expect(sanitizePhone('+1 (555) 123-4567')).toBe('+1(555)123-4567')
expect(sanitizeEmail('test@example.com')).toBe('test@example.com')

// JWT tests
expect(isTokenExpired(expiredToken)).toBe(true)
expect(getTokenTimeRemaining(validToken)).toBeGreaterThan(0)

// Auth storage tests
auth.setToken('token')
expect(auth.getToken()).toBe('token')
auth.clearSession()
expect(auth.isAuthenticated()).toBe(false)

// ErrorBoundary tests
render(<ErrorBoundary><ThrowError /></ErrorBoundary>)
expect(screen.getByText(/algo salió mal/i)).toBeInTheDocument()
```

### E2E Tests (Next Phase)
- Planned: Cypress or Playwright for login flow, chat interactions, attachments
- Coverage: User journeys, socket events, error scenarios

## Deployment & CI/CD

### GitHub Actions Pipelines

#### CI Pipeline ([.github/workflows/ci.yml](.github/workflows/ci.yml))
Runs on every push and pull request to `main`/`develop`:

```bash
# Matrix testing: Node 18 & 20
1. Install dependencies (npm ci)
2. Run linter (npm run lint)
3. Run tests (npm run test -- --run)
4. Generate coverage (npm run test:coverage)
5. Validate 80% coverage threshold
6. Build project (npm run build)
7. Check bundle size (warn if >200KB gzipped)
8. Upload artifacts (coverage, dist/)
```

**Required Secrets:**
- `VITE_API_URL` — API endpoint URL
- `VITE_SOCKET_URL` — WebSocket endpoint URL
- `VITE_SENTRY_DSN` — Sentry project DSN

#### CD Pipeline ([.github/workflows/deploy-production.yml](.github/workflows/deploy-production.yml))
Deploys to production on push to `main` or manual trigger:

```bash
1. Run tests (safety check)
2. Build for production
3. Create Sentry release + upload source maps
4. Deploy to server (rsync/S3/CDN)
5. Health check (verify site responds)
6. Notify on success/failure
7. Auto-rollback on failure
```

**Required Secrets:**
- `SENTRY_AUTH_TOKEN` — Sentry CLI authentication
- `SENTRY_ORG` — Sentry organization slug
- `SENTRY_PROJECT` — Sentry project slug
- Deployment credentials (SSH keys, AWS credentials, etc.)

#### Lighthouse CI ([.github/workflows/lighthouse-ci.yml](.github/workflows/lighthouse-ci.yml))
Performance audits on PRs:
- **Performance**: ≥90 score
- **Accessibility**: ≥90 score
- **Best Practices**: ≥90 score
- **SEO**: ≥80 score

### Deployment Environments

| Environment | Branch | URL | Purpose |
|-------------|--------|-----|---------|
| **Production** | `main` | https://irrigacion.com.ar | Live users |
| **Staging** | `develop` | https://staging.irrigacion.com.ar | QA testing |
| **Local** | feature branches | http://localhost:5173 | Development |

### Rollback Procedure

If a deployment breaks production:

```bash
# Option 1: Revert via Git
git revert <commit-sha>
git push origin main  # Triggers CI/CD

# Option 2: Manual rollback to previous tag
git tag  # List all releases
git checkout v1.2.3
npm run build
# Deploy manually

# Option 3: GitHub Actions manual trigger
# Go to Actions → Deploy to Production → Run workflow
# Select previous commit SHA
```

### Health Checks

Production deployment includes automatic health checks:
- HTTP 200 status from root URL
- Response time <2 seconds
- Critical assets load successfully

### Sentry Release Tracking

Every deployment creates a Sentry release:
```bash
# Release format: <branch>-<commit-sha>
# Example: main-a1b2c3d

# View releases in Sentry dashboard
# Track which errors belong to which deployment
# Source maps uploaded for stack trace debugging
```

### Manual Deployment

To deploy manually (emergency):

```bash
# 1. Build locally
npm run build

# 2. Deploy to server (example with rsync)
rsync -avz --delete dist/ user@server:/var/www/irrigacion/

# 3. Create Sentry release
export SENTRY_RELEASE=manual-$(git rev-parse --short HEAD)
npm run sentry:upload-sourcemaps

# 4. Verify deployment
curl https://irrigacion.com.ar -I
```

### Pre-Deployment Checklist

Before merging to `main`:
- [ ] All tests pass locally (`npm run test`)
- [ ] Linter passes (`npm run lint`)
- [ ] Build succeeds (`npm run build`)
- [ ] Bundle size acceptable (<200KB main chunk)
- [ ] `.env.local` not committed (gitignored)
- [ ] Secrets configured in GitHub repo settings
- [ ] Sentry DSN valid and accessible

## Monitoring & Analytics

Sistema completo de monitoreo con Sentry Performance + Web Vitals tracking.

### Features

- **Error Tracking** — Captura automática de errores con Sentry
- **Performance Monitoring** — API calls, page loads, transactions
- **Web Vitals** — CLS, FID, FCP, LCP, TTFB tracking
- **Custom Events** — User actions, features, socket events
- **Real-time Dashboard** — Dev-only metrics overlay (Ctrl+Shift+M)

### Quick Usage

```typescript
import { trackEvent, trackAction, trackApiCall } from '@/utils/monitoring';

// Track user action
trackAction('send_message', { length: 150 });

// Track API performance
const start = performance.now();
const response = await fetch('/api/messages');
trackApiCall('/api/messages', performance.now() - start, response.status);

// Track feature usage
trackFeatureUsage('emoji_picker');
```

### Web Vitals Metrics

| Metric | Target | What it measures |
|--------|--------|------------------|
| **CLS** | <0.1 | Layout stability |
| **FID** | <100ms | Interactivity |
| **FCP** | <1.8s | First paint |
| **LCP** | <2.5s | Largest paint |
| **TTFB** | <800ms | Server response |

### Dev Dashboard

Press **Ctrl+Shift+M** para ver métricas en tiempo real (solo en desarrollo).

### Alertas

Configurar en Sentry:
- Error rate >10 errors/min → Slack notification
- P95 response time >2s → Email alert
- LCP >4s for >20% users → GitHub issue

Ver [MONITORING.md](MONITORING.md) para configuración completa de alertas, dashboards, y troubleshooting.

## Accessibility (a11y)

Sistema completo siguiendo **WCAG 2.1 Level AA** standards.

### Features

- **ARIA Labels** — Accessible names for all interactive elements
- **Keyboard Navigation** — Full keyboard support (Tab, Arrow keys, Escape)
- **Focus Management** — Focus traps for modals, auto-focus, focus visible
- **Screen Reader Support** — Announcements, semantic HTML, skip links
- **Color Contrast** — WCAG AA compliant (≥4.5:1 for normal text)

### Quick Usage

```typescript
import { useFocusTrap, useKeyboardShortcuts, useAnnouncement } from '@/hooks';
import { checkColorContrast, announceToScreenReader } from '@/utils/accessibility';

// Focus trap for modals
const modalRef = useFocusTrap<HTMLDivElement>({ enabled: isOpen });

// Keyboard shortcuts
useKeyboardShortcuts([
  { key: 's', ctrl: true, callback: handleSave, description: 'Save' },
  { key: 'Escape', callback: handleClose, description: 'Close' }
]);

// Screen reader announcements
const { announce } = useAnnouncement();
announce('Message sent successfully');

// Check color contrast
const result = checkColorContrast('#595959', '#FFFFFF');
// { ratio: 7.47, pass: true, level: 'AAA' }
```

### Testing Checklist

- [ ] Keyboard navigation works (Tab, Escape, Arrow keys)
- [ ] Focus indicators visible
- [ ] Screen reader announces changes
- [ ] All images have alt text
- [ ] Color contrast ≥4.5:1 (WCAG AA)
- [ ] Skip link available (press Tab)

### Browser Extensions

- **axe DevTools** — Automated a11y testing
- **WAVE** — Visual feedback on issues
- **Lighthouse** — Built-in accessibility audit

Ver [ACCESSIBILITY.md](ACCESSIBILITY.md) para guía completa de implementación, testing con screen readers, y ARIA patterns.

## Offline & PWA

App instalable como **Progressive Web App** con soporte offline completo.

### Features

- **Instalable** — Mobile y desktop (Android, iOS, Chrome, Edge)
- **Offline Mode** — Cache inteligente con Service Worker
- **Auto-updates** — Notificaciones de nuevas versiones
- **Fast Load** — Assets cached, instant startup
- **Network Detection** — Indicador visual de estado offline

### Quick Usage

```tsx
import { InstallPrompt, UpdatePrompt, OfflineIndicator } from '@/components';
import { isPWA, isOnline } from '@/utils/pwa';

function App() {
  return (
    <>
      <InstallPrompt />
      <UpdatePrompt />
      <OfflineIndicator />
      {/* App content */}
    </>
  );
}

// Check if running as PWA
if (isPWA()) {
  console.log('Running as installed app');
}

// Check network status
if (!isOnline()) {
  console.log('Offline mode active');
}
```

### Cache Strategies

| Resource | Strategy | Cache Duration |
|----------|----------|----------------|
| **API calls** | NetworkFirst | 24 hours |
| **Images** | CacheFirst | 30 days |
| **JS/CSS** | CacheFirst | 1 year |

### Installation

**Android/Chrome:**
- Banner automático después de 30 segundos
- Click "Instalar" → App en home screen

**iOS/Safari:**
- Share button → Add to Home Screen
- Manual (limitación de Apple)

**Desktop:**
- Ícono en barra de direcciones
- Menu → Install

### Testing PWA

```bash
# Build for production
npm run build

# Preview with Service Worker
npm run preview

# Test checklist
# ✅ Install prompt appears
# ✅ Offline mode works
# ✅ Update notification shows
# ✅ Lighthouse PWA score: 100/100
```

Ver [PWA.md](PWA.md) para guía completa de configuración, testing, troubleshooting, y platform-specific quirks.

## Performance Optimization

### Bundle Splitting (Vite)
The build is configured to split dependencies into separate chunks for better caching:
- `vendor-react.js` — React core libraries
- `vendor-ui.js` — Radix UI components
- `vendor-utils.js` — axios, socket.io, date-fns
- `vendor-emoji.js` — emoji-picker-react
- `index.js` — app code

This ensures vendor libraries are cached longer since they change less frequently.

### Lazy Loading
Use `React.lazy()` and `Suspense` to defer loading heavy components until needed:
```typescript
import { LazySection, LazyLoadingFallback } from './components/LazyLoad';

<LazySection fallback={<LazyLoadingFallback />}>
  <HeavyComponent />
</LazySection>
```

### Image Optimization
- Compress images before adding to `public/` (use tools like TinyPNG, ImageOptim)
- Use modern formats: WebP with fallbacks to PNG/JPG
- Lazy-load images with `loading="lazy"` on `<img>` tags

### Cache Headers (Server Configuration)
Configure your deployment server (nginx, Apache, etc.) to set cache headers:

```nginx
# Cache static assets for 1 year (they have hash in filename from Vite)
location ~* \.(js|css|woff2|woff|ttf|svg)$ {
  expires 1y;
  add_header Cache-Control "public, immutable";
}

# Cache HTML with revalidation (app shell)
location ~* \.html$ {
  expires 1d;
  add_header Cache-Control "public, must-revalidate";
}

# Don't cache index.html
location = /index.html {
  expires -1;
  add_header Cache-Control "no-cache, no-store, must-revalidate";
}
```

### Measuring Performance with Lighthouse
1. Build for production:
   ```bash
   npm run build
   ```

2. Preview locally:
   ```bash
   npm run preview
   ```

3. Open Chrome DevTools > Lighthouse > Generate Report
   - Target: Mobile & Desktop
   - Throttle: Simulated fast 4G / 4x CPU slowdown (realistic conditions)

4. Key metrics to track:
   - **Largest Contentful Paint (LCP)** < 2.5s (good)
   - **Cumulative Layout Shift (CLS)** < 0.1 (good)
   - **First Input Delay (FID)** < 100ms (good)
   - **Total Bundle Size** < 200KB gzipped (target)

### CDN Setup (Optional)
Deploy `dist/` to a CDN (Netlify, Vercel, Cloudflare, AWS CloudFront):
- Automatic compression (gzip/brotli)
- Global edge caching
- Automatic minification and optimization
- Performance insights dashboards

Most modern hosting platforms (Netlify, Vercel) handle this automatically.

## Theming and Branding
- Theme tokens drive gradients and surfaces; login inherits saved theme and dark-mode preferences from local storage.
- Branding uses the irrigación logo (no text lockup) with enlarged sizing and shadow on login.

## Changelog
See [CHANGELOG.md](CHANGELOG.md) for recent fixes and features.

## Notes
- Keep node version aligned with Vite 5 requirements (Node 18+ recommended).
