import {
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  LayoutDashboard,
  Plus,
  BookOpen,
  ShieldCheck,
  Activity,
  Landmark,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import type {
  DocumentAccessControl,
  DocumentClassification,
} from "@shared/knowledge-types";

// ── Page / nav types ──────────────────────────────────────────────────────────

export type KnowledgeTab =
  | "overview"
  | "ingest"
  | "library"
  | "validate"
  | "govern"
  | "pipelines"
  | "activity";
export type LibraryView = "documents" | "collections" | "taxonomy" | "graph";
export type ValidateSection = "test" | "eval" | "quality" | "gaps";
export type ActivitySection = "pipeline" | "alerts";
export type GovernSection = "review" | "team" | "compliance";
export type IngestMode = "text" | "url" | "file";

export interface KBNavItem {
  key: KnowledgeTab;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: KBNavItem[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "ingest", label: "Add", icon: Plus },
  { key: "library", label: "Library", icon: BookOpen },
  { key: "validate", label: "Validate", icon: ShieldCheck },
  { key: "govern", label: "Govern", icon: Landmark },
  { key: "pipelines", label: "Processing", icon: Workflow },
  { key: "activity", label: "Activity", icon: Activity },
];

/** Manage — primary nav (first 5) */
export const CHAPTER_ITEMS = NAV_ITEMS.filter(i =>
  ["overview", "ingest", "library", "validate", "govern"].includes(i.key)
);
/** Monitor — secondary nav (Pipelines + Activity) */
export const INDEX_ITEMS = NAV_ITEMS.filter(i =>
  ["pipelines", "activity"].includes(i.key)
);

// ── Constants ─────────────────────────────────────────────────────────────────

export const JOB_STATUS_META: Record<
  string,
  { Icon: typeof CheckCircle; color: string }
> = {
  completed: { Icon: CheckCircle, color: "text-primary" },
  failed: { Icon: XCircle, color: "text-red-500" },
  cancelled: { Icon: XCircle, color: "text-muted-foreground" },
  queued: { Icon: Clock, color: "text-muted-foreground" },
  extracting: { Icon: Loader2, color: "text-blue-500" },
  cleaning: { Icon: Loader2, color: "text-blue-500" },
  enriching: { Icon: Loader2, color: "text-primary" },
  chunking: { Icon: Loader2, color: "text-emerald-500" },
  indexing: { Icon: Loader2, color: "text-violet-500" },
};

export const DOC_TYPES = [
  "general",
  "policy",
  "sop",
  "faq",
  "training",
  "report",
  "memo",
] as const;

export const SEARCH_MODES = [
  { value: "hybrid", label: "Hybrid", desc: "Vector + keyword" },
  { value: "vector", label: "Vector", desc: "Semantic similarity" },
  { value: "keyword", label: "Keyword", desc: "BM25 full-text" },
] as const;

// ── Shared style tokens ───────────────────────────────────────────────────────

export const cardCls = [
  "rounded-2xl",
  "kb-surface-card text-card-foreground",
].join(" ");
export const inputCls =
  "w-full px-3 py-2 text-sm rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30";
export const surfaceCls = "kb-surface-inset";

// ── Error humanizer ──────────────────────────────────────────────────────────

export function humanizeError(raw: string | null | undefined): string {
  if (!raw) return "";
  if (raw.includes("422")) return "Processing validation failed";
  if (raw.includes("413")) return "File too large";
  if (raw.includes("401") || raw.includes("403")) return "Auth error";
  if (raw.includes("429")) return "Rate limited — retry soon";
  if (raw.includes("fetch failed") || raw.includes("ECONNREFUSED"))
    return "Service unavailable";
  if (raw.includes("500") || raw.includes("INTERNAL_SERVER_ERROR"))
    return "Server error";
  if (raw.includes("timeout") || raw.includes("ETIMEDOUT")) return "Timed out";
  if (/name ['"`]?\w+['"`]? is not defined/i.test(raw))
    return "Internal processing rule failed";
  if (raw.includes("An unexpected error occurred"))
    return "Unexpected processing error";
  const clean = raw
    .replace(/^TRPCClientError:\s*/i, "")
    .replace(/^Service error \d+:\s*/i, "");
  return clean.length > 120 ? clean.slice(0, 117) + "…" : clean;
}

export function humanizePipelineError(
  raw: string | null | undefined,
  failedAtStage?: string | null
): string {
  if (!raw) return "";
  const normalized = raw.toLowerCase();

  if (
    failedAtStage === "queued" ||
    normalized.includes("service restarted before processing began")
  ) {
    return "Service restarted before processing began";
  }

  if (
    failedAtStage === "indexing" &&
    (normalized.includes("422") || normalized.includes("validation"))
  ) {
    return "Indexing validation failed";
  }

  return humanizeError(raw);
}

// ── Utilities ─────────────────────────────────────────────────────────────────

export function getFreshness(referenceAt: string | null): {
  label: string;
  color: string;
} {
  if (!referenceAt)
    return { label: "Unknown", color: "text-muted-foreground bg-muted/60" };
  const days = Math.floor(
    (Date.now() - new Date(referenceAt).getTime()) / 86400000
  );
  if (days < 30)
    return { label: "Current", color: "text-primary bg-primary/10" };
  if (days < 90)
    return { label: "Review", color: "text-primary bg-primary/10" };
  return { label: "Stale", color: "text-red-500 bg-red-500/10" };
}

export function getDocumentLifecycleMetadata(
  doc:
    | {
        metadata?: {
          custom?: Record<string, unknown> | null;
        } | null;
      }
    | null
    | undefined
): {
  owner: string | null;
  nextReviewDate: string | null;
} {
  const custom = doc?.metadata?.custom;
  const owner =
    typeof custom?.owner === "string" && custom.owner.trim()
      ? custom.owner.trim()
      : null;
  const nextReviewDate =
    typeof custom?.nextReviewDate === "string" && custom.nextReviewDate.trim()
      ? custom.nextReviewDate.trim()
      : null;

  return {
    owner,
    nextReviewDate,
  };
}

type RetrievalScoreScale = "normalized" | "raw_rank";

type AccessControlLike = Partial<DocumentAccessControl> | null | undefined;

export const DOCUMENT_CLASSIFICATION_META: Record<
  DocumentClassification,
  {
    label: string;
    description: string;
    tone: "neutral" | "info" | "caution" | "sensitive";
  }
> = {
  internal: {
    label: "Internal",
    description: "Standard content for the current domain.",
    tone: "neutral",
  },
  confidential: {
    label: "Confidential",
    description:
      "Business-sensitive content for a narrower operating audience.",
    tone: "info",
  },
  restricted: {
    label: "Restricted",
    description: "Sensitive material that should stay within named groups.",
    tone: "caution",
  },
  privileged: {
    label: "Privileged",
    description: "Legal or regulated content with tight access controls.",
    tone: "sensitive",
  },
};

function normalizedPrincipals(values?: string[] | null): string[] {
  if (!Array.isArray(values)) return [];
  return values.map(value => value?.trim()).filter(Boolean) as string[];
}

function joinSummary(values: string[], maxItems = 2): string {
  if (values.length <= maxItems) return values.join(", ");
  const visible = values.slice(0, maxItems);
  return `${visible.join(", ")} +${values.length - maxItems} more`;
}

export function getDocumentClassificationMeta(
  classification?: DocumentClassification | null
) {
  return DOCUMENT_CLASSIFICATION_META[classification ?? "internal"];
}

export function isSensitiveDocumentClassification(
  classification?: DocumentClassification | null
): boolean {
  return classification === "restricted" || classification === "privileged";
}

export function summarizeAccessControl(
  accessControl?: AccessControlLike,
  options?: {
    emptyLabel?: string;
    maxItems?: number;
    userLabels?: Record<string, string>;
  }
): string {
  const userLabels = options?.userLabels ?? {};
  const allowedUsers = normalizedPrincipals(accessControl?.allowedUsers).map(
    value => userLabels[value] ?? `user:${value}`
  );
  const allowedGroups = normalizedPrincipals(accessControl?.allowedGroups);
  const deniedUsers = normalizedPrincipals(accessControl?.deniedUsers).map(
    value => userLabels[value] ?? `user:${value}`
  );
  const deniedGroups = normalizedPrincipals(accessControl?.deniedGroups);
  const maxItems = options?.maxItems ?? 2;

  const allowed = [...allowedGroups, ...allowedUsers];
  const denied = [...deniedGroups, ...deniedUsers];

  if (!allowed.length && !denied.length) {
    return options?.emptyLabel ?? "Uses normal domain access";
  }

  if (allowed.length && !denied.length) {
    return `Allowed: ${joinSummary(allowed, maxItems)}`;
  }

  if (!allowed.length && denied.length) {
    return `Denied: ${joinSummary(denied, maxItems)}`;
  }

  return `Allowed: ${joinSummary(allowed, maxItems)} · Denied: ${joinSummary(denied, maxItems)}`;
}

export function hasExplicitAccessControl(
  accessControl?: AccessControlLike
): boolean {
  return (
    normalizedPrincipals(accessControl?.allowedUsers).length > 0 ||
    normalizedPrincipals(accessControl?.allowedGroups).length > 0 ||
    normalizedPrincipals(accessControl?.deniedUsers).length > 0 ||
    normalizedPrincipals(accessControl?.deniedGroups).length > 0
  );
}

export function getDocumentClassificationValue(doc: {
  classification?: DocumentClassification | null;
  metadata?: { classification?: DocumentClassification | null } | null;
}): DocumentClassification {
  return doc.classification ?? doc.metadata?.classification ?? "internal";
}

export function getDocumentAccessControlValue(doc: {
  accessControl?: AccessControlLike;
  metadata?: { accessControl?: AccessControlLike } | null;
}): DocumentAccessControl | undefined {
  const accessControl = doc.accessControl ?? doc.metadata?.accessControl;
  if (!accessControl) return undefined;

  return {
    allowedUsers: normalizedPrincipals(accessControl.allowedUsers),
    allowedGroups: normalizedPrincipals(accessControl.allowedGroups),
    deniedUsers: normalizedPrincipals(accessControl.deniedUsers),
    deniedGroups: normalizedPrincipals(accessControl.deniedGroups),
  };
}

export function isLikelyLegalStream(
  streamId?: string | null,
  streamName?: string | null
): boolean {
  const haystack = `${streamId ?? ""} ${streamName ?? ""}`.toLowerCase();
  return /(^|[^a-z])legal([^a-z]|$)/.test(haystack);
}

export function isNormalizedRetrievalScore(
  score: number | null | undefined,
  scale?: RetrievalScoreScale | null
): score is number {
  if (scale === "normalized") {
    return typeof score === "number" && Number.isFinite(score);
  }
  if (scale === "raw_rank") {
    return false;
  }
  return (
    typeof score === "number" &&
    Number.isFinite(score) &&
    score >= 0 &&
    score <= 1
  );
}

export function getRetrievalScorePercent(
  score: number | null | undefined,
  scale?: RetrievalScoreScale | null
): number | null {
  if (!isNormalizedRetrievalScore(score, scale)) return null;
  return Math.round(Math.max(0, Math.min(score, 1)) * 100);
}

export function formatRetrievalScore(
  score: number | null | undefined,
  scale?: RetrievalScoreScale | null
): string {
  const numericScore =
    typeof score === "number" && Number.isFinite(score) ? score : null;
  if (numericScore === null) return "0";
  const percent = getRetrievalScorePercent(numericScore, scale);
  if (percent !== null) {
    return `${percent}%`;
  }
  return numericScore >= 10 ? numericScore.toFixed(1) : numericScore.toFixed(2);
}

export function getRetrievalScoreTone(
  score: number | null | undefined,
  scale?: RetrievalScoreScale | null
): "high" | "medium" | "low" | "neutral" {
  if (!isNormalizedRetrievalScore(score, scale)) return "neutral";
  if (score >= 0.8) return "high";
  if (score >= 0.5) return "medium";
  return "low";
}
