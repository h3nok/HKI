# ═══════════════════════════════════════════════════════════════════════════════
# Orchestrator Service — Multi-stage Docker build
# The "brain" of the platform: ReAct loop, routing, guardrails, memory
# ═══════════════════════════════════════════════════════════════════════════════

# Build context: ai-platform/ (so shared/ is accessible)
# cd apps/ai-platform/
# docker build -f orchestrator-service/Dockerfile -t orchestrator-service .

# ── Stage 1: Build dependencies ──────────────────────────────────────────────
FROM python:3.13-alpine AS builder

COPY --from=ghcr.io/astral-sh/uv:0.5 /uv /uvx /bin/

WORKDIR /app

# Install shared package (hki-shared) and service package together.
# google-adk handles Vertex AI model calls natively via google.genai + ADC.
COPY shared/ ./shared/
COPY orchestrator-service/pyproject.toml ./orchestrator-service/
RUN pip install --trusted-host pypi.org --trusted-host pypi.python.org --trusted-host files.pythonhosted.org --no-cache-dir --prefix=/install ./shared './orchestrator-service'

# ── Stage 2: Production runtime ──────────────────────────────────────────────
FROM python:3.13-alpine

RUN apk upgrade --no-cache --force-missing-repositories || true

WORKDIR /app

# Copy installed packages from builder (includes hki-shared in site-packages)
COPY --from=builder /install /usr/local

# Copy application code
COPY orchestrator-service/src/ ./src/

# Create non-root user
RUN addgroup -S appuser && adduser -S -G appuser -h /app appuser && \
    chown -R appuser:appuser /app
USER appuser

EXPOSE 9501

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:9501/health')"

CMD ["gunicorn", "src.api.app:app", \
     "--worker-class", "uvicorn.workers.UvicornWorker", \
     "--workers", "4", \
     "--bind", "0.0.0.0:9501", \
     "--timeout", "120", \
     "--graceful-timeout", "30", \
     "--keep-alive", "5", \
     "--max-requests", "1000", \
     "--max-requests-jitter", "100"]
