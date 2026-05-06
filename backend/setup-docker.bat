@echo off
REM ============================================
REM Script de Setup - Bot de Irrigación
REM Para ejecutar: setup-docker.bat
REM ============================================

setlocal enabledelayedexpansion
cd /d "%~dp0"

echo.
echo ========================================
echo Bot de Irrigacion - Setup Docker
echo ========================================
echo.

REM ============================================
REM 1. Verificar requisitos
REM ============================================
echo [*] Verificando requisitos...

docker --version >nul 2>&1
if errorlevel 1 (
    echo [X] Docker no esta instalado
    pause
    exit /b 1
)
echo [OK] Docker instalado

docker-compose --version >nul 2>&1
if errorlevel 1 (
    echo [X] Docker Compose no esta instalado
    pause
    exit /b 1
)
echo [OK] Docker Compose instalado

REM ============================================
REM 2. Crear archivo .env
REM ============================================
echo.
echo [*] Configurando archivo .env...

if not exist .env (
    copy .env.example .env
    echo [OK] Archivo .env creado
    echo [!] Edita .env con tus credenciales
    echo     notepad .env
) else (
    echo [!] .env ya existe
)

REM ============================================
REM 3. Crear directorios necesarios
REM ============================================
echo.
echo [*] Creando directorios...

if not exist public\images mkdir public\images
if not exist public\docs mkdir public\docs
if not exist public\temp mkdir public\temp
if not exist logs mkdir logs

echo [OK] Directorios creados

REM ============================================
REM 4. Build de imagen Docker
REM ============================================
echo.
echo [*] Construyendo imagen Docker...
echo     (esto puede tomar 3-5 minutos la primera vez)

docker build -t bot-irrigacion:latest .
if errorlevel 1 (
    echo [X] Error construyendo imagen
    pause
    exit /b 1
)
echo [OK] Imagen construida exitosamente

REM ============================================
REM 5. Levantar contenedores
REM ============================================
echo.
echo [*] Levantando contenedores...

docker-compose up -d
echo [OK] Contenedores levantados

REM ============================================
REM 6. Esperar que esté listo
REM ============================================
echo.
echo [*] Esperando que el servicio este listo...

setlocal enabledelayedexpansion
for /L %%i in (1,1,30) do (
    timeout /t 1 /nobreak >nul
    echo [*] Intento %%i de 30...
)

REM ============================================
REM 7. Mostrar información
REM ============================================
echo.
echo ========================================
echo [OK] Setup completado exitosamente
echo ========================================
echo.

echo Informacion de acceso:
echo   URL:     http://localhost:3000
echo   Health:  http://localhost:3000/health
echo   Redis:   localhost:6379
echo.

echo Comandos utiles:
echo   Ver logs:        docker-compose logs -f app
echo   Entrar shell:    docker-compose exec app bash
echo   Detener:         docker-compose down
echo   Reiniciar:       docker-compose restart
echo   Ver estado:      docker-compose ps
echo.

echo Proximos pasos:
echo   1. Edita .env con tus credenciales
echo   2. Ejecuta migracion si es necesario
echo   3. Verifica logs: docker-compose logs -f app
echo   4. Accede a http://localhost:3000
echo.

echo Para deploy en servidor: Ver DOCKER.md
echo.

pause
