# ✅ CHECKLIST HOSTINGER - Bot Irrigación

## 📋 Pre-Deployment

- [ ] Código testeado localmente (`npm test` pasando)
- [ ] Sin vulnerabilidades (`npm audit`)
- [ ] Cambios pusheados a `main` en GitHub
- [ ] Variables de Hostinger documentadas
- [ ] Credenciales de WhatsApp verificadas
- [ ] Dominio apuntando a Hostinger DNS
- [ ] SSL/HTTPS disponible en Hostinger

---

## 🔧 Setup en Hostinger

- [ ] **SSH Access**: Habilitado en Hostinger
  ```bash
  ssh tu_usuario@tu_servidor.com
  ```

- [ ] **Node.js**: Versión 18+ instalada
  ```bash
  node --version
  npm --version
  ```

- [ ] **MySQL Database**: Creada y accesible
  - Nombre: `bot_irrigacion_db`
  - Usuario: `tu_usuario_mysql`
  - Password: Guardado de forma segura

- [ ] **Git Clonado**: Repo en `/home/tu_usuario/bot-irrigacion`
  ```bash
  git clone https://github.com/LL1121/nuevo-bot-irrigacion.git
  cd bot-irrigacion
  ```

- [ ] **Variables de Entorno**: `.env` configurado
  ```bash
  cp .env.hostinger .env
  nano .env  # Editar con credenciales reales
  ```

- [ ] **Dependencias Instaladas**: `npm ci --production`
  ```bash
  npm cache clean --force
  npm ci --production
  ```

---

## 🗄️ Base de Datos

- [ ] **Tabla Creada**: Database schema importada
  ```bash
  mysql -u usuario -p bot_irrigacion_db < database/setup.sql
  ```

- [ ] **Índices Creados**: Mejorar performance (opcional)
  ```bash
  npm run db:index
  ```

- [ ] **Conexión Verificada**: Test de conexión exitoso
  ```bash
  mysql -h localhost -u usuario -p bot_irrigacion_db
  ```

---

## 🔐 PM2 Configuration

- [ ] **PM2 Instalado Globalmente**
  ```bash
  npm install -g pm2
  ```

- [ ] **App Iniciada con PM2**
  ```bash
  pm2 start ecosystem.config.js
  pm2 status
  ```

- [ ] **PM2 Guardar en Startup**
  ```bash
  pm2 save
  pm2 startup
  # Copiar y ejecutar el comando que imprime
  ```

- [ ] **Logs Funcionando**
  ```bash
  pm2 logs bot-irrigacion
  # Debe mostrar: "✅ Servidor corriendo en puerto 3000"
  ```

---

## 🌐 Nginx / Reverse Proxy

- [ ] **Dominio Apunta a Hostinger**: DNS verificado
  ```bash
  nslookup tu-dominio.com
  ```

- [ ] **Nginx Configurado**: Reverse proxy a :3000
  - `/etc/nginx/sites-available/tu-dominio.com`
  - Redirige HTTP → HTTPS
  - Proxy a `localhost:3000`

- [ ] **SSL/HTTPS**: Let's Encrypt habilitado
  ```bash
  sudo certbot certificates
  # Debe mostrar certificado válido
  ```

- [ ] **Nginx Reloadado**: Configuración activa
  ```bash
  sudo nginx -t  # Verificar sintaxis
  sudo systemctl reload nginx
  ```

---

## 🧪 Testing en Producción

- [ ] **Health Check Funciona**
  ```bash
  curl https://tu-dominio.com/health
  # Response: {"status":"OK","uptime":...}
  ```

- [ ] **API Endpoints Responden**
  ```bash
  curl https://tu-dominio.com/api/chats -H "Authorization: Bearer token"
  ```

- [ ] **WebSocket Conecta**
  - Abrir dev tools en frontend
  - Ver conexión: `Socket.io connected`

- [ ] **Base de Datos Conecta**
  - Ver logs: `pm2 logs bot-irrigacion`
  - No debe haber "Connection refused" errors

---

## 📊 Monitoreo

- [ ] **Sentry Configurado** (opcional pero recomendado)
  - Dashboard mostrando eventos
  - Alerts configuradas

- [ ] **PM2 Monitoring**
  ```bash
  pm2 monit
  # Ver CPU/RAM en tiempo real
  ```

- [ ] **Logs Rotan Correctamente**
  - Ver: `/home/tu_usuario/bot-irrigacion/logs/`
  - Archivos no crecen infinitamente

---

## 🔐 Seguridad

- [ ] **Variables No Están en Git**
  ```bash
  git status
  # .env NO debe aparecer (en .gitignore)
  ```

- [ ] **Credenciales Protegidas**
  - WHATSAPP_TOKEN: No commitado
  - DB_PASSWORD: No visible en logs
  - Secretos en .env solamente

- [ ] **Rate Limiting Activo**
  - Limita: 100 requests por 15 minutos
  - Previene abuse

- [ ] **Helmet Security Headers**
  - CORS whitelist: Solo tu dominio
  - CSP headers configurados

---

## 📈 Performance

- [ ] **Response Time Bajo**
  - `/health`: <100ms
  - `/api/chats`: <500ms
  - Verificar con: `curl -w "@curl-format.txt"` o chrome DevTools

- [ ] **Compresión Activa**
  - Gzip habilitado: Responses 75% más chicas
  - Verificar: Chrome DevTools → Network → Response headers

- [ ] **Índices de BD Creados**
  - Queries: 10-100x más rápidas
  - Ver: `SHOW INDEXES FROM mensajes;`

---

## 🚀 Deployment Script

- [ ] **Deploy Script Funciona**
  ```bash
  bash scripts/deploy-hostinger.sh
  # Debe: pull, test, restart, verify
  ```

- [ ] **Auto-Updates (Opcional)**
  ```bash
  # cPanel → Cron Jobs
  0 */2 * * * cd ~/bot-irrigacion && git pull && npm ci --production && pm2 restart bot-irrigacion
  ```

---

## 📝 Documentación

- [ ] **HOSTINGER_SETUP.md**: Leído y entendido
- [ ] **Credenciales**: Guardadas en lugar seguro
- [ ] **Escalation contacts**: Documentados
- [ ] **Backup strategy**: Documentado

---

## 🆘 Troubleshooting

Si algo falla:

1. **App no inicia**
   ```bash
   pm2 logs bot-irrigacion --lines 100 --err
   # Ver error específico
   ```

2. **BD no conecta**
   ```bash
   mysql -h localhost -u usuario -p bot_irrigacion_db
   # Verificar credenciales
   ```

3. **Dominio no funciona**
   ```bash
   curl -i https://tu-dominio.com/health
   # Ver headers y response
   ```

4. **SSL error**
   ```bash
   sudo certbot renew
   sudo systemctl reload nginx
   ```

---

## ✅ Sign-Off

- [ ] Todo funciona en `https://tu-dominio.com/health`
- [ ] Logs se actualizan en tiempo real
- [ ] PM2 reinicia automático en reboot
- [ ] Backup de BD configurado
- [ ] Alertas (Sentry) recibidas

**¡Deployment completado exitosamente! 🎉**

---

## 📞 Próximos Pasos

1. **Monitoreo Continuo**
   - Revisar logs diariamente
   - Monitor de Sentry
   - Health checks

2. **Mantenimiento**
   - Actualizar dependencias
   - Rotación de tokens
   - Backup de BD

3. **E2E Testing**
   - TODO #10: Tests con credenciales reales
   - Validar reactivation flow completo

