"""HKI-T06 — MCP tool without domain binding (POST-HKI)."""
from __future__ import annotations

import hki_runtime


TOOLS: list[dict[str, str]] = [
    {"id": "search.iris", "domain": "iris"},
    {"id": "global.search", "domain": "*"},
    {"id": "shared.lookup"},  # missing domain
]


def _envelope(domain: str) -> dict:
    return {
        "hki_version": "1.0",
        "envelope_id": f"env_{domain}",
        "org_id": "org_acme",
        "subject_id": "user_42",
        "active_domain": domain,
        "authorized_domains": [domain],
        "purpose": "tool-call",
        "risk_tier": "write",
        "policy_pack_id": "p1",
        "issued_at": 0,
        "expires_at": 99999999999,
        "issuer": "edge",
        "signature": "sig",
    }


class ToolDenied(Exception):
    pass


def can_invoke_safe(tool_id: str, envelope: dict) -> bool:
    for t in TOOLS:
        if t["id"] != tool_id:
            continue
        domain: str | None = t.get("domain")
        if not domain:
            raise ToolDenied(f"tool {tool_id} has no domain binding")
        target = hki_runtime.HkiGatewayTarget(type="tool", id=tool_id, domain=domain)
        decision = hki_runtime.evaluate_gateway_target(envelope, target)
        if not decision.allowed:
            raise ToolDenied(decision.reason)
        return True
    return False


def main() -> None:
    env = _envelope("iris")
    assert can_invoke_safe("search.iris", env)

    for bad in ("global.search", "shared.lookup"):
        try:
            can_invoke_safe(bad, env)
        except ToolDenied as e:
            print(f"BLOCKED {bad}: {e}")


if __name__ == "__main__":
    main()
