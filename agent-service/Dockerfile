# ==============================================================================
# Multi-stage Dockerfile for CarbonScribe Agent Service (#825)
# Stage 1: Build stage (compile TypeScript & install dependencies)
# Stage 2: Minimal, secure runtime stage (production-only, non-root user)
# ==============================================================================

# ------------------------------------------------------------------------------
# 1. Builder Stage
# ------------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies needed for compiling the project
COPY package*.json ./
RUN npm ci

# Copy configuration, source files, and SQL database migrations
COPY tsconfig.json ./
COPY src/ ./src/
COPY migrations/ ./migrations/

# Compile TypeScript into dist/
RUN npm run build

# ------------------------------------------------------------------------------
# 2. Production Runtime Stage
# ------------------------------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4500

# Install production dependencies only and clear npm cache to minimize layer size
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled JavaScript output and database migrations from the builder stage
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/migrations ./migrations

# Enforce least privilege by running as the built-in non-root 'node' user
USER node

# Expose standard agent-service port
EXPOSE 4500

# Container liveness health check probe hitting /health/liveness
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:' + (process.env.PORT || 4500) + '/health/liveness').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

# Exec-form ensures node runs as PID 1 to receive SIGTERM/SIGINT for graceful shutdown
CMD ["node", "dist/main.js"]
