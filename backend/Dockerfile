# =========================================================
# Build stage
# =========================================================
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN apk add --no-cache python3 make g++ \
    && npm ci \
    && npm rebuild bcrypt --build-from-source
COPY . .
RUN npm run build

# =========================================================
# Production stage
# =========================================================
FROM node:20-alpine AS production
WORKDIR /app
COPY package*.json ./
RUN apk add --no-cache python3 make g++ \
    && npm ci --omit=dev \
    && npm rebuild bcrypt --build-from-source \
    && apk del python3 make g++
COPY --from=builder --chown=node:node /app/dist ./dist
USER node
EXPOSE 3000
CMD ["node", "dist/main"]

# =========================================================
# Development stage (default)
# =========================================================
# Dev usa node:20 (Debian/glibc), NO node:20-alpine (musl), a propósito:
# en local el contenedor monta ./backend:/app, por lo que usa el
# node_modules del HOST (compilado para glibc en WSL). Un binario nativo
# glibc (.node de bcrypt) bajo musl segfaulta (exit 139) al ejecutar
# BCrypt.compare — verificado empíricamente. Con el mismo libc los
# módulos nativos del host cargan y corren OK.
# Producción sigue en alpine porque NO monta /app (usa su propio
# node_modules dentro de la imagen, compilado para musl) — ver arriba.
FROM node:20 AS development
WORKDIR /app
COPY package*.json ./
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/* \
    && npm ci \
    && npm rebuild bcrypt --build-from-source
USER node
EXPOSE 3000
CMD ["npm", "run", "start:dev"]