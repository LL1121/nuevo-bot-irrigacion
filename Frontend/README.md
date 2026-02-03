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

## Theming and Branding
- Theme tokens drive gradients and surfaces; login inherits saved theme and dark-mode preferences from local storage.
- Branding uses the irrigación logo (no text lockup) with enlarged sizing and shadow on login.

## Changelog
See [CHANGELOG.md](CHANGELOG.md) for recent fixes and features.

## Notes
- Keep node version aligned with Vite 5 requirements (Node 18+ recommended).
