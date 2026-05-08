# ═══════════════════════════════════════════════════════════════════════════════
# Analytics Service — Multi-stage Docker build
# Usage analytics and insights
# ═══════════════════════════════════════════════════════════════════════════════

# Build context: apps/ai-platform/ (so shared/ is accessible)
# docker build -f analytics-service/Dockerfile -t analytics-service apps/ai-platform/

# ── Stage 1: Build dependencies ──────────────────────────────────────────────
FROM python:3.13-alpine AS builder

COPY --from=ghcr.io/astral-sh/uv:0.5 /uv /uvx /bin/

COPY --from=ghcr.io/astral-sh/uv:0.5 /uv /uvx /bin/

WORKDIR /app

# packages/shared-py/ must be present before uv resolves the path dep (hki-shared = { path = "../../packages/shared-py" })
COPY packages/shared-py/ /packages/shared-py/
COPY services/analytics-service/pyproject.toml /app/
RUN uv pip install --system --no-cache --prefix=/install /app

# ── Stage 2: Production runtime ──────────────────────────────────────────────
FROM python:3.13-alpine

RUN apk upgrade --no-cache

WORKDIR /app

# Copy installed packages from builder
COPY --from=builder /install /usr/local

# Copy application code
COPY services/analytics-service/src/ /app/src/

# Preserve the editable dependency path installed at build time.
COPY packages/shared-py/ /packages/shared-py/

# Create non-root user
RUN addgroup -S appuser && adduser -S -G appuser -h /app appuser && \
    chown -R appuser:appuser /app
USER appuser

EXPOSE 9512

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:9512/health')"

CMD ["gunicorn", "src.api.app:app", \
    "--worker-class", "uvicorn.workers.UvicornWorker", \
    "--workers", "2", \
    "--bind", "0.0.0.0:9512", \
    "--timeout", "120", \
    "--graceful-timeout", "30", \
    "--keep-alive", "5", \
    "--max-requests", "1000", \
    "--max-requests-jitter", "100"]
