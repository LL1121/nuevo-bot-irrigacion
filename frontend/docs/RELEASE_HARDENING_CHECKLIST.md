# Release Hardening Checklist

Checklist operativa para cada release del frontend.

## 1) Pre-flight (antes de merge/deploy)

- Confirmar rama y commit objetivo.
- Verificar `npm ci` sin errores.
- Verificar variables críticas de entorno:
  - `VITE_API_URL`
  - `VITE_SOCKET_URL`
  - `VITE_ENABLE_SENTRY`
  - `VITE_SENTRY_DSN` (si Sentry está habilitado)

## 2) Gate automática mínima

Ejecutar:

```bash
npm run release:check
```

Esto valida:

- Tests críticos de mensajería/caché (`test:critical`)
- Build de producción (`build`)

## 3) Gate automática completa (release mayor)

Ejecutar:

```bash
npm run release:check:full
```

Esto valida:

- Lint completo
- Suite completa de tests
- Build de producción

## 4) Validaciones manuales obligatorias

- Login/logout funciona correctamente.
- Carga inicial de conversaciones sin errores.
- Envío de mensaje (optimistic -> reconciliación) correcto.
- Recepción socket en tiempo real correcta.
- Scroll/cargar más mensajes estable.
- Sidebar y mensajes virtualizados sin glitches visibles.

## 5) Observabilidad y alertas

- Verificar que eventos críticos aparecen en telemetría:
  - `socket_connect_error`, `socket_reconnect_attempt`, `socket_reconnect_failed`
  - `message_send_failed`, `messages_load_more_failed`, `chats_load_failed`
- Confirmar que alertas visuales no spamean (throttle activo).

## 6) Post-deploy (primeros 30 minutos)

- Revisar errores frontend en consola/Sentry.
- Confirmar que tasa de errores no sube respecto al baseline.
- Probar al menos un flujo real de mensaje extremo a extremo.

## 7) Criterio de rollback

Aplicar rollback si ocurre cualquiera de estos puntos:

- Fallo de login generalizado.
- Socket sin reconexión en producción por más de 5 minutos.
- Error sostenido en envío/recepción de mensajes.
- Error crítico de render en listas virtualizadas.
