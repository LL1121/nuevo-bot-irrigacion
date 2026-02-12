# 🚀 Guía de Despliegue - Frontend

Guía completa para desplegar el frontend del Bot de Irrigación Malargüe en producción.

---

## 📋 Pre-Requisitos

### Sistema
- **Servidor**: Linux (Ubuntu 20.04+ recomendado)
- **Node.js**: 18.x o superior
- **npm**: 9.x o superior
- **Nginx** o **Apache** para servir archivos estáticos

### Dominio y SSL
- Dominio configurado: `chat.irrigacionmalargue.net`
- Certificado SSL válido (Let's Encrypt recomendado)

### Backend
- Backend corriendo en `https://chat.irrigacionmalargue.net`
- Endpoints `/api/*` y WebSocket `/socket.io` funcionando
- CORS configurado para permitir el frontend

---

## 🔧 Configuración Inicial

### 1. Variables de Entorno

Editar `.env.production`:

```env
# API Configuration
VITE_API_URL=https://chat.irrigacionmalargue.net
VITE_SOCKET_URL=https://chat.irrigacionmalargue.net

# Auth
VITE_TOKEN_KEY=token
VITE_OPERADOR_KEY=operador
VITE_JWT_EXPIRY_MS=3600000

# Feature Flags
VITE_ENABLE_LOGGING=false
VITE_ENABLE_SENTRY=true
VITE_SENTRY_DSN=https://your-sentry-key@sentry.io/project-id

# Timeouts
VITE_REQUEST_TIMEOUT_MS=30000
VITE_SOCKET_RECONNECT_DELAY_MS=2000
VITE_SOCKET_RECONNECT_ATTEMPTS=10
VITE_SESSION_TIMEOUT_MS=86400000
```

### 2. Build de Producción

```bash
# Instalar dependencias (producción only)
npm ci --only=production

# Generar build optimizado
npm run build

# Verificar build
ls -lh dist/
```

**Output esperado**:
```
dist/
├── index.html
├── assets/
│   ├── index-[hash].js
│   ├── index-[hash].css
│   └── ...
├── sw.js (Service Worker)
└── manifest.webmanifest
```

---

## 🌐 Opciones de Despliegue

### Opción 1: Nginx (Recomendado)

#### Instalar Nginx

```bash
sudo apt update
sudo apt install nginx
```

#### Configurar Nginx

Crear `/etc/nginx/sites-available/irrigacion-frontend`:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name chat.irrigacionmalargue.net;
    
    # Redirigir HTTP a HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name chat.irrigacionmalargue.net;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/chat.irrigacionmalargue.net/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/chat.irrigacionmalargue.net/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Root directory
    root /var/www/irrigacion/frontend;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript 
               application/javascript application/json application/xml+rss
               image/svg+xml;

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Service Worker no cache
    location = /sw.js {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        expires 0;
    }

    # SPA fallback (todas las rutas -> index.html)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://chat.irrigacionmalargue.net wss://chat.irrigacionmalargue.net;" always;
}
```

#### Activar sitio

```bash
# Crear symlink
sudo ln -s /etc/nginx/sites-available/irrigacion-frontend /etc/nginx/sites-enabled/

# Verificar configuración
sudo nginx -t

# Reiniciar Nginx
sudo systemctl restart nginx
```

---

### Opción 2: Apache

#### Configurar Apache

Crear `/etc/apache2/sites-available/irrigacion-frontend.conf`:

```apache
<VirtualHost *:80>
    ServerName chat.irrigacionmalargue.net
    Redirect permanent / https://chat.irrigacionmalargue.net/
</VirtualHost>

<VirtualHost *:443>
    ServerName chat.irrigacionmalargue.net
    
    DocumentRoot /var/www/irrigacion/frontend
    
    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/chat.irrigacionmalargue.net/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/chat.irrigacionmalargue.net/privkey.pem
    
    <Directory /var/www/irrigacion/frontend>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
        
        # SPA fallback
        RewriteEngine On
        RewriteBase /
        RewriteRule ^index\.html$ - [L]
        RewriteCond %{REQUEST_FILENAME} !-f
        RewriteCond %{REQUEST_FILENAME} !-d
        RewriteRule . /index.html [L]
    </Directory>
    
    # Cache static assets
    <FilesMatch "\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$">
        Header set Cache-Control "max-age=31536000, public, immutable"
    </FilesMatch>
    
    # Service Worker no cache
    <Files "sw.js">
        Header set Cache-Control "no-cache, no-store, must-revalidate"
    </Files>
</VirtualHost>
```

```bash
# Habilitar módulos
sudo a2enmod rewrite ssl headers

# Activar sitio
sudo a2ensite irrigacion-frontend

# Reiniciar Apache
sudo systemctl restart apache2
```

---

### Opción 3: Docker

#### Crear Dockerfile

```dockerfile
# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

#### Crear nginx.conf

```nginx
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    location ~* \.(js|css|png|jpg|jpeg|gif|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

#### Build y Deploy

```bash
# Build imagen
docker build -t irrigacion-frontend:latest .

# Ejecutar contenedor
docker run -d \
  --name irrigacion-frontend \
  -p 80:80 \
  --restart unless-stopped \
  irrigacion-frontend:latest

# Ver logs
docker logs -f irrigacion-frontend
```

---

## 🔄 Script de Despliegue Automatizado

Crear `deploy.sh`:

```bash
#!/bin/bash

set -e

echo "🚀 Iniciando despliegue..."

# Variables
DEPLOY_DIR="/var/www/irrigacion/frontend"
BACKUP_DIR="/var/backups/irrigacion/frontend"
DATE=$(date +%Y%m%d_%H%M%S)

# Backup del deployment anterior
if [ -d "$DEPLOY_DIR" ]; then
    echo "📦 Creando backup..."
    mkdir -p $BACKUP_DIR
    tar -czf $BACKUP_DIR/frontend_$DATE.tar.gz -C $DEPLOY_DIR .
fi

# Build
echo "🔨 Generando build..."
npm ci
npm run build

# Deploy
echo "📤 Desplegando archivos..."
mkdir -p $DEPLOY_DIR
rsync -av --delete dist/ $DEPLOY_DIR/

# Permisos
echo "🔐 Configurando permisos..."
chown -R www-data:www-data $DEPLOY_DIR
chmod -R 755 $DEPLOY_DIR

# Verificar
echo "✅ Verificando deployment..."
if [ -f "$DEPLOY_DIR/index.html" ]; then
    echo "✅ Despliegue exitoso!"
else
    echo "❌ Error: index.html no encontrado"
    exit 1
fi

# Limpiar backups antiguos (mantener últimos 5)
echo "🧹 Limpiando backups antiguos..."
ls -t $BACKUP_DIR/frontend_*.tar.gz | tail -n +6 | xargs -r rm

echo "🎉 Despliegue completado!"
```

Ejecutar:

```bash
chmod +x deploy.sh
sudo ./deploy.sh
```

---

## 🔒 SSL con Let's Encrypt

### Instalar Certbot

```bash
sudo apt install certbot python3-certbot-nginx
```

### Obtener Certificado

```bash
sudo certbot --nginx -d chat.irrigacionmalargue.net
```

### Renovación Automática

```bash
# Verificar renovación
sudo certbot renew --dry-run

# Cronjob para renovación (ya configurado por defecto)
# /etc/cron.d/certbot
```

---

## 📊 Monitoreo Post-Despliegue

### Health Check

```bash
# Verificar que el sitio responde
curl -I https://chat.irrigacionmalargue.net

# Verificar SSL
curl -vI https://chat.irrigacionmalargue.net 2>&1 | grep -i ssl

# Verificar archivos estáticos
curl https://chat.irrigacionmalargue.net/manifest.webmanifest
```

### Logs

```bash
# Nginx access logs
sudo tail -f /var/log/nginx/access.log

# Nginx error logs
sudo tail -f /var/log/nginx/error.log

# Apache logs
sudo tail -f /var/log/apache2/access.log
sudo tail -f /var/log/apache2/error.log
```

### Performance

```bash
# Lighthouse CI (requiere npm install -g @lhci/cli)
lhci autorun --collect.url=https://chat.irrigacionmalargue.net

# WebPageTest
# https://www.webpagetest.org/
```

---

## 🔄 Rollback

En caso de problemas, restaurar versión anterior:

```bash
# Listar backups
ls -lh /var/backups/irrigacion/frontend/

# Restaurar backup específico
sudo tar -xzf /var/backups/irrigacion/frontend/frontend_20260211_143000.tar.gz \
     -C /var/www/irrigacion/frontend

# Reiniciar servidor web
sudo systemctl restart nginx
```

---

## ⚡ Optimizaciones Adicionales

### CDN (Opcional)

Configurar Cloudflare para:
- Caché de assets estáticos
- DDoS protection
- Edge caching

### Compresión Brotli

```bash
# Instalar módulo Nginx Brotli
sudo apt install nginx-module-brotli

# Configurar en nginx.conf
brotli on;
brotli_comp_level 6;
brotli_types text/plain text/css text/xml application/javascript application/json;
```

---

## 🐛 Troubleshooting

### Error 404 en rutas SPA

**Problema**: Al recargar página en `/chat` da 404

**Solución**: Verificar que `try_files $uri $uri/ /index.html;` esté en la config de Nginx/Apache

### WebSocket no conecta

**Problema**: Socket.io no puede conectar

**Solución**: 
```nginx
# Agregar en config Nginx
location /socket.io {
    proxy_pass http://backend;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

### Service Worker no actualiza

**Problema**: Cambios no se reflejan en navegador

**Solución**:
```nginx
# Forzar no-cache en sw.js
location = /sw.js {
    add_header Cache-Control "no-cache, no-store, must-revalidate";
    expires 0;
}
```

---

## 📞 Soporte

Si tienes problemas durante el despliegue:

1. Revisa los logs: `sudo tail -f /var/log/nginx/error.log`
2. Verifica variables de entorno en `.env.production`
3. Confirma que el backend esté accesible
4. Crea un issue en GitHub con los detalles del error

---

**Última actualización**: Febrero 2026
