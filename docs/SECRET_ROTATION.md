# Rotación de Secretos - Procedimientos

## Resumen

La rotación periódica de secretos es crítica para mantener la seguridad del sistema. Este documento describe los procedimientos y frecuencias recomendadas.

## Frecuencias de Rotación

| Secreto | Frecuencia | Prioridad | Impacto |
|---------|------------|-----------|---------|
| `WHATSAPP_TOKEN` | 60-90 días | Alta | Se invalidan sesiones de WhatsApp |
| `WEBHOOK_APP_SECRET` | 90 días | Alta | Webhooks dejan de validarse |
| `JWT_SECRET` | 180 días | Media | Se invalidan todos los tokens de usuarios |
| `DB_PASSWORD` | 90 días | Alta | Requiere reinicio de app |
| `SENTRY_DSN` | 365 días | Baja | Solo afecta monitoreo |

## Procedimientos

### 1. Rotación de WHATSAPP_TOKEN

**Impacto:** La aplicación dejará de poder enviar mensajes hasta actualizar el token.

**Pasos:**

1. **Generar nuevo token en Meta:**
   ```
   1. Ir a https://business.facebook.com/
   2. Seleccionar Business Account
   3. WhatsApp → API Setup
   4. Click en "Generate Token"
   5. Seleccionar permisos: whatsapp_business_messaging, whatsapp_business_management
   6. Copiar el nuevo token
   ```

2. **Actualizar en GitHub Secrets:**
   ```bash
   gh secret set WHATSAPP_TOKEN
   # Pegar el nuevo token cuando te lo pida
   ```

3. **Actualizar en producción:**
   - Si usas Docker: `docker-compose restart app`
   - Si usas PM2: `pm2 restart bot-irrigacion`
   - Verificar logs: debe aparecer "✅ Servidor iniciado"

4. **Probar endpoint:**
   ```bash
   curl -X POST http://localhost:3000/api/v1/reactivate \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer <jwt-token>" \
     -d '{"customerId": "test123"}'
   ```

5. **Revocar token anterior:**
   ```
   1. Ir a Meta Business Manager
   2. Business Settings → System Users
   3. Seleccionar el sistema user
   4. Assets → Apps → Manage
   5. Revocar el token anterior
   ```

**Rollback:** Si algo falla, poner el token anterior temporalmente y debuggear.

---

### 2. Rotación de WEBHOOK_APP_SECRET

**Impacto:** Los webhooks entrantes de WhatsApp dejarán de validarse correctamente.

**Pasos:**

1. **Obtener nuevo App Secret de Meta:**
   ```
   1. Ir a https://developers.facebook.com/apps/
   2. Seleccionar tu app
   3. Settings → Basic
   4. Click en "Reset App Secret"
   5. Confirmar reset
   6. Copiar el nuevo secret
   ```

2. **Actualizar en GitHub Secrets:**
   ```bash
   gh secret set WEBHOOK_APP_SECRET
   # Pegar el nuevo secret
   ```

3. **Actualizar en .env de producción:**
   ```bash
   # Editar .env
   vim /path/to/.env
   # Cambiar WEBHOOK_APP_SECRET=nuevo_valor
   ```

4. **Reiniciar aplicación:**
   ```bash
   docker-compose restart app
   # o
   pm2 restart bot-irrigacion
   ```

5. **Verificar webhook:**
   ```bash
   # Meta enviará un request de verificación
   # Revisar logs que no aparezcan errores de firma
   ```

**IMPORTANTE:** Meta puede tardar unos minutos en empezar a usar el nuevo secret.

---

### 3. Rotación de JWT_SECRET

**Impacto:** ⚠️ ALTO - Se invalidarán TODOS los tokens JWT activos. Todos los usuarios operadores tendrán que volver a hacer login.

**Pasos:**

1. **Notificar a usuarios:**
   - Enviar email/mensaje avisando de mantenimiento
   - Programar rotación en horario de baja actividad

2. **Generar nuevo secret:**
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```

3. **Actualizar en GitHub Secrets:**
   ```bash
   gh secret set JWT_SECRET
   ```

4. **Actualizar en .env de producción:**
   ```bash
   vim /path/to/.env
   # Cambiar JWT_SECRET=nuevo_valor
   ```

5. **Reiniciar aplicación:**
   ```bash
   docker-compose restart app
   ```

6. **Verificar:**
   - Los tokens anteriores deben dar error 401
   - Login debe generar nuevos tokens válidos

**Opcional:** Implementar rotación gradual con múltiples secrets (actual + anterior) para transición suave.

---

### 4. Rotación de DB_PASSWORD

**Impacto:** La aplicación perderá conexión a la base de datos hasta actualizar la contraseña.

**Pasos:**

1. **Generar nueva contraseña:**
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```

2. **Actualizar en PostgreSQL:**
   ```sql
   ALTER USER bot_irrigacion_app WITH PASSWORD 'nueva_contraseña_segura';
   ```

3. **Actualizar en GitHub Secrets:**
   ```bash
   gh secret set DB_PASSWORD
   ```

4. **Actualizar en .env de producción:**
   ```bash
   vim /path/to/.env
   # Cambiar DB_PASSWORD=nueva_contraseña
   ```

5. **Reiniciar aplicación:**
   ```bash
   docker-compose restart app
   ```

6. **Verificar conexión:**
   ```bash
   # Revisar logs
   docker-compose logs app | grep "Database"
   # Debe aparecer "✅ Base de datos conectada"
   ```

---

## Script Automático de Rotación

Usa el script `scripts/rotate_secrets.js`:

```bash
# Rotar JWT_SECRET
node scripts/rotate_secrets.js --type=jwt

# Rotar DB_PASSWORD
node scripts/rotate_secrets.js --type=db

# Rotar todos (interactive)
node scripts/rotate_secrets.js --type=all
```

---

## Checklist de Rotación

Antes de rotar cualquier secreto:

- [ ] Hacer backup de la base de datos
- [ ] Verificar que el CI está pasando
- [ ] Revisar que no hay deployments en curso
- [ ] Notificar al equipo (si aplica)
- [ ] Tener plan de rollback listo

Después de rotar:

- [ ] Verificar logs de la aplicación
- [ ] Probar endpoints críticos
- [ ] Actualizar documentación de runbook
- [ ] Revocar secretos anteriores (donde aplique)
- [ ] Documentar en changelog

---

## Emergencia: Secreto Comprometido

Si un secreto fue expuesto accidentalmente:

1. **INMEDIATO - Revocar acceso:**
   - WhatsApp token: Revocar en Meta Business Manager
   - App Secret: Reset en Meta Developers
   - JWT: Rotar inmediatamente
   - DB: Cambiar contraseña y limitar IPs

2. **Rotar el secreto siguiendo procedimiento acelerado:**
   - No esperar al horario programado
   - Ejecutar rotación de inmediato

3. **Investigar exposición:**
   - Revisar git history: `git log --all -- '*' | grep -i 'password\|token\|secret'`
   - Revisar logs de servidor
   - Verificar accesos sospechosos en DB

4. **Notificar:**
   - Equipo de seguridad
   - Stakeholders
   - Documentar en incident report

5. **Prevenir:**
   - Agregar pre-commit hooks para detectar secretos
   - Usar `git-secrets` o `truffleHog`
   - Capacitar al equipo

---

## Contacto de Emergencia

En caso de incidente de seguridad:
- 🚨 Email: security@tu-empresa.com
- 📱 Slack: #security-incidents
- 📞 On-call: Check PagerDuty

---

## Referencias

- [OWASP Secret Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [WhatsApp Business API - Token Management](https://developers.facebook.com/docs/whatsapp/business-management-api/get-started)
- [NIST Password Guidelines](https://pages.nist.gov/800-63-3/sp800-63b.html)
