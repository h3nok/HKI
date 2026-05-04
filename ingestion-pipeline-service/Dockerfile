# ═══════════════════════════════════════════════════════════════════════════════
# Ingestion Pipeline Service — Multi-stage Docker build
# Document ingestion: extract, clean, enrich, delegate to vector-store
# ═══════════════════════════════════════════════════════════════════════════════

# Build context: ai-platform/ (so shared/ is accessible)
# cd apps/ai-platform/
# docker build -f ingestion-pipeline-service/Dockerfile -t ingestion-pipeline-service .

# ── Stage 1: Build dependencies ──────────────────────────────────────────────
FROM python:3.13-alpine AS builder

COPY --from=ghcr.io/astral-sh/uv:0.5 /uv /uvx /bin/

WORKDIR /app

# Install shared package (hki-shared) and service package together
COPY shared/ ./shared/
COPY ingestion-pipeline-service/pyproject.toml ./ingestion-pipeline-service/
RUN pip install --trusted-host pypi.org --trusted-host pypi.python.org --trusted-host files.pythonhosted.org --no-cache-dir --prefix=/install ./shared ./ingestion-pipeline-service

# ── Stage 2: Production runtime ──────────────────────────────────────────────
FROM python:3.13-alpine

RUN apk upgrade --no-cache --force-missing-repositories || true

WORKDIR /app

# Copy installed packages from builder (includes hki-shared in site-packages)
COPY --from=builder /install /usr/local

# Copy application code
COPY ingestion-pipeline-service/src/ ./src/

# Create non-root user
RUN addgroup -S appuser && adduser -S -G appuser -h /app appuser && \
    chown -R appuser:appuser /app
USER appuser

EXPOSE 9508

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:9508/health')"

CMD ["gunicorn", "src.api.app:app", \
    "--worker-class", "uvicorn.workers.UvicornWorker", \
    "--workers", "2", \
    "--bind", "0.0.0.0:9508", \
    "--timeout", "120", \
    "--graceful-timeout", "30", \
    "--keep-alive", "5", \
    "--max-requests", "1000", \
    "--max-requests-jitter", "100"]
