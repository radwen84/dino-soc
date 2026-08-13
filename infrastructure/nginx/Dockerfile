FROM node:24-alpine AS frontend-builder
WORKDIR /app

COPY apps/frontend/package.json apps/frontend/package-lock.json ./
RUN npm ci
COPY apps/frontend/ ./
RUN npm run build

FROM nginx:1.25-alpine
COPY infrastructure/nginx/nginx.conf /etc/nginx/nginx.conf
COPY --from=frontend-builder /app/dist /usr/share/nginx/html

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1/health || exit 1
