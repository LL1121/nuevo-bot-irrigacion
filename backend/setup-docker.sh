#!/bin/bash

# ============================================
# Script de Setup - Bot de Irrigación
# Para ejecutar: bash setup-docker.sh
# ============================================

set -e  # Exit on error

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Bot de Irrigación - Setup Docker${NC}"
echo -e "${BLUE}========================================${NC}\n"

# ============================================
# 1. Verificar requisitos
# ============================================
echo -e "${YELLOW}✓ Verificando requisitos...${NC}"

if ! command -v docker &> /dev/null; then
    echo -e "${RED}✗ Docker no está instalado${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker instalado${NC}"

if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}✗ Docker Compose no está instalado${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker Compose instalado${NC}"

# ============================================
# 2. Crear archivo .env
# ============================================
echo -e "\n${YELLOW}✓ Configurando archivo .env...${NC}"

if [ ! -f .env ]; then
    cp .env.example .env
    echo -e "${GREEN}✓ Archivo .env creado${NC}"
    echo -e "${YELLOW}  ⚠️  Edita .env con tus credenciales:${NC}"
    echo -e "  nano .env"
else
    echo -e "${YELLOW}  ⚠️  .env ya existe${NC}"
fi

# ============================================
# 3. Crear directorios necesarios
# ============================================
echo -e "\n${YELLOW}✓ Creando directorios...${NC}"

mkdir -p public/images
mkdir -p public/docs
mkdir -p public/temp
mkdir -p logs

chmod -R 755 public logs

echo -e "${GREEN}✓ Directorios creados${NC}"

# ============================================
# 4. Build de imagen Docker
# ============================================
echo -e "\n${YELLOW}✓ Construyendo imagen Docker...${NC}"
echo -e "  (esto puede tomar 3-5 minutos la primera vez)"

if DOCKER_BUILDKIT=1 docker build -t bot-irrigacion:latest .; then
    echo -e "${GREEN}✓ Imagen construida exitosamente${NC}"
else
    echo -e "${RED}✗ Error construyendo imagen${NC}"
    exit 1
fi

# ============================================
# 5. Verificar imagen
# ============================================
echo -e "\n${YELLOW}✓ Verificando imagen...${NC}"
docker images | grep bot-irrigacion

# ============================================
# 6. Levantar contenedores
# ============================================
echo -e "\n${YELLOW}✓ Levantando contenedores...${NC}"

docker-compose up -d

echo -e "${GREEN}✓ Contenedores levantados${NC}"

# ============================================
# 7. Esperar que esté listo
# ============================================
echo -e "\n${YELLOW}✓ Esperando que el servicio esté listo...${NC}"

for i in {1..30}; do
    if curl -s http://localhost:3000/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Servicio está activo${NC}"
        break
    fi
    echo -n "."
    sleep 1
    
    if [ $i -eq 30 ]; then
        echo -e "\n${YELLOW}  ⚠️  El servicio tarda más de lo esperado${NC}"
        echo -e "  Ver logs con: docker-compose logs -f app"
    fi
done

# ============================================
# 8. Mostrar información de acceso
# ============================================
echo -e "\n${BLUE}========================================${NC}"
echo -e "${GREEN}✓ Setup completado exitosamente${NC}"
echo -e "${BLUE}========================================${NC}\n"

echo -e "${YELLOW}Información de acceso:${NC}"
echo -e "  URL:     http://localhost:3000"
echo -e "  Health:  http://localhost:3000/health"
echo -e "  Redis:   localhost:6379"

echo -e "\n${YELLOW}Comandos útiles:${NC}"
echo -e "  Ver logs:        docker-compose logs -f app"
echo -e "  Entrar shell:    docker-compose exec app bash"
echo -e "  Detener:         docker-compose down"
echo -e "  Reiniciar:       docker-compose restart"
echo -e "  Ver estado:      docker-compose ps"

echo -e "\n${YELLOW}Próximos pasos:${NC}"
echo -e "  1. Edita .env con tus credenciales (base de datos, WhatsApp, etc)"
echo -e "  2. Ejecuta la migración de BD si es necesario: node migrate-db.js"
echo -e "  3. Verifica logs: docker-compose logs -f app"
echo -e "  4. Accede a la aplicación en http://localhost:3000"

echo -e "\n${BLUE}Para deploy en servidor:${NC}"
echo -e "  Ver: ${YELLOW}DOCKER.md${NC}"

echo ""
