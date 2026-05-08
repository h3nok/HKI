from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient

# Keep the API test harness fully local and deterministic.
os.environ["AUTH_ENABLED"] = "false"
os.environ["ALLOYDB_URL"] = ""
os.environ["EMBEDDING_GATEWAY_URL"] = ""
os.environ["ANALYTICS_SERVICE_URL"] = ""
os.environ["NEO4J_URI"] = ""
os.environ["ENTITY_EXTRACTION_ENABLED"] = "false"
os.environ["PIPELINE_SERVICE_SECRET"] = ""

from src.api.app import app


@pytest.fixture()
def client() -> TestClient:
    with TestClient(app) as test_client:
        yield test_client
