# Bot WhatsApp (panel + API)

[![Node.js](https://img.shields.io/badge/Node.js-20+-green)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.x-blue)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-blue)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue)](https://www.docker.com/)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

Monorepo con backend Node.js (Express, Socket.IO, WhatsApp Cloud API), frontend React (Vite) y stack Docker (PostgreSQL, Redis).

## Requisitos

- Node.js 20+
- Docker y Docker Compose (opcional, recomendado para levantar todo el stack)

## Inicio rápido con Docker

Desde la raíz del proyecto:

```bash
docker compose up -d --build
```

Por defecto:

- Frontend: `http://localhost:8080`
- Backend (API + webhook): `http://localhost:3003`

Variables sensibles (Meta, JWT, DB, Redis) van en un `.env` en la raíz o según indique tu despliegue. Podés tomar como guía los archivos `.env.example` del repo.

## Desarrollo local sin Docker

**Backend** (`backend/`):

```bash
cd backend
npm install
cp .env.example .env   # si existe; completar valores
npm start
```

**Frontend** (`frontend/`):

```bash
cd frontend
npm install
cp .env.example .env   # opcional; VITE_API_URL / VITE_SOCKET_URL
npm run dev
```

El backend escucha por defecto en el puerto **3003**. El frontend en desarrollo suele usar Vite (p. ej. `http://localhost:5173`) y debe apuntar al backend con `VITE_API_URL` y `VITE_SOCKET_URL` (por defecto en código suele ser `http://localhost:3003`).

## Webhook local con ngrok

WhatsApp Cloud API necesita una URL pública HTTPS para el webhook. En tu máquina local no es accesible desde internet, así que usá un túnel (por ejemplo [ngrok](https://ngrok.com/)):

1. Levantá el backend (puerto 3003).
2. Ejecutá algo equivalente a: `ngrok http 3003`
3. Copiá la URL HTTPS que te da ngrok y configurá en Meta el callback del webhook, p. ej. `https://<tu-subdominio>.ngrok-free.app/webhook`
4. Usá el mismo `WEBHOOK_VERIFY_TOKEN` en la app de Meta y en tu `.env`.

Sin un túnel así, el verificador y los `POST` del webhook no van a llegar a tu entorno local.

## Documentación adicional

En el repo hay más detalle en archivos como `DOCKER.md`, `API_DOCUMENTATION.md` o `SECURITY.md` si los tenés presentes en tu clon.

## Licencia

Ver `LICENSE` en la raíz del proyecto.
