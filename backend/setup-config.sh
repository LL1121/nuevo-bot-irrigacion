#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════════════
# 🤖 CONFIGURACIÓN INTERACTIVA - BOT DE IRRIGACIÓN
# ═══════════════════════════════════════════════════════════════════════════════
# 
# Este script te guía para configurar todas las variables de entorno
# de forma interactiva
#
# ═══════════════════════════════════════════════════════════════════════════════

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
print_header() {
    echo -e "\n${BLUE}════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

read_input() {
    local prompt="$1"
    local default="$2"
    local input
    
    if [ -z "$default" ]; then
        echo -n -e "${BLUE}→${NC} $prompt: "
    else
        echo -n -e "${BLUE}→${NC} $prompt [$default]: "
    fi
    
    read -r input
    
    if [ -z "$input" ]; then
        echo "$default"
    else
        echo "$input"
    fi
}

# Main Script
print_header "🤖 BOT DE IRRIGACIÓN - CONFIGURACIÓN INTERACTIVA"

# Check if .env exists
if [ -f ".env" ]; then
    print_warning ".env ya existe"
    read_input "¿Deseas sobrescribir? (s/n)" "n" | grep -q "^s" && rm .env || {
        print_error "Abortado"
        exit 0
    }
fi

# Copy template
cp .env.example .env
print_success "Archivo .env creado"

# SERVIDOR
print_header "🔧 CONFIGURACIÓN DE SERVIDOR"

NODE_ENV=$(read_input "Ambiente (development/production)" "production")
PORT=$(read_input "Puerto" "3000")
BASE_URL=$(read_input "URL base" "https://chat.irrigacionmalargue.net")

# POSTGRESQL
print_header "🗄️ CONFIGURACIÓN DE POSTGRESQL"

print_warning "Asegúrate que PostgreSQL esté corriendo en el servidor"
read -p "Presiona Enter para continuar..."

DB_HOST=$(read_input "Host de PostgreSQL" "localhost")
DB_PORT=$(read_input "Puerto PostgreSQL" "5432")
DB_USER=$(read_input "Usuario PostgreSQL" "postgres")
DB_PASSWORD=$(read_input "Contraseña PostgreSQL" "")
DB_NAME=$(read_input "Nombre de la BD" "irrigacion_bot")

# Validate PostgreSQL connection
print_warning "Validando conexión a PostgreSQL..."
if psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1" >/dev/null 2>&1; then
    print_success "Conexión a PostgreSQL verificada"
else
    print_error "No se pudo conectar a PostgreSQL"
    echo "Continúa igualmente? (s/n)"
    read -r continue_anyway
    if [ "$continue_anyway" != "s" ]; then
        exit 1
    fi
fi

# WHATSAPP
print_header "📱 CONFIGURACIÓN DE WHATSAPP CLOUD API"

print_warning "Necesitas credenciales de Meta/Facebook Developers"
read -p "Presiona Enter para continuar..."

WHATSAPP_TOKEN=$(read_input "Token de WhatsApp Business API" "")
WHATSAPP_PHONE_NUMBER_ID=$(read_input "Phone Number ID" "")
WHATSAPP_BUSINESS_ACCOUNT_ID=$(read_input "Business Account ID" "")
WEBHOOK_VERIFY_TOKEN=$(read_input "Webhook Verify Token" "")
WEBHOOK_APP_SECRET=$(read_input "App Secret (Meta)" "")

# REDIS
print_header "🔴 CONFIGURACIÓN DE REDIS"

print_warning "Redis es opcional pero recomendado para caché"
read -p "¿Configurar Redis? (s/n) " -n 1 -r SETUP_REDIS
echo

if [[ $SETUP_REDIS =~ ^[Ss]$ ]]; then
    REDIS_HOST=$(read_input "Host de Redis" "redis")
    REDIS_PORT=$(read_input "Puerto Redis" "6379")
    REDIS_PASSWORD=$(read_input "Contraseña Redis" "")
else
    REDIS_HOST="redis"
    REDIS_PORT="6379"
    REDIS_PASSWORD=""
fi

# JWT
print_header "🔐 CONFIGURACIÓN DE JWT"

print_warning "Se recomienda generar un JWT_SECRET fuerte"
read -p "¿Generar JWT_SECRET automáticamente? (s/n) " -n 1 -r GENERATE_JWT
echo

if [[ $GENERATE_JWT =~ ^[Ss]$ ]]; then
    JWT_SECRET=$(openssl rand -base64 32)
    print_success "JWT_SECRET generado"
else
    JWT_SECRET=$(read_input "JWT_SECRET" "")
fi

JWT_EXPIRY=$(read_input "Expiración JWT" "8h")

# LOGGING
print_header "📊 CONFIGURACIÓN DE LOGGING"

LOG_LEVEL=$(read_input "Nivel de log (debug/info/warn/error)" "info")
LOG_TO_FILE=$(read_input "¿Guardar logs en archivo? (true/false)" "true")

# OPCIONALES
print_header "📦 CONFIGURACIÓN OPCIONAL"

read -p "¿Configurar Sentry? (s/n) " -n 1 -r SETUP_SENTRY
echo

if [[ $SETUP_SENTRY =~ ^[Ss]$ ]]; then
    SENTRY_DSN=$(read_input "Sentry DSN" "")
    SENTRY_ENVIRONMENT=$(read_input "Sentry Environment" "production")
fi

# Update .env file
print_header "💾 GUARDANDO CONFIGURACIÓN"

# Function to update .env
update_env() {
    local key="$1"
    local value="$2"
    local escaped_value=$(printf '%s\n' "$value" | sed -e 's/[\/&]/\\&/g')
    
    if grep -q "^${key}=" .env; then
        sed -i.bak "s/^${key}=.*/${key}=${escaped_value}/" .env
    else
        echo "${key}=${value}" >> .env
    fi
}

# Update all variables
update_env "NODE_ENV" "$NODE_ENV"
update_env "PORT" "$PORT"
update_env "BASE_URL" "$BASE_URL"
update_env "DB_HOST" "$DB_HOST"
update_env "DB_PORT" "$DB_PORT"
update_env "DB_USER" "$DB_USER"
update_env "DB_PASSWORD" "$DB_PASSWORD"
update_env "DB_NAME" "$DB_NAME"
update_env "WHATSAPP_TOKEN" "$WHATSAPP_TOKEN"
update_env "WHATSAPP_PHONE_NUMBER_ID" "$WHATSAPP_PHONE_NUMBER_ID"
update_env "WHATSAPP_BUSINESS_ACCOUNT_ID" "$WHATSAPP_BUSINESS_ACCOUNT_ID"
update_env "WEBHOOK_VERIFY_TOKEN" "$WEBHOOK_VERIFY_TOKEN"
update_env "WEBHOOK_APP_SECRET" "$WEBHOOK_APP_SECRET"
update_env "REDIS_HOST" "$REDIS_HOST"
update_env "REDIS_PORT" "$REDIS_PORT"
update_env "REDIS_PASSWORD" "$REDIS_PASSWORD"
update_env "JWT_SECRET" "$JWT_SECRET"
update_env "JWT_EXPIRY" "$JWT_EXPIRY"
update_env "LOG_LEVEL" "$LOG_LEVEL"
update_env "LOG_TO_FILE" "$LOG_TO_FILE"

if [ -n "$SENTRY_DSN" ]; then
    update_env "SENTRY_DSN" "$SENTRY_DSN"
    update_env "SENTRY_ENVIRONMENT" "$SENTRY_ENVIRONMENT"
fi

# Cleanup backup
rm -f .env.bak

print_success "Configuración guardada en .env"

# Summary
print_header "✅ RESUMEN DE CONFIGURACIÓN"

echo -e "${GREEN}Servidor:${NC}"
echo "  NODE_ENV: $NODE_ENV"
echo "  PORT: $PORT"
echo "  BASE_URL: $BASE_URL"

echo -e "\n${GREEN}PostgreSQL:${NC}"
echo "  Host: $DB_HOST"
echo "  Puerto: $DB_PORT"
echo "  Usuario: $DB_USER"
echo "  BD: $DB_NAME"

echo -e "\n${GREEN}WhatsApp:${NC}"
echo "  Token: ${WHATSAPP_TOKEN:0:10}..."
echo "  Phone ID: $WHATSAPP_PHONE_NUMBER_ID"

echo -e "\n${GREEN}Redis:${NC}"
echo "  Host: $REDIS_HOST"
echo "  Puerto: $REDIS_PORT"

echo -e "\n${GREEN}JWT:${NC}"
echo "  Secret: ${JWT_SECRET:0:10}..."
echo "  Expiry: $JWT_EXPIRY"

# Next steps
print_header "🚀 SIGUIENTES PASOS"

echo "1. Verificar configuración:"
echo "   cat .env"

echo -e "\n2. Instalar dependencias (si no lo hizo):"
echo "   npm install"

echo -e "\n3. Iniciar servidor:"
echo "   npm start"

echo -e "\n4. Verificar health:"
echo "   curl http://localhost:3000/health"

echo -e "\n${GREEN}¡Configuración completada! 🎉${NC}\n"
