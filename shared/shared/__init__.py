"""
hki-shared — Shared modules for HKI platform services.

Re-exports commonly used symbols for convenience:

    from shared import ServiceSettings, setup_logging, ServiceError, install_error_handlers
    from shared.auth_middleware import verify_request_jwt
    from shared.tracing import init_tracing
    from shared.health import create_health_router
"""
