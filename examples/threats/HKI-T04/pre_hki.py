"""HKI-T04 — async job loses domain on resume (PRE-HKI)."""
from __future__ import annotations

QUEUE: list[dict] = []
ARTIFACTS: list[dict] = []


def enqueue_buggy(payload: dict, domain: str) -> None:
    # BUG: envelope is not threaded through the job payload.
    QUEUE.append({"payload": payload})


def worker_buggy() -> None:
    while QUEUE:
        msg = QUEUE.pop(0)
        # No envelope on resume -> falls back to "global"
        ARTIFACTS.append({"domain": "global", "data": msg["payload"]})


def main() -> None:
    enqueue_buggy({"text": "iris doc"}, domain="iris")
    worker_buggy()
    print(f"LEAK: artifact stored as -> {ARTIFACTS[-1]}")
    assert ARTIFACTS[-1]["domain"] == "global"


if __name__ == "__main__":
    main()
