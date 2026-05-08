"""HKI-T10 — wildcard publication into runtime domain (POST-HKI)."""
from __future__ import annotations

import hki_runtime

ARTIFACTS: list[dict] = []


class PublicationDenied(Exception):
    pass


def publish_safe(content: str, domain: str) -> None:
    if hki_runtime.is_forbidden_runtime_domain(domain):
        raise PublicationDenied(f"refuse wildcard/global publication: {domain!r}")
    ARTIFACTS.append({"domain": domain, "content": content})


def read_runtime(domain: str) -> list[dict]:
    if hki_runtime.is_forbidden_runtime_domain(domain):
        raise PublicationDenied(f"refuse runtime read for {domain!r}")
    return [a for a in ARTIFACTS if hki_runtime.same_domain(a["domain"], domain)]


def main() -> None:
    try:
        publish_safe("backdoor doc", domain="*")
    except PublicationDenied as err:
        print(f"BLOCKED: {err}")
        return
    raise AssertionError("publication should have been blocked")


if __name__ == "__main__":
    main()
