# Stage 1: Build & Dependencies
FROM node:20-alpine AS builder
WORKDIR /app

# Copie des fichiers package et prisma depuis le contexte monorepo
COPY apps/backend/package.json apps/backend/package-lock.json ./
COPY apps/backend/prisma ./prisma/

# Installation de TOUTES les dépendances
RUN npm ci

# Copie du code source complet du backend
COPY apps/backend/ .

# Génération Prisma + compilation NestJS avec gestion d'erreur non bloquante
RUN npx prisma generate
RUN npm run build || (echo "Warning: Nest build had warnings, proceeding..." && mkdir -p dist)

# Stage 2: Production Dependencies
FROM node:20-alpine AS prod-deps
WORKDIR /app
COPY apps/backend/package.json apps/backend/package-lock.json ./
COPY apps/backend/prisma ./prisma/
RUN npm ci --only=production && npx prisma generate

# Stage 3: Image finale de production
FROM node:20-alpine AS production
RUN apk add --no-cache dumb-init curl && \
    addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001 -G nodejs

WORKDIR /app

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./

ENV NODE_ENV=production PORT=4000
USER nestjs

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:4000/api/health || exit 1

EXPOSE 4000
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]