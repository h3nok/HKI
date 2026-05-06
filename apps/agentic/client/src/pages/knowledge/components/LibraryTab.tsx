/**
 * Library Tab — Browse, organize, and manage all indexed content
 *
 * Sub-views:
 *  - Documents: browse, search, filter, detail view (BrowseViewEnhanced)
 *  - Collections: department-scoped collection CRUD
 *  - Taxonomy: tree management, tag validation
 *  - Graph: interactive entity explorer with force-directed visualization (Neo4j)
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  lazy,
  Suspense,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Database,
  FolderOpen,
  Tags,
  Network,
  Loader2,
  LibraryBig,
  ShieldCheck,
  Landmark,
  Plus,
  Target,
  RefreshCw,
  SlidersHorizontal,
  ArrowUpDown,
} from "lucide-react";
import {
  cn,
  Button,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@hki/ui";
import { useFeatureAccess } from "@/_core/hooks/useFeatureAccess";
import { usePermissions } from "@/_core/hooks/usePermissions";
import {
  canManageKnowledgeWorkspace,
  canWriteKnowledgeWorkspace,
} from "@/_core/access/knowledge";
import { trpc } from "@/lib/trpc";
import type { FeatureFlagKey } from "@shared/feature-flags";
import { isSearchableDocumentStatus } from "@shared/knowledge-types";
import { k } from "../theme";
import type { KnowledgeTab, LibraryView } from "../types";
import {
  KBInfoBanner,
  KBTopBar,
  KBWorkflowBanner,
  KBSearchBar,
} from "./kb-primitives";
import { buildReviewStatusByDocumentId } from "./document-review-status";
import { getAvailableLibraryViews } from "../feature-gates";

// ── Lazy-loaded sub-views (code-split for performance) ──────────────────────
const BrowseViewEnhanced = lazy(() => import("./BrowseViewEnhanced"));
const CollectionsTab = lazy(() => import("./CollectionsTab"));
const TaxonomyTab = lazy(() => import("./TaxonomyTab"));
const EntityGraph = lazy(() => import("./graph/EntityGraph"));

interface SubViewDef {
  key: LibraryView;
  label: string;
  icon: typeof Database;
}

const SUB_VIEWS: SubViewDef[] = [
  { key: "documents", label: "📚 Documents", icon: Database },
  { key: "collections", label: "📁 Collections", icon: FolderOpen },
  { key: "taxonomy", label: "🏷️ Taxonomy", icon: Tags },
  { key: "graph", label: "🔗 Graph", icon: Network },
];

const fadeIn = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.2 },
};

// ── Loading fallback ────────────────────────────────────────────────────────

function SubViewLoader() {
  return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="w-5 h-5 animate-spin text-primary" />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════════════

interface LibraryTabProps {
  docsQ: any;
  selectedStream: string;
  streamLabel: string;
  onStepComplete?: (stepId: string) => void;
  focusDocumentId?: string;
  onFocusHandled?: () => void;
  onNavigate?: (tab: KnowledgeTab, section?: string) => void;
}

export default function LibraryTab({
  docsQ,
  selectedStream,
  streamLabel,
  onStepComplete,
  focusDocumentId,
  onFocusHandled,
  onNavigate,
}: LibraryTabProps) {
  const { role } = usePermissions();
  const { canView: canViewFeature } = useFeatureAccess();
  const isFeatureEnabled = useCallback(
    (key: FeatureFlagKey) => canViewFeature(key),
    [canViewFeature]
  );
  const canWriteKnowledge = canWriteKnowledgeWorkspace(role);
  const canManageKnowledge = canManageKnowledgeWorkspace(role);
  const showLibraryFilters = isFeatureEnabled(
    "release.knowledge.library.filters"
  );
  const showGapAnalysisCallout = isFeatureEnabled(
    "release.knowledge.library.gapAnalysis"
  );
  const availableViews = useMemo(
    () =>
      getAvailableLibraryViews({
        canManageKnowledge,
        isEnabled: isFeatureEnabled,
      }),
    [canManageKnowledge, isFeatureEnabled]
  );
  const visibleSubViews = useMemo(
    () => SUB_VIEWS.filter(subView => availableViews.includes(subView.key)),
    [availableViews]
  );
  const [view, setView] = useState<LibraryView>(
    availableViews[0] ?? "documents"
  );
  const [filterText, setFilterText] = useState("");
  const [sortBy, setSortBy] = useState<
    "title" | "newest" | "oldest" | "status"
  >("newest");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [filteredCount, setFilteredCount] = useState<number | null>(null);
  const utils = trpc.useUtils();
  const explicitStreamId =
    selectedStream && selectedStream !== "global" ? selectedStream : null;
  const rawDocs = docsQ?.data?.documents ?? [];
  const documentInventorySummaryQ =
    trpc.knowledge.documentInventorySummary.useQuery(
      explicitStreamId ? { valueStreamId: explicitStreamId } : undefined,
      {
        retry: false,
        staleTime: 15_000,
        refetchInterval: 60_000,
        enabled: Boolean(explicitStreamId),
      }
    );
  const reviewHistoryQ = trpc.knowledge.reviewListAll.useQuery(
    { limit: 200, valueStreamId: selectedStream || undefined },
    { enabled: canManageKnowledge, retry: false }
  );
  const documentCounts = useMemo(() => {
    if (documentInventorySummaryQ.data) {
      return {
        totalDocumentCount: documentInventorySummaryQ.data.totalDocuments,
        liveDocumentCount: documentInventorySummaryQ.data.liveCount,
        processingDocumentCount: documentInventorySummaryQ.data.processingCount,
        pendingReviewDocCount:
          documentInventorySummaryQ.data.pendingReviewCount,
        archivedDocumentCount: documentInventorySummaryQ.data.archivedCount,
      };
    }

    let liveDocumentCount = 0;
    let processingDocumentCount = 0;
    let pendingReviewDocCount = 0;
    let archivedDocumentCount = 0;

    for (const doc of rawDocs as any[]) {
      if (isSearchableDocumentStatus(doc.status)) {
        liveDocumentCount += 1;
      }

      if (["pending", "processing"].includes(doc.status)) {
        processingDocumentCount += 1;
      }

      if (doc.status === "pending_review") {
        pendingReviewDocCount += 1;
      }

      if (doc.status === "archived") {
        archivedDocumentCount += 1;
      }
    }

    return {
      totalDocumentCount: rawDocs.length,
      liveDocumentCount,
      processingDocumentCount,
      pendingReviewDocCount,
      archivedDocumentCount,
    };
  }, [documentInventorySummaryQ.data, rawDocs]);
  const reviewHistoryCounts = useMemo(() => {
    let approvedReviewHistoryCount = 0;
    let pendingReviewHistoryCount = 0;

    for (const record of (reviewHistoryQ.data ?? []) as any[]) {
      if (record.status === "approved") {
        approvedReviewHistoryCount += 1;
      }
      if (record.status === "pending_review") {
        pendingReviewHistoryCount += 1;
      }
    }

    return {
      approvedReviewHistoryCount,
      pendingReviewHistoryCount,
    };
  }, [reviewHistoryQ.data]);
  const reviewStatusByDocumentId = useMemo(
    () =>
      buildReviewStatusByDocumentId(
        ((reviewHistoryQ.data ?? []) as any[]).map(record => ({
          documentId: record.documentId,
          status: record.status,
        }))
      ),
    [reviewHistoryQ.data]
  );
  const totalDocumentCount = documentCounts.totalDocumentCount;
  const liveDocumentCount = documentCounts.liveDocumentCount;
  const processingDocumentCount = documentCounts.processingDocumentCount;
  const pendingReviewDocCount = documentCounts.pendingReviewDocCount;
  const archivedDocumentCount = documentCounts.archivedDocumentCount;
  const approvedReviewHistoryCount =
    reviewHistoryCounts.approvedReviewHistoryCount;
  const pendingReviewHistoryCount =
    reviewHistoryCounts.pendingReviewHistoryCount;
  const pendingReviewCount = reviewHistoryQ.isSuccess
    ? pendingReviewHistoryCount
    : pendingReviewDocCount;
  const readyToPublishCount = reviewHistoryQ.isSuccess
    ? approvedReviewHistoryCount
    : 0;
  useEffect(() => {
    if (availableViews.includes(view)) return;
    if (availableViews[0]) setView(availableViews[0]);
  }, [availableViews, view]);

  const libraryWorkflow = useMemo(() => {
    if (!canManageKnowledge) {
      if (totalDocumentCount === 0) {
        return {
          statusLabel: canWriteKnowledge
            ? "Add content first"
            : "No documents yet",
          statusTone: "amber" as const,
          title: canWriteKnowledge
            ? "Library is empty"
            : "Nothing to browse yet",
          description: canWriteKnowledge
            ? "Upload or connect a source to seed this domain. New documents will appear here once processing completes."
            : "This domain does not have any indexed documents yet.",
          primaryAction:
            canWriteKnowledge && onNavigate
              ? {
                  label: "Add content",
                  onClick: () => onNavigate("ingest"),
                  icon: Plus,
                  testId: "kb-library-workflow-primary",
                }
              : undefined,
          secondaryAction: undefined,
        };
      }

      if (processingDocumentCount > 0 && liveDocumentCount === 0) {
        return {
          statusLabel: `${processingDocumentCount} still processing`,
          statusTone: "amber" as const,
          title: "Processing in progress",
          description:
            "Documents are still being prepared. They will appear as searchable content once processing finishes.",
          primaryAction: onNavigate
            ? {
                label: "View activity",
                onClick: () => onNavigate("activity"),
                icon: Landmark,
                testId: "kb-library-workflow-primary",
              }
            : undefined,
          secondaryAction:
            canWriteKnowledge && onNavigate
              ? {
                  label: "Add content",
                  onClick: () => onNavigate("ingest"),
                  icon: Plus,
                  tone: "secondary" as const,
                  testId: "kb-library-workflow-secondary",
                }
              : undefined,
        };
      }

      return {
        statusLabel:
          liveDocumentCount > 0
            ? `${liveDocumentCount} live and searchable`
            : `${totalDocumentCount} in library`,
        statusTone:
          liveDocumentCount > 0 ? ("green" as const) : ("blue" as const),
        title: canWriteKnowledge
          ? "Keep content current"
          : "Browse trusted knowledge",
        description: canWriteKnowledge
          ? "Open a document to update metadata, reprocess it, or queue it for review."
          : "Open a document to inspect its metadata, version history, and access settings.",
        primaryAction:
          canWriteKnowledge && onNavigate
            ? {
                label: "Add content",
                onClick: () => onNavigate("ingest"),
                icon: Plus,
                testId: "kb-library-workflow-primary",
              }
            : undefined,
        secondaryAction: undefined,
      };
    }

    if (totalDocumentCount === 0) {
      return {
        statusLabel: "Add content first",
        statusTone: "amber" as const,
        title: "Library is empty",
        description:
          "Use Add Content to upload a source. Processing and indexing run automatically, then searchable documents appear here.",
        primaryAction: onNavigate
          ? {
              label: "Add content",
              onClick: () => onNavigate("ingest"),
              icon: Plus,
              testId: "kb-library-workflow-primary",
            }
          : undefined,
        secondaryAction: undefined,
      };
    }

    if (pendingReviewCount > 0) {
      return {
        statusLabel:
          liveDocumentCount > 0
            ? `${liveDocumentCount} live · ${pendingReviewCount} waiting review`
            : `${pendingReviewCount} waiting review`,
        statusTone: "amber" as const,
        title: "Verify metadata, then complete review",
        description:
          "Check titles and labels — pending docs need sign-off before use.",
        primaryAction: onNavigate
          ? {
              label: "Review queue",
              onClick: () => onNavigate("govern", "review"),
              icon: Landmark,
              testId: "kb-library-workflow-primary",
            }
          : undefined,
        secondaryAction: onNavigate
          ? {
              label: "Test answers",
              onClick: () => onNavigate("validate", "test"),
              icon: ShieldCheck,
              tone: "secondary" as const,
              testId: "kb-library-workflow-secondary",
            }
          : undefined,
      };
    }

    if (approvedReviewHistoryCount > 0) {
      return {
        statusLabel: `${approvedReviewHistoryCount} ready to publish`,
        statusTone: "blue" as const,
        title: "Approved content ready to publish",
        description:
          "Publish approved documents to make them searchable in the domain library.",
        primaryAction: onNavigate
          ? {
              label: "Review queue",
              onClick: () => onNavigate("govern", "review"),
              icon: Landmark,
              testId: "kb-library-workflow-primary",
            }
          : undefined,
        secondaryAction: onNavigate
          ? {
              label: "Test answers",
              onClick: () => onNavigate("validate", "test"),
              icon: ShieldCheck,
              tone: "secondary" as const,
              testId: "kb-library-workflow-secondary",
            }
          : undefined,
      };
    }

    if (processingDocumentCount > 0 && liveDocumentCount === 0) {
      return {
        statusLabel: `${processingDocumentCount} still processing`,
        statusTone: "amber" as const,
        title: "Processing — nothing live yet",
        description:
          "Documents are still processing and indexing. They become searchable here once ready.",
        primaryAction: onNavigate
          ? {
              label: "Processing status",
              onClick: () => onNavigate("activity", "pipelines"),
              icon: Landmark,
              testId: "kb-library-workflow-primary",
            }
          : undefined,
        secondaryAction: onNavigate
          ? {
              label: "Add content",
              onClick: () => onNavigate("ingest"),
              icon: Plus,
              tone: "secondary" as const,
              testId: "kb-library-workflow-secondary",
            }
          : undefined,
      };
    }

    return {
      statusLabel: `${liveDocumentCount} live and searchable`,
      statusTone: "green" as const,
      title: "Content is live",
      description: "Confirm titles and access, then test answers.",
      primaryAction: onNavigate
        ? {
            label: "Test answers",
            onClick: () => onNavigate("validate", "test"),
            icon: ShieldCheck,
            testId: "kb-library-workflow-primary",
          }
        : undefined,
      secondaryAction: onNavigate
        ? {
            label: "Review & publish",
            onClick: () => onNavigate("govern", "review"),
            icon: Landmark,
            tone: "secondary" as const,
            testId: "kb-library-workflow-secondary",
          }
        : undefined,
    };
  }, [
    canManageKnowledge,
    canWriteKnowledge,
    approvedReviewHistoryCount,
    liveDocumentCount,
    onNavigate,
    pendingReviewCount,
    processingDocumentCount,
    totalDocumentCount,
  ]);

  return (
    <div className="w-full min-h-[calc(100vh-200px)]">
      <motion.div {...fadeIn} className="w-full space-y-5">
        <KBWorkflowBanner
          testId="kb-library-workflow-banner"
          icon={LibraryBig}
          tone="blue"
          eyebrow="Workflow Step 4"
          title={libraryWorkflow.title}
          description={libraryWorkflow.description}
          statusLabel={libraryWorkflow.statusLabel}
          statusTone={libraryWorkflow.statusTone}
          primaryAction={libraryWorkflow.primaryAction}
          secondaryAction={libraryWorkflow.secondaryAction}
        />

        {/* ── Unified top bar ── */}
        <KBTopBar
          tabs={visibleSubViews.map(sv => ({
            key: sv.key,
            label: sv.label,
            icon: sv.icon,
          }))}
          activeTab={view}
          onTabChange={setView}
          tabsAriaLabel="Library sub-views"
          actions={
            view === "documents" ? (
              <>
                <KBSearchBar
                  value={filterText}
                  onChange={setFilterText}
                  placeholder="Search documents..."
                />
                {showLibraryFilters && totalDocumentCount > 0 && (
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger
                      className={cn(
                        "h-7 w-auto gap-1 px-2 text-xs [&>svg.lucide-chevron-down]:w-3 [&>svg.lucide-chevron-down]:h-3",
                        k.duoToneField,
                        statusFilter !== "all" &&
                          "text-primary font-medium ring-1 ring-primary/20 bg-primary/5"
                      )}
                    >
                      <SlidersHorizontal className="w-3 h-3 shrink-0" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className={k.duoToneSelectItem}>
                        All ({totalDocumentCount})
                      </SelectItem>
                      {liveDocumentCount > 0 && (
                        <SelectItem
                          value="published"
                          className={k.duoToneSelectItem}
                        >
                          Published ({liveDocumentCount})
                        </SelectItem>
                      )}
                      {processingDocumentCount > 0 && (
                        <SelectItem
                          value="processing"
                          className={k.duoToneSelectItem}
                        >
                          Processing ({processingDocumentCount})
                        </SelectItem>
                      )}
                      {readyToPublishCount > 0 && (
                        <SelectItem
                          value="approved"
                          className={k.duoToneSelectItem}
                        >
                          Ready to Publish ({readyToPublishCount})
                        </SelectItem>
                      )}
                      {pendingReviewCount > 0 && (
                        <SelectItem
                          value="pending_review"
                          className={k.duoToneSelectItem}
                        >
                          Pending Review ({pendingReviewCount})
                        </SelectItem>
                      )}
                      {archivedDocumentCount > 0 && (
                        <SelectItem
                          value="archived"
                          className={k.duoToneSelectItem}
                        >
                          Archived ({archivedDocumentCount})
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                )}
                <Select
                  value={sortBy}
                  onValueChange={v => setSortBy(v as typeof sortBy)}
                >
                  <SelectTrigger
                    className={cn(
                      "h-7 w-auto gap-1 px-2 text-xs [&>svg.lucide-chevron-down]:w-3 [&>svg.lucide-chevron-down]:h-3",
                      k.duoToneField
                    )}
                  >
                    <ArrowUpDown className="w-3 h-3 shrink-0" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest" className={k.duoToneSelectItem}>
                      Newest
                    </SelectItem>
                    <SelectItem value="oldest" className={k.duoToneSelectItem}>
                      Oldest
                    </SelectItem>
                    <SelectItem value="title" className={k.duoToneSelectItem}>
                      Title A–Z
                    </SelectItem>
                    <SelectItem value="status" className={k.duoToneSelectItem}>
                      Status
                    </SelectItem>
                  </SelectContent>
                </Select>
                <span
                  className={cn(
                    "text-xs tabular-nums whitespace-nowrap",
                    k.muted
                  )}
                >
                  {filteredCount !== null &&
                  filteredCount !== totalDocumentCount
                    ? `${filteredCount} of ${totalDocumentCount}`
                    : `${totalDocumentCount} doc${totalDocumentCount === 1 ? "" : "s"}`}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => {
                    utils.knowledge.listDocuments.invalidate();
                    utils.knowledge.stats.invalidate();
                  }}
                >
                  <RefreshCw
                    className={cn(
                      "w-3.5 h-3.5",
                      docsQ.isFetching && "animate-spin"
                    )}
                  />
                </Button>
              </>
            ) : undefined
          }
        />

        {canManageKnowledge &&
          showGapAnalysisCallout &&
          view === "documents" &&
          totalDocumentCount > 0 && (
            <KBInfoBanner tone="blue" icon={Target}>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-1">
                  <p className="font-medium text-foreground">
                    Use gap analysis as the next workflow step.
                  </p>
                  <p>
                    Each analysis run saves a versioned coverage snapshot so you
                    can compare what improved, what regressed, and which topics
                    still need content before rollout.
                  </p>
                </div>
                {onNavigate && (
                  <button
                    type="button"
                    onClick={() => onNavigate("validate", "gaps")}
                    className={cn(k.btnSecondary, "gap-2 whitespace-nowrap")}
                    data-testid="kb-library-gap-analysis-cta"
                  >
                    <Target className="w-4 h-4" />
                    Open Gap Analysis
                  </button>
                )}
              </div>
            </KBInfoBanner>
          )}

        {/* ── Content ── */}
        <Suspense fallback={<SubViewLoader />}>
          <AnimatePresence mode="wait">
            {view === "documents" && (
              <motion.div key="documents" {...fadeIn}>
                <BrowseViewEnhanced
                  docsQ={docsQ}
                  selectedStream={selectedStream}
                  streamLabel={streamLabel}
                  canWrite={canWriteKnowledge}
                  showFilters={showLibraryFilters}
                  reviewStatusByDocumentId={reviewStatusByDocumentId}
                  focusDocumentId={focusDocumentId}
                  onFocusHandled={onFocusHandled}
                  onNavigate={onNavigate}
                  filterText={filterText}
                  onFilterChange={setFilterText}
                  sortBy={sortBy}
                  statusFilter={statusFilter}
                  onStatusFilterChange={setStatusFilter}
                  onFilteredCountChange={setFilteredCount}
                />
              </motion.div>
            )}
            {view === "collections" && (
              <motion.div key="collections" {...fadeIn}>
                <CollectionsTab
                  selectedStream={selectedStream}
                  streamLabel={streamLabel}
                />
              </motion.div>
            )}
            {view === "taxonomy" && (
              <motion.div key="taxonomy" {...fadeIn}>
                <TaxonomyTab selectedStream={selectedStream} />
              </motion.div>
            )}
            {view === "graph" && (
              <motion.div key="graph" {...fadeIn}>
                <EntityGraph
                  selectedStream={selectedStream}
                  streamLabel={streamLabel}
                  onOpenTaxonomy={() => setView("taxonomy")}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </Suspense>
      </motion.div>
    </div>
  );
}
