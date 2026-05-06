import type { TaskMessage } from "../types";

export function normalizeConfidenceScore(raw: unknown): number | null {
  if (raw == null) return null;

  const numeric = Number(raw);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;

  const percentage = numeric <= 1 ? numeric * 100 : numeric;
  return Math.max(1, Math.min(100, Math.round(percentage)));
}

export function extractMessageConfidence(message: TaskMessage): number | null {
  if (message.content.type !== "text" || message.content.author !== "agent") {
    return null;
  }

  return normalizeConfidenceScore(message.attributes?.confidence);
}