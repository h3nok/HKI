"""HKI-T08 — embedding cache key omits domain (PRE-HKI)."""
from __future__ import annotations

CACHE: dict[str, list[float]] = {}


def embed_buggy(text: str, model: str, domain: str) -> list[float]:
    # BUG: domain not in cache key.
    key: str = f"{model}:{text}"
    if key in CACHE:
        return CACHE[key]
    # Pretend embeddings differ per tenant due to tenant-specific tokenizers
    vec: list[float] = [float(len(text)), float(hash(domain) & 0xFF)]
    CACHE[key] = vec
    return vec


def main() -> None:
    iris_vec: list[float] = embed_buggy("hello", "ada-002", "iris")
    pulse_vec: list[float] = embed_buggy("hello", "ada-002", "pulse")
    print(f"iris  -> {iris_vec}")
    print(f"pulse -> {pulse_vec}")
    assert pulse_vec == iris_vec
    print("LEAK: tenant B got tenant A's cached embedding.")


if __name__ == "__main__":
    main()
