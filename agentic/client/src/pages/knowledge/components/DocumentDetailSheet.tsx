/**
 * Document Detail Sheet — Full document view with version control
 *
 * Opens as a slide-over panel from the Library. Shows:
 *   - Document header with status badge & actions
 *   - Content preview
 *   - Metadata (editable)
 *   - Version history timeline
 *   - Lifecycle management (archive, reprocess)
 */

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Hash,
  Calendar,
  Tag,
  Loader2,
  Trash2,
  Archive,
  CheckCircle,
  Clock,
  AlertTriangle,
  GitCommitVertical,
  History,
  Plus,
  Pencil,
  Minus,
  Equal,
  Copy,
  Settings,
  RotateCw,
  ArrowUpDown,
  Download,
  Globe,
  RefreshCw,
  Save,
  X,
  Check,
  Send,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";
import {
  cn,
  Button,
  Badge,
  Input,
  Label,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Separator,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  ScrollArea,
  useNotifications,
} from "@hki/ui";
import { usePermissions } from "@/_core/hooks/usePermissions";
import { trpc } from "@/lib/trpc";
import type { KnowledgeTab } from "../types";
import {
  getDocumentAccessControlValue,
  getDocumentClassificationMeta,
  getDocumentClassificationValue,
  getDocumentLifecycleMetadata,
  getFreshness,
  hasExplicitAccessControl,
  summarizeAccessControl,
} from "../types";
import { k } from "../theme";
import type {
  DocumentAccessControl,
  DocumentClassification,
  DocumentVersion,
  DocumentStatus,
  DiffResponse,
  DiffLine,
} from "@shared/knowledge-types";
import { isSearchableDocumentStatus } from "@shared/knowledge-types";
import { getEffectiveDocumentStatus } from "./document-review-status";

// ── Types ────────────────────────────────────────────────────────────────────

interface DocumentDetailSheetProps {
  documentId: string | null;
  selectedStream?: string;
  reviewStatusOverride?: string;
  onClose: () => void;
  onNavigate?: (tab: KnowledgeTab, section?: string) => void;
}

type DetailTab = "overview" | "versions" | "settings";

// ── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  DocumentStatus | "stale" | "approved",
  { label: string; color: string; bg: string; icon: LucideIcon }
> = {
  pending: {
    label: "Pending",
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/10",
    icon: Clock,
  },
  processing: {
    label: "Processing",
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-500/10",
    icon: Loader2,
  },
  pending_review: {
    label: "Pending Review",
    color: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-500/10",
    icon: ShieldAlert,
  },
  approved: {
    label: "Ready to Publish",
    color: "text-primary",
    bg: "bg-primary/10",
    icon: CheckCircle,
  },
  indexed: {
    label: "Active",
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/10",
    icon: CheckCircle,
  },
  published: {
    label: "Published",
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/10",
    icon: CheckCircle,
  },
  failed: {
    label: "Failed",
    color: "text-destructive",
    bg: "bg-destructive/10",
    icon: AlertTriangle,
  },
  archived: {
    label: "Archived",
    color: "text-muted-foreground",
    bg: "bg-muted",
    icon: Archive,
  },
  stale: {
    label: "Stale",
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/10",
    icon: AlertTriangle,
  },
};

function getDocDisplayStatus(
  doc: any,
  reviewStatusOverride?: string
): DocumentStatus | "stale" | "approved" {
  const effectiveStatus = getEffectiveDocumentStatus(
    doc.status,
    reviewStatusOverride
  );

  if (effectiveStatus === "approved") return "approved";
  if (effectiveStatus === "archived") return "archived";
  if (effectiveStatus === "failed") return "failed";
  if (effectiveStatus === "processing") return "processing";
  if (effectiveStatus === "pending") return "pending";
  if (effectiveStatus === "pending_review") return "pending_review";
  if (effectiveStatus === "published") {
    const freshness = getFreshness(doc.updatedAt || doc.createdAt || null);
    return freshness.label === "Stale" ? "stale" : "published";
  }

  // indexed — check freshness
  const freshness = getFreshness(doc.updatedAt || doc.createdAt || null);
  if (freshness.label === "Stale") return "stale";
  return "indexed";
}

function listToCsv(values?: string[] | null): string {
  return Array.isArray(values) ? values.join(", ") : "";
}

function parsePrincipalCsv(value: string): string[] {
  return value
    .split(",")
    .map(token => token.trim())
    .filter(Boolean);
}

function toDateInputValue(value: string | null): string {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

function formatLifecycleDate(value: string | null): string {
  if (!value) return "Not scheduled";
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value}T12:00:00Z`
    : value;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ── Version history change icons ─────────────────────────────────────────────

const CHANGE_ICON: Record<string, typeof Plus> = {
  new: Plus,
  modified: Pencil,
  unchanged: Minus,
};

const CHANGE_COLOR: Record<string, { text: string; bg: string }> = {
  new: { text: "text-primary", bg: "bg-primary/10" },
  modified: { text: "text-amber-500", bg: "bg-amber-500/10" },
  unchanged: { text: "text-muted-foreground", bg: "bg-muted" },
};

// ── Diff line styling ──────────────────────────────────────────────────────────────

const DIFF_LINE_STYLES: Record<
  string,
  { bg: string; border: string; text: string; marker: string }
> = {
  added: {
    bg: "bg-primary/4 dark:bg-primary/8",
    border: "border-l-primary",
    text: "text-primary dark:text-primary",
    marker: "+",
  },
  removed: {
    bg: "bg-red-500/4 dark:bg-red-500/8",
    border: "border-l-red-500",
    text: "text-red-700 dark:text-red-300",
    marker: "-",
  },
  unchanged: {
    bg: "",
    border: "border-l-transparent",
    text: "text-muted-foreground",
    marker: " ",
  },
};

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

export default function DocumentDetailSheet({
  documentId,
  selectedStream,
  reviewStatusOverride,
  onClose,
  onNavigate,
}: DocumentDetailSheetProps) {
  const { hasPermission } = usePermissions();
  const { notify } = useNotifications();
  const utils = trpc.useUtils();
  const canWrite = hasPermission("knowledge:write");
  const canManage = hasPermission("knowledge:manage");
  const meQ = trpc.auth.me.useQuery(undefined, {
    retry: false,
    staleTime: 60_000,
  });
  const currentUserId = meQ.data?.id ? String(meQ.data.id) : undefined;
  const scopedInput = selectedStream ? { valueStreamId: selectedStream } : {};

  const docQ = trpc.knowledge.getDocument.useQuery(
    { documentId: documentId!, ...scopedInput },
    { enabled: !!documentId, retry: false }
  );

  const historyQ = trpc.knowledge.versionHistory.useQuery(
    { sourceRef: documentId! },
    { enabled: !!documentId, retry: false }
  );

  const deleteMut = trpc.knowledge.deleteDocument.useMutation({
    onSuccess: () => {
      notify({
        title: "Document deleted",
        severity: "info",
        group: "knowledge",
      });
      utils.knowledge.listDocuments.invalidate();
      utils.knowledge.stats.invalidate();
      onClose();
    },
    onError: (e: any) =>
      notify({
        title: "Delete failed",
        description: e.message,
        severity: "error",
        group: "knowledge",
      }),
  });

  const updateStatusMut = trpc.knowledge.updateDocumentStatus.useMutation({
    onSuccess: data => {
      const label =
        data.status === "archived"
          ? "Archived"
          : data.status === "indexed"
            ? "Restored"
            : "Updated";
      notify({
        title: `Document ${label.toLowerCase()}`,
        severity: "success",
        group: "knowledge",
      });
      utils.knowledge.listDocuments.invalidate();
      utils.knowledge.stats.invalidate();
      utils.knowledge.getDocument.invalidate({
        documentId: documentId!,
        ...scopedInput,
      });
    },
    onError: (e: any) =>
      notify({
        title: "Status update failed",
        description: e.message,
        severity: "error",
        group: "knowledge",
      }),
  });

  const reprocessMut = trpc.knowledge.reprocessDocument.useMutation({
    onSuccess: data => {
      notify({
        title: "Reprocessing started",
        description: data.message,
        severity: "success",
        group: "knowledge",
      });
      utils.knowledge.getDocument.invalidate({
        documentId: documentId!,
        ...scopedInput,
      });
      utils.knowledge.listDocuments.invalidate();
    },
    onError: (e: any) =>
      notify({
        title: "Reprocess failed",
        description: e.message,
        severity: "error",
        group: "knowledge",
      }),
  });

  const refreshMut = trpc.knowledge.refreshDocument.useMutation({
    onSuccess: data => {
      notify({
        title: data.contentChanged ? "Content updated" : "No changes detected",
        description: data.message,
        severity: data.contentChanged ? "success" : "info",
        group: "knowledge",
      });
      if (data.contentChanged) {
        utils.knowledge.getDocument.invalidate({
          documentId: documentId!,
          ...scopedInput,
        });
        utils.knowledge.listDocuments.invalidate();
      }
    },
    onError: (e: any) =>
      notify({
        title: "Refresh failed",
        description: e.message,
        severity: "error",
        group: "knowledge",
      }),
  });

  const updateMetadataMut = trpc.knowledge.updateDocumentMetadata.useMutation({
    onSuccess: data => {
      notify({
        title: "Metadata updated",
        description: `Updated: ${data.updatedFields.join(", ")}`,
        severity: "success",
        group: "knowledge",
      });
      utils.knowledge.getDocument.invalidate({
        documentId: documentId!,
        ...scopedInput,
      });
      utils.knowledge.listDocuments.invalidate();
    },
    onError: (e: any) =>
      notify({
        title: "Metadata update failed",
        description: e.message,
        severity: "error",
        group: "knowledge",
      }),
  });

  const submitReviewMut = trpc.knowledge.reviewSubmit.useMutation({
    onSuccess: () => {
      notify({
        title: "Submitted for review",
        description: "This document is now in the review queue.",
        severity: "success",
        group: "knowledge",
      });
      utils.knowledge.reviewListAll.invalidate();
      utils.knowledge.reviewListPending.invalidate();
    },
    onError: (e: any) =>
      notify({
        title: "Submit for review failed",
        description: e.message,
        severity: "error",
        group: "knowledge",
      }),
  });

  const doc = docQ.data;
  const versions = historyQ.data?.versions ?? [];

  return (
    <Sheet open={!!documentId} onOpenChange={open => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl p-0 flex flex-col"
      >
        {/* Always-present title satisfies Radix a11y requirement (SheetContent = DialogContent internally). Visible title is inside DocumentContent when doc is loaded. */}
        <SheetTitle className="sr-only">Document detail</SheetTitle>
        <SheetDescription className="sr-only">
          Document metadata, version history, and lifecycle actions.
        </SheetDescription>
        {docQ.isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : !doc ? (
          <div className="flex-1 flex items-center justify-center">
            <p className={cn(k.muted, "text-sm")}>Document not found</p>
          </div>
        ) : (
          <DocumentContent
            doc={doc}
            displayStatus={getDocDisplayStatus(doc, reviewStatusOverride)}
            documentId={documentId!}
            versions={versions}
            versionsLoading={historyQ.isLoading}
            onDelete={() => {
              if (
                confirm(
                  `Delete "${doc.title || "this document"}"? This cannot be undone.`
                )
              ) {
                deleteMut.mutate({ documentId: documentId!, ...scopedInput });
              }
            }}
            isDeleting={deleteMut.isPending}
            onArchive={() =>
              updateStatusMut.mutate({
                documentId: documentId!,
                status: doc.status === "archived" ? "indexed" : "archived",
                ...scopedInput,
              })
            }
            isUpdatingStatus={updateStatusMut.isPending}
            onReprocess={(chunkSize?: number, chunkOverlap?: number) =>
              reprocessMut.mutate({
                documentId: documentId!,
                ...scopedInput,
                ...(chunkSize ? { chunkSize } : {}),
                ...(chunkOverlap !== undefined ? { chunkOverlap } : {}),
              })
            }
            isReprocessing={reprocessMut.isPending}
            onRefresh={(chunkSize?: number, chunkOverlap?: number) =>
              refreshMut.mutate({
                documentId: documentId!,
                ...scopedInput,
                ...(chunkSize ? { chunkSize } : {}),
                ...(chunkOverlap !== undefined ? { chunkOverlap } : {}),
              })
            }
            isRefreshing={refreshMut.isPending}
            onUpdateMetadata={fields =>
              updateMetadataMut.mutate({
                documentId: documentId!,
                ...scopedInput,
                ...fields,
              })
            }
            isUpdatingMetadata={updateMetadataMut.isPending}
            canWrite={canWrite}
            canManage={canManage}
            onSubmitReview={() => {
              if (!doc.title?.trim()) {
                notify({
                  title: "Title required",
                  description:
                    "Add a document title before submitting for review.",
                  severity: "warning",
                  group: "knowledge",
                });
                return;
              }
              submitReviewMut.mutate({
                documentId: documentId!,
                streamId: selectedStream,
                title: doc.title,
                department: doc.department,
                tags: doc.metadata?.tags ?? [],
                sourceRef: doc.id,
              });
            }}
            isSubmittingReview={submitReviewMut.isPending}
            selectedStream={selectedStream}
            currentUserId={currentUserId}
            onNavigate={
              onNavigate
                ? (tab, section) => {
                    onClose();
                    window.setTimeout(() => onNavigate(tab, section), 60);
                  }
                : undefined
            }
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

// ── Document Content ─────────────────────────────────────────────────────────

function DocumentContent({
  doc,
  displayStatus,
  documentId,
  selectedStream,
  versions,
  versionsLoading,
  onDelete,
  isDeleting,
  onArchive,
  isUpdatingStatus,
  onReprocess,
  isReprocessing,
  onRefresh,
  isRefreshing,
  onUpdateMetadata,
  isUpdatingMetadata,
  canWrite,
  canManage,
  onSubmitReview,
  isSubmittingReview,
  currentUserId,
  onNavigate,
}: {
  doc: any;
  displayStatus: DocumentStatus | "stale" | "approved";
  documentId: string;
  selectedStream?: string;
  versions: DocumentVersion[];
  versionsLoading: boolean;
  onDelete: () => void;
  isDeleting: boolean;
  onArchive: () => void;
  isUpdatingStatus: boolean;
  onReprocess: (chunkSize?: number, chunkOverlap?: number) => void;
  isReprocessing: boolean;
  onRefresh: (chunkSize?: number, chunkOverlap?: number) => void;
  isRefreshing: boolean;
  onUpdateMetadata: (fields: {
    title?: string;
    department?: string;
    documentType?: string;
    tags?: string[];
    sourceUrl?: string;
    classification?: DocumentClassification;
    accessControl?: DocumentAccessControl;
    custom?: Record<string, unknown>;
  }) => void;
  isUpdatingMetadata: boolean;
  canWrite: boolean;
  canManage: boolean;
  onSubmitReview: () => void;
  isSubmittingReview: boolean;
  currentUserId?: string;
  onNavigate?: (tab: KnowledgeTab, section?: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");
  const status = displayStatus;
  const statusCfg = STATUS_CONFIG[status];
  const StatusIcon = statusCfg.icon;
  const classification = getDocumentClassificationValue(doc);
  const classificationMeta = getDocumentClassificationMeta(classification);
  const accessControl = getDocumentAccessControlValue(doc);
  const canSubmitForReview = canWrite && isSearchableDocumentStatus(doc.status);
  const accessSummary = summarizeAccessControl(accessControl, {
    emptyLabel: "Uses normal stream access",
    userLabels: currentUserId ? { [currentUserId]: "You" } : undefined,
  });

  const handleCopyId = () => {
    navigator.clipboard.writeText(doc.id);
  };

  const TABS: { key: DetailTab; label: string }[] = [
    { key: "overview", label: "Overview" },
    {
      key: "versions",
      label: `Versions${versions.length > 0 ? ` (${versions.length})` : ""}`,
    },
    ...(canWrite ? [{ key: "settings" as DetailTab, label: "Settings" }] : []),
  ];

  return (
    <>
      {/* ── Header ── */}
      <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/30 space-y-0">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
            <FileText className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <SheetTitle className="text-base font-bold text-foreground leading-tight">
              {doc.title || "Untitled Document"}
            </SheetTitle>
            <SheetDescription className="mt-1 flex items-center gap-2 flex-wrap">
              <span
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold",
                  statusCfg.bg,
                  statusCfg.color
                )}
              >
                <StatusIcon className="w-3 h-3" />
                {statusCfg.label}
              </span>
              {doc.department && (
                <span className="text-xs text-muted-foreground">
                  {doc.department}
                </span>
              )}
              {doc.documentType && doc.documentType !== "general" && (
                <Badge variant="secondary" className="text-xs">
                  {doc.documentType}
                </Badge>
              )}
              <Badge
                data-testid="kb-document-classification-badge"
                variant="outline"
                className={cn(
                  "text-xs",
                  classification === "privileged" &&
                    "border-red-500/20 bg-red-500/8 text-red-600 dark:text-red-400",
                  classification === "restricted" &&
                    "border-amber-500/20 bg-amber-500/8 text-amber-600 dark:text-amber-400",
                  classification === "confidential" &&
                    "border-primary/20 bg-primary/8 text-primary"
                )}
              >
                {classificationMeta.label}
              </Badge>
              <span
                data-testid="kb-document-access-summary"
                className="text-xs text-muted-foreground"
              >
                {accessSummary}
              </span>
              {canSubmitForReview && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onSubmitReview}
                  disabled={isSubmittingReview}
                  title="Submit this document for manager review before publishing"
                  className="h-7 text-xs gap-1 text-primary border-primary/20 kb-duotone-bg-hover"
                >
                  {isSubmittingReview ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Send className="w-3 h-3" />
                  )}
                  Submit for Review
                </Button>
              )}
            </SheetDescription>
          </div>
        </div>
      </SheetHeader>

      {/* ── Tab Switcher ── */}
      <div className="flex items-center border-b border-border/30 px-6">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium transition-colors relative",
              activeTab === tab.key
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
            {activeTab === tab.key && (
              <motion.div
                layoutId="doc-tab-indicator"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full"
              />
            )}
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      <ScrollArea className="flex-1">
        <div className="px-6 py-5 space-y-5">
          <AnimatePresence mode="wait">
            {activeTab === "overview" && (
              <motion.div
                key="overview"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-5"
              >
                <OverviewSection
                  doc={doc}
                  onCopyId={handleCopyId}
                  onUpdateMetadata={onUpdateMetadata}
                  canWrite={canWrite}
                  canManage={canManage}
                  currentUserId={currentUserId}
                  displayStatus={status}
                  onNavigate={onNavigate}
                />
              </motion.div>
            )}
            {activeTab === "versions" && (
              <motion.div
                key="versions"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-4"
              >
                <VersionsSection
                  versions={versions}
                  isLoading={versionsLoading}
                />
              </motion.div>
            )}
            {canWrite && activeTab === "settings" && (
              <motion.div
                key="settings"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-4"
              >
                <SettingsSection
                  doc={doc}
                  documentId={documentId}
                  selectedStream={selectedStream}
                  onDelete={onDelete}
                  isDeleting={isDeleting}
                  onArchive={onArchive}
                  isUpdatingStatus={isUpdatingStatus}
                  onReprocess={onReprocess}
                  isReprocessing={isReprocessing}
                  onRefresh={onRefresh}
                  isRefreshing={isRefreshing}
                  onUpdateMetadata={onUpdateMetadata}
                  isUpdatingMetadata={isUpdatingMetadata}
                  currentUserId={currentUserId}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </ScrollArea>
    </>
  );
}

// ── Overview Section ─────────────────────────────────────────────────────────

function OverviewSection({
  doc,
  displayStatus,
  onCopyId,
  onUpdateMetadata,
  canWrite,
  canManage,
  currentUserId,
  onNavigate,
}: {
  doc: any;
  displayStatus: DocumentStatus | "stale" | "approved";
  onCopyId: () => void;
  onUpdateMetadata: (fields: {
    title?: string;
    department?: string;
    documentType?: string;
    tags?: string[];
    sourceUrl?: string;
    classification?: DocumentClassification;
    accessControl?: DocumentAccessControl;
    custom?: Record<string, unknown>;
  }) => void;
  canWrite: boolean;
  canManage: boolean;
  currentUserId?: string;
  onNavigate?: (tab: KnowledgeTab, section?: string) => void;
}) {
  const [addingTag, setAddingTag] = useState(false);
  const [newTag, setNewTag] = useState("");
  const classification = getDocumentClassificationValue(doc);
  const classificationMeta = getDocumentClassificationMeta(classification);
  const accessControl = getDocumentAccessControlValue(doc);
  const lifecycle = getDocumentLifecycleMetadata(doc);
  const accessSummary = summarizeAccessControl(accessControl, {
    emptyLabel: "Uses normal stream access",
    userLabels: currentUserId ? { [currentUserId]: "You" } : undefined,
  });

  const handleAddTag = () => {
    const tag = newTag.trim();
    if (!tag) return;
    const existing = doc.metadata?.tags ?? [];
    if (!existing.includes(tag)) {
      onUpdateMetadata({ tags: [...existing, tag] });
    }
    setNewTag("");
    setAddingTag(false);
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const existing: string[] = doc.metadata?.tags ?? [];
    onUpdateMetadata({
      tags: existing.filter((t: string) => t !== tagToRemove),
    });
  };
  const nextStepCopy =
    displayStatus === "pending_review"
      ? {
          title: "This document is waiting for reviewer approval",
          description:
            "Keep the content details here, then move to Review & Publish to approve or request changes before broader rollout.",
          primaryLabel: "Review & publish",
          primaryTarget: ["govern", "review"] as const,
          secondaryLabel: "Test answers",
          secondaryTarget: ["validate", "test"] as const,
        }
      : displayStatus === "approved"
        ? {
            title: "This document is approved and waiting to be published",
            description:
              "The review decision is complete. Publish it from Review & Publish to make it live in answers.",
            primaryLabel: "Review & publish",
            primaryTarget: ["govern", "review"] as const,
            secondaryLabel: "Test answers",
            secondaryTarget: ["validate", "test"] as const,
          }
      : {
          title: "This document is ready for production-style testing",
          description:
            "Now ask the questions your team will actually ask and verify the cited sources before broad rollout.",
          primaryLabel: "Test answers",
          primaryTarget: ["validate", "test"] as const,
          secondaryLabel: "Review & publish",
          secondaryTarget: ["govern", "review"] as const,
        };
  return (
    <>
      {canManage && onNavigate && (
        <div className={cn(k.card, "p-4 space-y-3")}>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p className={cn(k.label, "text-xs")}>Next step</p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {nextStepCopy.title}
              </p>
              <p className={cn(k.muted, "mt-1 leading-5")}>
                {nextStepCopy.description}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  onNavigate(
                    nextStepCopy.secondaryTarget[0],
                    nextStepCopy.secondaryTarget[1]
                  )
                }
                data-testid="kb-document-next-secondary"
              >
                {nextStepCopy.secondaryLabel}
              </Button>
              <Button
                size="sm"
                onClick={() =>
                  onNavigate(
                    nextStepCopy.primaryTarget[0],
                    nextStepCopy.primaryTarget[1]
                  )
                }
                data-testid="kb-document-next-primary"
              >
                {nextStepCopy.primaryLabel}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className={cn(k.card, "p-4 space-y-3")}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className={cn(k.label, "text-xs")}>Security & Access</p>
            <p className={cn(k.muted, "mt-1 leading-5")}>
              Classification controls how sensitive this document is treated.
              Access rules narrow who can retrieve or cite it.
            </p>
          </div>
          <Badge
            variant="outline"
            className={cn(
              classification === "privileged" &&
                "border-red-500/20 bg-red-500/8 text-red-600 dark:text-red-400",
              classification === "restricted" &&
                "border-amber-500/20 bg-amber-500/8 text-amber-600 dark:text-amber-400",
              classification === "confidential" &&
                "border-primary/20 bg-primary/8 text-primary"
            )}
          >
            {classificationMeta.label}
          </Badge>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-border/30 bg-muted/15 px-3 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Classification
            </p>
            <p className="mt-2 text-sm font-semibold text-foreground">
              {classificationMeta.label}
            </p>
            <p className={cn(k.muted, "mt-1 leading-5")}>
              {classificationMeta.description}
            </p>
          </div>
          <div className="rounded-xl border border-border/30 bg-muted/15 px-3 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Access
            </p>
            <p className="mt-2 text-sm font-semibold text-foreground">
              {accessSummary}
            </p>
            <p className={cn(k.muted, "mt-1 leading-5")}>
              {hasExplicitAccessControl(accessControl)
                ? "Named groups restrict retrieval, citations, and grounded answers."
                : "This document currently relies on the stream boundary only."}
            </p>
          </div>
        </div>
      </div>

      {/* Metadata grid */}
      <div className={cn(k.card, "p-4 space-y-3")}>
        <MetaRow
          icon={Hash}
          label="Document ID"
          value={
            <span className="flex items-center gap-1.5">
              <span className="font-mono text-xs truncate max-w-48">
                {doc.id}
              </span>
              <button
                onClick={onCopyId}
                className="p-0.5 rounded hover:bg-muted transition-colors"
                title="Copy ID"
              >
                <Copy className="w-3 h-3 text-muted-foreground" />
              </button>
            </span>
          }
        />
        <MetaRow
          icon={Calendar}
          label="Created"
          value={
            doc.createdAt
              ? new Date(doc.createdAt).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })
              : "—"
          }
        />
        {doc.updatedAt && doc.updatedAt !== doc.createdAt && (
          <MetaRow
            icon={Calendar}
            label="Updated"
            value={new Date(doc.updatedAt).toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          />
        )}
        <MetaRow
          icon={FileText}
          label="Chunks"
          value={`${doc.chunkCount ?? 0} chunks indexed`}
        />
        {doc.department && (
          <MetaRow icon={Tag} label="Department" value={doc.department} />
        )}
        {doc.documentType && (
          <MetaRow
            icon={Tag}
            label="Type"
            value={
              doc.documentType.charAt(0).toUpperCase() +
              doc.documentType.slice(1)
            }
          />
        )}
        <MetaRow
          icon={Tag}
          label="Owner"
          value={lifecycle.owner || "Unassigned"}
        />
        <MetaRow
          icon={Calendar}
          label="Next Review"
          value={formatLifecycleDate(lifecycle.nextReviewDate)}
        />
      </div>

      {/* Tags */}
      <div className={cn(k.card, "p-4")}>
        <p className={cn(k.label, "text-xs mb-2")}>Tags</p>
        <div className="flex flex-wrap gap-1.5">
          {doc.metadata?.tags?.length > 0 ? (
            doc.metadata.tags.map((t: string) => (
              <Badge key={t} variant="secondary" className="text-xs group/tag">
                {t}
                {canWrite ? (
                  <button
                    onClick={() => handleRemoveTag(t)}
                    className="ml-1 opacity-0 group-hover/tag:opacity-100 transition-opacity hover:text-destructive"
                    title={`Remove "${t}"`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                ) : null}
              </Badge>
            ))
          ) : (
            <span className={cn(k.muted, "text-xs italic")}>No tags</span>
          )}
          {canWrite && addingTag ? (
            <span className="flex items-center gap-1">
              <input
                autoFocus
                value={newTag}
                onChange={e => setNewTag(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") handleAddTag();
                  if (e.key === "Escape") {
                    setAddingTag(false);
                    setNewTag("");
                  }
                }}
                placeholder="tag name"
                className="w-24 h-6 px-1.5 text-xs rounded border border-primary bg-background outline-none"
              />
              <button
                onClick={handleAddTag}
                className="p-0.5 text-primary/80 kb-duotone-text-hover"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  setAddingTag(false);
                  setNewTag("");
                }}
                className="p-0.5 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ) : canWrite ? (
            <button
              onClick={() => setAddingTag(true)}
              className="px-2 py-0.5 rounded-md text-xs font-medium border border-dashed border-border/30 text-muted-foreground/60 kb-duotone-text-hover kb-duotone-border-hover-strong transition-colors"
            >
              + Add tag
            </button>
          ) : null}
        </div>
      </div>

      {/* Content Preview */}
      <div className={cn(k.card, "p-4")}>
        <div className="flex items-center justify-between mb-2">
          <p className={cn(k.label, "text-xs")}>Content Preview</p>
        </div>
        {doc.contentPreview ? (
          <div
            className={cn(
              "p-4 rounded-lg border border-border/50",
              "bg-muted/30 dark:bg-muted/20",
              "text-sm text-foreground leading-relaxed",
              "max-h-64 overflow-y-auto whitespace-pre-wrap"
            )}
          >
            {doc.contentPreview}
          </div>
        ) : (
          <div
            className={cn(
              "p-4 rounded-lg border border-border/50 bg-muted/30",
              "flex items-center justify-center text-sm",
              k.muted
            )}
          >
            No preview available
          </div>
        )}
      </div>
    </>
  );
}

// ── Versions Section ─────────────────────────────────────────────────────────

function VersionsSection({
  versions,
  isLoading,
}: {
  versions: DocumentVersion[];
  isLoading: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [diff, setDiff] = useState<DiffResponse | null>(null);
  const { notify } = useNotifications();

  const diffMut = trpc.knowledge.computeDiff.useMutation({
    onSuccess: (d: DiffResponse) => setDiff(d),
    onError: (e: any) =>
      notify({
        title: "Diff failed",
        description: e.message,
        severity: "error",
        group: "versioning",
      }),
  });

  const handleSelectVersion = (v: DocumentVersion) => {
    if (selectedId === v.id) {
      setSelectedId(null);
      setDiff(null);
      return;
    }
    setSelectedId(v.id);
    setDiff(null);

    // Auto-compute diff against the previous version
    const idx = versions.findIndex(ver => ver.id === v.id);
    if (idx < versions.length - 1) {
      const older = versions[idx + 1];
      diffMut.mutate({
        oldText: `Version ${older.version} (${older.changeType})\nWords: ${older.fingerprint.wordCount}\nHash: ${older.fingerprint.sha256}\nDate: ${older.createdAt}`,
        newText: `Version ${v.version} (${v.changeType})\nWords: ${v.fingerprint.wordCount}\nHash: ${v.fingerprint.sha256}\nDate: ${v.createdAt}`,
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    );
  }

  if (versions.length === 0) {
    return (
      <div className="text-center py-12 space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto">
          <GitCommitVertical className="w-6 h-6 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">
            No version history
          </p>
          <p className={cn(k.muted, "text-xs mt-1 max-w-xs mx-auto")}>
            Re-ingest this document to create new versions. Each ingestion
            creates an immutable snapshot you can compare.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-primary" />
          <h4 className={cn(k.heading, "font-semibold")}>
            {versions.length} version{versions.length !== 1 ? "s" : ""}
          </h4>
        </div>
        {versions.length > 0 && (
          <div className="flex items-center gap-2">
            <span className={cn(k.muted, "text-xs")}>
              Latest: v{versions[0].version}
            </span>
            <span
              className={cn(
                "px-1.5 py-0.5 text-xs font-semibold rounded uppercase tracking-wider",
                CHANGE_COLOR[versions[0].changeType]?.bg ?? "bg-muted",
                CHANGE_COLOR[versions[0].changeType]?.text ??
                  "text-muted-foreground"
              )}
            >
              {versions[0].changeType}
            </span>
          </div>
        )}
      </div>

      {/* Version timeline */}
      <div className="relative ml-2">
        {/* Vertical connector line */}
        <div className="absolute left-3.5 top-5 bottom-5 w-px bg-border" />

        <div className="space-y-0.5">
          {versions.map((v, i) => {
            const Icon = CHANGE_ICON[v.changeType] ?? Hash;
            const colors = CHANGE_COLOR[v.changeType] ?? CHANGE_COLOR.unchanged;
            const date = new Date(v.createdAt);
            const isLatest = i === 0;
            const isSelected = selectedId === v.id;
            const wordDelta =
              i < versions.length - 1
                ? v.fingerprint.wordCount -
                  versions[i + 1].fingerprint.wordCount
                : v.fingerprint.wordCount;

            return (
              <div key={v.id}>
                <button
                  onClick={() => handleSelectVersion(v)}
                  className={cn(
                    "w-full flex items-start gap-3 px-2 py-2.5 rounded-lg relative transition-all text-left",
                    isSelected
                      ? "bg-primary/6 dark:bg-primary/10 ring-1 ring-primary/20"
                      : "hover:bg-muted/50"
                  )}
                >
                  {/* Icon dot */}
                  <div
                    className={cn(
                      "flex items-center justify-center w-7 h-7 rounded-full shrink-0 z-10",
                      isSelected ? "bg-primary/20" : colors.bg
                    )}
                  >
                    <Icon
                      className={cn(
                        "w-3.5 h-3.5",
                        isSelected ? "text-primary" : colors.text
                      )}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-foreground">
                        v{v.version}
                      </span>
                      <span
                        className={cn(
                          "px-1.5 py-0.5 text-xs font-semibold rounded uppercase tracking-wider",
                          colors.bg,
                          colors.text
                        )}
                      >
                        {v.changeType}
                      </span>
                      {isLatest && (
                        <Badge variant="default" className="text-xs py-0">
                          Latest
                        </Badge>
                      )}
                      {wordDelta !== 0 && i > 0 && (
                        <span
                          className={cn(
                            "text-xs font-semibold tabular-nums",
                            wordDelta > 0 ? "text-primary" : "text-red-500"
                          )}
                        >
                          {wordDelta > 0 ? "+" : ""}
                          {wordDelta} words
                        </span>
                      )}
                    </div>

                    {v.diffSummary && (
                      <p className={cn(k.muted, "text-xs mt-0.5 truncate")}>
                        {v.diffSummary}
                      </p>
                    )}

                    <div className="flex items-center gap-3 mt-1">
                      <span className={cn(k.muted, "text-xs")}>
                        {date.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                      <span className={cn(k.muted, "text-xs")}>
                        {date.toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                      {v.fingerprint?.wordCount != null && (
                        <span className={cn(k.muted, "text-xs tabular-nums")}>
                          {v.fingerprint.wordCount.toLocaleString()} words
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Expand indicator */}
                  <ArrowUpDown
                    className={cn(
                      "w-3.5 h-3.5 shrink-0 mt-1 transition-colors",
                      isSelected ? "text-primary" : "text-muted-foreground/30"
                    )}
                  />
                </button>

                {/* Inline diff panel */}
                <AnimatePresence>
                  {isSelected && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="ml-12 mr-2 mb-2">
                        <InlineDiffPanel
                          version={v}
                          previousVersion={
                            i < versions.length - 1 ? versions[i + 1] : null
                          }
                          diff={diff}
                          isLoading={diffMut.isPending}
                          isFirstVersion={i === versions.length - 1}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Inline Diff Panel ────────────────────────────────────────────────────────

function InlineDiffPanel({
  version,
  previousVersion,
  diff,
  isLoading,
  isFirstVersion,
}: {
  version: DocumentVersion;
  previousVersion: DocumentVersion | null;
  diff: DiffResponse | null;
  isLoading: boolean;
  isFirstVersion: boolean;
}) {
  if (isFirstVersion) {
    return (
      <div className={cn(k.inset, "p-4 text-center space-y-2")}>
        <Plus className="w-5 h-5 text-primary mx-auto" />
        <p className="text-sm font-semibold text-foreground">Initial version</p>
        <p className={cn(k.muted, "text-xs")}>
          {version.fingerprint.wordCount.toLocaleString()} words ingested
        </p>
        <div className="flex items-center justify-center gap-4 pt-1">
          <FingerprintStat
            label="SHA-256"
            value={version.fingerprint.sha256.slice(0, 12) + "…"}
            mono
          />
          <FingerprintStat
            label="Content length"
            value={version.fingerprint.contentLength.toLocaleString()}
          />
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div
        className={cn(k.inset, "p-6 flex items-center justify-center gap-2")}
      >
        <Loader2 className="w-4 h-4 animate-spin text-primary" />
        <span className={cn(k.muted, "text-xs")}>Computing diff…</span>
      </div>
    );
  }

  if (!diff) {
    return (
      <div className={cn(k.inset, "p-4")}>
        <div className="grid grid-cols-2 gap-4">
          <ComparisonColumn
            label={`v${previousVersion?.version ?? "??"}`}
            version={previousVersion}
          />
          <ComparisonColumn
            label={`v${version.version}`}
            version={version}
            isCurrent
          />
        </div>
      </div>
    );
  }

  return (
    <div className={cn(k.inset, "overflow-hidden")}>
      {/* Diff stats bar */}
      <div className="flex items-center gap-4 px-4 py-2.5 border-b border-border/50">
        <span className="flex items-center gap-1 text-xs font-semibold text-primary">
          <Plus className="w-3 h-3" /> {diff.stats.addedCount} added
        </span>
        <span className="flex items-center gap-1 text-xs font-semibold text-red-500">
          <Minus className="w-3 h-3" /> {diff.stats.removedCount} removed
        </span>
        <span className="flex items-center gap-1 text-xs text-muted-foreground/60">
          <Equal className="w-3 h-3" /> {diff.stats.unchangedCount} unchanged
        </span>

        {/* Visual change bar */}
        {diff.stats.addedCount + diff.stats.removedCount > 0 && (
          <div className="flex items-center h-1.5 rounded-full overflow-hidden flex-1 max-w-24 bg-muted/60">
            <div
              className="h-full bg-primary"
              style={{
                width: `${(diff.stats.addedCount / (diff.stats.addedCount + diff.stats.removedCount + diff.stats.unchangedCount)) * 100}%`,
              }}
            />
            <div
              className="h-full bg-red-500"
              style={{
                width: `${(diff.stats.removedCount / (diff.stats.addedCount + diff.stats.removedCount + diff.stats.unchangedCount)) * 100}%`,
              }}
            />
          </div>
        )}
      </div>

      {/* Diff lines */}
      <div className="max-h-64 overflow-y-auto font-mono text-[11px] leading-5">
        {diff.lines.length === 0 ? (
          <div className="text-center py-6 text-xs text-muted-foreground/60">
            No differences found
          </div>
        ) : (
          diff.lines.map((line: DiffLine, i: number) => {
            const style =
              DIFF_LINE_STYLES[line.type] ?? DIFF_LINE_STYLES.unchanged;
            return (
              <div
                key={i}
                className={cn(
                  "flex items-start border-l-2",
                  style.bg,
                  style.border
                )}
              >
                <span className="w-8 shrink-0 text-right pr-2 py-0.5 text-xs text-muted-foreground/40 select-none">
                  {line.lineNumber ?? ""}
                </span>
                <span
                  className={cn(
                    "w-4 shrink-0 text-center py-0.5 select-none",
                    style.text
                  )}
                >
                  {style.marker}
                </span>
                <span
                  className={cn(
                    "flex-1 py-0.5 pr-3 whitespace-pre-wrap break-all",
                    style.text
                  )}
                >
                  {line.content || "\u00A0"}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ── Comparison columns (fallback when diff not computed) ─────────────────────

function ComparisonColumn({
  label,
  version,
  isCurrent,
}: {
  label: string;
  version: DocumentVersion | null;
  isCurrent?: boolean;
}) {
  if (!version) return null;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <span
          className={cn(
            "text-xs font-bold",
            isCurrent ? "text-primary" : "text-muted-foreground"
          )}
        >
          {label}
        </span>
        {isCurrent && (
          <Badge variant="default" className="text-xs py-0">
            Current
          </Badge>
        )}
      </div>
      <FingerprintStat
        label="Words"
        value={version.fingerprint.wordCount.toLocaleString()}
      />
      <FingerprintStat
        label="Hash"
        value={version.fingerprint.sha256.slice(0, 12) + "…"}
        mono
      />
      <FingerprintStat
        label="Date"
        value={new Date(version.createdAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })}
      />
    </div>
  );
}

function FingerprintStat({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <span className={cn(k.muted, "text-xs")}>{label}</span>
      <p
        className={cn(
          "text-xs font-semibold text-foreground",
          mono && "font-mono"
        )}
      >
        {value}
      </p>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SETTINGS TAB
// ══════════════════════════════════════════════════════════════════════════════

function SettingsSection({
  doc,
  documentId,
  selectedStream,
  onDelete,
  isDeleting,
  onArchive,
  isUpdatingStatus,
  onReprocess,
  isReprocessing,
  onRefresh,
  isRefreshing,
  onUpdateMetadata,
  isUpdatingMetadata,
  currentUserId,
}: {
  doc: any;
  documentId: string;
  selectedStream?: string;
  onDelete: () => void;
  isDeleting: boolean;
  onArchive: () => void;
  isUpdatingStatus: boolean;
  onReprocess: (chunkSize?: number, chunkOverlap?: number) => void;
  isReprocessing: boolean;
  onRefresh: (chunkSize?: number, chunkOverlap?: number) => void;
  isRefreshing: boolean;
  onUpdateMetadata: (fields: {
    title?: string;
    department?: string;
    documentType?: string;
    tags?: string[];
    sourceUrl?: string;
    classification?: DocumentClassification;
    accessControl?: DocumentAccessControl;
    custom?: Record<string, unknown>;
  }) => void;
  isUpdatingMetadata: boolean;
  currentUserId?: string;
}) {
  const { notify } = useNotifications();
  const isArchived = doc.status === "archived";
  const hasSourceUrl = !!doc.metadata?.sourceUrl || !!doc.sourceUrl;
  const lifecycle = getDocumentLifecycleMetadata(doc);

  // ── Metadata editing state ──
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(doc.title ?? "");
  const [editDept, setEditDept] = useState(doc.department ?? "");
  const [editType, setEditType] = useState(doc.documentType ?? "general");
  const [editTags, setEditTags] = useState(
    (doc.metadata?.tags ?? []).join(", ")
  );
  const currentAccessControl = getDocumentAccessControlValue(doc);
  const [editClassification, setEditClassification] =
    useState<DocumentClassification>(getDocumentClassificationValue(doc));
  const [editAllowedGroups, setEditAllowedGroups] = useState(
    listToCsv(currentAccessControl?.allowedGroups)
  );
  const [editDeniedGroups, setEditDeniedGroups] = useState(
    listToCsv(currentAccessControl?.deniedGroups)
  );
  const [editOwner, setEditOwner] = useState(lifecycle.owner ?? "");
  const [editNextReviewDate, setEditNextReviewDate] = useState(
    toDateInputValue(lifecycle.nextReviewDate)
  );

  useEffect(() => {
    setEditTitle(doc.title ?? "");
    setEditDept(doc.department ?? "");
    setEditType(doc.documentType ?? "general");
    setEditTags((doc.metadata?.tags ?? []).join(", "));
    setEditClassification(getDocumentClassificationValue(doc));
    const nextLifecycle = getDocumentLifecycleMetadata(doc);
    const nextAccessControl = getDocumentAccessControlValue(doc);
    setEditAllowedGroups(listToCsv(nextAccessControl?.allowedGroups));
    setEditDeniedGroups(listToCsv(nextAccessControl?.deniedGroups));
    setEditOwner(nextLifecycle.owner ?? "");
    setEditNextReviewDate(toDateInputValue(nextLifecycle.nextReviewDate));
  }, [doc]);

  const handleSaveMetadata = () => {
    const updates: Record<string, any> = {};
    if (editTitle !== (doc.title ?? "")) updates.title = editTitle;
    if (editDept !== (doc.department ?? "")) updates.department = editDept;
    if (editType !== (doc.documentType ?? "general"))
      updates.documentType = editType;
    const newTags = editTags
      .split(",")
      .map((t: string) => t.trim())
      .filter(Boolean);
    const oldTags = doc.metadata?.tags ?? [];
    if (JSON.stringify(newTags) !== JSON.stringify(oldTags))
      updates.tags = newTags;
    const oldClassification = getDocumentClassificationValue(doc);
    if (editClassification !== oldClassification) {
      updates.classification = editClassification;
    }
    const nextAccessControl: DocumentAccessControl = {
      allowedUsers: currentAccessControl?.allowedUsers ?? [],
      deniedUsers: currentAccessControl?.deniedUsers ?? [],
      allowedGroups: parsePrincipalCsv(editAllowedGroups),
      deniedGroups: parsePrincipalCsv(editDeniedGroups),
    };
    const oldAccessControl = currentAccessControl ?? {
      allowedUsers: [],
      allowedGroups: [],
      deniedUsers: [],
      deniedGroups: [],
    };
    if (
      JSON.stringify(nextAccessControl) !== JSON.stringify(oldAccessControl)
    ) {
      updates.accessControl = nextAccessControl;
    }

    const nextCustom: Record<string, unknown> = {};
    if (editOwner.trim() !== (lifecycle.owner ?? "")) {
      nextCustom.owner = editOwner.trim() || null;
    }
    if (editNextReviewDate !== toDateInputValue(lifecycle.nextReviewDate)) {
      nextCustom.nextReviewDate = editNextReviewDate || null;
    }
    if (Object.keys(nextCustom).length > 0) {
      updates.custom = nextCustom;
    }

    if (Object.keys(updates).length === 0) {
      setEditing(false);
      return;
    }
    onUpdateMetadata(updates);
    setEditing(false);
  };

  // ── Export / Download ──
  const contentQ = trpc.knowledge.getDocumentContent.useQuery(
    {
      documentId,
      ...(selectedStream ? { valueStreamId: selectedStream } : {}),
    },
    { enabled: false }
  );

  const handleExport = async () => {
    try {
      const result = await contentQ.refetch();
      if (!result.data) {
        notify({
          title: "Export failed",
          description: "No content returned",
          severity: "error",
          group: "knowledge",
        });
        return;
      }
      const blob = new Blob([result.data.content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(doc.title || "document").replace(/[^a-zA-Z0-9_-]/g, "_")}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      notify({
        title: "Downloaded",
        description: `${result.data.wordCount.toLocaleString()} words exported`,
        severity: "success",
        group: "knowledge",
      });
    } catch (e: any) {
      notify({
        title: "Export failed",
        description: e.message,
        severity: "error",
        group: "knowledge",
      });
    }
  };

  const handleCopyContent = async () => {
    try {
      const result = await contentQ.refetch();
      if (!result.data) return;
      await navigator.clipboard.writeText(result.data.content);
      notify({
        title: "Copied to clipboard",
        description: `${result.data.wordCount.toLocaleString()} words`,
        severity: "success",
        group: "knowledge",
      });
    } catch (e: any) {
      notify({
        title: "Copy failed",
        description: e.message,
        severity: "error",
        group: "knowledge",
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* ── Pipeline Actions ── */}
      <div className={cn(k.card, "p-4")}>
        <p className={cn(k.label, "text-xs mb-3")}>Pipeline Actions</p>
        <div className="space-y-2">
          <ActionRow
            icon={RotateCw}
            title="Reprocess"
            description="Re-chunk and re-embed this document using the current pipeline settings."
            actionLabel="Reprocess"
            onClick={() => onReprocess()}
            isLoading={isReprocessing}
          />
          <ActionRow
            icon={Globe}
            title="Refresh from Source"
            description={
              hasSourceUrl
                ? "Fetch fresh content from the source URL and re-ingest if changed."
                : "No source URL — document was uploaded directly."
            }
            actionLabel="Refresh"
            onClick={hasSourceUrl ? () => onRefresh() : undefined}
            isLoading={isRefreshing}
            disabled={!hasSourceUrl}
          />
        </div>
      </div>

      {/* ── Document Lifecycle ── */}
      <div className={cn(k.card, "p-4")}>
        <p className={cn(k.label, "text-xs mb-3")}>Document Lifecycle</p>
        <div className="space-y-2">
          <ActionRow
            icon={isArchived ? RefreshCw : Archive}
            title={isArchived ? "Restore" : "Archive"}
            description={
              isArchived
                ? "Restore this document to active search results."
                : "Remove from active search results. Can be restored later."
            }
            actionLabel={isArchived ? "Restore" : "Archive"}
            onClick={onArchive}
            isLoading={isUpdatingStatus}
          />
        </div>
      </div>

      {/* ── Metadata Editor ── */}
      <div className={cn(k.card, "p-4")}>
        <div className="flex items-center justify-between mb-3">
          <p className={cn(k.label, "text-xs")}>Metadata</p>
          {!editing ? (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs gap-1 h-7"
              onClick={() => setEditing(true)}
            >
              <Pencil className="w-3 h-3" />
              Edit
            </Button>
          ) : (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs gap-1 h-7"
                onClick={() => setEditing(false)}
              >
                <X className="w-3 h-3" />
                Cancel
              </Button>
              <Button
                variant="default"
                size="sm"
                className="text-xs gap-1 h-7"
                onClick={handleSaveMetadata}
                disabled={isUpdatingMetadata}
              >
                {isUpdatingMetadata ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Check className="w-3 h-3" />
                )}
                Save
              </Button>
            </div>
          )}
        </div>

        {editing ? (
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Title</Label>
              <Input
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                className="mt-1 h-8 text-sm"
                placeholder="Document title"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">
                Department
              </Label>
              <Input
                value={editDept}
                onChange={e => setEditDept(e.target.value)}
                className="mt-1 h-8 text-sm"
                placeholder="e.g. pharmacy, grocery"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">
                Document Type
              </Label>
              <Select value={editType} onValueChange={setEditType}>
                <SelectTrigger className="mt-1 h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="policy">Policy</SelectItem>
                  <SelectItem value="sop">SOP</SelectItem>
                  <SelectItem value="faq">FAQ</SelectItem>
                  <SelectItem value="product_info">Product Info</SelectItem>
                  <SelectItem value="training">Training</SelectItem>
                  <SelectItem value="reference">Reference</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">
                Classification
              </Label>
              <Select
                value={editClassification}
                onValueChange={value =>
                  setEditClassification(value as DocumentClassification)
                }
              >
                <SelectTrigger className="mt-1 h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="internal">Internal</SelectItem>
                  <SelectItem value="confidential">Confidential</SelectItem>
                  <SelectItem value="restricted">Restricted</SelectItem>
                  <SelectItem value="privileged">Privileged</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">
                Tags{" "}
                <span className="text-xs text-muted-foreground/60">
                  (comma-separated)
                </span>
              </Label>
              <Input
                value={editTags}
                onChange={e => setEditTags(e.target.value)}
                className="mt-1 h-8 text-sm"
                placeholder="tag1, tag2, tag3"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">
                Allowed Groups
              </Label>
              <Input
                value={editAllowedGroups}
                onChange={e => setEditAllowedGroups(e.target.value)}
                className="mt-1 h-8 text-sm"
                placeholder="department:legal, role:manager"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">
                Denied Groups
              </Label>
              <Input
                value={editDeniedGroups}
                onChange={e => setEditDeniedGroups(e.target.value)}
                className="mt-1 h-8 text-sm"
                placeholder="role:viewer"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Owner</Label>
              <Input
                value={editOwner}
                onChange={e => setEditOwner(e.target.value)}
                className="mt-1 h-8 text-sm"
                placeholder="e.g. Pharmacy Operations"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">
                Next Review Date
              </Label>
              <Input
                type="date"
                value={editNextReviewDate}
                onChange={e => setEditNextReviewDate(e.target.value)}
                className="mt-1 h-8 text-sm"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <MetaRow
              icon={FileText}
              label="Title"
              value={doc.title || "Untitled"}
            />
            <MetaRow
              icon={Tag}
              label="Department"
              value={doc.department || "—"}
            />
            <MetaRow
              icon={Tag}
              label="Type"
              value={
                doc.documentType
                  ? doc.documentType.charAt(0).toUpperCase() +
                    doc.documentType.slice(1).replace("_", " ")
                  : "General"
              }
            />
            <MetaRow
              icon={ShieldAlert}
              label="Classification"
              value={
                getDocumentClassificationMeta(
                  getDocumentClassificationValue(doc)
                ).label
              }
            />
            <MetaRow
              icon={ShieldAlert}
              label="Access"
              value={summarizeAccessControl(
                getDocumentAccessControlValue(doc),
                {
                  emptyLabel: "Uses normal stream access",
                  userLabels: currentUserId
                    ? { [currentUserId]: "You" }
                    : undefined,
                }
              )}
            />
            <MetaRow
              icon={Tag}
              label="Owner"
              value={lifecycle.owner || "Unassigned"}
            />
            <MetaRow
              icon={Calendar}
              label="Next Review"
              value={formatLifecycleDate(lifecycle.nextReviewDate)}
            />
            <MetaRow
              icon={Tag}
              label="Tags"
              value={
                doc.metadata?.tags?.length > 0 ? (
                  <span className="flex flex-wrap gap-1">
                    {doc.metadata.tags.map((t: string) => (
                      <Badge key={t} variant="secondary" className="text-xs">
                        {t}
                      </Badge>
                    ))}
                  </span>
                ) : (
                  <span className="text-muted-foreground italic">None</span>
                )
              }
            />
            {hasSourceUrl && (
              <MetaRow
                icon={Globe}
                label="Source"
                value={
                  <a
                    href={doc.metadata?.sourceUrl || doc.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline truncate text-xs"
                  >
                    {doc.metadata?.sourceUrl || doc.sourceUrl}
                  </a>
                }
              />
            )}
          </div>
        )}
      </div>

      {/* ── Export / Download ── */}
      <div className={cn(k.card, "p-4")}>
        <p className={cn(k.label, "text-xs mb-3")}>Export</p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-xs gap-1.5"
            onClick={handleExport}
            disabled={contentQ.isFetching}
          >
            {contentQ.isFetching ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            Download as TXT
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-xs gap-1.5"
            onClick={handleCopyContent}
            disabled={contentQ.isFetching}
          >
            <Copy className="w-3.5 h-3.5" />
            Copy Content
          </Button>
        </div>
      </div>

      {/* ── Danger Zone ── */}
      <div
        className={cn(
          "rounded-2xl border border-destructive/20 bg-destructive/4 p-4"
        )}
      >
        <p className="text-xs font-bold uppercase tracking-widest text-destructive/70 mb-3">
          Danger Zone
        </p>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">
              Delete document
            </p>
            <p className={cn(k.muted, "text-xs")}>
              Permanently removes document, all chunks, and version history.
            </p>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={onDelete}
            disabled={isDeleting}
            className="text-xs gap-1.5 shrink-0"
          >
            {isDeleting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}

function ActionRow({
  icon: Icon,
  title,
  description,
  actionLabel,
  onClick,
  isLoading,
  disabled,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel: string;
  onClick?: () => void;
  isLoading?: boolean;
  disabled?: boolean;
}) {
  const isDisabled = disabled || !onClick;
  return (
    <div
      className={cn(
        "flex items-center gap-3 px-3 py-3 rounded-lg border border-border/50 transition-all",
        isDisabled ? "opacity-50" : "kb-duotone-border-hover-soft"
      )}
    >
      <div className="w-8 h-8 rounded-lg bg-primary/8 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className={cn(k.muted, "text-xs")}>{description}</p>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="text-xs shrink-0"
        onClick={onClick}
        disabled={isLoading || isDisabled}
      >
        {isLoading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
        ) : null}
        {actionLabel}
      </Button>
    </div>
  );
}

// ── Shared Components ────────────────────────────────────────────────────────

function MetaRow({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      <span className={cn(k.muted, "text-xs w-20 shrink-0")}>{label}</span>
      <span className="text-sm text-foreground flex-1 min-w-0">{value}</span>
    </div>
  );
}
