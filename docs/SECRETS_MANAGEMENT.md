# Gestión de Secretos y Rotación

Este documento describe cómo manejar secretos sensibles en producción y el proceso de rotación.

## Secretos Críticos

Los siguientes secretos deben almacenarse de forma segura y nunca committearse:

1. **WHATSAPP_TOKEN** - Token de acceso a WhatsApp Business API
2. **WEBHOOK_APP_SECRET** - Secret para verificar webhooks de Meta
3. **JWT_SECRET** - Secret para firmar tokens JWT
4. **DB_PASSWORD** - Contraseña de MySQL
5. **SENTRY_DSN** - DSN de Sentry para monitoreo
6. **REDIS_URL** - URL de conexión a Redis (si incluye contraseña)

## Configuración en GitHub Actions

### 1. Agregar Secrets al repositorio

Ve a **Settings → Secrets and variables → Actions** y agrega:

```
WHATSAPP_TOKEN=<tu_token>
WEBHOOK_APP_SECRET=<tu_secret>
JWT_SECRET=<tu_secret>
DB_PASSWORD=<tu_password>
SENTRY_DSN=<tu_dsn>
DB_HOST=<tu_host>
DB_USER=<tu_user>
DB_NAME=irrigacion
```

### 2. Uso en workflows

Los secrets se acceden con `${{ secrets.SECRET_NAME }}`:

```yaml
- name: Run tests
  env:
    WHATSAPP_TOKEN: ${{ secrets.WHATSAPP_TOKEN }}
    WEBHOOK_APP_SECRET: ${{ secrets.WEBHOOK_APP_SECRET }}
  run: npm test
```

## Proceso de Rotación de Secretos

### WHATSAPP_TOKEN

**Frecuencia:** Cada 60-90 días o inmediatamente si hay sospecha de compromiso.

**Pasos:**

1. Ir al [Meta Business Dashboard](https://business.facebook.com/)
2. Navegar a **WhatsApp → API Setup**
3. Generar nuevo token de acceso
4. Actualizar en producción:
   ```bash
   # Actualizar GitHub Secret
   gh secret set WHATSAPP_TOKEN --body "nuevo_token"
   
   # O manualmente en Settings → Secrets
   ```
5. Reiniciar la aplicación para que tome el nuevo token
6. Verificar logs: `✅ WhatsApp API conectada`
7. Invalidar token anterior en Meta Dashboard

### WEBHOOK_APP_SECRET

**Frecuencia:** Cada 90 días o si hay compromiso.

**Pasos:**

1. Ir al [Meta App Dashboard](https://developers.facebook.com/apps/)
2. Navegar a **Settings → Basic → App Secret**
3. Generar nuevo App Secret
4. Actualizar en producción:
   ```bash
   gh secret set WEBHOOK_APP_SECRET --body "nuevo_secret"
   ```
5. **Importante:** Actualizar el webhook en Meta para que use el nuevo secret
6. Reiniciar aplicación
7. Probar webhook con: `node scripts/test_security.js`

### JWT_SECRET

**Frecuencia:** Cada 6 meses o si hay compromiso.

**Pasos:**

1. Generar nuevo secret:
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```
2. Actualizar en producción
3. **Advertencia:** Invalidará todos los tokens JWT existentes
4. Los usuarios/operadores deberán volver a autenticarse

### DB_PASSWORD

**Frecuencia:** Cada 90 días o si hay compromiso.

**Pasos:**

1. Conectar a MySQL:
   ```bash
   mysql -u root -p
   ```
2. Cambiar contraseña:
   ```sql
   ALTER USER 'root'@'localhost' IDENTIFIED BY 'nueva_password';
   FLUSH PRIVILEGES;
   ```
3. Actualizar secret en GitHub
4. Reiniciar aplicación

## Alternativa: Uso de Vault (Producción avanzada)

Para entornos enterprise, considera usar HashiCorp Vault:

```javascript
// src/config/secrets.js
const vault = require('node-vault')({ endpoint: process.env.VAULT_ADDR });

async function getSecret(path) {
  const result = await vault.read(path);
  return result.data;
}

module.exports = { getSecret };
```

## Checklist de Seguridad

- [ ] Todos los secretos están en GitHub Secrets (no en código)
- [ ] `.env` está en `.gitignore`
- [ ] `.env.example` NO contiene valores reales
- [ ] Rotación automática configurada (si disponible)
- [ ] Alertas de Sentry activas para errores de autenticación
- [ ] Logs NO imprimen secretos (verificar `logger.info`)
- [ ] Rate limiting activo para prevenir ataques
- [ ] Webhook signature verification habilitada

## Monitoreo de Secretos

### Alertas a configurar:

1. **Token expirado:** Si WhatsApp API retorna 401/403
2. **Secret inválido:** Si webhook rechaza firmas válidas
3. **Intentos de acceso no autorizado:** Múltiples 401 en endpoints protegidos

### Logs a revisar:

```bash
# Buscar errores de autenticación
grep "401\|403\|Invalid token" logs/error.log

# Verificar webhooks rechazados
grep "Firma de webhook inválida" logs/combined.log
```

## Contacto de Emergencia

En caso de compromiso de secretos:

1. **Inmediatamente:** Rotar todos los secretos afectados
2. **Revisar:** Logs de acceso y audit_log en BD
3. **Notificar:** Al equipo de seguridad
4. **Documentar:** Incidente en `docs/incidents/YYYY-MM-DD.md`

## Referencias

- [GitHub Encrypted Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Meta Business Security](https://developers.facebook.com/docs/whatsapp/security/)
- [OWASP Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
