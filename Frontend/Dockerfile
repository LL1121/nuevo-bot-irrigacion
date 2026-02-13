# ================================
# Stage 1: Build Stage
# ================================
FROM node:18-alpine AS build

# Establecer directorio de trabajo
WORKDIR /app

# Copiar package.json y package-lock.json
COPY package*.json ./

# Instalar dependencias
RUN npm ci

# Copiar código fuente
COPY . .

# Construir la aplicación para producción
RUN npm run build

# ================================
# Stage 2: Production Stage
# ================================
FROM nginx:alpine

# Copiar archivos estáticos del build al directorio de Nginx
COPY --from=build /app/dist /usr/share/nginx/html

# Copiar configuración personalizada de Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Exponer puerto 80
EXPOSE 80

# Comando por defecto (ya incluido en la imagen nginx:alpine)
CMD ["nginx", "-g", "daemon off;"]

# Usuario nginx
USER nginx

# Exponer puerto
EXPOSE 80 443

# Entrypoint
ENTRYPOINT ["dumb-init", "--"]

# Comando por defecto
CMD ["nginx", "-g", "daemon off;"]
