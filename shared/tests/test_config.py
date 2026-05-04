"""Tests for shared.config — ServiceSettings base class."""

from __future__ import annotations

import pytest
from pydantic import ValidationError


class TestServiceSettings:
    """Test ServiceSettings defaults and production validation."""

    def test_defaults(self) -> None:
        """Settings can be instantiated with all defaults."""
        from shared.config import ServiceSettings

        s = ServiceSettings()
        assert s.SERVICE_NAME == "unknown-service"
        assert s.SERVICE_PORT == 8000
        assert s.LOG_LEVEL == "INFO"
        assert s.ENVIRONMENT == "development"
        assert s.AUTH_ENABLED is True
        assert s.OTEL_ENABLED is False
        assert isinstance(s.CORS_ORIGINS, list)

    def test_env_override(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Environment variables override defaults."""
        from shared.config import ServiceSettings

        monkeypatch.setenv("SERVICE_NAME", "my-svc")
        monkeypatch.setenv("SERVICE_PORT", "1234")
        monkeypatch.setenv("LOG_LEVEL", "DEBUG")
        s = ServiceSettings()
        assert s.SERVICE_NAME == "my-svc"
        assert s.SERVICE_PORT == 1234
        assert s.LOG_LEVEL == "DEBUG"

    def test_production_missing_secret_fails(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Production mode must have SERVICE_AUTH_SECRET set."""
        from shared.config import ServiceSettings

        monkeypatch.setenv("ENVIRONMENT", "production")
        monkeypatch.setenv("SERVICE_AUTH_SECRET", "")
        monkeypatch.setenv("AUTH_ENABLED", "true")
        with pytest.raises((ValueError, ValidationError)):
            ServiceSettings()

    def test_production_placeholder_llm_key_fails(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Production rejects placeholder LLM_API_KEY values."""
        from shared.config import ServiceSettings

        monkeypatch.setenv("ENVIRONMENT", "production")
        monkeypatch.setenv("SERVICE_AUTH_SECRET", "real-secret")
        monkeypatch.setenv("LLM_API_KEY", "sk-1234")
        with pytest.raises((ValueError, ValidationError)):
            ServiceSettings()

    def test_production_auth_disabled_fails(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Production rejects AUTH_ENABLED=false."""
        from shared.config import ServiceSettings

        monkeypatch.setenv("ENVIRONMENT", "production")
        monkeypatch.setenv("SERVICE_AUTH_SECRET", "real-secret")
        monkeypatch.setenv("LLM_API_KEY", "real-key-xyz")
        monkeypatch.setenv("AUTH_ENABLED", "false")
        with pytest.raises((ValueError, ValidationError)):
            ServiceSettings()

    def test_production_valid_config_passes(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Valid production config should not raise."""
        from shared.config import ServiceSettings

        monkeypatch.setenv("ENVIRONMENT", "production")
        monkeypatch.setenv("SERVICE_AUTH_SECRET", "real-secret")
        monkeypatch.setenv("LLM_API_KEY", "real-key-xyz")
        monkeypatch.setenv("AUTH_ENABLED", "true")
        s = ServiceSettings()
        assert s.ENVIRONMENT == "production"

    def test_development_skips_validation(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Development mode skips production validation entirely."""
        from shared.config import ServiceSettings

        monkeypatch.setenv("ENVIRONMENT", "development")
        monkeypatch.setenv("SERVICE_AUTH_SECRET", "")
        monkeypatch.setenv("LLM_API_KEY", "sk-1234")
        monkeypatch.setenv("AUTH_ENABLED", "false")
        s = ServiceSettings()
        assert s.ENVIRONMENT == "development"

    def test_subclass_inherits_validation(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Subclass gets production validation for free."""
        from shared.config import ServiceSettings

        class MySettings(ServiceSettings):
            SERVICE_NAME: str = "my-service"
            MY_CUSTOM_FIELD: str = "value"

        monkeypatch.setenv("ENVIRONMENT", "development")
        s = MySettings()
        assert s.SERVICE_NAME == "my-service"
        assert s.MY_CUSTOM_FIELD == "value"
        assert s.AUTH_ENABLED is True  # inherited default

    def test_extra_fields_ignored(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Unknown env vars are silently ignored (extra='ignore')."""
        from shared.config import ServiceSettings

        monkeypatch.setenv("TOTALLY_UNKNOWN_VAR", "should-not-crash")
        ServiceSettings()  # should not raise
