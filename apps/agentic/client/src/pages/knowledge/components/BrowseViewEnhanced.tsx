/**
 * Enhanced BrowseView — Knowledge Domain Document Repository
 *
 * Retail-grade features:
 *  - Batch selection & bulk actions (review, delete, tag, reprocess)
 *  - Visual status indicators (Pending Review, Published, Processing, Archived)
 *  - Enhanced filters (Type, Department, Status)
 *  - Compact density mode for large libraries
 */

import {
  memo,
  useState,
  useMemo,
  useRef,
  useEffect,
  useCallback,
  useDeferredValue,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Loader2,
  FileText,
  Trash2,
  Database,
  RefreshCw,
  ChevronDown,
  Hash,
  CheckSquare,
  Square,
  Tags,
  Clock,
  AlertTriangle,
  FileSpreadsheet,
  File,
  CheckCircle,
  MoreHorizontal,
  Play,
  Eye,
  Archive,
  ArchiveRestore,
  X,
  Send,
} from "lucide-react";
import { cn, useNotifications, Button, Badge, Input } from "@hki/ui";
import { trpc } from "@/lib/trpc";
import { useScope } from "@/_core/hooks/useScope";
import { isSearchableDocumentStatus } from "@shared/knowledge-types";
import {
  getDocumentAccessControlValue,
  getDocumentClassificationMeta,
  getDocumentClassificationValue,
  getFreshness,
  hasExplicitAccessControl,
  summarizeAccessControl,
} from "../types";
import { k } from "../theme";
import DocumentDetailSheet from "./DocumentDetailSheet";
import { getEffectiveDocumentStatus } from "./document-review-status";
import { KBSearchBar } from "./kb-primitives";

const KB_FOCUS_DOCUMENT_KEY = "kb-focus-document-id";

const fadeIn = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.2 },
};

function getFileIcon(type: string) {
  const t = (type || "").toLowerCase();
  if (t.includes("pdf"))
    return { icon: FileText, color: "text-red-500", bg: "bg-red-500/10" };
  if (t.includes("excel") || t.includes("csv"))
    return {
      icon: FileSpreadsheet,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    };
  if (t.includes("word") || t.includes("docx"))
    return { icon: FileText, color: "text-blue-500", bg: "bg-blue-500/10" };
  return {
    icon: FileText,
    color: "text-muted-foreground/60",
    bg: "bg-black/5 dark:bg-muted/60",
  };
}

function normalizeDocumentStatus(docStatus: string | null | undefined) {
  return (docStatus || "pending").toLowerCase();
}

function resolveDocumentReviewStreamId(doc: any, selectedStream?: string) {
  return (
    selectedStream || doc?.streamId || doc?.metadata?.streamId || undefined
  );
}

function canSubmitDocumentForReview(doc: any) {
  return isSearchableDocumentStatus(normalizeDocumentStatus(doc?.status));
}

function getDocumentReviewBlocker(doc: any, selectedStream?: string) {
  const docStatus = normalizeDocumentStatus(doc?.status);

  if (docStatus === "archived") {
    return "Archived documents cannot be sent for review.";
  }

  if (docStatus === "pending_review") {
    return "Document is already pending review.";
  }

  if (docStatus === "processing" || docStatus === "pending") {
    return "Document is still processing. Wait for indexing to finish first.";
  }

  if (docStatus === "failed") {
    return "Document failed processing. Reprocess it before sending it for review.";
  }

  if (!doc?.title?.trim()) {
    return "Add a document title before sending it for review.";
  }

  if (!resolveDocumentReviewStreamId(doc, selectedStream)) {
    return "Assign a domain before sending this document for review.";
  }

  return null;
}

function getDocumentStatusDisplay(docStatus: string | null | undefined) {
  const normalizedStatus = normalizeDocumentStatus(docStatus);

  if (normalizedStatus === "approved") {
    return { label: "Ready to Publish", color: "text-primary" };
  }
  if (normalizedStatus === "published") {
    return { label: "Published", color: "text-emerald-600" };
  }
  if (normalizedStatus === "indexed") {
    return { label: "Published", color: "text-emerald-600" };
  }
  if (normalizedStatus === "archived") {
    return { label: "Archived", color: "text-muted-foreground" };
  }
  if (normalizedStatus === "pending_review") {
    return { label: "Pending Review", color: "text-primary" };
  }
  if (normalizedStatus === "processing" || normalizedStatus === "pending") {
    return { label: "Processing", color: "text-blue-600" };
  }
  if (normalizedStatus === "failed") {
    return { label: "Failed", color: "text-red-600" };
  }

  return { label: "Pending Review", color: "text-primary" };
}

type BrowseDocumentRowProps = {
  doc: any;
  displayStatus: string;
  canWrite: boolean;
  selectedStream?: string;
  streamNameById: Map<string, string>;
  isExpanded: boolean;
  isSelected: boolean;
  isOverflowOpen: boolean;
  isAddingInlineTag: boolean;
  inlineTagValue: string;
  detail: any;
  isDetailLoading: boolean;
  submitReviewPending: boolean;
  overflowRef: React.RefObject<HTMLDivElement | null>;
  onToggleExpand: (documentId: string) => void;
  onToggleSelect: (event: React.MouseEvent, documentId: string) => void;
  onToggleOverflow: (event: React.MouseEvent, documentId: string) => void;
  onCloseOverflow: () => void;
  onOpenSheet: (documentId: string) => void;
  onSubmitForReview: (doc: any) => void;
  onReprocess: (documentId: string) => void;
  onToggleArchive: (doc: any) => void;
  onDelete: (doc: any) => void;
  onStartAddTag: (documentId: string) => void;
  onCancelAddTag: () => void;
  onInlineTagChange: (value: string) => void;
  onCommitInlineTag: (doc: any, existingTags: string[]) => void;
  onRemoveTag: (doc: any, existingTags: string[], tag: string) => void;
};

const BrowseDocumentRow = memo(function BrowseDocumentRow({
  doc,
  displayStatus,
  canWrite,
  selectedStream,
  streamNameById,
  isExpanded,
  isSelected,
  isOverflowOpen,
  isAddingInlineTag,
  inlineTagValue,
  detail,
  isDetailLoading,
  submitReviewPending,
  overflowRef,
  onToggleExpand,
  onToggleSelect,
  onToggleOverflow,
  onCloseOverflow,
  onOpenSheet,
  onSubmitForReview,
  onReprocess,
  onToggleArchive,
  onDelete,
  onStartAddTag,
  onCancelAddTag,
  onInlineTagChange,
  onCommitInlineTag,
  onRemoveTag,
}: BrowseDocumentRowProps) {
  const freshness = getFreshness(doc.updatedAt || doc.createdAt);
  const iconInfo = getFileIcon(doc.documentType);
  const Icon = iconInfo.icon;
  const docStreamId = doc.streamId ?? doc.metadata?.streamId ?? null;
  const docStreamName = docStreamId
    ? streamNameById.get(docStreamId) || docStreamId
    : "Shared";
  const classification = getDocumentClassificationValue(doc);
  const classificationMeta = getDocumentClassificationMeta(classification);
  const docStatus = normalizeDocumentStatus(displayStatus);
  const statusDisplay = getDocumentStatusDisplay(docStatus);
  const canReview = canSubmitDocumentForReview(doc);
  const documentTags: string[] =
    detail?.metadata?.tags ?? doc.metadata?.tags ?? [];

  return (
    <div>
      <div
        onClick={() => onToggleExpand(doc.id)}
        className={cn(
          "group w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all cursor-pointer border",
          isSelected
            ? "bg-primary/5 border-primary/30"
            : isExpanded
              ? cn(
                  "bg-card dark:bg-card/80 border-border/30 rounded-b-none shadow-sm"
                )
              : "bg-card dark:bg-card/60 border-transparent hover:border-border/40 dark:hover:border-border/40 hover:shadow-sm"
        )}
      >
        {canWrite ? (
          <button
            onClick={event => onToggleSelect(event, doc.id)}
            className={cn(
              "p-1 -ml-1 transition-opacity duration-150",
              isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            )}
          >
            {isSelected ? (
              <CheckSquare className="w-4 h-4 text-primary" />
            ) : (
              <Square className="w-4 h-4 text-muted-foreground/40 hover:text-muted-foreground/60" />
            )}
          </button>
        ) : null}

        <div
          className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
            iconInfo.bg
          )}
        >
          <Icon className={cn("w-4 h-4", iconInfo.color)} />
        </div>

        <div className="flex-1 min-w-0 pr-4">
          <div className="flex items-center gap-2 min-w-0">
            <p className={cn("font-medium truncate text-[13px]", k.heading)}>
              {doc.title || "Untitled Document"}
            </p>
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {doc.department && (
              <span className={cn("text-[11px]", k.muted)}>
                {doc.department}
              </span>
            )}
            {doc.department && (doc.documentType || !selectedStream) && (
              <span className="text-muted-foreground/30 text-[10px]">·</span>
            )}
            {doc.documentType && doc.documentType !== "general" && (
              <span className={cn("text-[11px]", k.muted)}>
                {doc.documentType}
              </span>
            )}
            {!selectedStream && (
              <>
                {(doc.department ||
                  (doc.documentType && doc.documentType !== "general")) && (
                  <span className="text-muted-foreground/30 text-[10px]">
                    ·
                  </span>
                )}
                <span className={cn("text-[11px]", k.muted)}>
                  {docStreamName}
                </span>
              </>
            )}
            {classification !== "internal" && (
              <span
                className={cn(
                  "text-[10px] font-medium px-1.5 py-0.5 rounded-md",
                  classification === "privileged" &&
                    "bg-red-500/8 text-red-500",
                  classification === "restricted" &&
                    "bg-primary/8 text-primary",
                  classification === "confidential" &&
                    "bg-primary/8 text-primary"
                )}
              >
                {classificationMeta.label}
              </span>
            )}
            {freshness.label === "Stale" && (
              <span className="text-[10px] font-medium text-primary">
                · Needs review
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span
            className={cn(
              "text-[11px] font-medium tabular-nums",
              statusDisplay.color
            )}
          >
            {docStatus === "processing" || docStatus === "pending" ? (
              <span className="flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                Processing
              </span>
            ) : (
              statusDisplay.label
            )}
          </span>
          <div className="flex items-center gap-1">
            <div
              className="relative"
              ref={isOverflowOpen ? overflowRef : undefined}
            >
              <button
                className="p-1.5 rounded-md text-muted-foreground/60 hover:bg-black/5 dark:hover:bg-white/5 hover:text-foreground dark:hover:text-white transition-colors"
                onClick={event => onToggleOverflow(event, doc.id)}
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
              <AnimatePresence>
                {isOverflowOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -4 }}
                    transition={{ duration: 0.12 }}
                    className="absolute right-0 top-full mt-1 z-50 min-w-44 rounded-lg border border-border/30 bg-popover shadow-lg py-1"
                  >
                    <button
                      className="flex items-center gap-2 w-full px-3 py-2 text-[12px] font-medium text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                      onClick={event => {
                        event.stopPropagation();
                        onCloseOverflow();
                        onOpenSheet(doc.id);
                      }}
                    >
                      <Eye className="w-3.5 h-3.5 text-muted-foreground" /> View
                      Details
                    </button>
                    {canWrite ? (
                      <>
                        {canReview && (
                          <button
                            className="flex items-center gap-2 w-full px-3 py-2 text-[12px] font-medium kb-duotone-accent-text kb-duotone-bg-hover transition-colors disabled:opacity-50"
                            disabled={submitReviewPending}
                            onClick={event => {
                              event.stopPropagation();
                              onCloseOverflow();
                              onSubmitForReview(doc);
                            }}
                          >
                            <Send className="w-3.5 h-3.5" /> Submit for Review
                          </button>
                        )}
                        <button
                          className="flex items-center gap-2 w-full px-3 py-2 text-[12px] font-medium text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                          onClick={event => {
                            event.stopPropagation();
                            onCloseOverflow();
                            onReprocess(doc.id);
                          }}
                        >
                          <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
                          Reprocess
                        </button>
                        <button
                          className="flex items-center gap-2 w-full px-3 py-2 text-[12px] font-medium text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                          onClick={event => {
                            event.stopPropagation();
                            onCloseOverflow();
                            onToggleArchive(doc);
                          }}
                        >
                          {(doc.status || "").toLowerCase() === "archived" ? (
                            <>
                              <ArchiveRestore className="w-3.5 h-3.5 text-muted-foreground" />
                              Restore
                            </>
                          ) : (
                            <>
                              <Archive className="w-3.5 h-3.5 text-muted-foreground" />
                              Archive
                            </>
                          )}
                        </button>
                        <div className="my-1 border-t border-border/40" />
                        <button
                          className="flex items-center gap-2 w-full px-3 py-2 text-[12px] font-medium text-red-500 hover:bg-red-500/5 transition-colors"
                          onClick={event => {
                            event.stopPropagation();
                            onCloseOverflow();
                            onDelete(doc);
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                      </>
                    ) : null}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <ChevronDown
              className={cn(
                "w-4 h-4 transition-transform ml-1",
                k.muted,
                isExpanded && "rotate-180"
              )}
            />
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div
              className={cn(
                "bg-white dark:bg-card border border-t-0 border-border/30 rounded-b-xl px-5 pb-5 pt-3 -mt-1"
              )}
            >
              {isDetailLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground/60" />
                </div>
              ) : detail ? (
                <div className="flex gap-6">
                  <div className="w-64 shrink-0 space-y-4 pr-6 border-r border-border/30 dark:border-border/30">
                    <div>
                      <p
                        className={cn(
                          "text-xs font-bold uppercase tracking-wider mb-1",
                          k.muted
                        )}
                      >
                        ID
                      </p>
                      <p
                        className="text-[11px] font-mono text-muted-foreground truncate"
                        title={doc.id}
                      >
                        {doc.id}
                      </p>
                    </div>
                    <div>
                      <p
                        className={cn(
                          "text-xs font-bold uppercase tracking-wider mb-1",
                          k.muted
                        )}
                      >
                        Created
                      </p>
                      <p className="text-[12px] font-medium text-foreground">
                        {detail.createdAt
                          ? new Date(detail.createdAt).toLocaleString()
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <p
                        className={cn(
                          "text-xs font-bold uppercase tracking-wider mb-2",
                          k.muted
                        )}
                      >
                        Security
                      </p>
                      <div className="space-y-2">
                        <div className="rounded-xl border border-border/30 bg-muted/15 px-3 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                            Classification
                          </p>
                          <p className="mt-1 text-[12px] font-semibold text-foreground">
                            {
                              getDocumentClassificationMeta(
                                getDocumentClassificationValue(detail)
                              ).label
                            }
                          </p>
                        </div>
                        <div className="rounded-xl border border-border/30 bg-muted/15 px-3 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                            Access
                          </p>
                          <p className="mt-1 text-[12px] font-medium text-foreground leading-5">
                            {summarizeAccessControl(
                              getDocumentAccessControlValue(detail),
                              {
                                emptyLabel: "Uses normal domain access",
                              }
                            )}
                          </p>
                          {hasExplicitAccessControl(
                            getDocumentAccessControlValue(detail)
                          ) && (
                            <p className="mt-1 text-[11px] text-muted-foreground leading-5">
                              Named groups restrict who can retrieve or cite
                              this document.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div>
                      <p
                        className={cn(
                          "text-xs font-bold uppercase tracking-wider mb-2",
                          k.muted
                        )}
                      >
                        Tags
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {documentTags.length ? (
                          documentTags.map((tag: string) => (
                            <span
                              key={tag}
                              className="group/tag inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs font-medium rounded border border-border/30 bg-muted/50 dark:bg-muted/50 text-muted-foreground"
                            >
                              {tag}
                              {canWrite ? (
                                <button
                                  onClick={event => {
                                    event.stopPropagation();
                                    onRemoveTag(doc, documentTags, tag);
                                  }}
                                  className="opacity-0 group-hover/tag:opacity-100 transition-opacity hover:text-red-500"
                                  title={`Remove "${tag}"`}
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              ) : null}
                            </span>
                          ))
                        ) : (
                          <span className="text-[11px] italic text-muted-foreground/60">
                            No tags
                          </span>
                        )}
                        {canWrite && isAddingInlineTag ? (
                          <span className="inline-flex items-center gap-1">
                            <input
                              autoFocus
                              value={inlineTagValue}
                              onChange={event =>
                                onInlineTagChange(event.target.value)
                              }
                              onKeyDown={event => {
                                if (event.key === "Enter") {
                                  event.stopPropagation();
                                  onCommitInlineTag(doc, documentTags);
                                }
                                if (event.key === "Escape") {
                                  onCancelAddTag();
                                }
                              }}
                              onClick={event => event.stopPropagation()}
                              placeholder="tag"
                              className="w-20 h-5 px-1 text-xs rounded border border-primary bg-background outline-none"
                            />
                          </span>
                        ) : canWrite ? (
                          <button
                            onClick={event => {
                              event.stopPropagation();
                              onStartAddTag(doc.id);
                            }}
                            className="px-1.5 py-0.5 rounded text-xs font-medium border border-dashed border-border/25 dark:border-border/25 text-muted-foreground/60 kb-duotone-text-hover kb-duotone-border-hover-strong transition-colors"
                          >
                            + Add
                          </button>
                        ) : null}
                      </div>
                    </div>

                    {canWrite ? (
                      <div className="pt-2 mt-2 border-t border-border/30 dark:border-border/30">
                        <button
                          onClick={() => onDelete(doc)}
                          className="flex items-center gap-1.5 text-xs font-medium text-red-500 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete Document
                        </button>
                      </div>
                    ) : null}
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col">
                    <div className="flex items-center justify-between mb-2">
                      <p
                        className={cn(
                          "text-xs font-bold uppercase tracking-wider",
                          k.muted
                        )}
                      >
                        Content Preview
                      </p>
                      <button
                        onClick={() => onOpenSheet(doc.id)}
                        className="text-[11px] font-medium text-primary hover:underline"
                      >
                        Open Full Details →
                      </button>
                    </div>
                    {detail.contentPreview ? (
                      <div className="flex-1 min-h-40 p-4 rounded-xl bg-muted dark:bg-card border border-border/50 dark:border-border/50 text-[12px] text-foreground leading-relaxed overflow-y-auto whitespace-pre-wrap font-serif">
                        {detail.contentPreview}
                      </div>
                    ) : (
                      <div className="flex-1 min-h-40 flex items-center justify-center rounded-xl bg-muted dark:bg-card border border-border/50 dark:border-border/50 text-[11px] text-muted-foreground/60">
                        No preview available
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p className={cn("text-xs py-4 text-center", k.muted)}>
                  Could not load details
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}, areBrowseDocumentRowPropsEqual);

function areBrowseDocumentRowPropsEqual(
  prev: Readonly<BrowseDocumentRowProps>,
  next: Readonly<BrowseDocumentRowProps>
) {
  return (
    prev.doc === next.doc &&
    prev.displayStatus === next.displayStatus &&
    prev.canWrite === next.canWrite &&
    prev.selectedStream === next.selectedStream &&
    prev.isExpanded === next.isExpanded &&
    prev.isSelected === next.isSelected &&
    prev.isOverflowOpen === next.isOverflowOpen &&
    prev.isAddingInlineTag === next.isAddingInlineTag &&
    prev.inlineTagValue === next.inlineTagValue &&
    prev.detail === next.detail &&
    prev.isDetailLoading === next.isDetailLoading &&
    prev.submitReviewPending === next.submitReviewPending
  );
}

export default function BrowseViewEnhanced({
  docsQ,
  selectedStream,
  streamLabel,
  canWrite = true,
  showFilters = true,
  reviewStatusByDocumentId,
  focusDocumentId,
  onFocusHandled,
  onNavigate,
  filterText: externalFilterText,
  onFilterChange,
  sortBy: externalSortBy,
  statusFilter: externalStatusFilter,
  onStatusFilterChange,
  onFilteredCountChange,
}: {
  docsQ: any;
  selectedStream?: string;
  streamLabel?: string;
  canWrite?: boolean;
  showFilters?: boolean;
  reviewStatusByDocumentId?: Map<string, string>;
  focusDocumentId?: string;
  onFocusHandled?: () => void;
  onNavigate?: (tab: any, section?: string) => void;
  filterText?: string;
  onFilterChange?: (value: string) => void;
  sortBy?: "title" | "newest" | "oldest" | "status";
  statusFilter?: string;
  onStatusFilterChange?: (value: string) => void;
  onFilteredCountChange?: (count: number) => void;
}) {
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);
  const [internalFilterText, setInternalFilterText] = useState("");
  const filterText = externalFilterText ?? internalFilterText;
  const setFilterText = onFilterChange ?? setInternalFilterText;
  const [internalStatusFilter, setInternalStatusFilter] =
    useState<string>("all");
  const statusFilter = externalStatusFilter ?? internalStatusFilter;
  const setStatusFilter = onStatusFilterChange ?? setInternalStatusFilter;
  const sortBy = externalSortBy ?? "newest";
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  const [sheetDocId, setSheetDocId] = useState<string | null>(null);
  const [overflowDocId, setOverflowDocId] = useState<string | null>(null);
  const [addingTagDocId, setAddingTagDocId] = useState<string | null>(null);
  const [newInlineTag, setNewInlineTag] = useState("");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [batchTagOpen, setBatchTagOpen] = useState(false);
  const [batchTagInput, setBatchTagInput] = useState("");
  const batchTagRef = useRef<HTMLInputElement | null>(null);
  const [batchDeptOpen, setBatchDeptOpen] = useState(false);
  const [batchDeptInput, setBatchDeptInput] = useState("");
  const batchDeptRef = useRef<HTMLInputElement | null>(null);
  const [batchTypeOpen, setBatchTypeOpen] = useState(false);
  const [isBatchSubmittingReview, setIsBatchSubmittingReview] = useState(false);
  const overflowRef = useRef<HTMLDivElement | null>(null);
  const deferredFilterText = useDeferredValue(filterText);

  const utils = trpc.useUtils();
  const { notify } = useNotifications();
  const { availableScopes } = useScope();
  const allDocs = docsQ.data?.documents ?? [];
  const streamNameById = useMemo(
    () => new Map(availableScopes.map(scope => [scope.id, scope.name])),
    [availableScopes]
  );
  const scopedMutationInput = selectedStream
    ? { valueStreamId: selectedStream }
    : {};
  const normalizedFilterText = deferredFilterText.trim().toLowerCase();
  const isFilterPending = filterText !== deferredFilterText;
  const selectedDocumentRows = useMemo(
    () => allDocs.filter((doc: any) => selectedDocs.has(doc.id)),
    [allDocs, selectedDocs]
  );
  const selectedReviewableDocs = useMemo(
    () =>
      selectedDocumentRows.filter((doc: any) =>
        canSubmitDocumentForReview(doc)
      ),
    [selectedDocumentRows]
  );

  useEffect(() => {
    if (canWrite) return;
    setSelectedDocs(new Set());
    setBatchTagOpen(false);
    setBatchDeptOpen(false);
    setBatchTypeOpen(false);
    setAddingTagDocId(null);
    setNewInlineTag("");
  }, [canWrite]);

  useEffect(() => {
    if (showFilters) return;
    setStatusFilter("all");
    setTagFilter(null);
  }, [showFilters]);

  // Fetch all unique tags for the filter dropdown
  const allTagsQ = trpc.knowledge.listAllTags.useQuery(
    selectedStream ? { valueStreamId: selectedStream } : undefined,
    { enabled: showFilters, staleTime: 30_000 }
  );

  // Close overflow menu on outside click
  useEffect(() => {
    if (!overflowDocId) return;
    const handler = (e: MouseEvent) => {
      if (
        overflowRef.current &&
        !overflowRef.current.contains(e.target as Node)
      ) {
        setOverflowDocId(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [overflowDocId]);

  // ── Deep-link: auto-open detail sheet when focusDocumentId is set ──
  useEffect(() => {
    if (focusDocumentId) {
      setSheetDocId(focusDocumentId);
      try {
        window.sessionStorage.removeItem(KB_FOCUS_DOCUMENT_KEY);
      } catch {
        /* noop */
      }
      onFocusHandled?.();
    }
  }, [focusDocumentId, onFocusHandled]);

  useEffect(() => {
    try {
      const pendingDocumentId = window.sessionStorage.getItem(
        KB_FOCUS_DOCUMENT_KEY
      );
      if (pendingDocumentId) {
        setSheetDocId(pendingDocumentId);
        window.sessionStorage.removeItem(KB_FOCUS_DOCUMENT_KEY);
      }
    } catch {
      /* noop */
    }

    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      const documentId =
        typeof detail === "string" ? detail : detail?.documentId;
      if (typeof documentId === "string" && documentId.trim()) {
        setSheetDocId(documentId);
      }
    };
    window.addEventListener("kb-focus-document", handler);
    return () => window.removeEventListener("kb-focus-document", handler);
  }, []);

  const docDetailQ = trpc.knowledge.getDocument.useQuery(
    {
      documentId: expandedDoc!,
      ...(selectedStream ? { valueStreamId: selectedStream } : {}),
    },
    { enabled: !!expandedDoc, retry: false }
  );

  const deleteMut = trpc.knowledge.deleteDocument.useMutation({
    onSuccess: () => {
      notify({
        title: "Document deleted",
        severity: "info",
        group: "knowledge",
      });
      setExpandedDoc(null);
      setSelectedDocs(new Set());
      utils.knowledge.listDocuments.invalidate();
      utils.knowledge.stats.invalidate();
    },
    onError: (e: any) =>
      notify({
        title: "Delete failed",
        description: e.message,
        severity: "error",
        group: "knowledge",
      }),
  });

  const archiveMut = trpc.knowledge.updateDocumentStatus.useMutation({
    onSuccess: (_data, variables) => {
      notify({
        title:
          variables.status === "archived"
            ? "Document archived"
            : "Document restored",
        severity: "info",
        group: "knowledge",
      });
      utils.knowledge.listDocuments.invalidate();
      utils.knowledge.stats.invalidate();
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
    onSuccess: () => {
      notify({
        title: "Document queued for reprocessing",
        severity: "info",
        group: "knowledge",
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

  const submitReviewMut = trpc.knowledge.reviewSubmit.useMutation();

  const updateMetadataMut = trpc.knowledge.updateDocumentMetadata.useMutation({
    onSuccess: () => {
      notify({
        title: "Metadata updated",
        severity: "info",
        group: "knowledge",
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

  const docs = useMemo(() => {
    const filtered = allDocs.filter((doc: any) => {
      // Status filter
      if (statusFilter !== "all") {
        const docStatus = getEffectiveDocumentStatus(
          doc.status,
          reviewStatusByDocumentId?.get(doc.id)
        );
        if (
          statusFilter === "published" &&
          !isSearchableDocumentStatus(docStatus)
        )
          return false;
        if (statusFilter === "approved" && docStatus !== "approved") {
          return false;
        }
        if (statusFilter === "pending_review" && docStatus !== "pending_review")
          return false;
        if (statusFilter === "archived" && docStatus !== "archived")
          return false;
        if (
          statusFilter === "processing" &&
          docStatus !== "pending" &&
          docStatus !== "processing"
        )
          return false;
      }
      // Tag filter
      if (tagFilter) {
        const docTags: string[] = doc.tags ?? doc.metadata?.tags ?? [];
        if (!docTags.includes(tagFilter)) return false;
      }
      // Text filter (also searches tags)
      if (normalizedFilterText) {
        const docTags: string[] = doc.tags ?? doc.metadata?.tags ?? [];
        return (
          (doc.title || "").toLowerCase().includes(normalizedFilterText) ||
          (doc.department || "").toLowerCase().includes(normalizedFilterText) ||
          (doc.documentType || "")
            .toLowerCase()
            .includes(normalizedFilterText) ||
          docTags.some((t: string) =>
            t.toLowerCase().includes(normalizedFilterText)
          )
        );
      }
      return true;
    });

    // Sort
    const STATUS_ORDER: Record<string, number> = {
      pending_review: 0,
      approved: 1,
      processing: 2,
      pending: 3,
      indexed: 4,
      published: 5,
      archived: 6,
    };
    filtered.sort((a: any, b: any) => {
      switch (sortBy) {
        case "title":
          return (a.title || "").localeCompare(b.title || "");
        case "oldest":
          return (
            new Date(a.createdAt || 0).getTime() -
            new Date(b.createdAt || 0).getTime()
          );
        case "status":
          return (
            (STATUS_ORDER[
              getEffectiveDocumentStatus(
                a.status,
                reviewStatusByDocumentId?.get(a.id)
              )
            ] ?? 9) -
            (STATUS_ORDER[
              getEffectiveDocumentStatus(
                b.status,
                reviewStatusByDocumentId?.get(b.id)
              )
            ] ?? 9)
          );
        case "newest":
        default:
          return (
            new Date(b.createdAt || 0).getTime() -
            new Date(a.createdAt || 0).getTime()
          );
      }
    });

    return filtered;
  }, [
    allDocs,
    normalizedFilterText,
    reviewStatusByDocumentId,
    sortBy,
    statusFilter,
    tagFilter,
  ]);

  // Report filtered count back to parent
  useEffect(() => {
    onFilteredCountChange?.(docs.length);
  }, [docs.length, onFilteredCountChange]);

  const total = docsQ.data?.total ?? 0;

  const invalidateReviewSubmissionSurface = useCallback(async () => {
    await Promise.all([
      utils.knowledge.listDocuments.invalidate(),
      utils.knowledge.reviewListAll.invalidate(),
      utils.knowledge.reviewListPending.invalidate(),
      utils.knowledge.stats.invalidate(),
    ]);
  }, [utils]);

  const submitDocumentForReview = useCallback(
    async (doc: any) => {
      const blocker = getDocumentReviewBlocker(doc, selectedStream);

      if (blocker) {
        return {
          ok: false as const,
          severity: "warning" as const,
          message: blocker,
        };
      }

      try {
        await submitReviewMut.mutateAsync({
          documentId: doc.id,
          streamId: resolveDocumentReviewStreamId(doc, selectedStream),
          title: doc.title.trim(),
          department: doc.department,
          tags: doc.tags ?? doc.metadata?.tags ?? [],
          sourceRef: doc.id,
        });

        return { ok: true as const };
      } catch (error: any) {
        return {
          ok: false as const,
          severity: "error" as const,
          message: error?.message ?? "Submit for review failed",
        };
      }
    },
    [selectedStream, submitReviewMut]
  );

  // Batch actions
  const toggleSelectAll = useCallback(() => {
    setSelectedDocs(current => {
      if (current.size === docs.length && docs.length > 0) {
        return new Set();
      }

      return new Set(docs.map((doc: any) => doc.id));
    });
  }, [docs]);

  const toggleSelect = useCallback((event: React.MouseEvent, id: string) => {
    event.stopPropagation();
    setSelectedDocs(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleToggleExpanded = useCallback((documentId: string) => {
    setExpandedDoc(current => (current === documentId ? null : documentId));
  }, []);

  const handleToggleOverflow = useCallback(
    (event: React.MouseEvent, documentId: string) => {
      event.stopPropagation();
      setOverflowDocId(current => (current === documentId ? null : documentId));
    },
    []
  );

  const handleCloseOverflow = useCallback(() => {
    setOverflowDocId(null);
  }, []);

  const handleOpenDocumentSheet = useCallback((documentId: string) => {
    setSheetDocId(documentId);
  }, []);

  const handleSubmitForReview = useCallback(
    (doc: any) => {
      void (async () => {
        const result = await submitDocumentForReview(doc);

        if (!result.ok) {
          notify({
            title:
              result.severity === "warning"
                ? "Cannot send to review"
                : "Send to review failed",
            description: result.message,
            severity: result.severity,
            group: "knowledge",
          });
          return;
        }

        await invalidateReviewSubmissionSurface();
        notify({
          title: "Sent for review",
          description: "Document is now pending review.",
          severity: "success",
          group: "knowledge",
        });
      })();
    },
    [invalidateReviewSubmissionSurface, notify, submitDocumentForReview]
  );

  const handleReprocess = useCallback(
    (documentId: string) => {
      reprocessMut.mutate({
        documentId,
        ...scopedMutationInput,
      });
    },
    [reprocessMut, scopedMutationInput]
  );

  const handleToggleArchive = useCallback(
    (doc: any) => {
      const isArchived = (doc.status || "").toLowerCase() === "archived";
      archiveMut.mutate({
        documentId: doc.id,
        status: isArchived ? "indexed" : "archived",
        ...scopedMutationInput,
      });
    },
    [archiveMut, scopedMutationInput]
  );

  const handleDeleteDocument = useCallback(
    (doc: any) => {
      if (confirm(`Delete "${doc.title || "this document"}"?`)) {
        deleteMut.mutate({
          documentId: doc.id,
          ...scopedMutationInput,
        });
      }
    },
    [deleteMut, scopedMutationInput]
  );

  const handleStartAddingInlineTag = useCallback((documentId: string) => {
    setAddingTagDocId(documentId);
    setNewInlineTag("");
  }, []);

  const handleCancelAddingInlineTag = useCallback(() => {
    setNewInlineTag("");
    setAddingTagDocId(null);
  }, []);

  const handleInlineTagChange = useCallback((value: string) => {
    setNewInlineTag(value);
  }, []);

  const handleCommitInlineTag = useCallback(
    (doc: any, existingTags: string[]) => {
      const nextTag = newInlineTag.trim();
      if (nextTag && !existingTags.includes(nextTag)) {
        updateMetadataMut.mutate({
          documentId: doc.id,
          tags: [...existingTags, nextTag],
          ...scopedMutationInput,
        });
      }
      setNewInlineTag("");
      setAddingTagDocId(null);
    },
    [newInlineTag, scopedMutationInput, updateMetadataMut]
  );

  const handleRemoveTag = useCallback(
    (doc: any, existingTags: string[], tag: string) => {
      updateMetadataMut.mutate({
        documentId: doc.id,
        tags: existingTags.filter((value: string) => value !== tag),
        ...scopedMutationInput,
      });
    },
    [scopedMutationInput, updateMetadataMut]
  );

  const batchDeleteMut = trpc.knowledge.batchDeleteDocuments.useMutation({
    onSuccess: data => {
      notify({
        title: `Deleted ${data.total_deleted} document${data.total_deleted !== 1 ? "s" : ""}`,
        description: data.total_failed
          ? `${data.total_failed} failed to delete`
          : undefined,
        severity: data.total_failed ? "warning" : "info",
        group: "knowledge",
      });
      setSelectedDocs(new Set());
      utils.knowledge.listDocuments.invalidate();
      utils.knowledge.stats.invalidate();
    },
    onError: (e: any) =>
      notify({
        title: "Batch delete failed",
        description: e.message,
        severity: "error",
        group: "knowledge",
      }),
  });

  const handleBatchDelete = () => {
    if (confirm(`Delete ${selectedDocs.size} selected documents?`)) {
      batchDeleteMut.mutate({
        ids: Array.from(selectedDocs),
        ...scopedMutationInput,
      });
    }
  };

  const handleBatchAddTags = () => {
    if (batchTagOpen) {
      // Submit the tags
      const newTags = batchTagInput
        .split(",")
        .map(t => t.trim())
        .filter(Boolean);
      if (newTags.length === 0) {
        setBatchTagOpen(false);
        setBatchTagInput("");
        return;
      }
      const allDocs = docsQ.data?.documents ?? [];
      for (const docId of Array.from(selectedDocs)) {
        const doc = allDocs.find((d: any) => d.id === docId);
        const existing: string[] = doc?.tags ?? doc?.metadata?.tags ?? [];
        const merged = Array.from(new Set([...existing, ...newTags]));
        updateMetadataMut.mutate({
          documentId: docId,
          tags: merged,
          ...scopedMutationInput,
        });
      }
      setBatchTagOpen(false);
      setBatchTagInput("");
    } else {
      // Open the inline input
      setBatchTagOpen(true);
      setTimeout(() => batchTagRef.current?.focus(), 50);
    }
  };

  const handleBatchReprocess = () => {
    if (!confirm(`Reprocess ${selectedDocs.size} selected documents?`)) return;
    for (const docId of Array.from(selectedDocs)) {
      reprocessMut.mutate({ documentId: docId, ...scopedMutationInput });
    }
  };

  const handleBatchSubmitForReview = useCallback(() => {
    void (async () => {
      if (selectedDocumentRows.length === 0 || isBatchSubmittingReview) return;

      setIsBatchSubmittingReview(true);
      let successes = 0;
      let skipped = 0;
      let failures = 0;

      for (const doc of selectedDocumentRows) {
        const result = await submitDocumentForReview(doc);

        if (result.ok) {
          successes += 1;
          continue;
        }

        if (result.severity === "warning") {
          skipped += 1;
        } else {
          failures += 1;
        }
      }

      setIsBatchSubmittingReview(false);
      setSelectedDocs(new Set());

      if (successes > 0) {
        await invalidateReviewSubmissionSurface();
      }

      if (successes === 0 && skipped > 0 && failures === 0) {
        notify({
          title: "No selected documents were ready for review",
          description:
            "Select published documents with a title and domain assignment, then try again.",
          severity: "warning",
          group: "knowledge",
        });
        return;
      }

      notify({
        title: `${successes} document${successes !== 1 ? "s" : ""} sent for review${skipped > 0 ? `, ${skipped} skipped` : ""}${failures > 0 ? `, ${failures} failed` : ""}`,
        severity: skipped > 0 || failures > 0 ? "warning" : "success",
        group: "knowledge",
      });
    })();
  }, [
    invalidateReviewSubmissionSurface,
    isBatchSubmittingReview,
    notify,
    selectedDocumentRows,
    submitDocumentForReview,
  ]);

  const handleBatchSetDept = () => {
    if (batchDeptOpen) {
      const dept = batchDeptInput.trim();
      if (!dept) {
        setBatchDeptOpen(false);
        setBatchDeptInput("");
        return;
      }
      for (const docId of Array.from(selectedDocs)) {
        updateMetadataMut.mutate({
          documentId: docId,
          department: dept,
          ...scopedMutationInput,
        });
      }
      setBatchDeptOpen(false);
      setBatchDeptInput("");
    } else {
      setBatchDeptOpen(true);
      setTimeout(() => batchDeptRef.current?.focus(), 50);
    }
  };

  const handleBatchSetType = (docType: string) => {
    for (const docId of Array.from(selectedDocs)) {
      updateMetadataMut.mutate({
        documentId: docId,
        documentType: docType,
        ...scopedMutationInput,
      });
    }
    setBatchTypeOpen(false);
  };

  return (
    <motion.div {...fadeIn} className="space-y-2">
      {/* ── Batch Toolbar — only visible when at least one doc is selected ── */}
      <div className="flex items-center justify-between px-2 min-h-7">
        {canWrite && selectedDocs.size > 0 ? (
          <button
            onClick={toggleSelectAll}
            className="flex items-center gap-2 text-xs font-medium text-muted-foreground kb-duotone-text-hover transition-colors"
          >
            {selectedDocs.size === docs.length ? (
              <CheckSquare className="w-4 h-4 text-primary" />
            ) : (
              <div className="w-4 h-4 rounded-lg border-2 border-primary bg-primary/20 flex items-center justify-center">
                <div className="w-2 h-0.5 bg-primary rounded-full" />
              </div>
            )}
            {selectedDocs.size} selected
            {selectedReviewableDocs.length > 0 &&
            selectedReviewableDocs.length !== selectedDocs.size ? (
              <span className="text-[11px] text-muted-foreground/70">
                {selectedReviewableDocs.length} ready for review
              </span>
            ) : null}
          </button>
        ) : (
          <span />
        )}

        <AnimatePresence>
          {canWrite && selectedDocs.size > 0 && (
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="flex items-center gap-1.5"
            >
              <Button
                size="sm"
                className="h-8 text-xs gap-1.5"
                onClick={handleBatchSubmitForReview}
                disabled={
                  isBatchSubmittingReview || selectedReviewableDocs.length === 0
                }
              >
                {isBatchSubmittingReview ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                {isBatchSubmittingReview ? "Sending..." : "Send for Review"}
              </Button>
              <div className="relative flex items-center gap-1.5">
                <button
                  onClick={handleBatchAddTags}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium kb-duotone-fill kb-duotone-bg-hover-strong transition-colors"
                >
                  <Tags className="w-3.5 h-3.5" />{" "}
                  {batchTagOpen ? "Apply" : "Add Tags"}
                </button>
                <AnimatePresence>
                  {batchTagOpen && (
                    <motion.div
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: "auto" }}
                      exit={{ opacity: 0, width: 0 }}
                      className="flex items-center gap-1 overflow-hidden"
                    >
                      <input
                        ref={batchTagRef}
                        value={batchTagInput}
                        onChange={e => setBatchTagInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter") handleBatchAddTags();
                          if (e.key === "Escape") {
                            setBatchTagOpen(false);
                            setBatchTagInput("");
                          }
                        }}
                        placeholder="tag1, tag2, ..."
                        className={cn(k.input, "w-40 py-1 px-2 text-xs")}
                      />
                      <button
                        onClick={() => {
                          setBatchTagOpen(false);
                          setBatchTagInput("");
                        }}
                        className="p-1 rounded hover:bg-muted/60 text-muted-foreground/60"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Batch Set Department */}
              <div className="relative flex items-center gap-1.5">
                <button
                  onClick={handleBatchSetDept}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium kb-duotone-fill kb-duotone-bg-hover-strong transition-colors"
                >
                  <Hash className="w-3.5 h-3.5" />{" "}
                  {batchDeptOpen ? "Apply" : "Set Dept"}
                </button>
                <AnimatePresence>
                  {batchDeptOpen && (
                    <motion.div
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: "auto" }}
                      exit={{ opacity: 0, width: 0 }}
                      className="flex items-center gap-1 overflow-hidden"
                    >
                      <input
                        ref={batchDeptRef}
                        value={batchDeptInput}
                        onChange={e => setBatchDeptInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter") handleBatchSetDept();
                          if (e.key === "Escape") {
                            setBatchDeptOpen(false);
                            setBatchDeptInput("");
                          }
                        }}
                        placeholder="e.g. Pharmacy"
                        className={cn(k.input, "w-32 py-1 px-2 text-xs")}
                      />
                      <button
                        onClick={() => {
                          setBatchDeptOpen(false);
                          setBatchDeptInput("");
                        }}
                        className="p-1 rounded hover:bg-muted/60 text-muted-foreground/60"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Batch Set Document Type */}
              <div className="relative">
                <button
                  onClick={() => setBatchTypeOpen(prev => !prev)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium kb-duotone-fill kb-duotone-bg-hover-strong transition-colors"
                >
                  <FileText className="w-3.5 h-3.5" /> Set Type
                  <ChevronDown
                    className={cn(
                      "w-3 h-3 transition-transform",
                      batchTypeOpen && "rotate-180"
                    )}
                  />
                </button>
                <AnimatePresence>
                  {batchTypeOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="absolute top-full left-0 mt-1 z-20 bg-white dark:bg-card border border-border/30 rounded-lg shadow-lg py-1 min-w-30"
                    >
                      {[
                        "general",
                        "policy",
                        "sop",
                        "faq",
                        "training",
                        "report",
                      ].map(t => (
                        <button
                          key={t}
                          onClick={() => handleBatchSetType(t)}
                          className="w-full text-left px-3 py-1.5 text-xs font-medium text-foreground kb-duotone-bg-hover kb-duotone-text-hover transition-colors"
                        >
                          {t.charAt(0).toUpperCase() + t.slice(1)}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <button
                onClick={handleBatchReprocess}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium kb-duotone-fill kb-duotone-bg-hover-strong transition-colors"
              >
                <Play className="w-3.5 h-3.5" /> Reprocess
              </button>
              <Button
                variant="destructive"
                size="sm"
                className="h-8 text-xs gap-1.5"
                onClick={handleBatchDelete}
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Document List ── */}
      {docsQ.isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground/60" />
        </div>
      ) : docs.length === 0 ? (
        <div className="text-center py-24 space-y-3 bg-card/60 dark:bg-card/40 rounded-2xl border border-dashed border-border/50 dark:border-border">
          <Database className="w-10 h-10 text-muted-foreground/40 dark:text-muted-foreground/30 mx-auto" />
          <p className={cn("font-bold", k.heading)}>
            {filterText ? "No matches found" : "No content yet"}
          </p>
          <p className={cn("text-sm max-w-sm mx-auto", k.muted)}>
            {filterText
              ? showFilters
                ? "Try adjusting your search terms or filters."
                : "Try adjusting your search terms."
              : selectedStream
                ? `No documents are available in ${streamLabel || selectedStream} yet. Upload or publish content for this domain to populate the library.`
                : "Upload and process your first documents to get started."}
          </p>
          {!filterText && (
            <Button
              size="sm"
              className="mt-2"
              disabled={!canWrite}
              onClick={() => {
                window.dispatchEvent(
                  new CustomEvent("kb-navigate", { detail: "ingest" })
                );
              }}
            >
              Add Content
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-1">
          {docs.map((doc: any) => (
            <BrowseDocumentRow
              key={doc.id}
              doc={doc}
              displayStatus={getEffectiveDocumentStatus(
                doc.status,
                reviewStatusByDocumentId?.get(doc.id)
              )}
              canWrite={canWrite}
              selectedStream={selectedStream}
              streamNameById={streamNameById}
              isExpanded={expandedDoc === doc.id}
              isSelected={selectedDocs.has(doc.id)}
              isOverflowOpen={overflowDocId === doc.id}
              isAddingInlineTag={addingTagDocId === doc.id}
              inlineTagValue={addingTagDocId === doc.id ? newInlineTag : ""}
              detail={expandedDoc === doc.id ? docDetailQ.data : null}
              isDetailLoading={expandedDoc === doc.id && docDetailQ.isLoading}
              submitReviewPending={
                submitReviewMut.isPending || isBatchSubmittingReview
              }
              overflowRef={overflowRef}
              onToggleExpand={handleToggleExpanded}
              onToggleSelect={toggleSelect}
              onToggleOverflow={handleToggleOverflow}
              onCloseOverflow={handleCloseOverflow}
              onOpenSheet={handleOpenDocumentSheet}
              onSubmitForReview={handleSubmitForReview}
              onReprocess={handleReprocess}
              onToggleArchive={handleToggleArchive}
              onDelete={handleDeleteDocument}
              onStartAddTag={handleStartAddingInlineTag}
              onCancelAddTag={handleCancelAddingInlineTag}
              onInlineTagChange={handleInlineTagChange}
              onCommitInlineTag={handleCommitInlineTag}
              onRemoveTag={handleRemoveTag}
            />
          ))}
        </div>
      )}
      {/* Document Detail Sheet */}
      <DocumentDetailSheet
        documentId={sheetDocId}
        selectedStream={selectedStream}
        reviewStatusOverride={
          sheetDocId ? reviewStatusByDocumentId?.get(sheetDocId) : undefined
        }
        onClose={() => setSheetDocId(null)}
        onNavigate={onNavigate}
      />
    </motion.div>
  );
}
