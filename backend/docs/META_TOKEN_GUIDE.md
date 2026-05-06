# 🔐 Guía: Usar Meta Access Token Long-Lived (No Expira)

## 📝 Resumen Rápido

| Aspecto | Antes (Token Estándar) | Ahora (Long-Lived) |
|--------|----------------------|-------------------|
| **Tipo** | Temporary Access Token | System User Token |
| **Expiración** | ⏰ 60 días | ✅ Nunca expira |
| **Regeneración** | 📅 Cada 2 meses | ❌ No necesaria |
| **Complejidad** | Media | Baja |
| **Seguridad** | Buena | Muy Buena |

---

## 🚀 Paso a Paso: Generar Meta Long-Lived Token

### 1️⃣ Acceder a Meta App Dashboard

```
https://developers.facebook.com/docs/whatsapp/cloud-api/get-started
```

### 2️⃣ Crear System User

1. En tu App Dashboard
2. Settings > Users and Roles > System Users
3. Click "Create System User"

```
Nombre: "Bot Irrigación WhatsApp"
Role: Admin (o personalizado con permisos necesarios)
```

4. Click "Create"

### 3️⃣ Asignar Permisos a la App

Una vez creado el System User:

1. Click en el usuario
2. Click "Add Apps"
3. Seleccionar tu app
4. Permisos necesarios:
   - `whatsapp_business_messaging` - Enviar mensajes
   - `whatsapp_business_management` - Gestionar cuenta

5. Click "Save Changes"

### 4️⃣ Generar Token Long-Lived

1. En System User, click "Generate Token"
2. Seleccionar App: Tu app WhatsApp
3. Seleccionar Permisos:
   ```
   ✓ whatsapp_business_messaging
   ✓ whatsapp_business_management
   ```
4. Click "Generate"

```
Token generado (ejemplo):
EAAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 5️⃣ Copiar a .env

```env
META_ACCESS_TOKEN=EAAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## ✅ Ventajas del Token Long-Lived

| Ventaja | Descripción |
|---------|------------|
| **No expira** | ✅ Válido indefinidamente |
| **Más seguro** | ✅ System User con permisos específicos |
| **Menos mantenimiento** | ✅ No necesitas regenerar cada 2 meses |
| **Mejor para producción** | ✅ Evita interrupciones por token expirado |
| **Auditable** | ✅ Puedes ver qué System User accede |

---

## 🔍 Verificar que el Token Funciona

### Desde la API de Meta

```bash
curl -X GET "https://graph.instagram.com/debug_token?input_token=YOUR_TOKEN&access_token=YOUR_TOKEN"
```

Respuesta esperada (long-lived):
```json
{
  "data": {
    "app_id": "123456789",
    "type": "USER",
    "application": "Bot Irrigación",
    "data_access_expires_at": 0,    // ← 0 = No expira
    "expires_at": 0,                 // ← 0 = No expira
    "is_valid": true,
    "scopes": [
      "whatsapp_business_messaging",
      "whatsapp_business_management"
    ]
  }
}
```

⚠️ `expires_at: 0` significa que **NO expira** ✅

### Desde tu App

```bash
npm start

# En logs debe aparecer:
# ✓ WhatsApp API connected with META_ACCESS_TOKEN
# ✓ Token type: Long-Lived
# ✓ No expiration date
```

---

## 🛡️ Buenas Prácticas de Seguridad

### 1️⃣ Nunca Commitear el Token

```bash
# Verificar .env está en .gitignore
cat .gitignore | grep "^.env"
# Debe mostrar: .env
```

### 2️⃣ Usar Secrets Manager en Producción

```bash
# En Docker/servidor, usar variables de entorno
export META_ACCESS_TOKEN="token_aqui"

# O en docker-compose.yml
environment:
  - META_ACCESS_TOKEN=${META_ACCESS_TOKEN}
```

### 3️⃣ Rotación de Tokens

Aunque no expire, es bueno rotar tokens periódicamente:

```bash
# Cada 6-12 meses:
1. Generar nuevo token (paso 4)
2. Actualizar en producción
3. Revocar token anterior en Settings > System Users
```

### 4️⃣ Revocar Token (Si es necesario)

Si crees que el token fue comprometido:

1. Meta App Settings > Users and Roles > System Users
2. Click en el usuario
3. Click "Revoke Tokens"
4. Generar nuevo token

---

## 🐛 Troubleshooting

### "Invalid Token"

```
✗ Error: Invalid token provided
```

**Soluciones**:
1. Verificar que copiaste el token completo
2. No hay espacios al inicio/final
3. Token de System User (no personal)
4. Token tiene permisos necesarios

### "Token Expired"

```
✗ Error: Token has expired
```

**Si aún estás usando token estándar:**
1. Genera token long-lived en su lugar
2. System Users > Generate Token

### "Insufficient Permissions"

```
✗ Error: Insufficient permissions
```

**Solución**:
1. Editar System User
2. Add/Remove Apps
3. Asegurar que tiene permisos:
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`

---

## 📚 Referencias Oficiales

- [Meta Access Tokens Documentation](https://developers.facebook.com/docs/facebook-login/access-tokens)
- [WhatsApp Cloud API Setup](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started)
- [System Users Guide](https://developers.facebook.com/docs/apps/managing-app-access/system-users)
- [WhatsApp API Reference](https://developers.facebook.com/docs/whatsapp/cloud-api/reference)

---

## ✨ Checklist Final

- [ ] System User creado con nombre descriptivo
- [ ] Permisos asignados: `whatsapp_business_messaging`, `whatsapp_business_management`
- [ ] Token long-lived generado (expires_at = 0)
- [ ] Token copiado a `.env` como `META_ACCESS_TOKEN`
- [ ] Token NO commiteado a Git
- [ ] Test: `npm start` y verificar logs
- [ ] Token verificado con debug API
- [ ] Backups de token en lugar seguro (password manager)

---

**¡Listo! Tu token Meta never expira y está seguro. 🎉**
