# syntax=docker/dockerfile:1

# ---------- Backend build ----------
FROM node:22-alpine AS backend-builder
WORKDIR /app/web-backend
COPY web-backend/package.json web-backend/package-lock.json ./
RUN npm ci
COPY web-backend/ ./
RUN npm run build && npm prune --omit=dev

# ---------- Backend runtime ----------
FROM node:22-alpine AS backend
RUN apk add --no-cache libstdc++
WORKDIR /app
ENV NODE_ENV=production
COPY --from=backend-builder --chown=node:node /app/web-backend/node_modules ./node_modules
COPY --from=backend-builder --chown=node:node /app/web-backend/dist ./dist
COPY --from=backend-builder --chown=node:node /app/web-backend/package.json ./package.json
USER node
EXPOSE 46120
CMD ["node", "dist/main"]

# ---------- Frontend build ----------
FROM node:22-alpine AS frontend-builder
WORKDIR /app/web-frontend
COPY web-frontend/package.json web-frontend/package-lock.json ./
RUN npm ci
COPY web-frontend/ ./
ARG NEXT_PUBLIC_API_URL=http://localhost:46120/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build

# ---------- Frontend runtime ----------
FROM node:22-alpine AS frontend
WORKDIR /app
ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=46121
COPY --from=frontend-builder --chown=node:node /app/web-frontend/public ./public
COPY --from=frontend-builder --chown=node:node /app/web-frontend/.next/standalone ./
COPY --from=frontend-builder --chown=node:node /app/web-frontend/.next/static ./.next/static
USER node
EXPOSE 46121
CMD ["node", "server.js"]
