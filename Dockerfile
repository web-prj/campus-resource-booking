# syntax=docker/dockerfile:1

# ---------- Backend build ----------
FROM node:22-alpine AS backend-builder
WORKDIR /app/web-backend
COPY web-backend/package.json web-backend/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY web-backend/ ./
RUN npm run build && npm prune --omit=dev

# ---------- Backend runtime ----------
FROM node:22-alpine AS backend
WORKDIR /app
ENV NODE_ENV=production
COPY --from=backend-builder --chown=node:node /app/web-backend/node_modules ./node_modules
COPY --from=backend-builder --chown=node:node /app/web-backend/dist ./dist
COPY --from=backend-builder --chown=node:node /app/web-backend/package.json ./package.json
USER node
EXPOSE 18320
CMD ["sh", "-c", "node node_modules/typeorm/cli.js migration:run -d dist/database/data-source.js && exec node dist/main"]

# ---------- Frontend build ----------
FROM node:22-alpine AS frontend-builder
WORKDIR /app/web-frontend
COPY web-frontend/package.json web-frontend/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY web-frontend/ ./
ARG NEXT_PUBLIC_API_URL=http://localhost:18320/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---------- Frontend runtime ----------
FROM node:22-alpine AS frontend
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=18321
COPY --from=frontend-builder --chown=node:node /app/web-frontend/.next/standalone ./
COPY --from=frontend-builder --chown=node:node /app/web-frontend/.next/static ./.next/static
USER node
EXPOSE 18321
CMD ["node", "server.js"]
