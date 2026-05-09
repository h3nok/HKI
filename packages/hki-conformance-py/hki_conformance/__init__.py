"""hki-conformance — HKI 1.0 conformance fixtures, adapter protocol, and runner."""

from .adapter import HkiRuntimeAdapter
from .cases import HKI_CONFORMANCE_CASES, HkiConformanceCase
from .fixtures import (
    ACTIVE_GATEWAY_TARGET,
    BASE_ENVELOPE,
    CACHE_INPUT,
    CHANGED_OPERATION_CACHE_INPUT,
    CHANGED_POLICY_CACHE_INPUT,
    CONFORMANCE_NOW,
    CROSS_DOMAIN_ARTIFACT,
    CROSS_DOMAIN_CACHE_INPUT,
    CROSS_DOMAIN_GATEWAY_TARGET,
    CROSS_ORG_ARTIFACT,
    EXPIRED_ENVELOPE,
    GLOBAL_ARTIFACT,
    GLOBAL_AUTHORIZED_ENVELOPE,
    GLOBAL_ENVELOPE,
    GLOBAL_GATEWAY_TARGET,
    MISSING_ACTIVE_DOMAIN_ENVELOPE,
    PUBLISHED_GATEWAY_TARGET,
    UNSIGNED_ENVELOPE,
    UNAUTHORIZED_ENVELOPE,
    VISIBLE_ARTIFACT,
    WILDCARD_ARTIFACT,
    WILDCARD_AUTHORIZED_ENVELOPE,
    WILDCARD_ENVELOPE,
    WILDCARD_GATEWAY_TARGET,
    WILDCARD_PUBLISHED_GATEWAY_TARGET,
    WRONG_VERSION_ENVELOPE,
)
from .runner import conformance_level, run_conformance
from .types import (
    HkiConformanceAdapter,
    HkiConformanceCaseResult,
    HkiConformanceReport,
    HkiConformanceSeverity,
)

__all__ = [
    # adapter
    "HkiRuntimeAdapter",
    # cases
    "HKI_CONFORMANCE_CASES",
    "HkiConformanceCase",
    # fixtures
    "ACTIVE_GATEWAY_TARGET",
    "BASE_ENVELOPE",
    "CACHE_INPUT",
    "CHANGED_OPERATION_CACHE_INPUT",
    "CHANGED_POLICY_CACHE_INPUT",
    "CONFORMANCE_NOW",
    "CROSS_DOMAIN_ARTIFACT",
    "CROSS_DOMAIN_CACHE_INPUT",
    "CROSS_DOMAIN_GATEWAY_TARGET",
    "CROSS_ORG_ARTIFACT",
    "EXPIRED_ENVELOPE",
    "GLOBAL_ARTIFACT",
    "GLOBAL_AUTHORIZED_ENVELOPE",
    "GLOBAL_ENVELOPE",
    "GLOBAL_GATEWAY_TARGET",
    "MISSING_ACTIVE_DOMAIN_ENVELOPE",
    "PUBLISHED_GATEWAY_TARGET",
    "UNSIGNED_ENVELOPE",
    "UNAUTHORIZED_ENVELOPE",
    "VISIBLE_ARTIFACT",
    "WILDCARD_ARTIFACT",
    "WILDCARD_AUTHORIZED_ENVELOPE",
    "WILDCARD_ENVELOPE",
    "WILDCARD_GATEWAY_TARGET",
    "WILDCARD_PUBLISHED_GATEWAY_TARGET",
    "WRONG_VERSION_ENVELOPE",
    # runner
    "conformance_level",
    "run_conformance",
    # types
    "HkiConformanceAdapter",
    "HkiConformanceCaseResult",
    "HkiConformanceReport",
    "HkiConformanceSeverity",
]
