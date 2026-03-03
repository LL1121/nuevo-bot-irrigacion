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

# Limpiar configuración default y copiar la nuestra
RUN rm -f /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copiar artefactos estáticos
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
