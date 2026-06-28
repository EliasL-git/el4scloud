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
    CLAMAV_DB_DIR=/var/lib/clamav \
    # Use clamscan binary directly (not clamd daemon)
    CLAMSCAN_BIN=/usr/bin/clamscan \
    CLAMAV_ENABLED=true

EXPOSE 3000

# ── Install ClamAV (clamscan binary + freshclam) ─────────────────────────────
RUN apk add --no-cache clamav clamav-libunrar unzip && \
    mkdir -p /var/lib/clamav && \
    # Verify the binary exists at the expected path
    test -x /usr/bin/clamscan && \
    /usr/bin/clamscan --version && \
    echo "ClamAV installed successfully at /usr/bin/clamscan"

# ── Download virus databases via freshclam ────────────────────────────────────
RUN printf 'DatabaseDirectory /var/lib/clamav\nDatabaseMirror database.clamav.net\nConnectTimeout 60\nReceiveTimeout 60\n' > /etc/freshclam.conf && \
    freshclam --config-file=/etc/freshclam.conf --stdout --show-progress && \
    ls -lh /var/lib/clamav/ && \
    echo "Virus databases downloaded."

# ── Copy built app ───────────────────────────────────────────────────────────
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:$PORT/ || exit 1

# Refresh virus databases at startup (if stale), then start the app
RUN printf '#!/bin/sh\nset -e\necho "=== Refreshing ClamAV virus definitions... ==="\nfreshclam --config-file=/etc/freshclam.conf --stdout --show-progress || echo "freshclam update failed (using existing databases)"\necho "=== Starting app... ==="\nexec node server.js\n' > /start.sh && chmod +x /start.sh

CMD ["/start.sh"]
