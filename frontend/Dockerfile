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

# URLs que ve el navegador (host). Override con build.args en docker-compose.
ARG VITE_API_URL=http://localhost:3003
ARG VITE_SOCKET_URL=http://localhost:3003
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SOCKET_URL=$VITE_SOCKET_URL

# Construir la aplicación para producción
RUN npm run build

# ================================
# Stage 2: Production Stage
# ================================
FROM nginx:alpine

# wget: healthcheck del contenedor (nginx:alpine no siempre lo trae)
RUN apk add --no-cache wget

# Limpiar configuración default y copiar la nuestra
RUN rm -f /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copiar artefactos estáticos
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
