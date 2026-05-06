/**
 * Validate Tab — Agent-powered knowledge quality evaluation
 *
 * Four sections:
 * 1. Test Sandbox — interactive query tester (search + generate + inline eval)
 * 2. Eval Suite — batch test runner with RAGAS-style metrics
 * 3. Quality Dashboard — freshness, distributions, health metrics
 * 4. Gap Analysis — AI-powered coverage analysis
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Loader2,
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  BookOpen,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
  MessageCircleQuestion,
  ShieldCheck,
  BarChart3,
  TrendingUp,
  Clock,
  FileText,
  Zap,
  Play,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Target,
  FlaskConical,
  LibraryBig,
  Landmark,
  Eye,
} from "lucide-react";
import { cn, useNotifications } from "@hki/ui";
import { trpc } from "@/lib/trpc";
import {
  canManageKnowledgeWorkspace,
  canWriteKnowledgeWorkspace,
} from "@/_core/access/knowledge";
import { useFeatureAccess } from "@/_core/hooks/useFeatureAccess";
import { usePermissions } from "@/_core/hooks/usePermissions";
import { useScope } from "@/_core/hooks/useScope";
import type { FeatureFlagKey } from "@shared/feature-flags";
import type {
  KnowledgeEvalSuiteSummary,
  ShadowRetrievalComparison,
} from "@shared/knowledge-types";
import { k, ACCENT } from "../theme";
import type { KnowledgeTab, ValidateSection } from "../types";
import { KBInfoBanner, KBTopBar, KBWorkflowBanner } from "./kb-primitives";
import {
  cardCls,
  formatRetrievalScore,
  getFreshness,
  getRetrievalScoreTone,
  isNormalizedRetrievalScore,
} from "../types";
import GapCoverageDiff from "./GapCoverageDiff";
import ShadowRetrievalPanel from "./ShadowRetrievalPanel";
import { getAvailableValidateSections } from "../feature-gates";

// ── Types ────────────────────────────────────────────────────────────────────

interface ValidateTabProps {
  streamName?: string;
  streamDescription?: string;
  valueStreamId?: string;
  docsQ: any;
  statsQ: any;
  initialSection?: ValidateSection;
  onStepComplete?: (stepId: string) => void;
  onNavigate?: (tab: KnowledgeTab, section?: string) => void;
}

// ── Animation ────────────────────────────────────────────────────────────────

const fadeIn = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.2 },
};

// ── Metric display metadata ──────────────────────────────────────────────────

const METRIC_META: Record<
  string,
  { label: string; desc: string; color: string }
> = {
  context_relevance: {
    label: "Context Relevance",
    desc: "How relevant retrieved chunks are to the query",
    color: "text-blue-600",
  },
  context_precision: {
    label: "Context Precision",
    desc: "Fraction of chunks above the relevance threshold",
    color: "text-emerald-600",
  },
  context_recall: {
    label: "Context Recall",
    desc: "How much of the expected answer is covered by retrieved context",
    color: "text-violet-600",
  },
  answer_similarity: {
    label: "Answer Similarity",
    desc: "Cosine similarity between generated and expected answers",
    color: "text-indigo-600",
  },
  faithfulness: {
    label: "Faithfulness",
    desc: "Is the answer grounded in the retrieved context? (LLM judge)",
    color: "text-primary",
  },
  answer_correctness: {
    label: "Answer Correctness",
    desc: "Does the answer match the expected answer? (LLM judge)",
    color: "text-rose-600",
  },
  chunk_utilization: {
    label: "Chunk Utilization",
    desc: "Fraction of retrieved chunks that are actually useful",
    color: "text-teal-600",
  },
};

function toAnchorToken(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "item"
  );
}

function getRetrievalDocumentId(result: any): string {
  return String(
    result?.metadata?.document_id || result?.metadata?.documentId || ""
  );
}

function getRetrievalTitle(result: any): string {
  return String(result?.metadata?.title || "Untitled");
}

function getRetrievalAnchorId(result: any, index: number): string {
  const basis = getRetrievalDocumentId(result) || getRetrievalTitle(result);
  return `validate-retrieval-${toAnchorToken(basis)}-${index}`;
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

export default function ValidateTab({
  streamName,
  streamDescription,
  valueStreamId,
  docsQ,
  statsQ,
  initialSection,
  onStepComplete,
  onNavigate,
}: ValidateTabProps) {
  const { canView: canViewFeature } = useFeatureAccess();
  const { role } = usePermissions();
  const isFeatureEnabled = useCallback(
    (key: FeatureFlagKey) => canViewFeature(key),
    [canViewFeature]
  );
  const canWriteKnowledge = canWriteKnowledgeWorkspace(role);
  const canManageKnowledge = canManageKnowledgeWorkspace(role);
  const availableSections = useMemo(
    () => getAvailableValidateSections(isFeatureEnabled),
    [isFeatureEnabled]
  );
  const [section, setSection] = useState<ValidateSection>(
    initialSection ?? availableSections[0] ?? "test"
  );
  const { notify } = useNotifications();

  // Sync from parent only when initialSection explicitly changes
  useEffect(() => {
    if (initialSection && availableSections.includes(initialSection)) {
      setSection(initialSection);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSection]);

  // If the current section is disabled, fall back to the first available
  useEffect(() => {
    if (!availableSections.includes(section) && availableSections[0]) {
      setSection(availableSections[0]);
    }
  }, [availableSections, section]);

  // statsQ hits the vector store (only counts embedded docs); fall back to
  // the SQL-backed listDocuments total so the banner reflects reality even
  // when the stats service lags or docs are in pending_review state.
  const docCount = statsQ.data?.totalDocuments ?? docsQ.data?.total ?? 0;
  const chunkCount = statsQ.data?.totalChunks ?? 0;

  const sections: {
    key: ValidateSection;
    label: string;
    icon: typeof Search;
    desc: string;
  }[] = [
    {
      key: "test",
      label: "Test Sandbox",
      icon: MessageCircleQuestion,
      desc: "Ask questions & verify answers",
    },
    {
      key: "eval",
      label: "Eval Suite",
      icon: FlaskConical,
      desc: "Batch test runner with metrics",
    },
    {
      key: "quality",
      label: "Quality",
      icon: BarChart3,
      desc: "Data health & freshness",
    },
    {
      key: "gaps",
      label: "Gap Analysis",
      icon: Sparkles,
      desc: "AI-powered coverage analysis",
    },
  ];

  const visibleSections = sections.filter(item =>
    availableSections.includes(item.key)
  );
  const showCompare = canViewFeature("release.knowledge.validate.compare");
  const showContextShaping = canViewFeature(
    "release.knowledge.validate.contextShaping"
  );
  const currentSec = visibleSections.find(s => s.key === section);
  const reviewHistoryQ = trpc.knowledge.reviewListAll.useQuery(
    { limit: 50, valueStreamId: valueStreamId || undefined },
    { retry: false }
  );
  const pendingReviewCount = (reviewHistoryQ.data ?? []).filter(
    (record: any) => record.status === "pending_review"
  ).length;
  const validateWorkflow = useMemo(() => {
    const sectionLabel =
      currentSec?.label.replace(/^[^\s]+\s/, "") ?? "Validate";
    // Only block when there are truly no documents at all (not even in the SQL DB).
    // chunkCount alone is unreliable — the vector-store stats can lag behind.
    if (docCount === 0) {
      return {
        eyebrow: `${sectionLabel} workflow`,
        statusLabel: "Needs indexed content",
        statusTone: "amber" as const,
        title: canWriteKnowledge
          ? "No content to test yet"
          : "No indexed content to test yet",
        description: canWriteKnowledge
          ? "Index a document first, then validate answers here."
          : "A KB admin needs to index content before read-only testing can start.",
        primaryAction:
          onNavigate && canWriteKnowledge
            ? {
                label: "Add content",
                onClick: () => onNavigate("ingest"),
                icon: Plus,
                testId: "kb-validate-workflow-primary",
              }
            : undefined,
        secondaryAction: onNavigate
          ? {
              label: "Open library",
              onClick: () => onNavigate("library"),
              icon: LibraryBig,
              tone: "secondary" as const,
              testId: "kb-validate-workflow-secondary",
            }
          : undefined,
      };
    }

    if (pendingReviewCount > 0) {
      return {
        eyebrow: `${sectionLabel} workflow`,
        statusLabel: `${pendingReviewCount} waiting review`,
        statusTone: "amber" as const,
        title: canManageKnowledge
          ? "Test drafts before publishing"
          : "Draft content is still in review",
        description: canManageKnowledge
          ? "QA pending content — fix gaps or approve for publishing."
          : "Run read-only questions while KB admins review pending content.",
        primaryAction:
          onNavigate && canManageKnowledge
            ? {
                label: "Review queue",
                onClick: () => onNavigate("govern", "review"),
                icon: Landmark,
                testId: "kb-validate-workflow-primary",
              }
            : undefined,
        secondaryAction: onNavigate
          ? {
              label: "Open library",
              onClick: () => onNavigate("library"),
              icon: LibraryBig,
              tone: "secondary" as const,
              testId: "kb-validate-workflow-secondary",
            }
          : undefined,
      };
    }

    return {
      eyebrow: `${sectionLabel} workflow`,
      statusLabel: canManageKnowledge
        ? "Ready for rollout checks"
        : "Ready for read-only checks",
      statusTone: "green" as const,
      title: canManageKnowledge
        ? "Run production-style questions"
        : "Run read-only retrieval checks",
      description: canManageKnowledge
        ? "Verify cited sources and answer quality before rollout."
        : "Verify cited sources and grounded answers for this domain.",
      primaryAction:
        onNavigate && canManageKnowledge
          ? {
              label: "Review & publish",
              onClick: () => onNavigate("govern", "review"),
              icon: Landmark,
              testId: "kb-validate-workflow-primary",
            }
          : undefined,
      secondaryAction: onNavigate
        ? {
            label: "Open library",
            onClick: () => onNavigate("library"),
            icon: LibraryBig,
            tone: "secondary" as const,
            testId: "kb-validate-workflow-secondary",
          }
        : undefined,
    };
  }, [
    canManageKnowledge,
    canWriteKnowledge,
    chunkCount,
    currentSec?.label,
    docCount,
    onNavigate,
    pendingReviewCount,
  ]);

  return (
    <div className="w-full min-h-[calc(100vh-200px)]">
      <motion.div {...fadeIn} className="w-full space-y-5">
        <KBWorkflowBanner
          testId="kb-validate-workflow-banner"
          icon={currentSec?.icon ?? ShieldCheck}
          tone="purple"
          eyebrow={validateWorkflow.eyebrow}
          title={validateWorkflow.title}
          description={validateWorkflow.description}
          statusLabel={validateWorkflow.statusLabel}
          statusTone={validateWorkflow.statusTone}
          primaryAction={validateWorkflow.primaryAction}
          secondaryAction={validateWorkflow.secondaryAction}
        />

        {/* ── Unified top bar ── */}
        <KBTopBar
          tabs={visibleSections.map(s => ({
            key: s.key,
            label: s.label,
            icon: s.icon,
          }))}
          activeTab={section}
          onTabChange={setSection}
          tabsAriaLabel="Validate sections"
        />

        {/* ── Section content ── */}
        <AnimatePresence mode="wait">
          {section === "test" && (
            <TestSection
              key="test"
              canWriteKnowledge={canWriteKnowledge}
              streamName={streamName}
              valueStreamId={valueStreamId}
              docsQ={docsQ}
              showCompare={showCompare}
              showContextShaping={showContextShaping}
              onNavigate={onNavigate}
            />
          )}
          {section === "eval" && (
            <EvalSuiteSection
              key="eval"
              valueStreamId={valueStreamId}
              streamName={streamName}
            />
          )}
          {section === "quality" && (
            <QualitySection
              key="quality"
              docsQ={docsQ}
              statsQ={statsQ}
              docCount={docCount}
              chunkCount={chunkCount}
            />
          )}
          {section === "gaps" && (
            <GapAnalysisSection
              key="gaps"
              streamName={streamName}
              streamDescription={streamDescription}
              valueStreamId={valueStreamId}
              docsQ={docsQ}
              docCount={docCount}
              chunkCount={chunkCount}
              onStepComplete={onStepComplete}
              notify={notify}
            />
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 1. TEST SANDBOX — Interactive query tester
// ══════════════════════════════════════════════════════════════════════════════

function TestSection({
  canWriteKnowledge,
  streamName,
  valueStreamId,
  docsQ,
  showCompare,
  showContextShaping,
  onNavigate,
}: {
  canWriteKnowledge: boolean;
  streamName?: string;
  valueStreamId?: string;
  docsQ?: any;
  showCompare: boolean;
  showContextShaping: boolean;
  onNavigate?: (tab: KnowledgeTab, section?: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [shapeContext, setShapeContext] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [answer, setAnswer] = useState<any>(null);
  const [evalResult, setEvalResult] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [shadowComparison, setShadowComparison] =
    useState<ShadowRetrievalComparison | null>(null);
  const [shadowQuery, setShadowQuery] = useState("");
  const [suggestedQuestions, setSuggestedQuestions] = useState<
    Record<string, string[]>
  >({});
  const { notify } = useNotifications();

  useEffect(() => {
    if (!showContextShaping) {
      setShapeContext(false);
    }
  }, [showContextShaping]);

  const docs: any[] =
    docsQ?.data?.documents ?? docsQ?.data?.json?.documents ?? [];
  const activeDocs = docs.filter(
    (d: any) => d.status !== "failed" && d.status !== "archived"
  );

  const suggestMut = trpc.knowledge.suggestTestQuestions.useMutation({
    onSuccess: (data, variables) => {
      let questions = data.questions;
      // Client-side fallback when LLM is unavailable or returns nothing
      if (questions.length === 0) {
        const title = variables.title ?? "";
        const dept = variables.department ?? "";
        const tags = variables.tags ?? [];
        questions = [
          title ? `What is "${title}" about?` : null,
          dept ? `What does the ${dept} department cover?` : null,
          title ? `Summarize the key points in ${title}` : null,
          tags.length > 0 ? `What is related to ${tags[0]}?` : null,
          title ? `What are the important details in ${title}?` : null,
        ]
          .filter((q): q is string => q !== null)
          .slice(0, 5);
      }
      setSuggestedQuestions(prev => ({
        ...prev,
        [variables.documentId]: questions,
      }));
    },
  });

  const handleSelectDoc = (doc: any) => {
    const id = doc.id as string;
    if (selectedDocId === id) {
      setSelectedDocId(null);
      return;
    }
    setSelectedDocId(id);
    if (!suggestedQuestions[id]) {
      suggestMut.mutate({
        documentId: id,
        title: doc.title,
        tags: doc.metadata?.tags ?? [],
        department: doc.department,
        valueStreamId,
      });
    }
  };

  const handleQuestionChip = (q: string) => {
    setQuery(q);
    handleAsk(q);
  };

  const searchMut = trpc.knowledge.search.useMutation({
    onSuccess: (d, variables) => {
      setResults(d);
      setAnswer(null);
      setEvalResult(null);
      setFeedback(null);
      setErrorMessage(null);
      if ((d.results ?? []).length > 0) {
        generateMut.mutate({
          valueStreamId: variables.valueStreamId,
          query: variables.query,
          chunks: (d.results ?? []).map((r: any) => ({
            content: r.content || "",
            score: r.score ?? 0,
            scoreScale: r.scoreScale ?? r.score_scale,
            metadata: (r.metadata ?? {}) as Record<string, unknown>,
          })),
        });
      }
    },
    onError: e => {
      setResults(null);
      setAnswer(null);
      setEvalResult(null);
      setFeedback(null);
      setErrorMessage(e.message);
      notify({
        title: "Search failed",
        description: e.message,
        severity: "error",
        group: "validate",
      });
    },
  });

  const generateMut = trpc.knowledge.generateAnswer.useMutation({
    onSuccess: (d, variables) => {
      setAnswer(d);
      if (d.answer && variables.chunks.length > 0 && variables.query) {
        evalSingleMut.mutate({
          valueStreamId: variables.valueStreamId,
          query: variables.query,
          retrievedContexts: variables.chunks.map(chunk => chunk.content || ""),
          generatedAnswer: d.answer || "",
        });
      }
    },
    onError: () => {
      // LLM not available — skip answer generation, show search results only
      setAnswer(null);
    },
  });

  void generateMut;

  const evalSingleMut = trpc.knowledge.evaluateSingle.useMutation({
    onSuccess: d => setEvalResult(d),
    onError: () => {}, // Silent — eval is optional enrichment
  });

  const shadowCompareMut = trpc.knowledge.compareShadowRetrieval.useMutation({
    onSuccess: comparison => {
      setShadowComparison(comparison);
      notify({
        title: "Published vs pending comparison ready",
        severity: "success",
        group: "validate",
      });
    },
    onError: e =>
      notify({
        title: "Comparison failed",
        description: e.message,
        severity: "error",
        group: "validate",
      }),
  });

  const feedbackMut = trpc.knowledge.chunkFeedback.useMutation({
    onError: e => console.warn("Feedback failed:", e.message),
  });

  const handleAsk = (overrideQuery?: string) => {
    const q = overrideQuery ?? query;
    if (!q.trim()) return;
    if (overrideQuery) setQuery(overrideQuery);
    setResults(null);
    setAnswer(null);
    setEvalResult(null);
    setFeedback(null);
    setErrorMessage(null);
    searchMut.mutate({
      query: q,
      mode: "hybrid" as any,
      valueStreamId,
      shapeContext,
      includePending: true,
    });
  };

  const handleShadowCompare = (overrideQuery?: string) => {
    const q = (overrideQuery ?? query).trim();
    if (!q) return;
    if (overrideQuery) setQuery(overrideQuery);
    setShadowQuery(q);
    shadowCompareMut.mutate({
      query: q,
      mode: "hybrid",
      valueStreamId,
      shapeContext,
    });
  };

  const handleFeedback = (signal: "up" | "down") => {
    setFeedback(signal);
    notify({
      title: signal === "up" ? "Thanks!" : "Thanks - we'll improve",
      severity: signal === "up" ? "success" : "info",
    });
    if (answer && results?.results?.length && query) {
      feedbackMut.mutate({
        valueStreamId,
        signal,
        query,
        answer: answer.answer,
        chunkIds: results.results.map((_: any, i: number) => `chunk-${i}`),
        documentIds: results.results.map((r: any) =>
          String(r.metadata?.document_id || "")
        ),
        confidence: answer.confidence,
        evalScore: 0,
      });
    }
  };

  const isSearching = searchMut.isPending;
  const isGenerating = generateMut.isPending;
  const isThinking = isSearching || isGenerating;
  const [retrievalsOpen, setRetrievalsOpen] = useState(true);
  const [activeRetrievalId, setActiveRetrievalId] = useState<string | null>(
    null
  );

  useEffect(() => {
    setRetrievalsOpen(true);
    setActiveRetrievalId(null);
  }, [results]);

  const resolvedCitations = useMemo<
    Array<{ citation: any; resultIndex: number; anchorId: string | null }>
  >(() => {
    const retrieved = results?.results ?? [];
    if (!answer?.citations?.length || !retrieved.length) return [];

    return answer.citations.map((citation: any) => {
      const citationDocumentId = String(
        citation.documentId ?? citation.document_id ?? ""
      );
      const citationTitle = String(citation.title ?? "")
        .trim()
        .toLowerCase();

      let resultIndex = -1;

      if (citationDocumentId) {
        resultIndex = retrieved.findIndex(
          (result: any) => getRetrievalDocumentId(result) === citationDocumentId
        );
      }

      if (resultIndex === -1 && citationTitle) {
        resultIndex = retrieved.findIndex(
          (result: any) =>
            getRetrievalTitle(result).trim().toLowerCase() === citationTitle
        );
      }

      if (
        resultIndex === -1 &&
        typeof citation.index === "number" &&
        citation.index > 0 &&
        citation.index <= retrieved.length
      ) {
        resultIndex = citation.index - 1;
      }

      return {
        citation,
        resultIndex,
        anchorId:
          resultIndex >= 0
            ? getRetrievalAnchorId(retrieved[resultIndex], resultIndex)
            : null,
      };
    });
  }, [answer?.citations, results]);

  const citationsByRetrievalId = useMemo(() => {
    const map = new Map<string, any[]>();

    resolvedCitations.forEach(
      ({ citation, anchorId }: { citation: any; anchorId: string | null }) => {
        if (!anchorId) return;
        const existing = map.get(anchorId) ?? [];
        existing.push(citation);
        map.set(anchorId, existing);
      }
    );

    return map;
  }, [resolvedCitations]);

  const handleCitationClick = (anchorId: string | null) => {
    if (!anchorId) return;

    setRetrievalsOpen(true);
    setActiveRetrievalId(anchorId);

    window.setTimeout(() => {
      const element = document.getElementById(anchorId);
      element?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);
  };

  const handleCitationNavigate = (documentId: string) => {
    if (onNavigate && documentId) {
      onNavigate("library", documentId);
    }
  };

  return (
    <motion.div
      {...fadeIn}
      className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-5 items-start"
    >
      {/* ══ LEFT — Input side ══ */}
      <div className="space-y-4">
        {activeDocs.length === 0 && (
          <KBInfoBanner tone="amber" icon={AlertTriangle}>
            <div className="space-y-2">
              <p className="font-medium text-foreground">
                {canWriteKnowledge
                  ? "Add content and wait for indexing before you test retrieval."
                  : "No indexed content is available for read-only testing yet."}
              </p>
              <p>
                {canWriteKnowledge
                  ? "Once your first document is indexed, return here to ask realistic questions and inspect the cited sources."
                  : "A KB admin needs to add and index content before you can run sandbox questions here."}
              </p>
              {onNavigate && canWriteKnowledge && (
                <button
                  type="button"
                  onClick={() => onNavigate("ingest")}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-background/80 px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted/60"
                  data-testid="kb-validate-empty-go-ingest"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add content
                </button>
              )}
            </div>
          </KBInfoBanner>
        )}
        {/* ── Document picker + question chips ── */}
        {activeDocs.length > 0 && (
          <div className={cn(cardCls, "p-4 space-y-3")}>
            <p
              className={cn(
                "text-[11px] font-semibold uppercase tracking-wider",
                k.muted
              )}
            >
              Try asking about a document
            </p>
            {/* Document pills */}
            <div className="flex flex-wrap gap-1.5">
              {activeDocs.slice(0, 12).map((doc: any) => (
                <button
                  key={doc.id}
                  onClick={() => handleSelectDoc(doc)}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all",
                    selectedDocId === doc.id
                      ? "border-primary/40 bg-primary/8 text-primary"
                      : "border-border/60 bg-muted/30 text-muted-foreground kb-duotone-border-hover-strong hover:text-foreground hover:bg-muted/60"
                  )}
                >
                  <FileText className="w-3 h-3 shrink-0" />
                  <span className="max-w-40 truncate">
                    {doc.title || doc.id}
                  </span>
                </button>
              ))}
            </div>

            {/* Question chips for selected document */}
            <AnimatePresence>
              {selectedDocId && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  {suggestMut.isPending &&
                  selectedDocId &&
                  !suggestedQuestions[selectedDocId] ? (
                    <div className="flex items-center gap-2 py-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-primary/60" />
                      <span className={cn("text-xs", k.muted)}>
                        Generating suggestions...
                      </span>
                    </div>
                  ) : (suggestedQuestions[selectedDocId] ?? []).length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {(suggestedQuestions[selectedDocId] ?? []).map((q, i) => (
                        <button
                          key={i}
                          onClick={() => handleQuestionChip(q)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-primary/20 bg-primary/5 text-xs text-primary kb-duotone-bg-hover-strong kb-duotone-border-hover-strong transition-all text-left"
                        >
                          <MessageCircleQuestion className="w-3 h-3 shrink-0 opacity-70" />
                          {q}
                        </button>
                      ))}
                    </div>
                  ) : !suggestMut.isPending ? (
                    <p className={cn("text-xs py-1", k.muted)}>
                      No suggestions available — type your question below.
                    </p>
                  ) : null}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* ── Search bar ── */}
        <div className={cn(cardCls, "p-4")} data-tour="validate-input">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <MessageCircleQuestion className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/60" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleAsk()}
                placeholder={
                  activeDocs.length > 0
                    ? "Or type your own question..."
                    : "Ask a question to test your domain library..."
                }
                className={cn(k.input, "pl-10 py-3 text-sm")}
                autoFocus={activeDocs.length === 0}
              />
            </div>
            <button
              onClick={() => handleAsk()}
              disabled={!query.trim() || isThinking}
              className={cn(k.btnPrimary, "px-5 py-3")}
            >
              {isThinking ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              Test retrieval
            </button>
            {showCompare ? (
              <button
                onClick={() => handleShadowCompare()}
                disabled={!query.trim() || shadowCompareMut.isPending}
                className={cn(k.btnSecondary, "px-4 py-3")}
              >
                {shadowCompareMut.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
                Compare
              </button>
            ) : null}
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-3">
            {streamName && (
              <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                {streamName}
              </span>
            )}
            {showContextShaping ? (
              <label className="inline-flex items-center gap-2 text-[11px] text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={shapeContext}
                  onChange={e => setShapeContext(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-border/40 accent-primary"
                />
                <span className="font-medium text-foreground">
                  Context shaping
                </span>
              </label>
            ) : null}
          </div>
          <p className={cn("mt-2 text-[11px]", k.muted)}>
            {showCompare
              ? "Ask uses the pending-inclusive sandbox. Compare shows the published-only baseline next to the pending preview."
              : "Ask uses the pending-inclusive sandbox so you can inspect grounded answers before publish."}
          </p>
        </div>
      </div>
      {/* end left column */}

      {/* ══ RIGHT — Results side ══ */}
      <div className="space-y-4">
        {/* Thinking */}
        {isThinking && (
          <div className="flex items-center justify-center gap-3 py-8">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span className={cn("text-xs", k.muted)}>
              {isSearching
                ? "Searching domain library..."
                : "Generating grounded answer..."}
            </span>
          </div>
        )}

        {showCompare &&
          (shadowComparison || shadowCompareMut.isPending || shadowQuery) && (
            <ShadowRetrievalPanel
              comparison={shadowComparison}
              query={shadowQuery}
              isLoading={shadowCompareMut.isPending}
              errorMessage={shadowCompareMut.error?.message ?? null}
              onRun={() => handleShadowCompare()}
              description="Compare the published domain library against the pending-inclusive sandbox for this question."
              emptyTitle="No published vs pending comparison yet"
              emptyDescription="Run compare to inspect how pending-review content changes retrieval and grounded answers before publish."
              baselineLabel="Published retrieval"
              shadowLabel="Pending-inclusive retrieval"
            />
          )}

        {errorMessage && !isThinking && (
          <div className={cn(cardCls, "p-4 border-red-500/25 bg-red-500/5")}>
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 mt-0.5 text-red-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  Retrieval test failed
                </p>
                <p className="mt-1 text-xs text-muted-foreground wrap-break-word">
                  {errorMessage}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Answer card — only shown when LLM successfully generated an answer */}
        <AnimatePresence>
          {answer?.answer && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(cardCls, "overflow-hidden")}
            >
              {/* Header: confidence + feedback */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-border/30">
                <div className="flex items-center gap-3">
                  <ConfidenceRing value={answer.confidence} size={36} />
                  <div>
                    <p className={cn("text-xs font-semibold", k.heading)}>
                      AI Answer
                    </p>
                    <p className={cn("text-xs", k.muted)}>
                      {answer.confidence >= 0.8
                        ? "High confidence — well supported"
                        : answer.confidence >= 0.5
                          ? "Moderate — partially supported"
                          : "Low — may need more content"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleFeedback("up")}
                    className={cn(
                      "p-1.5 rounded-lg transition-colors",
                      feedback === "up"
                        ? "bg-primary/15 text-primary"
                        : "text-muted-foreground/40 kb-duotone-text-hover"
                    )}
                  >
                    <ThumbsUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleFeedback("down")}
                    className={cn(
                      "p-1.5 rounded-lg transition-colors",
                      feedback === "down"
                        ? "bg-red-500/15 text-red-500"
                        : "text-muted-foreground/40 hover:text-red-500"
                    )}
                  >
                    <ThumbsDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Answer body */}
              <div className="p-5">
                <p className="max-w-[76ch] text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                  {answer.answer}
                </p>

                {answer.citations?.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-black/4 dark:border-white/4">
                    <p
                      className={cn(
                        "text-xs font-semibold uppercase tracking-wider mb-2",
                        k.muted
                      )}
                    >
                      Sources
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {resolvedCitations.map(
                        ({
                          citation,
                          resultIndex,
                          anchorId,
                        }: {
                          citation: any;
                          resultIndex: number;
                          anchorId: string | null;
                        }) => {
                          const isLinked = !!anchorId;
                          const isActive = activeRetrievalId === anchorId;
                          const documentId =
                            resultIndex >= 0
                              ? getRetrievalDocumentId(
                                  (results?.results ?? [])[resultIndex]
                                )
                              : String(
                                  citation.documentId ??
                                    citation.document_id ??
                                    ""
                                );

                          return (
                            <div
                              key={`${citation.index}-${anchorId ?? citation.title ?? "source"}`}
                              id={anchorId ?? undefined}
                              className={cn(
                                "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs transition-colors",
                                isActive
                                  ? "bg-primary/8 ring-1 ring-primary/15"
                                  : "bg-muted/40 hover:bg-muted/60"
                              )}
                            >
                              <span className="w-5 h-5 rounded-md kb-duotone-fill text-[11px] font-bold flex items-center justify-center shrink-0">
                                {citation.index}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCitationClick(anchorId)}
                                disabled={!isLinked}
                                className={cn(
                                  "min-w-0 flex-1 truncate text-left transition-colors",
                                  isLinked
                                    ? "text-foreground hover:underline cursor-pointer"
                                    : "text-muted-foreground cursor-default"
                                )}
                              >
                                {citation.title || `Source ${citation.index}`}
                              </button>
                              {citation.score > 0 ? (
                                <span className="shrink-0 text-[11px] text-muted-foreground/70">
                                  {Math.round(citation.score * 100)}%
                                </span>
                              ) : null}
                              {documentId ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleCitationNavigate(documentId)
                                  }
                                  className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                                >
                                  <ArrowRight className="w-3 h-3" />
                                  View source
                                </button>
                              ) : null}
                            </div>
                          );
                        }
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Inline eval scores */}
              {evalResult &&
                (evalResult.caseResults ?? evalResult.case_results ?? [])
                  .length > 0 && (
                  <div className="px-5 pb-4 pt-1 border-t border-border/50">
                    <p
                      className={cn(
                        "text-xs font-semibold uppercase tracking-wider mb-2",
                        k.muted
                      )}
                    >
                      RAGAS Evaluation Scores
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {(
                        (evalResult.caseResults ?? evalResult.case_results)?.[0]
                          ?.metrics ?? []
                      ).map((m: any) => {
                        const meta = METRIC_META[m.name] ?? {
                          label: m.name,
                          color: "text-foreground",
                        };
                        const score = m.score;
                        return (
                          <div
                            key={m.name}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30 border border-border/30"
                            title={meta.desc}
                          >
                            <span
                              className={cn(
                                "text-xs font-semibold",
                                meta.color
                              )}
                            >
                              {meta.label}
                            </span>
                            <span
                              className={cn(
                                "text-xs font-bold tabular-nums",
                                score >= 0.7
                                  ? "text-emerald-600"
                                  : score >= 0.4
                                    ? "text-primary"
                                    : "text-red-500"
                              )}
                            >
                              {(score * 100).toFixed(0)}%
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Retrieved chunks (auto-expanded) */}
        {results && !isThinking && (results.results ?? []).length > 0 && (
          <div className={cn(cardCls, "overflow-hidden")}>
            {/* Header bar */}
            <button
              type="button"
              onClick={() => setRetrievalsOpen(v => !v)}
              className="flex items-center justify-between w-full px-4 py-3 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-2">
                <BookOpen className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-semibold text-foreground">
                  {results.results.length} chunks retrieved
                </span>
                {results.searchTimeMs != null && (
                  <span className="text-[11px] tabular-nums text-muted-foreground">
                    {results.searchTimeMs.toFixed(0)}ms
                  </span>
                )}
              </div>
              <ChevronDown
                className={cn(
                  "w-3.5 h-3.5 text-muted-foreground transition-transform",
                  !retrievalsOpen && "-rotate-90"
                )}
              />
            </button>

            {resolvedCitations.length > 0 && retrievalsOpen && (
              <p className="px-4 pb-2 text-[11px] text-muted-foreground/70">
                Click a source above to jump to its retrieval
              </p>
            )}

            {/* Chunk list */}
            <AnimatePresence initial={false}>
              {retrievalsOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4 space-y-2">
                    {(results.results ?? []).map((r: any, i: number) => {
                      const anchorId = getRetrievalAnchorId(r, i);
                      const isActive = activeRetrievalId === anchorId;
                      const citations =
                        citationsByRetrievalId.get(anchorId) ?? [];
                      const scoreTone =
                        r.score != null
                          ? getRetrievalScoreTone(
                              r.score,
                              r.scoreScale ?? r.score_scale
                            )
                          : null;
                      return (
                        <div
                          id={anchorId}
                          key={anchorId}
                          className={cn(
                            "scroll-mt-24 rounded-lg border px-3 py-2.5 transition-all",
                            isActive
                              ? "border-primary/25 bg-primary/5 ring-1 ring-primary/10"
                              : "border-border/40 bg-muted/20 hover:border-border/60"
                          )}
                        >
                          <div className="flex items-start gap-2.5">
                            <span
                              className={cn(
                                "w-6 h-6 rounded-lg text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5",
                                citations.length > 0
                                  ? "bg-primary/15 text-primary"
                                  : "bg-muted/60 text-muted-foreground"
                              )}
                            >
                              {i + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-3">
                                <p className="text-[11px] font-semibold text-foreground leading-snug">
                                  {String(r.metadata?.title || "Untitled")}
                                </p>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {citations.map((citation: any) => (
                                    <span
                                      key={`${anchorId}-${citation.index}`}
                                      className="inline-flex items-center rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary"
                                      title="Cited in answer"
                                    >
                                      [{citation.index}]
                                    </span>
                                  ))}
                                  {r.score != null && (
                                    <span
                                      className={cn(
                                        "text-[11px] font-bold tabular-nums",
                                        scoreTone === "high"
                                          ? "text-primary"
                                          : scoreTone === "medium"
                                            ? "text-primary"
                                            : "text-muted-foreground/60"
                                      )}
                                      title={
                                        isNormalizedRetrievalScore(
                                          r.score,
                                          r.scoreScale ?? r.score_scale
                                        )
                                          ? "Normalized retrieval score"
                                          : "Raw keyword rank score"
                                      }
                                    >
                                      {formatRetrievalScore(
                                        r.score,
                                        r.scoreScale ?? r.score_scale
                                      )}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3 mt-1">
                                {r.content}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* No results */}
        {results && !isThinking && (results.results ?? []).length === 0 && (
          <div className="text-center py-10 space-y-2">
            <Search className="w-8 h-8 text-muted-foreground/40 mx-auto" />
            <p className={cn("text-sm font-medium", k.heading)}>
              No results found
            </p>
            <p className={cn("text-xs", k.muted)}>
              Your domain library may not have content related to this query
              yet.
            </p>
          </div>
        )}

        {/* Empty state for right column */}
        {!results && !isThinking && (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-2">
            <MessageCircleQuestion className="w-8 h-8 text-muted-foreground/30" />
            <p className={cn("text-sm font-medium", k.heading)}>
              Results appear here
            </p>
            <p className={cn("text-xs max-w-[28ch]", k.muted)}>
              Pick a document or type a question to test your domain library.
            </p>
          </div>
        )}
      </div>
      {/* end right column */}
    </motion.div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. EVAL SUITE — Batch test runner
// ══════════════════════════════════════════════════════════════════════════════

interface TestCase {
  id: string;
  query: string;
  expectedAnswer: string;
}

function formatMaintainedSuiteOrigin(
  origin: KnowledgeEvalSuiteSummary["origin"]
): string {
  switch (origin) {
    case "curated":
      return "Curated prompts";
    case "generated":
      return "Generated";
    case "fallback":
      return "Starter set";
    default:
      return "Manual";
  }
}

function EvalSuiteSection({
  valueStreamId,
  streamName,
}: {
  valueStreamId?: string;
  streamName?: string;
}) {
  const { availableScopes } = useScope();
  const selectedScope = useMemo(
    () => availableScopes.find(scope => scope.id === valueStreamId),
    [availableScopes, valueStreamId]
  );
  const curatedCases = useMemo(() => {
    return (selectedScope?.sampleQuestions ?? [])
      .map(question => question.trim())
      .filter(Boolean)
      .map((query, index) => ({
        id: `curated-${valueStreamId ?? "global"}-${index + 1}`,
        query,
        expectedAnswer: "",
      }));
  }, [selectedScope?.sampleQuestions, valueStreamId]);
  const curatedSeedKey = useMemo(
    () => curatedCases.map(item => item.query).join("||"),
    [curatedCases]
  );
  const defaultManagedSuiteName = useMemo(() => {
    const label =
      streamName?.trim() || selectedScope?.name?.trim() || "Current";
    return `${label} rollout gate`;
  }, [selectedScope?.name, streamName]);
  const [cases, setCases] = useState<TestCase[]>([]);
  const [report, setReport] = useState<any>(null);
  const [expandedCase, setExpandedCase] = useState<string | null>(null);
  const [suiteOrigin, setSuiteOrigin] = useState<
    "curated" | "generated" | "fallback" | "manual"
  >("manual");
  const [suiteSummary, setSuiteSummary] = useState(
    "No curated eval prompts are configured yet. Generate a suite from indexed content and the latest gap snapshot."
  );
  const [suiteSnapshotId, setSuiteSnapshotId] = useState<string | null>(null);
  const [managedSuiteId, setManagedSuiteId] = useState<string | null>(null);
  const [managedSuiteName, setManagedSuiteName] = useState(
    defaultManagedSuiteName
  );
  const { notify } = useNotifications();
  const utils = trpc.useUtils();
  const savedSuitesQ = trpc.knowledge.listEvalSuites.useQuery(
    { valueStreamId, limit: 8 },
    {
      retry: false,
      staleTime: 30_000,
      enabled: Boolean(valueStreamId),
    }
  );
  const agentEvalRunsQ = trpc.knowledge.listAgentE2EEvals.useQuery(
    { valueStreamId, limit: 5 },
    { retry: false, staleTime: 30_000 }
  );
  const launchReadinessQ = trpc.knowledge.launchReadiness.useQuery(
    { valueStreamId },
    { retry: false, staleTime: 30_000 }
  );
  const releasesQ = trpc.knowledge.listReleases.useQuery(
    { valueStreamId, limit: 5 },
    { retry: false, staleTime: 30_000 }
  );

  useEffect(() => {
    setManagedSuiteId(null);
    setManagedSuiteName(defaultManagedSuiteName);
  }, [defaultManagedSuiteName, valueStreamId]);

  useEffect(() => {
    if (curatedCases.length > 0) {
      setCases(curatedCases);
      setSuiteOrigin("curated");
      setSuiteSummary(
        `Using ${curatedCases.length} curated question${curatedCases.length === 1 ? "" : "s"} configured for this domain.`
      );
    } else {
      setCases([]);
      setSuiteOrigin("manual");
      setSuiteSummary(
        "No curated eval prompts are configured yet. Generate a suite from indexed content and the latest gap snapshot."
      );
    }
    setSuiteSnapshotId(null);
    setReport(null);
    setExpandedCase(null);
  }, [valueStreamId, curatedSeedKey]);

  const generateSuiteMut = trpc.knowledge.generateEvalSuite.useMutation({
    onSuccess: data => {
      const nextCases = data.cases.map((testCase, index) => ({
        id: testCase.id || `generated-${index + 1}`,
        query: testCase.query,
        expectedAnswer: testCase.expectedAnswer || "",
      }));
      setCases(nextCases);
      setSuiteOrigin(data.source);
      setSuiteSummary(data.summary);
      setSuiteSnapshotId(data.basedOnSnapshotId);
      setReport(null);
      setExpandedCase(null);
      notify({
        title: "Evaluation suite generated",
        description: data.summary,
        severity: "success",
        group: "validate",
      });
    },
    onError: e =>
      notify({
        title: "Eval suite generation failed",
        description: e.message,
        severity: "error",
        group: "validate",
      }),
  });
  const saveSuiteMut = trpc.knowledge.saveEvalSuite.useMutation({
    onSuccess: suite => {
      setManagedSuiteId(suite.id);
      setManagedSuiteName(suite.name);
      setSuiteOrigin(suite.origin);
      setSuiteSnapshotId(suite.basedOnSnapshotId);
      setSuiteSummary(
        `Maintained suite "${suite.name}" saved with ${suite.caseCount} case${suite.caseCount === 1 ? "" : "s"} for repeatable regression checks.`
      );
      void utils.knowledge.listEvalSuites.invalidate();
      notify({
        title: "Maintained suite saved",
        description: `${suite.name} is now available for this domain.`,
        severity: "success",
        group: "validate",
      });
    },
    onError: e =>
      notify({
        title: "Maintained suite failed",
        description: e.message,
        severity: "error",
        group: "validate",
      }),
  });
  const deleteSuiteMut = trpc.knowledge.deleteEvalSuite.useMutation({
    onSuccess: result => {
      if (managedSuiteId === result.id) {
        setManagedSuiteId(null);
        setManagedSuiteName(defaultManagedSuiteName);
      }
      void utils.knowledge.listEvalSuites.invalidate();
      notify({
        title: "Maintained suite removed",
        description: "The saved suite has been deleted for this domain.",
        severity: "success",
        group: "validate",
      });
    },
    onError: e =>
      notify({
        title: "Suite delete failed",
        description: e.message,
        severity: "error",
        group: "validate",
      }),
  });

  const evalAutoMut = trpc.knowledge.evaluateAuto.useMutation({
    onSuccess: d => {
      setReport(d);
      const totalCases = d.totalCases ?? 0;
      const evalTimeMs = d.evalTimeMs ?? 0;
      notify({
        title: "Evaluation complete",
        description: `${totalCases} cases scored in ${(evalTimeMs / 1000).toFixed(1)}s`,
        severity: "success",
        group: "validate",
      });
    },
    onError: e =>
      notify({
        title: "Evaluation failed",
        description: e.message,
        severity: "error",
        group: "validate",
      }),
  });
  const agentEvalMut = trpc.knowledge.runAgentE2EEval.useMutation({
    onSuccess: d => {
      void Promise.all([
        utils.knowledge.listAgentE2EEvals.invalidate(),
        utils.knowledge.launchReadiness.invalidate(),
      ]);
      notify({
        title: d.passed
          ? "Agent E2E checks passed"
          : "Agent E2E checks found issues",
        description: `${d.passedCases}/${d.totalCases} cases passed through the orchestrator path.`,
        severity: d.passed ? "success" : "warning",
        group: "validate",
      });
    },
    onError: e =>
      notify({
        title: "Agent E2E evaluation failed",
        description: e.message,
        severity: "error",
        group: "validate",
      }),
  });
  const createReleaseMut = trpc.knowledge.createRelease.useMutation({
    onSuccess: release => {
      void Promise.all([
        utils.knowledge.listReleases.invalidate(),
        utils.knowledge.launchReadiness.invalidate(),
      ]);
      notify({
        title: "Release candidate created",
        description: `${release.label} is ready for promotion when launch checks pass.`,
        severity: "success",
        group: "validate",
      });
    },
    onError: e =>
      notify({
        title: "Release candidate failed",
        description: e.message,
        severity: "error",
        group: "validate",
      }),
  });
  const promoteReleaseMut = trpc.knowledge.promoteRelease.useMutation({
    onSuccess: result => {
      void Promise.all([
        utils.knowledge.listReleases.invalidate(),
        utils.knowledge.launchReadiness.invalidate(),
      ]);
      notify({
        title: "Release promoted",
        description: `${result.release.label} is now the promoted knowledge release.`,
        severity: "success",
        group: "validate",
      });
    },
    onError: e =>
      notify({
        title: "Release promotion blocked",
        description: e.message,
        severity: "error",
        group: "validate",
      }),
  });
  const rollbackReleaseMut = trpc.knowledge.rollbackRelease.useMutation({
    onSuccess: release => {
      void Promise.all([
        utils.knowledge.listReleases.invalidate(),
        utils.knowledge.launchReadiness.invalidate(),
      ]);
      notify({
        title: "Release restored",
        description: `${release.label} is now the active promoted release.`,
        severity: "success",
        group: "validate",
      });
    },
    onError: e =>
      notify({
        title: "Rollback failed",
        description: e.message,
        severity: "error",
        group: "validate",
      }),
  });

  const addCase = () => {
    setSuiteOrigin("manual");
    setSuiteSnapshotId(null);
    setSuiteSummary(
      "Customize the suite with the highest-risk questions for this domain."
    );
    setCases(prev => [
      ...prev,
      { id: String(Date.now()), query: "", expectedAnswer: "" },
    ]);
  };

  const removeCase = (id: string) => {
    setSuiteOrigin("manual");
    setSuiteSnapshotId(null);
    setCases(prev => prev.filter(c => c.id !== id));
  };

  const updateCase = (
    id: string,
    field: "query" | "expectedAnswer",
    value: string
  ) => {
    setSuiteOrigin("manual");
    setSuiteSnapshotId(null);
    setCases(prev =>
      prev.map(c => (c.id === id ? { ...c, [field]: value } : c))
    );
  };

  const handleGenerateSuite = () => {
    generateSuiteMut.mutate({ valueStreamId, limit: 8 });
  };

  const savedSuites = savedSuitesQ.data ?? [];

  const handleLoadSavedSuite = (suite: KnowledgeEvalSuiteSummary) => {
    setCases(
      suite.cases.map(testCase => ({
        id: testCase.id,
        query: testCase.query,
        expectedAnswer: testCase.expectedAnswer,
      }))
    );
    setManagedSuiteId(suite.id);
    setManagedSuiteName(suite.name);
    setSuiteOrigin(suite.origin);
    setSuiteSnapshotId(suite.basedOnSnapshotId);
    setSuiteSummary(
      `Loaded maintained suite "${suite.name}" with ${suite.caseCount} case${suite.caseCount === 1 ? "" : "s"}.`
    );
    setReport(null);
    setExpandedCase(null);
  };

  const handleSaveSuite = () => {
    if (!valueStreamId) {
      notify({
        title: "Select a domain",
        description: "Choose one domain before saving a maintained suite.",
        severity: "warning",
        group: "validate",
      });
      return;
    }

    const validCases = cases.filter(testCase => testCase.query.trim());
    if (validCases.length === 0) {
      notify({
        title: "No test cases",
        description: "Add at least one query before saving a maintained suite.",
        severity: "warning",
        group: "validate",
      });
      return;
    }

    if (!managedSuiteName.trim()) {
      notify({
        title: "Name required",
        description: "Give this maintained suite a name before saving it.",
        severity: "warning",
        group: "validate",
      });
      return;
    }

    saveSuiteMut.mutate({
      id: managedSuiteId ?? undefined,
      valueStreamId,
      name: managedSuiteName.trim(),
      origin: suiteOrigin,
      basedOnSnapshotId: suiteSnapshotId,
      cases: validCases.map(testCase => ({
        id: testCase.id,
        query: testCase.query,
        expectedAnswer: testCase.expectedAnswer || undefined,
      })),
    });
  };

  const handleDeleteSuite = (suite: KnowledgeEvalSuiteSummary) => {
    deleteSuiteMut.mutate({ id: suite.id, valueStreamId });
  };

  const handleStartNewManagedSuite = () => {
    setManagedSuiteId(null);
    setManagedSuiteName(defaultManagedSuiteName);
  };

  const suiteName =
    suiteOrigin === "curated"
      ? "curated-eval"
      : suiteOrigin === "generated"
        ? "generated-eval"
        : suiteOrigin === "fallback"
          ? "starter-eval"
          : "manual-eval";

  const suiteOriginLabel =
    suiteOrigin === "curated"
      ? "Curated stream prompts"
      : suiteOrigin === "generated"
        ? "Generated from docs and gaps"
        : suiteOrigin === "fallback"
          ? "Fallback starter set"
          : "Manual suite";

  const runEval = () => {
    const validCases = cases.filter(c => c.query.trim());
    if (validCases.length === 0) {
      notify({
        title: "No test cases",
        description: "Add at least one query to evaluate.",
        severity: "warning",
        group: "validate",
      });
      return;
    }
    setReport(null);
    evalAutoMut.mutate({
      suiteName,
      cases: validCases.map(c => ({
        id: c.id,
        query: c.query,
        expectedAnswer: c.expectedAnswer || undefined,
      })),
      valueStreamId,
      includePending: true,
    });
  };

  const runAgentEval = () => {
    const validCases = cases.filter(c => c.query.trim());
    if (validCases.length === 0) {
      notify({
        title: "No test cases",
        description: "Add at least one query to evaluate.",
        severity: "warning",
        group: "validate",
      });
      return;
    }
    agentEvalMut.mutate({
      suiteName: `${suiteName}-agent-e2e`,
      cases: validCases.map(c => ({
        id: c.id,
        query: c.query,
        expectedAnswer: c.expectedAnswer || undefined,
      })),
      valueStreamId,
      requireCitations: true,
    });
  };

  const caseResults = report?.caseResults ?? report?.case_results ?? [];
  const summary = report?.summary ?? {};
  const summaryEntries = Object.entries(summary).filter(
    ([, v]) => (v as number) > 0
  );
  const recentAgentEvals = agentEvalRunsQ.data ?? [];
  const latestAgentEval = agentEvalMut.data ?? recentAgentEvals[0] ?? null;
  const launchChecks = launchReadinessQ.data?.checks ?? [];
  const passedLaunchChecks = launchChecks.filter(check => check.passed).length;
  const latestRelease = releasesQ.data?.[0] ?? null;

  return (
    <motion.div {...fadeIn} className="space-y-4">
      {/* ── Row 1: Compact title bar ── */}
      <div
        className={cn(cardCls, "px-5 py-3 flex items-center justify-between")}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-500/10 flex items-center justify-center">
            <FlaskConical className="w-4 h-4 text-violet-600" />
          </div>
          <div>
            <h3 className={cn("text-sm font-bold", k.heading)}>
              Evaluation Suite
            </h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={cn("text-[11px]", k.muted)}>
                {suiteOriginLabel}
              </span>
              <span className="text-muted-foreground/30 text-[10px]">·</span>
              <span className="text-[11px] font-semibold text-primary">
                {streamName || selectedScope?.name || "Current stream"}
              </span>
              {suiteSnapshotId && (
                <>
                  <span className="text-muted-foreground/30 text-[10px]">
                    ·
                  </span>
                  <span className="text-[11px] font-semibold text-blue-600">
                    Snapshot
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleGenerateSuite}
            disabled={generateSuiteMut.isPending}
            className={cn(k.btnGhost, "gap-1.5")}
          >
            {generateSuiteMut.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            {curatedCases.length > 0
              ? "Generate"
              : cases.length > 0
                ? "Refresh"
                : "Generate"}
          </button>
          <button
            onClick={runAgentEval}
            disabled={
              agentEvalMut.isPending || cases.every(c => !c.query.trim())
            }
            className={cn(k.btnSecondary, "gap-1.5")}
          >
            {agentEvalMut.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ShieldCheck className="w-3.5 h-3.5" />
            )}
            E2E
          </button>
          <button
            onClick={runEval}
            disabled={
              evalAutoMut.isPending || cases.every(c => !c.query.trim())
            }
            className={cn(k.btnPrimary, "gap-1.5")}
          >
            {evalAutoMut.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5" />
            )}
            {evalAutoMut.isPending ? "Running..." : "Evaluate"}
          </button>
        </div>
      </div>

      {/* ── Row 2: Bento — Test cases (left 3/5) | Status + suites (right 2/5) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Left: Test Cases */}
        <div className={cn(cardCls, "p-4 lg:col-span-3")}>
          <div className="flex items-center justify-between mb-3">
            <p
              className={cn(
                "text-xs font-bold uppercase tracking-wider",
                k.muted
              )}
            >
              Test Cases ({cases.length})
            </p>
            <button
              onClick={addCase}
              className={cn(k.btnGhost, "text-xs gap-1")}
            >
              <Plus className="w-3 h-3" /> Add
            </button>
          </div>
          {cases.length > 0 ? (
            <div className="space-y-2 max-h-105 overflow-y-auto pr-1">
              {cases.map((tc, idx) => (
                <div key={tc.id} className="flex items-start gap-2 group">
                  <span
                    className={cn(
                      "w-5 h-8 flex items-center justify-center text-[11px] font-bold shrink-0",
                      k.muted
                    )}
                  >
                    {idx + 1}
                  </span>
                  <div className="flex-1 space-y-1">
                    <input
                      value={tc.query}
                      onChange={e => updateCase(tc.id, "query", e.target.value)}
                      placeholder="Test query..."
                      className={cn(k.input, "text-xs py-1.5")}
                    />
                    <input
                      value={tc.expectedAnswer}
                      onChange={e =>
                        updateCase(tc.id, "expectedAnswer", e.target.value)
                      }
                      placeholder="Expected answer (optional)..."
                      className={cn(
                        k.input,
                        "text-xs py-1 text-muted-foreground"
                      )}
                    />
                  </div>
                  <button
                    onClick={() => removeCase(tc.id)}
                    className="p-1 rounded-md text-muted-foreground/30 hover:text-red-500 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <FlaskConical className="w-8 h-8 text-violet-500/15" />
              <p className={cn("text-xs", k.muted)}>
                Generate cases or add them manually.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={handleGenerateSuite}
                  disabled={generateSuiteMut.isPending}
                  className={cn(k.btnSecondary, "gap-1.5 text-xs")}
                >
                  {generateSuiteMut.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  Generate
                </button>
                <button
                  onClick={addCase}
                  className={cn(k.btnGhost, "gap-1.5 text-xs")}
                >
                  <Plus className="w-3.5 h-3.5" /> Manual
                </button>
              </div>
            </div>
          )}
          {(evalAutoMut.isPending || agentEvalMut.isPending) && (
            <div className="flex items-center gap-2 pt-3 border-t border-border/30 mt-3">
              <Loader2 className="w-4 h-4 animate-spin text-violet-600" />
              <span className={cn("text-xs", k.muted)}>
                Running {cases.filter(c => c.query.trim()).length} cases
                {agentEvalMut.isPending ? " (E2E)" : ""}...
              </span>
            </div>
          )}
        </div>

        {/* Right: Status tiles + Maintained Suite */}
        <div className="lg:col-span-2 space-y-3">
          <div className="grid grid-cols-1 gap-2">
            <div
              className={cn(
                cardCls,
                "px-4 py-3 flex items-center justify-between"
              )}
            >
              <div>
                <p
                  className={cn(
                    "text-[10px] font-bold uppercase tracking-wider",
                    k.muted
                  )}
                >
                  Launch Gate
                </p>
                <p className="text-lg font-bold text-foreground mt-0.5">
                  {launchReadinessQ.data
                    ? launchReadinessQ.data.ready
                      ? "Ready"
                      : `${passedLaunchChecks}/${Math.max(launchChecks.length, 1)}`
                    : "Pending"}
                </p>
              </div>
              {launchReadinessQ.data && (
                <span
                  className={cn(
                    "text-[11px] font-semibold",
                    launchReadinessQ.data.ready
                      ? "text-emerald-600"
                      : "text-primary"
                  )}
                >
                  {launchReadinessQ.data.ready
                    ? "all checks"
                    : "checks passing"}
                </span>
              )}
            </div>
            <div
              className={cn(
                cardCls,
                "px-4 py-3 flex items-center justify-between"
              )}
            >
              <div>
                <p
                  className={cn(
                    "text-[10px] font-bold uppercase tracking-wider",
                    k.muted
                  )}
                >
                  Agent Eval
                </p>
                <p className="text-lg font-bold text-foreground mt-0.5">
                  {latestAgentEval ? `${latestAgentEval.passRate}%` : "—"}
                </p>
              </div>
              {latestAgentEval && (
                <span
                  className={cn(
                    "text-[11px] font-semibold",
                    latestAgentEval.passed ? "text-emerald-600" : "text-primary"
                  )}
                >
                  {latestAgentEval.passedCases}/{latestAgentEval.totalCases}{" "}
                  passed
                </span>
              )}
            </div>
            <div
              className={cn(
                cardCls,
                "px-4 py-3 flex items-center justify-between"
              )}
            >
              <div>
                <p
                  className={cn(
                    "text-[10px] font-bold uppercase tracking-wider",
                    k.muted
                  )}
                >
                  Release
                </p>
                <p className="text-lg font-bold text-foreground mt-0.5">
                  {latestRelease
                    ? latestRelease.status === "promoted"
                      ? "Promoted"
                      : latestRelease.status === "candidate"
                        ? "Candidate"
                        : "History"
                    : "—"}
                </p>
              </div>
              <button
                onClick={() =>
                  createReleaseMut.mutate({
                    valueStreamId,
                    basedOnEvalRunId: latestAgentEval?.id,
                  })
                }
                disabled={createReleaseMut.isPending || !latestAgentEval}
                className={cn(k.btnGhost, "text-[11px] gap-1")}
              >
                {createReleaseMut.isPending ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Plus className="w-3 h-3" />
                )}
                New
              </button>
            </div>
          </div>

          <div className={cn(cardCls, "p-3 space-y-2")}>
            <div className="flex items-center justify-between">
              <p
                className={cn(
                  "text-[10px] font-bold uppercase tracking-wider",
                  k.muted
                )}
              >
                Maintained Suite
              </p>
              {managedSuiteId && (
                <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold">
                  Editing
                </span>
              )}
            </div>
            <div className="flex gap-1.5">
              <input
                value={managedSuiteName}
                onChange={e => setManagedSuiteName(e.target.value)}
                placeholder="Suite name..."
                className={cn(k.input, "text-xs py-1.5 flex-1")}
              />
              <button
                onClick={handleSaveSuite}
                disabled={saveSuiteMut.isPending || !valueStreamId}
                className={cn(k.btnSecondary, "text-xs shrink-0")}
              >
                {saveSuiteMut.isPending ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : null}
                {managedSuiteId ? "Update" : "Save"}
              </button>
            </div>
            {valueStreamId ? (
              savedSuitesQ.isLoading ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" /> Loading...
                </div>
              ) : savedSuites.length > 0 ? (
                <div className="space-y-1.5 max-h-45 overflow-y-auto">
                  {savedSuites.map(suite => {
                    const isActiveSuite = managedSuiteId === suite.id;
                    return (
                      <div
                        key={suite.id}
                        className={cn(
                          "rounded-lg border border-border/30 px-2.5 py-2 flex items-center justify-between gap-2",
                          isActiveSuite && "ring-1 ring-primary/25 bg-primary/5"
                        )}
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-foreground truncate">
                            {suite.name}
                          </p>
                          <p className={cn("text-[10px]", k.muted)}>
                            {suite.caseCount} case
                            {suite.caseCount === 1 ? "" : "s"} ·{" "}
                            {formatMaintainedSuiteOrigin(suite.origin)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleLoadSavedSuite(suite)}
                            className={cn(k.btnGhost, "text-[11px] px-2 py-1")}
                          >
                            Load
                          </button>
                          <button
                            onClick={() => handleDeleteSuite(suite)}
                            disabled={deleteSuiteMut.isPending}
                            className="p-1 rounded-md text-muted-foreground/40 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className={cn("text-[11px]", k.muted)}>
                  No saved suites yet.
                </p>
              )
            ) : (
              <p className={cn("text-[11px]", k.muted)}>
                Select a domain to save suites.
              </p>
            )}
          </div>

          {launchChecks.length > 0 && (
            <div className={cn(cardCls, "p-3 space-y-1.5")}>
              <p
                className={cn(
                  "text-[10px] font-bold uppercase tracking-wider",
                  k.muted
                )}
              >
                Launch Checks
              </p>
              {launchChecks.map(check => (
                <div key={check.key} className="flex items-center gap-2">
                  {check.passed ? (
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-3.5 h-3.5 text-primary shrink-0" />
                  )}
                  <span className="text-xs text-foreground truncate">
                    {check.label}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Row 3: Agent E2E results + Releases (side by side when both present) ── */}
      {(latestAgentEval?.cases?.length > 0 ||
        (releasesQ.data && releasesQ.data.length > 0)) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {latestAgentEval?.cases?.length > 0 && (
            <div className={cn(cardCls, "p-4 space-y-2")}>
              <p
                className={cn(
                  "text-[10px] font-bold uppercase tracking-wider",
                  k.muted
                )}
              >
                Agent E2E Results
              </p>
              <div className="space-y-1.5 max-h-65 overflow-y-auto">
                {latestAgentEval.cases.map((result: any) => (
                  <div
                    key={result.caseId}
                    className="flex items-start gap-2 rounded-lg border border-border/20 px-2.5 py-2"
                  >
                    {result.passed ? (
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-medium text-foreground truncate">
                          {result.query}
                        </p>
                        <span
                          className={cn(
                            "text-xs font-bold tabular-nums shrink-0",
                            result.passed ? "text-emerald-600" : "text-primary"
                          )}
                        >
                          {result.confidence}%
                        </span>
                      </div>
                      {!result.passed && result.failureReasons?.length > 0 && (
                        <p className="text-[11px] mt-0.5 text-primary truncate">
                          {result.failureReasons.join(" · ")}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {releasesQ.data && releasesQ.data.length > 0 && (
            <div className={cn(cardCls, "p-4 space-y-2")}>
              <p
                className={cn(
                  "text-[10px] font-bold uppercase tracking-wider",
                  k.muted
                )}
              >
                Releases
              </p>
              <div className="space-y-1.5">
                {releasesQ.data.map((release: any) => (
                  <div
                    key={release.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border/20 px-2.5 py-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={cn(
                          "px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase shrink-0",
                          release.status === "promoted"
                            ? "bg-emerald-500/10 text-emerald-600"
                            : release.status === "candidate"
                              ? "bg-primary/10 text-primary"
                              : "bg-muted text-muted-foreground"
                        )}
                      >
                        {release.status.replace(/_/g, " ")}
                      </span>
                      <p className="text-xs font-medium text-foreground truncate">
                        {release.label}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {release.status !== "promoted" && (
                        <button
                          onClick={() =>
                            promoteReleaseMut.mutate({ releaseId: release.id })
                          }
                          disabled={
                            promoteReleaseMut.isPending ||
                            !launchReadinessQ.data?.ready
                          }
                          className={cn(k.btnGhost, "text-[11px] px-2 py-1")}
                        >
                          Promote
                        </button>
                      )}
                      {(release.status === "superseded" ||
                        release.status === "rolled_back") && (
                        <button
                          onClick={() =>
                            rollbackReleaseMut.mutate({ releaseId: release.id })
                          }
                          disabled={rollbackReleaseMut.isPending}
                          className={cn(k.btnGhost, "text-[11px] px-2 py-1")}
                        >
                          Restore
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Results (full-width) ── */}
      <AnimatePresence>
        {report && !evalAutoMut.isPending && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {summaryEntries.length > 0 && (
              <div className={cn(cardCls, "p-4")}>
                <div className="flex items-center justify-between mb-3">
                  <p
                    className={cn(
                      "text-xs font-bold flex items-center gap-2",
                      k.heading
                    )}
                  >
                    <Target className="w-3.5 h-3.5 text-violet-600" /> Aggregate
                    Scores
                  </p>
                  <span className={cn("text-[11px] tabular-nums", k.muted)}>
                    {report.totalCases ?? report.total_cases} cases &middot;{" "}
                    {(
                      (report.evalTimeMs ?? report.eval_time_ms) / 1000
                    ).toFixed(1)}
                    s
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {summaryEntries.map(([key, value]) => {
                    const meta = METRIC_META[key] ?? {
                      label: key,
                      color: "text-foreground",
                    };
                    const score = value as number;
                    return (
                      <div
                        key={key}
                        className="flex items-center gap-3 p-3 rounded-xl bg-muted/20 border border-border/30"
                      >
                        <ConfidenceRing value={score} size={40} />
                        <div>
                          <p
                            className={cn("text-xs font-semibold", meta.color)}
                          >
                            {meta.label}
                          </p>
                          <p className="text-lg font-bold text-foreground tabular-nums">
                            {(score * 100).toFixed(0)}%
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className={cn(cardCls, "overflow-hidden")}>
              <div className="px-4 py-3 border-b border-border/50">
                <p
                  className={cn(
                    "text-xs font-bold uppercase tracking-wider",
                    k.muted
                  )}
                >
                  Per-Case Results
                </p>
              </div>
              <div className="divide-y divide-border/20">
                {caseResults.map((cr: any) => {
                  const caseId = cr.caseId ?? cr.case_id;
                  const isExpanded = expandedCase === caseId;
                  const metrics = cr.metrics ?? [];
                  const avgScore =
                    metrics.length > 0
                      ? metrics.reduce(
                          (sum: number, m: any) => sum + m.score,
                          0
                        ) / metrics.length
                      : 0;
                  return (
                    <div key={caseId}>
                      <button
                        onClick={() =>
                          setExpandedCase(isExpanded ? null : caseId)
                        }
                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/10 transition-colors"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/60" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60" />
                        )}
                        <span className="text-xs font-medium text-foreground flex-1 truncate">
                          {cr.query}
                        </span>
                        <div className="flex items-center gap-2">
                          {metrics.slice(0, 3).map((m: any) => {
                            const meta = METRIC_META[m.name];
                            return (
                              <span
                                key={m.name}
                                className={cn(
                                  "text-xs font-bold tabular-nums",
                                  m.score >= 0.7
                                    ? "text-emerald-600"
                                    : m.score >= 0.4
                                      ? "text-primary"
                                      : "text-red-500"
                                )}
                                title={meta?.label}
                              >
                                {(m.score * 100).toFixed(0)}%
                              </span>
                            );
                          })}
                          <ConfidenceRing value={avgScore} size={24} />
                        </div>
                      </button>
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="px-10 pb-4 space-y-2">
                              {metrics.map((m: any) => {
                                const meta = METRIC_META[m.name] ?? {
                                  label: m.name,
                                  desc: "",
                                  color: "text-foreground",
                                };
                                return (
                                  <div
                                    key={m.name}
                                    className="flex items-center gap-3"
                                  >
                                    <span
                                      className={cn(
                                        "text-xs font-semibold w-36",
                                        meta.color
                                      )}
                                    >
                                      {meta.label}
                                    </span>
                                    <div className="flex-1 h-2 rounded-full bg-muted/40 overflow-hidden">
                                      <div
                                        className={cn(
                                          "h-full rounded-full transition-all",
                                          m.score >= 0.7
                                            ? "bg-emerald-500"
                                            : m.score >= 0.4
                                              ? "bg-primary/80"
                                              : "bg-red-500"
                                        )}
                                        style={{ width: `${m.score * 100}%` }}
                                      />
                                    </div>
                                    <span className="text-xs font-bold tabular-nums w-12 text-right text-foreground">
                                      {(m.score * 100).toFixed(0)}%
                                    </span>
                                  </div>
                                );
                              })}
                              {metrics.length === 0 && (
                                <p className={cn("text-xs py-2", k.muted)}>
                                  No metrics — retrieval may have returned no
                                  results.
                                </p>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 3. QUALITY DASHBOARD
// ══════════════════════════════════════════════════════════════════════════════

function QualitySection({ docsQ, statsQ, docCount, chunkCount }: any) {
  const docs = docsQ.data?.documents ?? [];

  const freshnessDist = useMemo(() => {
    const buckets = { current: 0, review: 0, stale: 0, unknown: 0 };
    for (const doc of docs) {
      const f = getFreshness(doc.updatedAt || doc.createdAt || null);
      if (f.label === "Current") buckets.current++;
      else if (f.label === "Review") buckets.review++;
      else if (f.label === "Stale") buckets.stale++;
      else buckets.unknown++;
    }
    return buckets;
  }, [docs]);

  const typeDist = useMemo(() => {
    const map: Record<string, number> = {};
    for (const doc of docs) {
      const t = doc.documentType || "general";
      map[t] = (map[t] || 0) + 1;
    }
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [docs]);

  const deptDist = useMemo(() => {
    const map: Record<string, number> = {};
    for (const doc of docs) {
      const d = doc.department || "Uncategorized";
      map[d] = (map[d] || 0) + 1;
    }
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [docs]);

  const avgChunksPerDoc = docCount > 0 ? Math.round(chunkCount / docCount) : 0;

  return (
    <motion.div {...fadeIn} className="space-y-5">
      {/* Top-level metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          icon={FileText}
          label="Documents"
          value={docCount}
          color="emerald"
        />
        <MetricCard
          icon={Zap}
          label="Chunks"
          value={chunkCount}
          color="violet"
        />
        <MetricCard
          icon={BarChart3}
          label="Avg Chunks/Doc"
          value={avgChunksPerDoc}
          color="blue"
        />
        <MetricCard
          icon={Clock}
          label="Freshness"
          value={
            docCount > 0
              ? `${Math.round((freshnessDist.current / docCount) * 100)}%`
              : "\u2014"
          }
          color="amber"
          subtitle="current"
        />
      </div>

      {/* Freshness breakdown */}
      <div className={cn(cardCls, "p-5")}>
        <h3
          className={cn(
            "text-sm font-bold mb-4 flex items-center gap-2",
            k.heading
          )}
        >
          <ShieldCheck className="w-4 h-4 text-primary" />
          Content Freshness
        </h3>
        <div className="space-y-3">
          {[
            {
              label: "Current",
              count: freshnessDist.current,
              color: "bg-primary",
              textColor: "text-primary",
            },
            {
              label: "Needs Review",
              count: freshnessDist.review,
              color: "bg-primary/80",
              textColor: "text-primary",
            },
            {
              label: "Stale",
              count: freshnessDist.stale,
              color: "bg-red-500",
              textColor: "text-red-500",
            },
          ].map(row => {
            const pct = docCount > 0 ? (row.count / docCount) * 100 : 0;
            return (
              <div key={row.label} className="flex items-center gap-3">
                <span className={cn("text-xs font-medium w-24", row.textColor)}>
                  {row.label}
                </span>
                <div className="flex-1 h-2 rounded-full bg-black/4 dark:bg-muted/40 overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      row.color
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs font-bold text-foreground tabular-nums w-12 text-right">
                  {row.count}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Distribution grids */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className={cn(cardCls, "p-4")}>
          <h4
            className={cn(
              "text-xs font-bold uppercase tracking-wider mb-3",
              k.muted
            )}
          >
            By Department
          </h4>
          {deptDist.length === 0 ? (
            <p className={cn("text-xs py-4 text-center", k.muted)}>
              No department data
            </p>
          ) : (
            <div className="space-y-2">
              {deptDist.map(([name, count]) => (
                <div key={name} className="flex items-center justify-between">
                  <span className="text-xs text-foreground truncate flex-1">
                    {name}
                  </span>
                  <span className="text-xs font-bold text-muted-foreground/60 tabular-nums ml-2">
                    {count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className={cn(cardCls, "p-4")}>
          <h4
            className={cn(
              "text-xs font-bold uppercase tracking-wider mb-3",
              k.muted
            )}
          >
            By Document Type
          </h4>
          {typeDist.length === 0 ? (
            <p className={cn("text-xs py-4 text-center", k.muted)}>
              No type data
            </p>
          ) : (
            <div className="space-y-2">
              {typeDist.map(([name, count]) => (
                <div key={name} className="flex items-center justify-between">
                  <span className="text-xs text-foreground truncate flex-1 capitalize">
                    {name}
                  </span>
                  <span className="text-xs font-bold text-muted-foreground/60 tabular-nums ml-2">
                    {count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tip */}
      <div className="flex items-center gap-3 p-3.5 rounded-xl border border-dashed border-primary/20 bg-primary/2">
        <TrendingUp className="w-5 h-5 text-primary/40 shrink-0" />
        <p className={cn("text-[11px]", k.muted)}>
          Use the <strong>Eval Suite</strong> to batch-test retrieval quality,
          or <strong>Gap Analysis</strong> to identify missing topics.
        </p>
      </div>
    </motion.div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 4. GAP ANALYSIS (preserved from original)
// ══════════════════════════════════════════════════════════════════════════════

function GapAnalysisSection({
  streamName,
  streamDescription,
  valueStreamId,
  docsQ,
  docCount,
  chunkCount,
  onStepComplete,
  notify,
}: any) {
  const [gapAnalysis, setGapAnalysis] = useState<any>(null);
  const utils = trpc.useUtils();

  // Always have a valueStreamId — fallback to "all" for All-Streams view
  const effectiveStreamId = valueStreamId || "all";

  // ── Auto-load latest snapshot on mount ──────────────────────────────────
  const latestSnapshotQ = trpc.gemini.listGapSnapshots.useQuery(
    { valueStreamId: effectiveStreamId, limit: 1 },
    { staleTime: 60_000 }
  );

  const latestSnapshotId = latestSnapshotQ.data?.snapshots?.[0]?.id;

  const latestDetailQ = trpc.gemini.getGapSnapshot.useQuery(
    { snapshotId: latestSnapshotId! },
    {
      enabled: !!latestSnapshotId && !gapAnalysis,
      staleTime: 300_000,
    }
  );

  // Hydrate local state from DB when no fresh analysis exists
  useEffect(() => {
    if (!gapAnalysis && latestDetailQ.data) {
      setGapAnalysis({
        coverageScore: latestDetailQ.data.coverageScore,
        coverageLabel: latestDetailQ.data.coverageLabel,
        summary: latestDetailQ.data.summary,
        strengths: latestDetailQ.data.strengths,
        gaps: latestDetailQ.data.gaps,
        staleContent: latestDetailQ.data.staleContent,
        recommendations: latestDetailQ.data.recommendations,
      });
    }
  }, [latestDetailQ.data, gapAnalysis]);

  const analyzeGapsMut = trpc.gemini.analyzeGaps.useMutation({
    onSuccess: d => {
      setGapAnalysis((d as any).analysis);
      notify?.({
        title: "Gap Analysis complete",
        description: "Coverage report generated.",
        severity: "success",
        group: "validate",
      });
      utils.gemini.listGapSnapshots.invalidate({
        valueStreamId: effectiveStreamId,
      });
      onStepComplete?.("gap-analysis");
    },
    onError: e => {
      notify?.({
        title: "Gap Analysis failed",
        description: e.message,
        severity: "error",
        group: "validate",
      });
    },
  });

  const handleAnalyze = () => {
    const docs = docsQ.data?.documents ?? [];
    analyzeGapsMut.mutate({
      streamName: streamName || "All Domains",
      streamDescription,
      valueStreamId: effectiveStreamId,
      documents: docs.slice(0, 50).map((d: any) => ({
        title: d.title || "Untitled",
        department: d.department,
        documentType: d.documentType,
        chunkCount: d.chunkCount,
        createdAt: d.createdAt,
      })),
      recentQueries: (docsQ.data as any)?.recentQueries ?? [],
    });
  };

  const gapsByPriority = useMemo(() => {
    const gaps = gapAnalysis?.gaps ?? [];
    const high = gaps.filter((g: any) => g.severity === "high");
    const medium = gaps.filter((g: any) => g.severity === "medium");
    const low = gaps.filter(
      (g: any) => g.severity !== "high" && g.severity !== "medium"
    );
    return { high, medium, low, total: gaps.length };
  }, [gapAnalysis?.gaps]);

  const coverageColor = (score: number) =>
    score >= 75
      ? "text-emerald-600 dark:text-emerald-400"
      : score >= 50
        ? "text-primary"
        : "text-red-600 dark:text-red-400";

  return (
    <motion.div {...fadeIn} className="space-y-6">
      {/* ── Header ── */}
      <div className={cn(cardCls, "overflow-hidden")}>
        <div className="p-6 pb-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
                <Target className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className={cn("text-lg font-bold", k.heading)}>
                  Knowledge Gap Analysis
                </h3>
                <p className={cn("text-sm mt-0.5", k.muted)}>
                  {docCount} documents &middot; {chunkCount} chunks indexed
                  &middot; every run saves a versioned snapshot
                </p>
              </div>
            </div>
            <button
              onClick={handleAnalyze}
              disabled={analyzeGapsMut.isPending}
              className={k.btnPrimary}
            >
              {analyzeGapsMut.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Target className="w-4 h-4" />
              )}
              {analyzeGapsMut.isPending
                ? "Analyzing..."
                : latestSnapshotId
                  ? "Save New Snapshot"
                  : "Run First Snapshot"}
            </button>
          </div>
        </div>

        <div className="border-t border-border/40 px-6 py-4 bg-muted/10">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <p className={cn("text-xs", k.muted)}>
              Continuous coverage tracking: compare each gap-analysis snapshot
              against the previous run to prove that new content actually closed
              the right gaps.
            </p>
            {latestSnapshotQ.data?.snapshots?.[0]?.createdAt && (
              <span className="text-xs font-semibold text-foreground">
                Latest snapshot{" "}
                {new Date(
                  latestSnapshotQ.data.snapshots[0].createdAt
                ).toLocaleString()}
              </span>
            )}
          </div>
        </div>

        {/* What Gemini checks — 3-pillar strip */}
        <div className="grid grid-cols-3 border-t border-border/40">
          {[
            {
              label: "Indexing",
              desc: "Are documents properly chunked & retrievable?",
              color: "text-primary",
              icon: FileText,
            },
            {
              label: "Coverage",
              desc: "Does your KB cover all domain topics?",
              color: "text-violet-600 dark:text-violet-400",
              icon: Target,
            },
            {
              label: "Freshness",
              desc: "Is content current and accurate?",
              color: "text-primary",
              icon: Clock,
            },
          ].map((pillar, i) => (
            <div
              key={pillar.label}
              className={cn("px-5 py-4", i > 0 && "border-l border-border/40")}
            >
              <div className="flex items-center gap-2 mb-1">
                <pillar.icon className={cn("w-3.5 h-3.5", pillar.color)} />
                <span
                  className={cn(
                    "text-xs font-bold uppercase tracking-wider",
                    pillar.color
                  )}
                >
                  {pillar.label}
                </span>
              </div>
              <p className={cn("text-xs leading-relaxed", k.muted)}>
                {pillar.desc}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Loading state with staged progress ── */}
      {(analyzeGapsMut.isPending ||
        (latestDetailQ.isLoading && !gapAnalysis)) && (
        <div className={cn(cardCls, "p-8")}>
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            </div>
            <div className="text-center">
              <p className={cn("text-sm font-semibold", k.heading)}>
                {analyzeGapsMut.isPending
                  ? "Analyzing your domain library..."
                  : "Loading latest analysis..."}
              </p>
              {analyzeGapsMut.isPending && (
                <p
                  className={cn(
                    "text-xs mt-1.5 max-w-sm mx-auto leading-relaxed",
                    k.muted
                  )}
                >
                  Gemini is scanning {docCount} documents across your domain to
                  identify coverage gaps, stale content, and missing topics.
                </p>
              )}
            </div>
            {analyzeGapsMut.isPending && (
              <div className="flex items-center gap-6 mt-1">
                {["Scanning docs", "Finding gaps", "Generating report"].map(
                  (stage, i) => (
                    <div key={stage} className="flex items-center gap-1.5">
                      <div
                        className={cn(
                          "w-1.5 h-1.5 rounded-full",
                          i === 0 ? "bg-primary animate-pulse" : "bg-muted"
                        )}
                      />
                      <span
                        className={cn(
                          "text-[11px]",
                          i === 0 ? "text-primary font-medium" : k.muted
                        )}
                      >
                        {stage}
                      </span>
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Results ── */}
      <AnimatePresence>
        {gapAnalysis && !analyzeGapsMut.isPending && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            className="space-y-5"
          >
            {/* Coverage Score Hero */}
            {gapAnalysis.coverageScore != null && (
              <div className={cn(cardCls, "p-6")}>
                <div className="flex items-start gap-6">
                  <div className="shrink-0">
                    <ConfidenceRing
                      value={gapAnalysis.coverageScore / 100}
                      size={88}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h4
                        className={cn(
                          "text-xl font-bold tabular-nums",
                          coverageColor(gapAnalysis.coverageScore)
                        )}
                      >
                        {gapAnalysis.coverageScore}% Coverage
                      </h4>
                      {gapAnalysis.coverageLabel && (
                        <span
                          className={cn(
                            "px-2.5 py-0.5 text-xs font-bold rounded-full uppercase tracking-wider",
                            gapAnalysis.coverageScore >= 75
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : gapAnalysis.coverageScore >= 50
                                ? "bg-primary/10 text-primary"
                                : "bg-red-500/10 text-red-600 dark:text-red-400"
                          )}
                        >
                          {gapAnalysis.coverageLabel}
                        </span>
                      )}
                    </div>
                    <p className={cn("text-sm leading-relaxed", k.muted)}>
                      {gapAnalysis.summary ||
                        "Based on Gemini analysis of your indexed documents against domain scope."}
                    </p>
                    {/* Quick stats strip */}
                    <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/30">
                      <span className="flex items-center gap-1.5 text-xs">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="font-semibold text-foreground">
                          {gapAnalysis.strengths?.length ?? 0}
                        </span>
                        <span className={k.muted}>strengths</span>
                      </span>
                      <span className="flex items-center gap-1.5 text-xs">
                        <AlertTriangle className="w-3.5 h-3.5 text-primary" />
                        <span className="font-semibold text-foreground">
                          {gapsByPriority.total}
                        </span>
                        <span className={k.muted}>gaps found</span>
                      </span>
                      {gapsByPriority.high.length > 0 && (
                        <span className="flex items-center gap-1.5 text-xs">
                          <span className="w-2 h-2 rounded-full bg-red-500" />
                          <span className="font-semibold text-red-600 dark:text-red-400">
                            {gapsByPriority.high.length} critical
                          </span>
                        </span>
                      )}
                      <span className="flex items-center gap-1.5 text-xs">
                        <ArrowRight className="w-3.5 h-3.5 text-blue-500" />
                        <span className="font-semibold text-foreground">
                          {gapAnalysis.recommendations?.length ?? 0}
                        </span>
                        <span className={k.muted}>actions</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Strengths & Gaps — side by side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Strengths */}
              {gapAnalysis.strengths?.length > 0 && (
                <div className={cn(cardCls, "overflow-hidden")}>
                  <div className="px-5 py-3.5 border-b border-border/40 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                    <h4 className="text-sm font-bold text-foreground">
                      Strengths
                    </h4>
                    <span className="ml-auto px-2 py-0.5 text-xs font-bold rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      {gapAnalysis.strengths.length}
                    </span>
                  </div>
                  <div className="p-5 space-y-3">
                    {gapAnalysis.strengths.map((s: string, i: number) => (
                      <div key={i} className="flex items-start gap-3">
                        <div className="w-5 h-5 rounded-md bg-emerald-500/10 flex items-center justify-center shrink-0 mt-0.5">
                          <CheckCircle className="w-3 h-3 text-emerald-500" />
                        </div>
                        <p className="text-sm text-foreground/80 leading-relaxed">
                          {s}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Gaps */}
              {gapsByPriority.total > 0 && (
                <div className={cn(cardCls, "overflow-hidden")}>
                  <div className="px-5 py-3.5 border-b border-border/40 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-primary" />
                    <h4 className="text-sm font-bold text-foreground">
                      Gaps Identified
                    </h4>
                    <span className="ml-auto px-2 py-0.5 text-xs font-bold rounded-full bg-primary/10 text-primary">
                      {gapsByPriority.total}
                    </span>
                  </div>
                  <div className="p-5 space-y-3.5">
                    {gapAnalysis.gaps.map((g: any, i: number) => (
                      <div key={i} className="flex items-start gap-3">
                        <span
                          className={cn(
                            "px-2 py-0.5 text-xs font-bold rounded uppercase shrink-0 mt-0.5",
                            g.severity === "high"
                              ? "bg-red-500/10 text-red-600 dark:text-red-400"
                              : g.severity === "medium"
                                ? "bg-primary/10 text-primary"
                                : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                          )}
                        >
                          {g.severity}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">
                            {g.topic}
                          </p>
                          {g.suggestion && (
                            <p
                              className={cn(
                                "text-xs mt-1 leading-relaxed",
                                k.muted
                              )}
                            >
                              {g.suggestion}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Recommendations */}
            {gapAnalysis.recommendations?.length > 0 && (
              <div className={cn(cardCls, "overflow-hidden")}>
                <div className="px-5 py-3.5 border-b border-border/40 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-blue-500" />
                  <h4 className="text-sm font-bold text-foreground">
                    Recommended Actions
                  </h4>
                  <span className="ml-auto px-2 py-0.5 text-xs font-bold rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">
                    {gapAnalysis.recommendations.length}
                  </span>
                </div>
                <div className="p-5 space-y-3.5">
                  {gapAnalysis.recommendations.map((r: string, i: number) => (
                    <div key={i} className="flex items-start gap-3.5">
                      <span className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 text-sm font-bold flex items-center justify-center shrink-0">
                        {i + 1}
                      </span>
                      <p className="text-sm text-foreground/80 leading-relaxed pt-1">
                        {r}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Coverage Diff — inline diff intelligence */}
            <GapCoverageDiff
              valueStreamId={effectiveStreamId}
              currentAnalysis={{
                coverageScore: gapAnalysis.coverageScore ?? 0,
                gaps: gapAnalysis.gaps ?? [],
                strengths: gapAnalysis.strengths ?? [],
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Empty state ── */}
      {!gapAnalysis &&
        !analyzeGapsMut.isPending &&
        !latestDetailQ.isLoading && (
          <div className={cn(cardCls, "p-8")}>
            <div className="flex flex-col items-center text-center max-w-lg mx-auto">
              <div className="w-14 h-14 rounded-2xl bg-primary/8 flex items-center justify-center mb-4">
                <Target className="w-7 h-7 text-primary/40" />
              </div>
              <h4 className={cn("text-base font-bold mb-1.5", k.heading)}>
                Ready to analyze your domain library
              </h4>
              <p className={cn("text-sm leading-relaxed mb-5", k.muted)}>
                Gemini will review your {docCount} indexed documents, compare
                them against your domain scope, and produce a detailed coverage
                report with actionable recommendations.
              </p>
              <div className="grid grid-cols-3 gap-3 w-full mb-6">
                {[
                  {
                    icon: CheckCircle,
                    label: "Identify strengths",
                    desc: "What your KB does well",
                  },
                  {
                    icon: AlertTriangle,
                    label: "Find gaps",
                    desc: "Missing topics by priority",
                  },
                  {
                    icon: Zap,
                    label: "Get actions",
                    desc: "Prioritized next steps",
                  },
                ].map(item => (
                  <div
                    key={item.label}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-muted/40"
                  >
                    <item.icon className="w-4 h-4 text-primary/60" />
                    <span className="text-xs font-semibold text-foreground">
                      {item.label}
                    </span>
                    <span className={cn("text-[11px]", k.muted)}>
                      {item.desc}
                    </span>
                  </div>
                ))}
              </div>
              <button
                onClick={handleAnalyze}
                disabled={analyzeGapsMut.isPending}
                className={k.btnPrimary}
              >
                <Target className="w-4 h-4" />
                Run Gap Analysis
              </button>
            </div>
          </div>
        )}
    </motion.div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// HELPER COMPONENTS
// ══════════════════════════════════════════════════════════════════════════════

function ConfidenceRing({ value, size }: { value: number; size: number }) {
  const r = (size - 6) / 2;
  const circumference = 2 * Math.PI * r;
  const color =
    value >= 0.8
      ? ACCENT
      : value >= 0.5
        ? "color-mix(in srgb, var(--primary) 62%, var(--muted-foreground) 38%)"
        : "#ef4444";
  const textColor =
    value >= 0.8
      ? "text-primary"
      : value >= 0.5
        ? "text-primary"
        : "text-red-500";

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={3}
          className="stroke-black/5 dark:stroke-white/6"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={3}
          strokeLinecap="round"
          stroke={color}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - value)}
        />
      </svg>
      <span
        className={cn(
          "absolute inset-0 flex items-center justify-center font-bold tabular-nums",
          textColor
        )}
        style={{ fontSize: size < 50 ? "10px" : "14px" }}
      >
        {Math.round(value * 100)}%
      </span>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  color,
  subtitle,
}: {
  icon: typeof FileText;
  label: string;
  value: string | number;
  color: string;
  subtitle?: string;
}) {
  const colorClasses: Record<string, string> = {
    blue: "bg-primary/5 border-primary/10",
    emerald: "bg-emerald-500/5 border-emerald-500/10",
    violet: "bg-violet-500/5 border-violet-500/10",
    amber: "bg-primary/5 border-primary/10",
  };
  const iconClasses: Record<string, string> = {
    blue: "text-primary",
    emerald: "text-emerald-500",
    violet: "text-violet-500",
    amber: "text-primary",
  };

  return (
    <div className={cn(cardCls, "p-4", colorClasses[color])}>
      <div className="flex items-center justify-between mb-2">
        <Icon className={cn("w-4 h-4", iconClasses[color])} />
        <span className="text-2xl font-bold text-foreground tabular-nums">
          {value}
        </span>
      </div>
      <p className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wide">
        {label}{" "}
        {subtitle && (
          <span className="normal-case font-normal">({subtitle})</span>
        )}
      </p>
    </div>
  );
}
