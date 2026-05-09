"""Reference adapter: wraps hki_runtime to satisfy HkiConformanceAdapter.

This is the canonical Python adapter. Third-party implementations must
produce identical results for all 28 cases.
"""

from __future__ import annotations

import hki_runtime

from .fixtures import CONFORMANCE_NOW


class HkiRuntimeAdapter:
    """Conformance adapter backed by the hki_runtime package."""

    name: str = "hki-runtime"
    version: str | None = hki_runtime.HKI_VERSION

    def _validate(self, envelope: dict) -> hki_runtime.HkiValidationResult:
        return hki_runtime.validate_envelope(
            envelope,
            require_signature=True,
            now=CONFORMANCE_NOW,
        )

    def validate_envelope(self, envelope: dict) -> hki_runtime.HkiValidationResult:
        return self._validate(envelope)

    def can_read_artifact(self, envelope: dict, artifact: dict) -> bool:
        v = self._validate(envelope)
        if not v.ok or v.envelope is None:
            return False
        label = hki_runtime.HkiArtifactLabel(
            org_id=str(artifact.get("org_id", "")),
            domain=str(artifact.get("domain", "")),
            artifact_type=str(artifact.get("artifact_type", "document")),
            artifact_id=str(artifact.get("artifact_id", "")),
        )
        return hki_runtime.assert_artifact_visible(v.envelope, label) is None

    def derive_cache_key(self, cache_input: dict) -> str:
        return hki_runtime.derive_hki_cache_key(cache_input)

    def evaluate_gateway_target(
        self, envelope: dict, target: dict
    ) -> hki_runtime.HkiGatewayDecision:
        v = self._validate(envelope)
        if not v.ok or v.envelope is None:
            return hki_runtime.HkiGatewayDecision(allowed=False, reason="invalid envelope")
        t = hki_runtime.HkiGatewayTarget(
            type=str(target.get("type", "tool")),
            id=str(target.get("id", "")),
            domain=str(target.get("domain", "")),
            published_domains=tuple(target.get("published_domains") or ()),
        )
        return hki_runtime.evaluate_gateway_target(v.envelope, t)

    def reject_scope_override(self, envelope: dict, args: dict) -> bool:
        v = self._validate(envelope)
        if not v.ok or v.envelope is None:
            return True
        return hki_runtime.reject_conflicting_scope_argument(v.envelope, args) is not None
