"""Pydantic v2 models for HKI 1.0 — M4 schema freeze.

These models enforce structural rules. They do **not** enforce expiry,
domain consistency, or signature verification. Use ``validate_envelope``
for runtime enforcement.

Pydantic v2 is an optional dependency. Import this module only when Pydantic
is already in your dependency tree.

Example::

    from hki_runtime.pydantic import HkiEnvelopeModel
    envelope = HkiEnvelopeModel.model_validate(raw_dict)
"""

from __future__ import annotations

from typing import Annotated

from pydantic import BaseModel, Field, field_validator, model_validator

from hki_runtime import GLOBAL_DOMAIN, HKI_VERSION, WILDCARD_DOMAIN

_FORBIDDEN = {GLOBAL_DOMAIN, WILDCARD_DOMAIN, GLOBAL_DOMAIN.upper(), "*"}


def _non_forbidden(v: str) -> str:
    if v.lower() in (GLOBAL_DOMAIN, WILDCARD_DOMAIN):
        raise ValueError(f'domain must not be "{GLOBAL_DOMAIN}" or "{WILDCARD_DOMAIN}"')
    return v


NonForbiddenDomain = Annotated[
    str,
    Field(min_length=1),
]


class HkiEnvelopeModel(BaseModel):
    """Pydantic v2 model for an HKI 1.0 runtime envelope.

    The ``hki_version`` field is constrained to the literal ``"1.0"``.
    ``active_domain`` and every element of ``authorized_domains`` must be
    non-global and non-wildcard.
    """

    model_config = {"frozen": True, "extra": "forbid"}

    hki_version: str = Field(default=HKI_VERSION)
    envelope_id: str = Field(min_length=1)
    org_id: str = Field(min_length=1)
    subject_id: str = Field(min_length=1)
    active_domain: str = Field(min_length=1)
    authorized_domains: tuple[str, ...] = Field(min_length=1)
    purpose: str = Field(min_length=1)
    risk_tier: str = Field(min_length=1)
    policy_pack_id: str = Field(min_length=1)
    issued_at: float
    expires_at: float
    issuer: str = Field(min_length=1)
    signature: str | None = Field(default=None)

    @field_validator("hki_version")
    @classmethod
    def check_version(cls, v: str) -> str:
        if v != HKI_VERSION:
            raise ValueError(f"hki_version must be {HKI_VERSION!r}, got {v!r}")
        return v

    @field_validator("active_domain")
    @classmethod
    def check_active_domain(cls, v: str) -> str:
        return _non_forbidden(v)

    @field_validator("authorized_domains", mode="before")
    @classmethod
    def coerce_authorized_domains(cls, v: object) -> tuple[str, ...]:
        if isinstance(v, (list, tuple)):
            return tuple(str(d) for d in v)
        raise ValueError("authorized_domains must be a list")

    @field_validator("authorized_domains")
    @classmethod
    def check_authorized_domains(cls, v: tuple[str, ...]) -> tuple[str, ...]:
        if not v:
            raise ValueError("authorized_domains must contain at least one domain")
        for domain in v:
            _non_forbidden(domain)
        if len(set(v)) != len(v):
            raise ValueError("authorized_domains must not contain duplicates")
        return v

    @model_validator(mode="after")
    def check_active_in_authorized(self) -> "HkiEnvelopeModel":
        if self.active_domain not in self.authorized_domains:
            raise ValueError("active_domain must appear in authorized_domains")
        return self


class HkiArtifactLabelModel(BaseModel):
    """Pydantic v2 model for an HKI artifact label."""

    model_config = {"frozen": True, "extra": "forbid"}

    org_id: str = Field(min_length=1)
    domain: str = Field(min_length=1)
    artifact_type: str = Field(min_length=1)
    artifact_id: str = Field(min_length=1)
    provenance_id: str | None = Field(default=None)

    @field_validator("domain")
    @classmethod
    def check_domain(cls, v: str) -> str:
        return _non_forbidden(v)


class HkiGatewayTargetModel(BaseModel):
    """Pydantic v2 model for an HKI gateway target."""

    model_config = {"frozen": True, "extra": "forbid"}

    type: str = Field(min_length=1)
    id: str = Field(min_length=1)
    domain: str = Field(min_length=1)
    published_domains: tuple[str, ...] = Field(default=())

    @field_validator("published_domains", mode="before")
    @classmethod
    def coerce_published_domains(cls, v: object) -> tuple[str, ...]:
        if v is None:
            return ()
        if isinstance(v, (list, tuple)):
            return tuple(str(d) for d in v)
        raise ValueError("published_domains must be a list")
