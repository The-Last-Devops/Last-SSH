# ── Stage 1: Build frontend ──────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files trước để tận dụng Docker layer cache
COPY package*.json ./
RUN npm ci --ignore-scripts

# Copy source và build frontend (web mode)
COPY . .
RUN BUILD_TARGET=web npm run build

# ── Stage 2: Production runtime ───────────────────────────────────────────────
FROM node:20-alpine AS runtime

# Install build deps cho node-pty (native module)
RUN apk add --no-cache python3 make g++ linux-headers

WORKDIR /app

COPY package*.json ./
# Install production deps (bao gồm native rebuild cho node-pty)
RUN npm ci --omit=dev --ignore-scripts && \
    npm rebuild node-pty

# Copy server và built frontend từ stage 1
COPY server.cjs ./
COPY --from=builder /app/dist ./dist

# Data directory cho store.json và known_hosts.json
ENV DATA_DIR=/data
ENV PORT=3000
RUN mkdir -p /data

VOLUME ["/data"]
EXPOSE 3000

CMD ["node", "server.cjs"]
