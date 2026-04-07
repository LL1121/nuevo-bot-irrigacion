#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════════════
# Irrigación Bot - Script de Deployment en Ubuntu Server
# Uso: sudo bash deploy.sh
# ═══════════════════════════════════════════════════════════════════════════════

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ═══════════════════════════════════════════════════════════════════════════════
# FUNCIONES
# ═══════════════════════════════════════════════════════════════════════════════

log() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# ═══════════════════════════════════════════════════════════════════════════════
# VALIDACIONES INICIALES
# ═══════════════════════════════════════════════════════════════════════════════

log "Validando requisitos previos..."

# Verificar que es root o usa sudo
if [[ $EUID -ne 0 ]]; then
    error "Este script debe ejecutarse como root (usa: sudo bash deploy.sh)"
fi

# Detectar distribución
if [ ! -f /etc/os-release ]; then
    error "No es posible detectar la distribución"
fi

. /etc/os-release
if [[ "$NAME" != "Ubuntu" && "$NAME" != "Debian GNU/Linux" ]]; then
    error "Este script está diseñado para Ubuntu/Debian"
fi

success "Distribución detectada: $PRETTY_NAME"

# ═══════════════════════════════════════════════════════════════════════════════
# 1. INSTALAR DOCKER
# ═══════════════════════════════════════════════════════════════════════════════

log "Instalando Docker y Docker Compose..."

# Actualizar paquetes
apt-get update -qq

# Instalar dependencias
apt-get install -y -qq \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    apt-transport-https

# Agregar clave GPG de Docker
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Agregar repositorio de Docker
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

# Actualizar y instalar Docker
apt-get update -qq
apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Iniciar Docker
systemctl start docker
systemctl enable docker

success "Docker instalado correctamente"

# ═══════════════════════════════════════════════════════════════════════════════
# 2. CREAR DIRECTORIOS Y ESTRUCTURA
# ═══════════════════════════════════════════════════════════════════════════════

log "Creando estructura de directorios..."

DEPLOY_DIR="/opt/irrigacion-bot"

# Crear directorio principal
mkdir -p "$DEPLOY_DIR"
cd "$DEPLOY_DIR"

# Crear subdirectorios
mkdir -p {Backend,Frontend,scripts,data/postgres_data,data/redis_data,logs}

success "Estructura de directorios creada en $DEPLOY_DIR"

# ═══════════════════════════════════════════════════════════════════════════════
# 3. DESCARGAR CÓDIGO O CLONAR DESDE GIT
# ═══════════════════════════════════════════════════════════════════════════════

log "¿Deseas clonar desde Git? (s/n)"
read -r CLONE_GIT

if [[ "$CLONE_GIT" == "s" || "$CLONE_GIT" == "S" ]]; then
    log "Ingresa la URL del repositorio Git:"
    read -r GIT_URL
    
    if [ -d ".git" ]; then
        git pull origin main
    else
        git clone "$GIT_URL" .
    fi
    
    success "Código descargado correctamente"
else
    warning "Recuerda copiar los archivos manualmente a: $DEPLOY_DIR"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# 4. CONFIGURAR VARIABLES DE ENTORNO
# ═══════════════════════════════════════════════════════════════════════════════

log "Configurando variables de entorno..."

if [ ! -f .env ]; then
    log "Ingresa el TOKEN del Cloudflare Tunnel:"
    read -r TUNNEL_TOKEN
    
    log "Ingresa la contraseña de PostgreSQL:"
    read -rs DB_PASSWORD
    
    log "Ingresa la contraseña de Redis:"
    read -rs REDIS_PASSWORD
    
    log "Ingresa el META_ACCESS_TOKEN:"
    read -r META_TOKEN
    
    log "Ingresa el WHATSAPP_PHONE_NUMBER_ID:"
    read -r PHONE_ID
    
    log "Ingresa el META_APP_SECRET:"
    read -r APP_SECRET
    
    # Crear archivo .env
    cat > .env << EOF
NODE_ENV=production
PORT=3000
HOSTNAME=0.0.0.0

DB_CLIENT=pg
DB_HOST=db
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=$DB_PASSWORD
DB_NAME=irrigacion_db
DB_POOL_MIN=5
DB_POOL_MAX=20

META_ACCESS_TOKEN=$META_TOKEN
WHATSAPP_PHONE_NUMBER_ID=$PHONE_ID
META_APP_SECRET=$APP_SECRET
WEBHOOK_VERIFY_TOKEN=lautaro_clave_secreta_123

JWT_SECRET=$(openssl rand -base64 32)
JWT_EXPIRY=8h

REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=$REDIS_PASSWORD

LOG_LEVEL=info
LOG_TO_FILE=true
LOG_DIR=/app/logs

API_URL=https://chat.irrigacionmalargue.net/api
WEBHOOK_URL=https://chat.irrigacionmalargue.net/webhook

TUNNEL_TOKEN=$TUNNEL_TOKEN

PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
MAX_BROWSERS=3

TZ=America/Argentina/Buenos_Aires
EOF
    
    chmod 600 .env
    success "Archivo .env creado con configuración segura"
else
    success "Archivo .env ya existe"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# 5. PERMISOS Y ESTRUCTURA DE DATOS
# ═══════════════════════════════════════════════════════════════════════════════

log "Configurando permisos..."

# Crear directorios de datos con permisos correctos
mkdir -p data/postgres_data data/redis_data
chmod 755 data/postgres_data data/redis_data

# Cambiar propietario
chown -R "$SUDO_USER:$SUDO_USER" "$DEPLOY_DIR"

success "Permisos configurados correctamente"

# ═══════════════════════════════════════════════════════════════════════════════
# 6. BUILD DE IMÁGENES DOCKER
# ═══════════════════════════════════════════════════════════════════════════════

log "Construyendo imágenes Docker..."

docker compose build --no-cache

success "Imágenes Docker construidas"

# ═══════════════════════════════════════════════════════════════════════════════
# 7. INICIAR SERVICIOS
# ═══════════════════════════════════════════════════════════════════════════════

log "Iniciando servicios..."

docker compose up -d

# Esperar a que los servicios inicien
sleep 10

# Verificar salud
log "Verificando salud de servicios..."

if docker compose ps | grep -q "healthy"; then
    success "✓ Servicios iniciados correctamente"
else
    warning "Algunos servicios pueden estar en proceso de iniciación"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# 8. VERIFICACIONES FINALES
# ═══════════════════════════════════════════════════════════════════════════════

log "Realizando verificaciones finales..."

# Verificar Backend
if curl -s http://localhost:3000/health > /dev/null; then
    success "Backend respondiendo correctamente"
else
    warning "Backend no responde aún (puede estar inicializando)"
fi

# Ver logs
log "Últimos logs:"
docker compose logs --tail=20

# ═══════════════════════════════════════════════════════════════════════════════
# 9. RESUMEN Y PRÓXIMOS PASOS
# ═══════════════════════════════════════════════════════════════════════════════

echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}         ✓ DEPLOYMENT COMPLETADO EXITOSAMENTE${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
echo ""

echo "📍 Directorio de instalación: $DEPLOY_DIR"
echo ""

echo "🔗 URLs:"
echo "   • Frontend: https://chat.irrigacionmalargue.net"
echo "   • API: https://chat.irrigacionmalargue.net/api"
echo "   • Health Check: http://localhost:3000/health"
echo ""

echo "📋 Comandos útiles:"
echo "   • Ver estado: docker compose ps"
echo "   • Ver logs: docker compose logs -f"
echo "   • Detener: docker compose down"
echo "   • Reiniciar: docker compose restart"
echo ""

echo "⚙️  Cloudflare Tunnel:"
echo "   • Estado: Verificar en dashboard.cloudflare.com"
echo "   • Comando manual: docker compose logs tunnel | grep -i connected"
echo ""

echo "📊 Base de datos:"
echo "   • Host: localhost:5432"
echo "   • Usuario: postgres"
echo "   • Base: irrigacion_db"
echo "   • Conectar: psql -h localhost -U postgres -d irrigacion_db"
echo ""

echo "🚀 Próximos pasos:"
echo "   1. Verificar que Cloudflare Tunnel está conectado"
echo "   2. Probar webhook de Meta desde dashboard"
echo "   3. Configurar caché de Cloudflare"
echo "   4. Monitorear logs: docker compose logs -f backend"
echo ""

echo -e "${YELLOW}IMPORTANTE: Guarda el archivo .env en lugar seguro${NC}"
echo ""
