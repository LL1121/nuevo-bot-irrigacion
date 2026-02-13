# Backend Dockerfile - Node.js 18 Alpine
# Despliegue de Irrigación Bot con PostgreSQL

FROM node:18-alpine

# Metadatos
LABEL maintainer="Lautaro <lautaro@irrigacionmalargue.net>"
LABEL description="Backend Irrigación Bot - Node.js 18 Alpine"

# Instalar dependencias del sistema necesarias
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev \
    pixman-dev

# Establecer directorio de trabajo
WORKDIR /app

# Copiar archivos de configuración de dependencias
COPY package*.json ./

# Instalar dependencias de Node.js (sin dev en producción)
RUN npm ci --only=production

# Copiar código del backend
COPY . .

# Crear directorios necesarios con permisos correctos
RUN mkdir -p /app/temp /app/uploads /app/tokens && \
    chmod 755 /app/temp /app/uploads /app/tokens

# Crear usuario no-root para seguridad
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

# Cambiar al usuario nodejs
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Exponer puerto
EXPOSE 3000

# Comando para iniciar la aplicación
CMD ["node", "server.js"]
