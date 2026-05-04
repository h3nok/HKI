import {
  CheckCircle,
  Clock,
  FileText,
  RotateCcw,
  Send,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReviewRecord } from "@shared/knowledge-types";

export type QueueView =
  | "pending_review"
  | "approved"
  | "needs_changes"
  | "published";

export type DetailView = "overview" | "checks" | "notes";

export interface ReviewStatusMeta {
  icon: LucideIcon;
  color: string;
  bg: string;
  border: string;
  label: string;
}

export interface QueueViewMeta {
  label: string;
  emoji: string;
  helper: string;
  emptyTitle: string;
  emptyDescription: string;
}

export interface ReviewStatusGuide {
  title: string;
  body: string;
  next: string;
}

export interface ReviewDetailMetaField {
  label: string;
  value: string;
}

export type ReviewQueueCounts = Record<QueueView, number>;

export const STATUS_META: Record<string, ReviewStatusMeta> = {
  draft: {
    icon: FileText,
    color: "text-muted-foreground",
    bg: "bg-muted",
    border: "border-border",
    label: "Draft",
  },
  pending_review: {
    icon: Clock,
    color: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/20",
    label: "Waiting For Review",
  },
  approved: {
    icon: CheckCircle,
    color: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/20",
    label: "Ready To Publish",
  },
  rejected: {
    icon: XCircle,
    color: "text-destructive",
    bg: "bg-destructive/10",
    border: "border-destructive/20",
    label: "Rejected",
  },
  revision_requested: {
    icon: RotateCcw,
    color: "text-amber-700 dark:text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    label: "Needs Changes",
  },
  published: {
    icon: Send,
    color: "text-emerald-700 dark:text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    label: "Live",
  },
};

export const QUEUE_VIEW_META: Record<QueueView, QueueViewMeta> = {
  pending_review: {
    label: "⏳ Waiting review",
    emoji: "⏳",
    helper:
      "Work the newest submissions first. Each item here needs a manager decision.",
    emptyTitle: "No items waiting for review",
    emptyDescription:
      "Ingest content, then submit it for review. Items land here once submitted.",
  },
  approved: {
    label: "✅ Ready to publish",
    emoji: "✅",
    helper:
      "These items are already approved. Publishing is the last step before they go live.",
    emptyTitle: "Nothing ready to publish",
    emptyDescription:
      "Approve items from the waiting queue, then publish them here.",
  },
  needs_changes: {
    label: "🔄 Needs changes",
    emoji: "🔄",
    helper:
      "These items were sent back or rejected and need updates before they can move forward.",
    emptyTitle: "All clear 👍",
    emptyDescription: "No items need changes right now.",
  },
  published: {
    label: "🟢 Recently live",
    emoji: "🟢",
    helper:
      "Use this view to confirm what is already published and available in answers.",
    emptyTitle: "Nothing published yet",
    emptyDescription:
      "Content will appear here once it has been approved and published.",
  },
};

export const REVIEW_STATUS_GUIDE: Record<string, ReviewStatusGuide> = {
  pending_review: {
    title: "⏳ Waiting for a review decision",
    body: "This content has been submitted, but no manager has approved it yet.",
    next: "Review it and choose approve, request changes, or reject.",
  },
  approved: {
    title: "✅ Approved but not live yet",
    body: "The content passed review, but it will not show up in answers until it is published.",
    next: "Publish it to make it available in the knowledge base.",
  },
  revision_requested: {
    title: "🔄 Sent back for changes",
    body: "The reviewer asked for updates before this can move forward.",
    next: "Update the content, then resubmit it for review.",
  },
  rejected: {
    title: "🚫 Stopped during review",
    body: "This content was rejected and will not go live in its current form.",
    next: "Update it if needed, then resubmit it for review.",
  },
  published: {
    title: "🟢 Live in the knowledge base",
    body: "This content is approved and published, so it can now support answers.",
    next: "Archive it later if it should no longer be used.",
  },
};

export function getQueueViewForRecord(record: ReviewRecord): QueueView {
  if (record.status === "approved") return "approved";
  if (record.status === "published") return "published";
  if (record.status === "rejected" || record.status === "revision_requested") {
    return "needs_changes";
  }
  return "pending_review";
}

export function getDefaultQueueView(
  recordsByView: Record<QueueView, ReviewRecord[]>
): QueueView {
  if (recordsByView.pending_review.length > 0) return "pending_review";
  if (recordsByView.approved.length > 0) return "approved";
  if (recordsByView.needs_changes.length > 0) return "needs_changes";
  if (recordsByView.published.length > 0) return "published";
  return "pending_review";
}

export function formatDateTime(
  value: string | null | undefined,
  fallback: string
): string {
  return value ? new Date(value).toLocaleString() : fallback;
}

export function formatRecordMeta(record: ReviewRecord): string {
  if (record.status === "pending_review") {
    if (record.submittedAt) {
      return `Submitted ${new Date(record.submittedAt).toLocaleDateString()}${
        record.submittedBy ? ` by ${record.submittedBy}` : ""
      }`;
    }
    return record.submittedBy
      ? `Submitted by ${record.submittedBy}`
      : "Waiting for a reviewer";
  }

  if (record.status === "approved") {
    return record.reviewedBy
      ? `Approved by ${record.reviewedBy}`
      : "Approved and waiting to be published";
  }

  if (record.status === "published") {
    return record.publishedAt
      ? `Published ${new Date(record.publishedAt).toLocaleDateString()}`
      : "Published";
  }

  if (record.status === "revision_requested") {
    return record.reviewedBy
      ? `Changes requested by ${record.reviewedBy}`
      : "Changes requested";
  }

  if (record.status === "rejected") {
    return record.reviewedBy ? `Rejected by ${record.reviewedBy}` : "Rejected";
  }

  return record.updatedAt
    ? `Updated ${new Date(record.updatedAt).toLocaleDateString()}`
    : "Recently updated";
}

export function buildDetailMeta(record: ReviewRecord): ReviewDetailMetaField[] {
  return [
    {
      label: "Submitted by",
      value: record.submittedBy || "Not captured",
    },
    {
      label: "Reviewed by",
      value: record.reviewedBy || "Not reviewed yet",
    },
    {
      label: "Submitted",
      value: formatDateTime(record.submittedAt, "Not submitted yet"),
    },
    {
      label: "Last updated",
      value: formatDateTime(record.updatedAt, "Unknown"),
    },
    {
      label: "Department",
      value: record.department || "General",
    },
    {
      label: "Source",
      value: record.sourceRef || record.documentId || "Not available",
    },
  ];
}
