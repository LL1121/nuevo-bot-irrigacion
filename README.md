# Bot de Atencion por WhatsApp

Sistema de atencion automatizada por WhatsApp con panel de operadores en tiempo real, gestion de deudas y generacion de boletos.

## Caracteristicas principales

- Bot conversacional con estados y memoria por usuario.
- Webhook para WhatsApp Cloud API (mensajes de texto e interactivos).
- Panel web para operadores con actualizacion en tiempo real (Socket.IO).
- Integracion con PostgreSQL y Redis (cache opcional).
- Flujo de deuda/boleto con API directa y fallback por scraping.
- Logging estructurado con archivos rotativos.

## Requisitos

- Node.js 20+
- npm
- PostgreSQL 15+
- Redis 7+ (opcional)
- Docker y Docker Compose (opcional)

## Inicio rapido (local)

```bash
# 1) Instalar dependencias
npm install

# 2) Crear archivos de entorno
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# 3) Ejecutar backend
cd backend
npm start

# 4) En otra terminal, ejecutar frontend
cd ../frontend
npm install
npm run dev
```

Entornos locales por defecto:

- Backend: `http://localhost:3003`
- Frontend: `http://localhost:5174`
- API: `http://localhost:3003/api`

## Webhook local con ngrok

Para recibir webhooks reales de WhatsApp en local, el backend necesita una URL publica HTTPS.

1. Levanta el backend en `3003`.
2. En otra terminal, expone el puerto con ngrok:

```bash
ngrok http 3003
```

3. Copia la URL HTTPS generada (ej: `https://xxxx-xx-xx-xx-xx.ngrok-free.app`).
4. Configura en `backend/.env`:

```env
BASE_URL=https://tu-url-ngrok
WEBHOOK_URL=https://tu-url-ngrok/webhook
```

5. Actualiza la URL del webhook en Meta/WhatsApp Developer para que apunte a esa URL.

Nota: cada vez que reinicies ngrok cambia la URL (salvo que uses dominio reservado), por lo que hay que volver a actualizarla.

## Docker Compose

Desde la raiz del proyecto:

```bash
docker compose up -d --build
```

Puertos por defecto:

- Frontend: `http://localhost:8080`
- Backend: `http://localhost:3003`

Variables relevantes de compose:

- `BACKEND_PORT` (default `3003`)
- `FRONTEND_PORT` (default `8080`)
- `VITE_API_URL`
- `VITE_SOCKET_URL`

## Estructura del proyecto

```text
backend/
  src/
    controllers/
    services/
    routes/
    middlewares/
    handlers/
  logs/
frontend/
  src/
  public/
```

## Variables de entorno (resumen)

Backend (`backend/.env`):

- `PORT`
- `JWT_SECRET`
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`
- `META_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `META_APP_SECRET`, `WEBHOOK_VERIFY_TOKEN`
- `BASE_URL`, `FRONTEND_URL`

Frontend (`frontend/.env`):

- `VITE_API_URL`
- `VITE_SOCKET_URL`
- `VITE_REQUEST_TIMEOUT_MS`

## Logs

Los errores y eventos se guardan en `backend/logs`.

- `backend/logs/error-YYYY-MM-DD-HH.log`
- `backend/logs/combined-YYYY-MM-DD-HH.log`
- `backend/logs/errors/<script>-YYYY-MM-DD-HH.log`

Retencion configurable:

- `SCRIPT_ERRORS_RETENTION_DAYS` (default `30`)

## Testing

Backend:

```bash
cd backend
npm test
```

Frontend:

```bash
cd frontend
npm test
```

## Despliegue

1. Configurar variables de entorno para el entorno objetivo.
2. Construir y levantar servicios (Docker Compose o proceso Node + frontend build).
3. Verificar health checks y conectividad de webhook.
4. Revisar logs en `backend/logs`.

## Notas

- Turnos se encuentra temporalmente deshabilitado en el menu principal.
- No subir claves, certificados ni archivos temporales (PDFs/keys) al repositorio.
