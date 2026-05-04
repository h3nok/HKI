export type SyntheticCleanupUser = {
  openId?: string | null;
  email?: string | null;
  name?: string | null;
};

export type SyntheticCleanupStream = {
  id: string;
  name?: string | null;
};

export const SMOKE_STREAM_PREFIX = (
  process.env.KB_GKE_SMOKE_STREAM_PREFIX ?? "hvsi-gke-smoke"
)
  .toLowerCase()
  .replace(/[^a-z0-9-]+/g, "-")
  .replace(/^-+|-+$/g, "")
  .slice(0, 32);

export const SMOKE_STREAM_NAME_PREFIX =
  process.env.KB_GKE_SMOKE_NAME_PREFIX?.trim() || "HVSI GKE Smoke";

function normalizeCleanupText(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

export function getSyntheticUserReasons(user: SyntheticCleanupUser): string[] {
  const openId = normalizeCleanupText(user.openId);
  const haystack = [user.openId, user.email, user.name]
    .map(value => normalizeCleanupText(value))
    .filter(Boolean)
    .join(" ");
  const reasons = new Set<string>();

  if (openId.startsWith("prod-e2e-") || /\bprod[-\s]?e2e\b/i.test(haystack)) {
    reasons.add("prod-e2e identity");
  }

  if (openId.startsWith("kb-")) {
    reasons.add("kb synthetic identity");
  }

  if (/(^|[\s-])kb-gke-smoke([\s-]|$)/i.test(haystack)) {
    reasons.add("kb-gke-smoke identity");
  }

  if (
    openId.startsWith("hvsi-") ||
    /(^|[\s-])hvsi-gke([\s-]|$)/i.test(haystack) ||
    /(^|[\s-])hvsi[\s-]gke([\s-]|$)/i.test(haystack)
  ) {
    reasons.add("hvsi-gke identity");
  }

  if (
    /\bhvsi\b/i.test(haystack) &&
    /\b(debug|readiness|smoke|wire|provision)\b/i.test(haystack)
  ) {
    reasons.add("hvsi debug or readiness identity");
  }

  return Array.from(reasons);
}

export function isSmokeStream(stream: SyntheticCleanupStream): boolean {
  return (
    stream.id.startsWith(`${SMOKE_STREAM_PREFIX}-`) ||
    Boolean(stream.name?.startsWith(SMOKE_STREAM_NAME_PREFIX))
  );
}
