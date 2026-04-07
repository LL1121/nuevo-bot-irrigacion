#!/bin/bash

###############################################################################
#                                                                             #
#    SCRIPT DE DEPLOYMENT PARA HOSTINGER                                    #
#                                                                             #
#    Uso:
#    bash scripts/deploy-hostinger.sh
#                                                                             #
#    Este script:
#    1. Verifica conexión con Hostinger
#    2. Pull del repo
#    3. Instala dependencias
#    4. Ejecuta tests
#    5. Reinicia PM2
#    6. Verifica health check
#                                                                             #
###############################################################################

set -e  # Exit on error

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Variables de configuración
HOSTINGER_USER="tu_usuario_hostinger"
HOSTINGER_HOST="tu_servidor.com"
HOSTINGER_PATH="/home/$HOSTINGER_USER/bot-irrigacion"
REMOTE_REPO="ssh://$HOSTINGER_USER@$HOSTINGER_HOST$HOSTINGER_PATH"

echo -e "${YELLOW}🚀 DEPLOYMENT SCRIPT - Bot Irrigación${NC}"
echo "================================================"

# Paso 1: Verificar que estamos en main
echo -e "${YELLOW}📍 Verificando rama...${NC}"
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo -e "${RED}❌ Debes estar en la rama 'main'${NC}"
    echo "Rama actual: $CURRENT_BRANCH"
    exit 1
fi
echo -e "${GREEN}✅ En rama main${NC}"

# Paso 2: Verificar tests locales
echo -e "${YELLOW}🧪 Ejecutando tests locales...${NC}"
if ! npm test; then
    echo -e "${RED}❌ Tests fallaron${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Tests pasados${NC}"

# Paso 3: Verificar auditoría de seguridad
echo -e "${YELLOW}🔒 Verificando vulnerabilidades...${NC}"
if npm audit --audit-level=moderate; then
    echo -e "${GREEN}✅ Sin vulnerabilidades críticas${NC}"
else
    echo -e "${YELLOW}⚠️  Hay vulnerabilidades, pero continuando...${NC}"
fi

# Paso 4: Push a GitHub
echo -e "${YELLOW}📤 Pusheando cambios a GitHub...${NC}"
if ! git push origin main; then
    echo -e "${RED}❌ Error al hacer push${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Push completado${NC}"

# Paso 5: SSH a Hostinger y actualizar
echo -e "${YELLOW}🔗 Conectando a Hostinger...${NC}"
ssh "$HOSTINGER_USER@$HOSTINGER_HOST" << 'EOF'

# Variables
APP_PATH="/home/$HOSTINGER_USER/bot-irrigacion"
APP_NAME="bot-irrigacion"

echo "📍 Entrando a directorio de app..."
cd $APP_PATH

echo "🔄 Actualizando código..."
git pull origin main

echo "📦 Instalando dependencias..."
npm ci --production  # Usar ci en producción (más seguro)

echo "🔄 Ejecutando migrations/setup si es necesario..."
# Si tienes scripts de setup, ejecutalos aquí
# npm run db:setup

echo "🔄 Reiniciando PM2..."
pm2 restart $APP_NAME

echo "⏳ Esperando que la app inicie..."
sleep 5

echo "🏥 Verificando health check..."
if curl -f http://localhost:3000/health > /dev/null 2>&1; then
    echo "✅ Health check OK"
else
    echo "❌ Health check FALLIDO - Revisa logs"
    pm2 logs $APP_NAME --lines 50
    exit 1
fi

echo "📊 Mostrando estado de PM2..."
pm2 status

EOF

# Paso 6: Verificación final
echo -e "${GREEN}✅ DEPLOYMENT COMPLETADO EXITOSAMENTE${NC}"
echo ""
echo "Siguiente:"
echo "1. Verifica: https://tu-dominio.com/health"
echo "2. Revisa logs: pm2 logs bot-irrigacion"
echo "3. Monitor: pm2 monit"
echo ""

