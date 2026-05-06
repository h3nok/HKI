/**
 * Shared utilities for Overview dashboard cards.
 */

export type Rating = "good" | "warn" | "bad" | "neutral";

export function rateSearchScore(v: number): Rating {
  if (v === 0) return "neutral";
  if (v >= 0.7) return "good";
  if (v >= 0.4) return "warn";
  return "bad";
}

export function rateIngestSuccess(v: number): Rating {
  if (v === 0) return "neutral";
  if (v >= 0.95) return "good";
  if (v >= 0.8) return "warn";
  return "bad";
}

export function rateCmos(v: number): Rating {
  if (v === 0) return "neutral";
  if (v <= 2000) return "good";
  if (v <= 4000) return "warn";
  return "bad";
}

export function rateCoverage(v: number): Rating {
  if (v === 0) return "neutral";
  if (v >= 75) return "good";
  if (v >= 50) return "warn";
  return "bad";
}

export function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const ts = new Date(dateStr).getTime();
  if (!Number.isFinite(ts)) return "—";
  const diffMs = Date.now() - ts;
  if (diffMs < 60_000) return "just now";
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}
