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

## Getting Started
1) Install dependencies: `npm install`
2) Start dev server: `npm run dev` (opens Vite on http://localhost:5173 by default)
3) Lint: `npm run lint`
4) Production build: `npm run build`; preview: `npm run preview`

## Project Structure (frontend)
- [src/main.tsx](src/main.tsx) bootstraps React and providers
- [src/App.tsx](src/App.tsx) manages auth guard, theme props, and layout
- [src/components](src/components) UI composition:
  - [components/Login.tsx](src/components/Login.tsx) themed/dark-mode-aware login
  - [components/chat-window.tsx](src/components/chat-window.tsx), [message-list.tsx](src/components/message-list.tsx), [message-input.tsx](src/components/message-input.tsx) chat experience
  - [components/sidebar.tsx](src/components/sidebar.tsx) navigation and branding
  - [components/ui](src/components/ui) shared Radix-based primitives
- [src/styles/global.css](src/styles/global.css) Tailwind base styles

## Theming and Branding
- Theme tokens drive gradients and surfaces; login inherits saved theme and dark-mode preferences from local storage.
- Branding uses the irrigación logo (no text lockup) with enlarged sizing and shadow on login.

## Changelog
See [CHANGELOG.md](CHANGELOG.md) for recent fixes and features.

## Notes
- Keep node version aligned with Vite 5 requirements (Node 18+ recommended).
