FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    # ClamAV paths (Alpine apk defaults)
    CLAMAV_DB_DIR=/var/lib/clamav \
    CLAMAV_ENABLED=true

EXPOSE 3000

# ── Install ClamAV with virus databases via freshclam ───────────────────────
# Step 1: Install ClamAV packages
RUN apk add --no-cache clamav clamav-libunrar clamav-daemon

# Step 2: Create clamav user/group (may already exist from apk)
RUN addgroup -S clamav 2>/dev/null || true && \
    adduser -S clamav -G clamav 2>/dev/null || true && \
    mkdir -p /var/lib/clamav && \
    chown -R clamav:clamav /var/lib/clamav

# Step 3: Generate freshclam config (avoids needing /etc/clamav/)
RUN echo "DatabaseDirectory /var/lib/clamav" > /tmp/freshclam.conf && \
    echo "UpdateLogFile /dev/stdout" >> /tmp/freshclam.conf && \
    echo "LogVerbose yes" >> /tmp/freshclam.conf && \
    echo "DatabaseMirror database.clamav.net" >> /tmp/freshclam.conf && \
    echo "ConnectTimeout 30" >> /tmp/freshclam.conf && \
    echo "ReceiveTimeout 30" >> /tmp/freshclam.conf && \
    # Run freshclam once to download databases
    freshclam --config-file=/tmp/freshclam.conf && \
    rm /tmp/freshclam.conf && \
    # Verify
    ls -lh /var/lib/clamav/ && \
    echo "ClamAV setup complete."

# ── Copy built app ───────────────────────────────────────────────────────────
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:$PORT/ || exit 1

CMD ["node", "server.js"]
