# Build from repo root:
#   docker build -f services/hki-probe-target/Dockerfile -t hki-probe-target .

FROM python:3.12-slim AS builder

COPY --from=ghcr.io/astral-sh/uv:0.5 /uv /bin/

WORKDIR /app

COPY packages/hki-runtime-py/ ./packages/hki-runtime-py/

RUN uv pip install --system --no-cache \
      "./packages/hki-runtime-py[fastapi]" \
      "fastapi>=0.111" \
      "uvicorn[standard]>=0.29"

# ── runtime ──────────────────────────────────────────────────────────────────
FROM python:3.12-slim

COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin/uvicorn /usr/local/bin/uvicorn

WORKDIR /app

COPY services/hki-probe-target/src/ ./src/

RUN adduser --system --group appuser \
    && chown -R appuser:appuser /app
USER appuser

ENV PORT=8080
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/healthz')"

CMD ["sh", "-c", "uvicorn src.app:app --host 0.0.0.0 --port ${PORT:-8080}"]
