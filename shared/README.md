# Shared Utilities

Common Python utilities used across all AI Platform services.

## What's Included

- **auth_middleware.py** - JWT authentication and verification
- **gcp_secrets.py** - Google Cloud Secret Manager integration
- **pubsub_publisher.py** - Cloud Pub/Sub message publishing
- **tracing.py** - OpenTelemetry distributed tracing
- **logging.py** - Structured JSON logging
- **health.py** - Health check utilities
- **http_client.py** - Consistent HTTP client configuration
- **errors.py** - Common error types and handling
- **config.py** - Base configuration classes
- **middleware.py** - Common FastAPI middleware

## Usage in Services

This package is referenced as `hki-shared` in service `pyproject.toml` files:

```toml
[project]
dependencies = [
    "hki-shared",
    # ... other dependencies
]

[tool.uv.sources]
hki-shared = { path = "../shared", editable = true }
```

## Example Usage

### Authentication Middleware

```python
from shared.auth_middleware import verify_jwt, get_current_user

@app.get("/protected")
async def protected_route(user = Depends(get_current_user)):
    return {"org_id": user.org_id, "user_id": user.sub}
```

### GCP Secrets

```python
from shared.gcp_secrets import get_secret

api_key = get_secret("my-api-key", project="my-project")
```

### Pub/Sub Publishing

```python
from shared.pubsub_publisher import PubSubPublisher

publisher = PubSubPublisher(project_id="my-project")
publisher.publish("my-topic", {"event": "document_uploaded"})
```

### Structured Logging

```python
from shared.logging import get_logger

logger = get_logger(__name__)
logger.info("Processing document", extra={"doc_id": "123", "org_id": "hki"})
```

### Tracing

```python
from shared.tracing import init_tracing, trace_function

init_tracing(service_name="my-service")

@trace_function
async def process_data(data):
    # Automatically traced
    pass
```

## Installation

This package is automatically installed when building services via Docker. For local development:

```bash
# Install in editable mode
pip install -e .

# Or with optional dependencies
pip install -e ".[gcp,otel,dev]"
```

## Optional Dependencies

- **gcp** - Google Cloud Platform integrations (Secret Manager, Pub/Sub)
- **otel** - OpenTelemetry tracing and instrumentation
- **dev** - Development tools (pytest, ruff)

## Development

```bash
# Install dev dependencies
pip install -e ".[dev]"

# Run tests
pytest

# Lint code
ruff check shared/
```

## Notes

- All services MUST be built from the `apps/ai-platform/` directory so this shared module is accessible
- The package is included in Docker images via `COPY shared/ ./shared/`
- Services import using `from shared.module_name import ...`
