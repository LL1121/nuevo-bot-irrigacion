# GitHub Secrets Configuration Guide

Este documento te guía paso a paso para configurar los secretos en GitHub.

## Acceder a GitHub Secrets

1. Ve a tu repositorio en GitHub
2. Click en **Settings** (⚙️)
3. En el menú lateral izquierdo, navega a **Secrets and variables → Actions**
4. Click en **New repository secret**

## Secretos a Configurar

### 1. WHATSAPP_TOKEN

**Cómo obtenerlo:**
1. Ir a [Meta Business Manager](https://business.facebook.com/)
2. Seleccionar tu Business Account
3. Navegar a **WhatsApp → API Setup**
4. Copiar el "Temporary access token" o generar uno permanente
5. **Importante:** Los tokens temporales expiran en 24h, usa tokens permanentes en producción

**Agregar a GitHub:**
- Name: `WHATSAPP_TOKEN`
- Value: `EAA...` (el token completo)

---

### 2. WEBHOOK_APP_SECRET

**Cómo obtenerlo:**
1. Ir a [Meta for Developers](https://developers.facebook.com/apps/)
2. Seleccionar tu app de WhatsApp
3. Navegar a **Settings → Basic**
4. Click en **Show** junto a "App Secret"
5. Copiar el valor

**Agregar a GitHub:**
- Name: `WEBHOOK_APP_SECRET`
- Value: `abc123...` (el app secret)

---

### 3. JWT_SECRET

**Cómo generarlo:**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

**Agregar a GitHub:**
- Name: `JWT_SECRET`
- Value: (el hash generado)

---

### 4. DB_HOST

**Valor:**
- Local: `localhost`
- Producción: IP o dominio de tu servidor PostgreSQL
- Cloud: endpoint proporcionado por tu proveedor (AWS RDS, Azure, etc.)

**Agregar a GitHub:**
- Name: `DB_HOST`
- Value: `tu-servidor.com` o `192.168.1.100`

---

### 5. DB_USER

**Valor:**
- Usuario de PostgreSQL con permisos en la base de datos
- Recomendado: crear usuario específico para la app (no usar `root` en producción)

```sql
CREATE USER 'bot_irrigacion'@'%' IDENTIFIED BY 'password_seguro';
GRANT ALL PRIVILEGES ON irrigacion.* TO 'bot_irrigacion'@'%';
FLUSH PRIVILEGES;
```

**Agregar a GitHub:**
- Name: `DB_USER`
- Value: `bot_irrigacion` o `root`

---

### 6. DB_PASSWORD

**Valor:**
- Contraseña del usuario de PostgreSQL

**Generar contraseña segura:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**Agregar a GitHub:**
- Name: `DB_PASSWORD`
- Value: (la contraseña del usuario PostgreSQL)

---

### 7. DB_NAME

**Valor:**
- Nombre de la base de datos (por defecto: `irrigacion`)

**Agregar a GitHub:**
- Name: `DB_NAME`
- Value: `irrigacion`

---

### 8. SENTRY_DSN (Opcional)

**Cómo obtenerlo:**
1. Crear cuenta en [Sentry.io](https://sentry.io/)
2. Crear nuevo proyecto (Node.js)
3. Copiar el DSN que te proporcionan

**Agregar a GitHub:**
- Name: `SENTRY_DSN`
- Value: `https://abc123@o123.ingest.sentry.io/456`

---

### 9. REDIS_URL (Opcional)

**Valor:**
- Local: `redis://localhost:6379`
- Cloud: URL proporcionada por tu proveedor (Upstash, Redis Labs, etc.)

**Agregar a GitHub:**
- Name: `REDIS_URL`
- Value: `redis://localhost:6379` o `redis://user:pass@host:port`

---

## Verificación

Después de configurar todos los secretos:

1. Ve a **Actions** en tu repositorio
2. Selecciona el workflow **CI**
3. Click en **Run workflow**
4. Si todo está bien configurado, el workflow debe pasar ✅

## Comandos útiles con GitHub CLI

Si tienes `gh` instalado:

```bash
# Listar secretos
gh secret list

# Agregar un secreto
gh secret set WHATSAPP_TOKEN

# Eliminar un secreto
gh secret remove WHATSAPP_TOKEN
```

## Troubleshooting

### Error: "Secret not found"
- Verifica que el nombre del secret en el workflow coincida exactamente
- Los nombres son case-sensitive: `WHATSAPP_TOKEN` ≠ `whatsapp_token`

### Error: "Token expired" en WhatsApp
- El WHATSAPP_TOKEN temporal expiró
- Genera un token permanente en Meta Business

### Error de conexión a base de datos
- Verifica que DB_HOST, DB_USER, DB_PASSWORD, DB_NAME estén correctos
- Si usas PostgreSQL en GitHub Actions, considera usar un servicio temporal:
  ```yaml
  services:
    postgres:
      image: postgres:16
      env:
        POSTGRES_DB: bot_irrigacion_prod
        POSTGRES_PASSWORD: test
  ```

## Seguridad

- ❌ **NUNCA** commits secretos en código
- ❌ **NUNCA** compartas secretos en chat/email
- ✅ Rota secretos cada 60-90 días
- ✅ Usa secretos diferentes para dev/staging/prod
- ✅ Revisa audit logs regularmente

## Referencias

- [GitHub Encrypted Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [WhatsApp API Access Tokens](https://developers.facebook.com/docs/whatsapp/business-management-api/get-started#1--acquire-an-access-token-using-a-system-user-or-facebook-login)
- [Sentry DSN](https://docs.sentry.io/product/sentry-basics/dsn-explainer/)
