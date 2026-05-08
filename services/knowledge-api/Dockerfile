# ═══════════════════════════════════════════════════════════════════════════════
# Knowledge API — Multi-stage Docker build
# Knowledge Platform: hybrid search with vector + keyword + graph discovery
# ═══════════════════════════════════════════════════════════════════════════════

# Build from ai-platform directory:
# docker build -f knowledge-api/Dockerfile -t knowledge-api .

# ── Stage 1: Build dependencies ──────────────────────────────────────────────
FROM python:3.13-alpine AS builder

COPY --from=ghcr.io/astral-sh/uv:0.5 /uv /uvx /bin/

WORKDIR /app

COPY packages/shared-py/ ./packages/shared-py/
COPY services/knowledge-api/pyproject.toml ./services/knowledge-api/
RUN pip install --no-cache-dir --prefix=/install ./packages/shared-py ./services/knowledge-api

# ── Stage 2: Production runtime ──────────────────────────────────────────────
FROM python:3.13-alpine

RUN apk upgrade --no-cache

WORKDIR /app

# Copy installed packages from builder
COPY --from=builder /install /usr/local

# Copy application code
COPY services/knowledge-api/src/ ./src/

# Create non-root user
RUN addgroup -S appuser && adduser -S -G appuser -h /app appuser && \
    chown -R appuser:appuser /app
USER appuser

ENV PORT=9509

EXPOSE 9509

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD sh -c "python -c \"import urllib.request; urllib.request.urlopen('http://127.0.0.1:${PORT:-9509}/health')\""

CMD ["sh", "-c", "uvicorn src.api.app:app --host 0.0.0.0 --port ${PORT:-9509} --workers 4 --timeout-keep-alive 5"]
