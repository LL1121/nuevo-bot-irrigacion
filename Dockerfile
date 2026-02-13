# ═══════════════════════════════════════════════════════════════════════════════
# Dockerfile para BACKEND (Node.js 18-alpine)
# Contexto de build: raíz del proyecto
# .dockerignore se encarga de excluir la carpeta Frontend/
# ═══════════════════════════════════════════════════════════════════════════════

FROM node:18-alpine

# Metadatos
LABEL maintainer="Lautaro <lautaro@irrigacionmalargue.net>"
LABEL description="Backend Irrigación Bot - Node.js 18 Alpine"

# Instalar dependencias del sistema necesarias para Puppeteer y aplicaciones
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    python3 \
    make \
    g++

# Establecer Chromium path para Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Crear directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias de producción
RUN npm ci --only=production

# Copiar el resto del código del Backend
# .dockerignore excluye automáticamente Frontend/, node_modules/, .git, etc
COPY . .

# Crear carpetas necesarias con permisos
RUN mkdir -p temp uploads tokens logs && \
    chmod 755 temp uploads tokens logs

# Crear usuario no-root para seguridad
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

# Cambiar al usuario nodejs
USER nodejs

# Exponer puerto
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Variables de entorno por defecto
ENV NODE_ENV=production
ENV PORT=3000

# Comando de inicio
CMD ["node", "src/index.js"]
