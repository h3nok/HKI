# ═══════════════════════════════════════════════════════════════════════════════
# Agentic Frontend — Multi-stage Docker build
# Stage 1: Install deps + build client (Vite) + bundle server (esbuild)
# Stage 2: Slim Node.js runtime with only production artifacts
#
# Build from ai-platform directory:
# cd apps/ai-platform && docker build -f agentic/Dockerfile -t agentic-bff .
# ═══════════════════════════════════════════════════════════════════════════════

# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:24-alpine AS builder

# Disable SSL verification for corporate proxy
ENV NODE_TLS_REJECT_UNAUTHORIZED=0
RUN corepack enable && corepack prepare pnpm@9 --activate && \
    pnpm config set strict-ssl false

WORKDIR /workspace

# Copy workspace-level files for pnpm workspace resolution
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml turbo.json ./

# Copy package.json files for all workspace packages that Agentic depends on
COPY agentic/package.json agentic/
COPY packages/ui/package.json packages/ui/
COPY packages/chat/package.json packages/chat/
COPY packages/typescript-config/package.json packages/typescript-config/
COPY packages/eslint-config/package.json packages/eslint-config/

# Install all dependencies (including devDeps for building)
RUN pnpm install --frozen-lockfile

# Copy source code for packages that Agentic imports
COPY packages/ui/ packages/ui/
COPY packages/chat/ packages/chat/
COPY packages/typescript-config/ packages/typescript-config/

# Copy Agentic source
COPY agentic/ agentic/

# Build shared packages, then Agentic.
# NODE_ENV=production ensures React JSX transform uses jsx (not jsxDEV)
# and Vite sets import.meta.env.DEV=false.
RUN pnpm --filter @hki/ui build && \
    pnpm --filter @hki/chat build && \
    NODE_ENV=production pnpm --filter @hki/agentic build

# ── Stage 2: Production runtime ──────────────────────────────────────────────
FROM node:24-alpine AS runtime

RUN apk upgrade --no-cache --allow-untrusted 2>/dev/null || true

# Create non-root user FIRST (before copying files)
RUN addgroup -S appuser && adduser -S -G appuser -h /app appuser

WORKDIR /app
RUN chown appuser:appuser /app

# Install only production node_modules
# Disable SSL verification for corporate proxy
ENV NODE_TLS_REJECT_UNAUTHORIZED=0
RUN corepack enable && corepack prepare pnpm@9 --activate && \
    pnpm config set strict-ssl false

COPY --chown=appuser:appuser pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY --chown=appuser:appuser agentic/package.json agentic/
COPY --chown=appuser:appuser packages/ui/package.json packages/ui/
COPY --chown=appuser:appuser packages/chat/package.json packages/chat/
COPY --chown=appuser:appuser packages/typescript-config/package.json packages/typescript-config/
COPY --chown=appuser:appuser packages/eslint-config/package.json packages/eslint-config/

USER appuser
RUN pnpm install --frozen-lockfile --prod

# Copy built artifacts from builder
COPY --chown=appuser:appuser --from=builder /workspace/agentic/dist/ agentic/dist/
COPY --chown=appuser:appuser --from=builder /workspace/packages/ui/dist/ packages/ui/dist/
COPY --chown=appuser:appuser --from=builder /workspace/packages/chat/dist/ packages/chat/dist/

# Copy drizzle migrations (needed at runtime for db:push)
COPY --chown=appuser:appuser agentic/drizzle/ agentic/drizzle/
COPY --chown=appuser:appuser agentic/drizzle.config.ts agentic/

ENV NODE_ENV=production
ENV PORT=9001

EXPOSE 9001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:9001/health').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"

WORKDIR /app/agentic

CMD ["node", "dist/index.js"]
