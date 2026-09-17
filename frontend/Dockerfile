# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage (no-root: USER nginx + puerto 8080 sin NET_BIND_SERVICE)
FROM nginx:alpine AS production
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY nginx-main.conf /etc/nginx/nginx.conf
RUN mkdir -p /var/cache/nginx /tmp && chown -R nginx:nginx /var/cache/nginx /tmp
EXPOSE 8080
USER nginx
CMD ["nginx", "-g", "daemon off;"]

# Development stage (default)
# Dev usa node:20 (Debian/glibc), NO alpine/musl, a propósito: en local el
# contenedor monta ./frontend:/app, por lo que usa el node_modules del HOST
# (esbuild/bcrypt compilados para glibc en WSL). La imagen no copia el código
# (lo aporta el bind mount) y NO hay volumen anónimo de node_modules -> un
# rebuild nunca deja dependencias stale (bug 'vite-plugin-pwa not found').
FROM node:20 AS development
WORKDIR /app
COPY package*.json ./
RUN npm install
EXPOSE 5173
CMD ["npm", "run", "dev"]