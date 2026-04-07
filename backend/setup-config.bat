@echo off
REM ═══════════════════════════════════════════════════════════════════════════════
REM 🤖 CONFIGURACIÓN INTERACTIVA - BOT DE IRRIGACIÓN (WINDOWS)
REM ═══════════════════════════════════════════════════════════════════════════════

setlocal enabledelayedexpansion
chcp 65001 >nul

cls
echo.
echo ════════════════════════════════════════════════════════════
echo 🤖 BOT DE IRRIGACIÓN - CONFIGURACIÓN INTERACTIVA
echo ════════════════════════════════════════════════════════════
echo.

REM Check if .env exists
if exist .env (
    echo ⚠️  .env ya existe
    set /p OVERWRITE="¿Deseas sobrescribir? (s/n): "
    if /i "!OVERWRITE!"=="s" (
        del .env
    ) else (
        echo ✗ Abortado
        pause
        exit /b 0
    )
)

REM Copy template
copy .env.example .env >nul
echo ✓ Archivo .env creado

REM SERVIDOR
echo.
echo ════════════════════════════════════════════════════════════
echo 🔧 CONFIGURACIÓN DE SERVIDOR
echo ════════════════════════════════════════════════════════════
echo.

set /p NODE_ENV="→ Ambiente (development/production) [production]: " || set NODE_ENV=production
set /p PORT="→ Puerto [3000]: " || set PORT=3000
set /p BASE_URL="→ URL base [https://chat.irrigacionmalargue.net]: " || set BASE_URL=https://chat.irrigacionmalargue.net

REM POSTGRESQL
echo.
echo ════════════════════════════════════════════════════════════
echo 🗄️ CONFIGURACIÓN DE POSTGRESQL
echo ════════════════════════════════════════════════════════════
echo.

echo ⚠️  Asegúrate que PostgreSQL esté corriendo en el servidor
pause

set /p DB_HOST="→ Host de PostgreSQL [localhost]: " || set DB_HOST=localhost
set /p DB_PORT="→ Puerto PostgreSQL [5432]: " || set DB_PORT=5432
set /p DB_USER="→ Usuario PostgreSQL [postgres]: " || set DB_USER=postgres
set /p DB_PASSWORD="→ Contraseña PostgreSQL: "
set /p DB_NAME="→ Nombre de la BD [irrigacion_bot]: " || set DB_NAME=irrigacion_bot

REM WHATSAPP
echo.
echo ════════════════════════════════════════════════════════════
echo 📱 CONFIGURACIÓN DE WHATSAPP CLOUD API
echo ════════════════════════════════════════════════════════════
echo.

echo ⚠️  Necesitas credenciales de Meta/Facebook Developers
pause

set /p WHATSAPP_TOKEN="→ Token de WhatsApp Business API: "
set /p WHATSAPP_PHONE_NUMBER_ID="→ Phone Number ID: "
set /p WHATSAPP_BUSINESS_ACCOUNT_ID="→ Business Account ID: "
set /p WEBHOOK_VERIFY_TOKEN="→ Webhook Verify Token: "
set /p WEBHOOK_APP_SECRET="→ App Secret (Meta): "

REM REDIS
echo.
echo ════════════════════════════════════════════════════════════
echo 🔴 CONFIGURACIÓN DE REDIS
echo ════════════════════════════════════════════════════════════
echo.

echo ⚠️  Redis es opcional pero recomendado para caché
set /p SETUP_REDIS="¿Configurar Redis? (s/n) [s]: " || set SETUP_REDIS=s

if /i "!SETUP_REDIS!"=="s" (
    set /p REDIS_HOST="→ Host de Redis [redis]: " || set REDIS_HOST=redis
    set /p REDIS_PORT="→ Puerto Redis [6379]: " || set REDIS_PORT=6379
    set /p REDIS_PASSWORD="→ Contraseña Redis: "
) else (
    set REDIS_HOST=redis
    set REDIS_PORT=6379
    set REDIS_PASSWORD=
)

REM JWT
echo.
echo ════════════════════════════════════════════════════════════
echo 🔐 CONFIGURACIÓN DE JWT
echo ════════════════════════════════════════════════════════════
echo.

echo ⚠️  Se recomienda generar un JWT_SECRET fuerte
set /p GENERATE_JWT="¿Generar JWT_SECRET automáticamente? (s/n) [s]: " || set GENERATE_JWT=s

if /i "!GENERATE_JWT!"=="s" (
    for /f "delims=" %%a in ('powershell -Command "[Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))" 2^>nul') do set JWT_SECRET=%%a
    echo ✓ JWT_SECRET generado
) else (
    set /p JWT_SECRET="→ JWT_SECRET: "
)

set /p JWT_EXPIRY="→ Expiración JWT [8h]: " || set JWT_EXPIRY=8h

REM LOGGING
echo.
echo ════════════════════════════════════════════════════════════
echo 📊 CONFIGURACIÓN DE LOGGING
echo ════════════════════════════════════════════════════════════
echo.

set /p LOG_LEVEL="→ Nivel de log (debug/info/warn/error) [info]: " || set LOG_LEVEL=info
set /p LOG_TO_FILE="→ ¿Guardar logs en archivo? (true/false) [true]: " || set LOG_TO_FILE=true

REM OPCIONALES
echo.
echo ════════════════════════════════════════════════════════════
echo 📦 CONFIGURACIÓN OPCIONAL
echo ════════════════════════════════════════════════════════════
echo.

set /p SETUP_SENTRY="¿Configurar Sentry? (s/n): "

if /i "!SETUP_SENTRY!"=="s" (
    set /p SENTRY_DSN="→ Sentry DSN: "
    set /p SENTRY_ENVIRONMENT="→ Sentry Environment [production]: " || set SENTRY_ENVIRONMENT=production
)

REM Update .env file
echo.
echo ════════════════════════════════════════════════════════════
echo 💾 GUARDANDO CONFIGURACIÓN
echo ════════════════════════════════════════════════════════════
echo.

REM Create new .env with all values
(
    echo # ═══════════════════════════════════════════════════════════════════════════════
    echo # 🤖 BOT DE IRRIGACIÓN - CONFIGURACIÓN DE ENTORNO
    echo # ═══════════════════════════════════════════════════════════════════════════════
    echo.
    echo # SERVIDOR
    echo NODE_ENV=%NODE_ENV%
    echo PORT=%PORT%
    echo BASE_URL=%BASE_URL%
    echo.
    echo # POSTGRESQL
    echo DB_HOST=%DB_HOST%
    echo DB_PORT=%DB_PORT%
    echo DB_USER=%DB_USER%
    echo DB_PASSWORD=%DB_PASSWORD%
    echo DB_NAME=%DB_NAME%
    echo DB_POOL_SIZE=50
    echo DB_IDLE_TIMEOUT=60000
    echo DB_CONNECT_TIMEOUT=10000
    echo.
    echo # WHATSAPP
    echo WHATSAPP_TOKEN=%WHATSAPP_TOKEN%
    echo WHATSAPP_PHONE_NUMBER_ID=%WHATSAPP_PHONE_NUMBER_ID%
    echo WHATSAPP_BUSINESS_ACCOUNT_ID=%WHATSAPP_BUSINESS_ACCOUNT_ID%
    echo WEBHOOK_VERIFY_TOKEN=%WEBHOOK_VERIFY_TOKEN%
    echo WEBHOOK_APP_SECRET=%WEBHOOK_APP_SECRET%
    echo.
    echo # REDIS
    echo REDIS_HOST=%REDIS_HOST%
    echo REDIS_PORT=%REDIS_PORT%
    echo REDIS_PASSWORD=%REDIS_PASSWORD%
    echo.
    echo # JWT
    echo JWT_SECRET=%JWT_SECRET%
    echo JWT_EXPIRY=%JWT_EXPIRY%
    echo JWT_ALGORITHM=HS256
    echo.
    echo # OPTIMIZACIONES
    echo MAX_BROWSERS=3
    echo SCRAPE_TIMEOUT=30000
    echo.
    echo # LOGGING
    echo LOG_LEVEL=%LOG_LEVEL%
    echo LOG_TO_FILE=%LOG_TO_FILE%
    echo LOG_DIR=./logs
) > .env

if defined SENTRY_DSN (
    echo SENTRY_DSN=%SENTRY_DSN%>> .env
    echo SENTRY_ENVIRONMENT=%SENTRY_ENVIRONMENT%>> .env
)

echo ✓ Configuración guardada en .env

REM Summary
echo.
echo ════════════════════════════════════════════════════════════
echo ✅ RESUMEN DE CONFIGURACIÓN
echo ════════════════════════════════════════════════════════════
echo.

echo Servidor:
echo   NODE_ENV: %NODE_ENV%
echo   PORT: %PORT%
echo   BASE_URL: %BASE_URL%
echo.

echo PostgreSQL:
echo   Host: %DB_HOST%
echo   Puerto: %DB_PORT%
echo   Usuario: %DB_USER%
echo   BD: %DB_NAME%
echo.

echo WhatsApp:
echo   Phone ID: %WHATSAPP_PHONE_NUMBER_ID%
echo.

echo Redis:
echo   Host: %REDIS_HOST%
echo   Puerto: %REDIS_PORT%
echo.

echo JWT:
echo   Secret: ****
echo   Expiry: %JWT_EXPIRY%

REM Next steps
echo.
echo ════════════════════════════════════════════════════════════
echo 🚀 SIGUIENTES PASOS
echo ════════════════════════════════════════════════════════════
echo.

echo 1. Verificar configuración:
echo    type .env
echo.

echo 2. Instalar dependencias (si no lo hizo^):
echo    npm install
echo.

echo 3. Iniciar servidor:
echo    npm start
echo.

echo 4. Verificar health:
echo    curl http://localhost:3000/health
echo.

echo ¡Configuración completada! 🎉

pause
