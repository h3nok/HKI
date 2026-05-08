"""
Embedding Drift Detection — monitors embedding distribution shifts over time.

Detects when embedding quality degrades due to model updates, data drift,
or schema changes. Essential for production RAG systems where silent
embedding degradation leads to gradual retrieval quality loss.

Approach (industry standard — aligned with Arize AI, Evidently, WhyLabs):
    1. Maintain a reference centroid from a "golden" sample of embeddings.
    2. On each evaluation run, compute the current centroid.
    3. Measure cosine distance between reference and current centroid.
    4. Track intra-cluster spread (mean distance from centroid) for
       distribution width monitoring.
    5. Alert when drift exceeds configurable thresholds.

Architecture:
    EmbeddingDriftDetector — stateless analyzer, injected with history store
    DriftSnapshot          — per-run measurement
    DriftReport            — trend + alert analysis
"""

from __future__ import annotations

import collections.abc
import datetime
import math
import statistics
import time

import pydantic

# ═══════════════════════════════════════════════════════════════════════════════
# Models
# ═══════════════════════════════════════════════════════════════════════════════


class DriftSnapshot(pydantic.BaseModel):
    """Point-in-time measurement of embedding distribution."""

    timestamp: datetime.datetime = pydantic.Field(default_factory=datetime.datetime.utcnow)
    centroid: list[float] = pydantic.Field(default_factory=list)
    mean_distance_from_centroid: float = 0.0  # Intra-cluster spread
    std_distance: float = 0.0  # Spread variance
    sample_size: int = 0
    embedding_dim: int = 0


class DriftAlert(pydantic.BaseModel):
    """A drift event that may require attention."""

    severity: str = "info"  # info | warning | critical
    metric: str = ""
    current_value: float = 0.0
    reference_value: float = 0.0
    delta: float = 0.0
    message: str = ""


class DriftReport(pydantic.BaseModel):
    """Complete drift analysis report."""

    timestamp: datetime.datetime = pydantic.Field(default_factory=datetime.datetime.utcnow)
    reference_snapshot: DriftSnapshot | None = None
    current_snapshot: DriftSnapshot | None = None
    centroid_drift: float = 0.0  # Cosine distance from reference
    spread_change: float = 0.0  # % change in intra-cluster spread
    alerts: list[DriftAlert] = pydantic.Field(default_factory=list)
    is_drifted: bool = False
    analysis_time_ms: float = 0.0


# ═══════════════════════════════════════════════════════════════════════════════
# Core detection engine
# ═══════════════════════════════════════════════════════════════════════════════


class EmbeddingDriftDetector:
    """
    Stateless embedding drift detector.

    Compares embedding distributions between a reference set (golden baseline)
    and a current set (latest retrieval queries or document embeddings).

    Usage:
        detector = EmbeddingDriftDetector(
            centroid_drift_threshold=0.15,
            spread_change_threshold=0.30,
        )

        ref_snapshot = detector.compute_snapshot(golden_embeddings)
        cur_snapshot = detector.compute_snapshot(current_embeddings)
        report = detector.analyze(ref_snapshot, cur_snapshot)

        if report.is_drifted:
            # Alert: embedding model may have changed or data shifted
            for alert in report.alerts:
                logger.warning(alert.message)
    """

    def __init__(
        self,
        centroid_drift_threshold: float = 0.15,
        spread_change_threshold: float = 0.30,
    ) -> None:
        """
        Args:
            centroid_drift_threshold: Max cosine distance before flagging drift.
                0.15 is a good default for 768-dim embeddings (catches ~2σ shift).
            spread_change_threshold: Max % change in intra-cluster spread before
                flagging distribution width change. 0.30 = 30% change.
        """
        self._centroid_threshold: float = centroid_drift_threshold
        self._spread_threshold: float = spread_change_threshold

    def compute_snapshot(
        self,
        embeddings: list[list[float]],
    ) -> DriftSnapshot:
        """
        Compute a distribution snapshot from a set of embeddings.

        Calculates the centroid (mean vector) and intra-cluster statistics.
        Efficient O(n*d) computation suitable for production batch sizes.
        """
        if not embeddings:
            return DriftSnapshot()

        dim: int = len(embeddings[0])
        n: int = len(embeddings)

        # Compute centroid (element-wise mean)
        centroid: list[float] = [0.0] * dim
        for vec in embeddings:
            for i in range(min(dim, len(vec))):
                centroid[i] += vec[i]
        centroid: list[float] = [c / n for c in centroid]

        # Compute distances from centroid
        distances: list[float] = [_cosine_distance(vec, centroid) for vec in embeddings]

        mean_dist: float = statistics.mean(distances) if distances else 0.0
        std_dist: float = statistics.stdev(distances) if len(distances) >= 2 else 0.0

        return DriftSnapshot(
            centroid=centroid,
            mean_distance_from_centroid=round(mean_dist, 6),
            std_distance=round(std_dist, 6),
            sample_size=n,
            embedding_dim=dim,
        )

    def analyze(
        self,
        reference: DriftSnapshot,
        current: DriftSnapshot,
    ) -> DriftReport:
        """
        Compare current embedding distribution against reference baseline
        and generate drift alerts.

        Returns a DriftReport with severity-classified alerts.
        """
        t0: float = time.monotonic()
        alerts: list[DriftAlert] = []

        # Guard: need valid snapshots
        if not reference.centroid or not current.centroid:
            return DriftReport(
                reference_snapshot=reference,
                current_snapshot=current,
                alerts=[
                    DriftAlert(
                        severity="info",
                        metric="snapshot_validity",
                        message="Missing reference or current snapshot — cannot analyze drift.",
                    )
                ],
                analysis_time_ms=round((time.monotonic() - t0) * 1000, 2),
            )

        # 1. Centroid drift (cosine distance)
        centroid_drift: float = _cosine_distance(reference.centroid, current.centroid)

        if centroid_drift > self._centroid_threshold * 1.5:
            alerts.append(
                DriftAlert(
                    severity="critical",
                    metric="centroid_drift",
                    current_value=round(centroid_drift, 4),
                    reference_value=0.0,
                    delta=round(centroid_drift, 4),
                    message=(
                        f"CRITICAL: Embedding centroid drift {centroid_drift:.4f} exceeds "
                        f"critical threshold ({self._centroid_threshold * 1.5:.3f}). "
                        "Embedding model may have changed or significant data shift occurred."
                    ),
                )
            )
        elif centroid_drift > self._centroid_threshold:
            alerts.append(
                DriftAlert(
                    severity="warning",
                    metric="centroid_drift",
                    current_value=round(centroid_drift, 4),
                    reference_value=0.0,
                    delta=round(centroid_drift, 4),
                    message=(
                        f"WARNING: Embedding centroid drift {centroid_drift:.4f} exceeds "
                        f"threshold ({self._centroid_threshold:.3f}). Monitor for quality impact."
                    ),
                )
            )

        # 2. Spread change (intra-cluster distribution width)
        spread_change = 0.0
        if reference.mean_distance_from_centroid > 0:
            spread_change: float = (
                current.mean_distance_from_centroid - reference.mean_distance_from_centroid
            ) / reference.mean_distance_from_centroid

        if abs(spread_change) > self._spread_threshold:
            direction: str = "widened" if spread_change > 0 else "narrowed"
            severity: str = (
                "warning"
                if abs(spread_change) < self._spread_threshold * 2
                else "critical"
            )
            alerts.append(
                DriftAlert(
                    severity=severity,
                    metric="spread_change",
                    current_value=round(current.mean_distance_from_centroid, 4),
                    reference_value=round(reference.mean_distance_from_centroid, 4),
                    delta=round(spread_change, 4),
                    message=(
                        f"Embedding distribution {direction} by {abs(spread_change) * 100:.1f}%. "
                        f"Current spread: {current.mean_distance_from_centroid:.4f} "
                        f"vs reference: {reference.mean_distance_from_centroid:.4f}."
                    ),
                )
            )

        # 3. Dimensionality check
        if (
            reference.embedding_dim > 0
            and current.embedding_dim > 0
            and reference.embedding_dim != current.embedding_dim
        ):
            alerts.append(
                DriftAlert(
                    severity="critical",
                    metric="dimension_mismatch",
                    current_value=float(current.embedding_dim),
                    reference_value=float(reference.embedding_dim),
                    delta=float(current.embedding_dim - reference.embedding_dim),
                    message=(
                        f"CRITICAL: Embedding dimension changed from "
                        f"{reference.embedding_dim} to {current.embedding_dim}. "
                        "This indicates an embedding model swap."
                    ),
                )
            )

        # 4. Sample size warning
        if current.sample_size < 10:
            alerts.append(
                DriftAlert(
                    severity="info",
                    metric="sample_size",
                    current_value=float(current.sample_size),
                    message=(
                        f"Small sample size ({current.sample_size}): "
                        "drift estimates may be unreliable. Recommendation: >= 30 samples."
                    ),
                )
            )

        is_drifted: bool = any(a.severity in ("warning", "critical") for a in alerts)

        return DriftReport(
            reference_snapshot=reference,
            current_snapshot=current,
            centroid_drift=round(centroid_drift, 6),
            spread_change=round(spread_change, 6),
            alerts=alerts,
            is_drifted=is_drifted,
            analysis_time_ms=round((time.monotonic() - t0) * 1000, 2),
        )


# ═══════════════════════════════════════════════════════════════════════════════
# Vector math
# ═══════════════════════════════════════════════════════════════════════════════


def _cosine_distance(
    a: collections.abc.Sequence[float],
    b: collections.abc.Sequence[float],
) -> float:
    """1 - cosine_similarity. Returns 0.0 for identical vectors, 1.0 for orthogonal."""
    if len(a) != len(b) or not a:
        return 1.0
    dot: float | int = sum(x * y for x, y in zip(a, b, strict=False))
    norm_a: float = math.sqrt(sum(x * x for x in a))
    norm_b: float = math.sqrt(sum(x * x for x in b))
    if norm_a == 0.0 or norm_b == 0.0:
        return 1.0
    similarity: float = max(-1.0, min(1.0, dot / (norm_a * norm_b)))
    return max(0.0, 1.0 - similarity)
