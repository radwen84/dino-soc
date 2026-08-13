# Stage 1: Build
FROM node:24-alpine AS builder
WORKDIR /app
COPY apps/frontend/package.json apps/frontend/package-lock.json ./
RUN npm ci
COPY apps/frontend/ .

RUN npm run build

# Stage 2: Production (Nginx)
FROM nginx:1.27-alpine AS production
RUN rm -rf /usr/share/nginx/html/*
COPY --from=builder /app/dist /usr/share/nginx/html
COPY apps/frontend/nginx/nginx.conf /etc/nginx/nginx.conf
COPY apps/frontend/nginx/default.conf /etc/nginx/conf.d/default.conf

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -q --spider http://localhost:80/health || exit 1

EXPOSE 80
