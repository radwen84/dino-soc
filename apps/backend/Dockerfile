# Stage 1
FROM node:24-alpine AS builder
WORKDIR /app

RUN apk add --no-cache openssl libc6-compat

COPY apps/backend/package.json apps/backend/package-lock.json ./
COPY apps/backend/prisma ./prisma/

RUN npm ci

COPY apps/backend/ .

RUN npx prisma generate
RUN npm run build
RUN ls -la dist && test -f dist/main.js


# Stage 2
FROM node:24-alpine AS prod-deps
WORKDIR /app

RUN apk add --no-cache openssl libc6-compat

COPY apps/backend/package.json apps/backend/package-lock.json ./
COPY apps/backend/prisma ./prisma/

RUN npm ci --only=production && npx prisma generate


# Stage 3
FROM node:24-alpine AS production

RUN apk add --no-cache openssl libc6-compat dumb-init curl && \
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