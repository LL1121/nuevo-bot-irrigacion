# 🚀 GUÍA DE SETUP HOSTINGER - Bot Irrigación

## 📋 Pre-requisitos

- ✅ Cuenta Hostinger con Node.js soportado (18+)
- ✅ Acceso SSH habilitado
- ✅ MySQL creada
- ✅ Dominio apuntando a Hostinger

---

## 1️⃣ CONEXIÓN INICIAL POR SSH

```bash
# Conectar a Hostinger
ssh tu_usuario@tu_servidor.com

# Verificar versión de Node
node --version    # Debe ser v18+ 
npm --version

# Crear directorio de la app
mkdir -p ~/bot-irrigacion
cd ~/bot-irrigacion
```

---

## 2️⃣ CLONAR REPOSITORIO

```bash
# Clonar con HTTPS (más fácil sin keys SSH)
git clone https://github.com/LL1121/nuevo-bot-irrigacion.git .

# O con SSH si tienes keys configuradas
git clone git@github.com:LL1121/nuevo-bot-irrigacion.git .

# Moverse a main
git checkout main
```

---

## 3️⃣ CONFIGURAR VARIABLES DE ENTORNO

```bash
# Copiar template de .env
cp .env.example .env

# Editar con credenciales reales
nano .env  # o vi, o tu editor favorito
```

**Variables CRÍTICAS que necesitas:**

```bash
# Base de datos
DB_HOST=localhost
DB_USER=tu_usuario_mysql
DB_PASSWORD=tu_password_mysql
DB_NAME=bot_irrigacion_db

# WhatsApp
WHATSAPP_TOKEN=tu_token_real
WEBHOOK_APP_SECRET=tu_webhook_secret

# Dominio
FRONTEND_URL=https://tu-dominio.com
BACKEND_URL=https://tu-dominio.com

# Sentry (opcional pero recomendado)
SENTRY_DSN=tu_sentry_dsn

# Puerto (Hostinger lo maneja, dejar en 3000)
PORT=3000

# Node env
NODE_ENV=production
```

---

## 4️⃣ INSTALAR DEPENDENCIAS

```bash
# Limpiar npm cache
npm cache clean --force

# Instalar solo dependencias de producción
npm ci --production

# Verificar que funciona
npm start
# Debe ver: "✅ Servidor corriendo en puerto 3000"
# Ctrl+C para salir
```

---

## 5️⃣ INSTALAR Y CONFIGURAR PM2

```bash
# Instalar PM2 globalmente
npm install -g pm2

# Iniciar la app con PM2
pm2 start ecosystem.config.js

# Ver status
pm2 status

# Guardar configuración para reinicio automático
pm2 save
pm2 startup

# Esto imprime un comando, CÓPIALO Y EJECUTALO
# (pm2 startup systemd -u tu_usuario --hp /home/tu_usuario)
```

**Output esperado:**
```
[PM2] Spawning PM2 daemon with pm2_home=/root/.pm2
[PM2] PM2 successfully started
[PM2] bot-irrigacion 0 online
```

---

## 6️⃣ CREAR BASE DE DATOS

```bash
# Conectar a MySQL
mysql -u tu_usuario_mysql -p

# Dentro de MySQL:
CREATE DATABASE bot_irrigacion_db;
USE bot_irrigacion_db;
source /home/tu_usuario/bot-irrigacion/database/setup.sql;
EXIT;
```

Luego volvés a SSH y corres:

```bash
# Crear índices (OPCIONAL, mejora performance)
npm run db:index
```

---

## 7️⃣ CONFIGURAR NGINX (Reverse Proxy)

En Hostinger, ve a:
1. **cPanel → Addon Domains** → Configura tu dominio
2. **cPanel → File Manager** → Navega a `/public_html`
3. Modifica `.htaccess` o configura Nginx

**Si es Nginx, edita `/etc/nginx/sites-available/tu-dominio.com`:**

```nginx
server {
    listen 80;
    listen [::]:80;
    
    server_name tu-dominio.com www.tu-dominio.com;
    
    # Redirigir a HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    
    server_name tu-dominio.com www.tu-dominio.com;
    
    # SSL (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/tu-dominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tu-dominio.com/privkey.pem;
    
    # Proxy a Node.js
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Socket.io
    location /socket.io {
        proxy_pass http://localhost:3000/socket.io;
        proxy_http_version 1.1;
        proxy_buffering off;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }
}
```

Luego:
```bash
sudo nginx -t  # Verificar sintaxis
sudo systemctl reload nginx
```

---

## 8️⃣ VERIFICAR QUE FUNCIONE

```bash
# Desde tu máquina local
curl https://tu-dominio.com/health

# Debe responder algo como:
# {"status":"OK","uptime":1234,"memory":"45MB"}
```

Si ves error:
```bash
# En Hostinger, revisar logs
pm2 logs bot-irrigacion

# Verificar que el proceso esté corriendo
pm2 status
```

---

## 9️⃣ CONFIGURAR ACTUALIZACIONES AUTOMÁTICAS (OPCIONAL)

```bash
# En Hostinger, crear cron job (cPanel → Cron Jobs)
# Ejecutar cada 2 horas:

0 */2 * * * cd ~/bot-irrigacion && git pull origin main && npm ci --production && pm2 restart bot-irrigacion
```

---

## 🔟 MONITOREO Y MANTENIMIENTO

```bash
# Ver logs en tiempo real
pm2 logs bot-irrigacion

# Monitor de recursos (CPU, RAM)
pm2 monit

# Reiniciar app
pm2 restart bot-irrigacion

# Detener app
pm2 stop bot-irrigacion

# Reanudar app
pm2 start bot-irrigacion

# Ver lista de procesos
pm2 list

# Limpiar logs antiguos
pm2 flush
```

---

## 🔐 SEGURIDAD - CHECKLIST

- [ ] `.env` no está en git (revisar `.gitignore`)
- [ ] WHATSAPP_TOKEN está en producción (no development token)
- [ ] SSL/HTTPS está habilitado
- [ ] Rate limiting configurado (ya está en código)
- [ ] Sentry está recibiendo errores
- [ ] Backups automáticos de BD configurados
- [ ] Logs rotan correctamente

---

## 🚨 PROBLEMAS COMUNES

### "Connection refused on port 3000"
```bash
# Verificar que PM2 está corriendo
pm2 status

# Si no, reiniciar
pm2 start ecosystem.config.js

# Ver si hay error
pm2 logs bot-irrigacion --err
```

### "Cannot connect to MySQL"
```bash
# Verificar credenciales en .env
cat .env | grep DB_

# Probar conexión directa
mysql -h localhost -u tu_usuario -p tu_base_datos
```

### "SSL certificate error"
```bash
# Renovar certificado Let's Encrypt
sudo certbot renew

# Verificar certificado
sudo certbot certificates
```

### "App se reinicia cada 10s"
```bash
# Probablemente hay error
pm2 logs bot-irrigacion --lines 100 --err

# Revisar error específico y arreglarlo
```

---

## 📞 SOPORTE

Si algo falla:
1. **Revisar logs**: `pm2 logs bot-irrigacion`
2. **Health check**: `curl https://tu-dominio.com/health`
3. **Sentry dashboard**: Ver errores en tiempo real
4. **GitHub Issues**: Reportar problema

---

## ✅ CHECKLIST FINAL

- [ ] App corriendo: `pm2 status`
- [ ] Health check OK: `curl https://tu-dominio.com/health`
- [ ] BD conectada: Tests de API
- [ ] SSL funcionando: Sin warnings en navegador
- [ ] Logs se actualizan: `pm2 logs bot-irrigacion`
- [ ] PM2 auto-inicia en reboot: `pm2 startup`

**¡Listo! Tu bot está en producción en Hostinger 🚀**
