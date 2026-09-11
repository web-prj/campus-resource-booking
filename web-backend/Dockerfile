# ---- Build stage ----
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies (including dev) using the lockfile for reproducibility.
COPY package.json package-lock.json ./
RUN npm ci

# Compile the TypeScript sources to dist/.
COPY . .
RUN npm run build

# Drop dev dependencies so only production modules are carried forward.
RUN npm prune --omit=dev

# ---- Runtime stage ----
FROM node:22-alpine AS runner

# bcrypt ships a prebuilt binary; libstdc++ is needed for it on Alpine.
RUN apk add --no-cache libstdc++

WORKDIR /app
ENV NODE_ENV=production

# Copy only what the runtime needs.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json

# Run as the built-in unprivileged user.
USER node

EXPOSE 3000

CMD ["node", "dist/main"]
