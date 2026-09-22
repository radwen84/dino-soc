# ============================================================
# Mini-SOC Plugin Engine (Express / TypeScript)
# ============================================================

# Stage 1: Build — compile TypeScript to JavaScript
FROM node:24-alpine AS builder
WORKDIR /app

# Install dependencies first (better layer caching)
COPY services/plugin-engine/package.json services/plugin-engine/package-lock.json ./
RUN npm ci

# Copy sources and build
COPY services/plugin-engine/ .
RUN npm run build && test -f dist/src/index.js


# Stage 2: Production dependencies only
FROM node:24-alpine AS prod-deps
WORKDIR /app
COPY services/plugin-engine/package.json services/plugin-engine/package-lock.json ./
RUN npm ci --omit=dev


# Stage 3: Final runtime image
FROM node:24-alpine AS production
RUN apk add --no-cache dumb-init curl && \
    addgroup -g 1001 -S nodejs && adduser -S pluginsvc -u 1001 -G nodejs

WORKDIR /app

# Runtime deps + compiled output (dist/src, dist/plugins) + package manifest
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

ENV NODE_ENV=production PORT=8001

USER pluginsvc

# Healthcheck hits the unauthenticated /health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -f http://localhost:8001/health || exit 1

EXPOSE 8001

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/src/index.js"]