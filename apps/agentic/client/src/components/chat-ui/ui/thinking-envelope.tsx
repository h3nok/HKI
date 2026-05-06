/**
 * ThinkingEnvelope — HKI-branded reasoning indicator
 *
 * Bold, clear, elevated. Features the HKI hermetic isolation animation with
 * an enlarged, helpful trace timeline. Professional but unmistakably HKI.
 */

import { useMemo, useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Wrench,
  Search,
  Shield,
  Brain,
  BookOpen,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { ThinkingAnimation } from "./thinking-animation";
import { useFeatureAccess } from "@/_core/hooks/useFeatureAccess";
import type { TraceStep } from "../hooks/use-streaming-state";
import type { TaskMessageAttributes } from "../types";

const TRACE_ACCENT = "var(--primary)";

const ENVELOPE_SURFACE = {
  borderColor: "color-mix(in srgb, var(--border) 58%, var(--primary) 42%)",
  background:
    "linear-gradient(180deg, color-mix(in srgb, var(--card) 86%, var(--primary) 14%) 0%, color-mix(in srgb, var(--card) 94%, var(--primary) 6%) 54%, color-mix(in srgb, var(--background) 62%, var(--card) 38%) 100%)",
  boxShadow:
    "inset 0 1px 0 color-mix(in srgb, white 22%, transparent), 0 22px 48px -32px color-mix(in srgb, var(--primary) 62%, transparent), 0 12px 26px -20px rgba(0,0,0,0.34)",
};

const STEP_ICONS: Record<string, React.ElementType> = {
  guardrail: Shield,
  thinking: Brain,
  planning: Brain,
  tool_call: Wrench,
  tool_result: Wrench,
  knowledge_retrieval: BookOpen,
  reflecting: Brain,
};

const STEP_LABELS: Record<string, string> = {
  guardrail: "Validating input",
  routing: "Routing request",
  memory_recall: "Recalling context",
  thinking: "Reasoning",
  planning: "Planning approach",
  tool_call: "Executing tool",
  tool_result: "Processing result",
  knowledge_retrieval: "Searching domain knowledge",
  reflecting: "Synthesizing response",
  cache_hit: "Cache hit",
};

type ToolPair = {
  name: string;
  arguments?: Record<string, any>;
  output?: any;
  error?: string | null;
  durationMs?: number;
  isActive: boolean;
};

type TokenUsage = {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  llm_calls: number;
  kb_used?: boolean;
  kb_chunks_retrieved?: number;
  kb_search_ms?: number;
  estimated_ungrounded_total_tokens?: number;
  estimated_tokens_saved?: number;
  citations_used?: number;
};

type KnowledgeSignals = {
  kbUsed: boolean;
  chunksRetrieved: number;
  citationsUsed: number;
  avgSearchMs: number;
  documentCount: number;
  sectionCount: number;
  topScore: number;
  topSources: string[];
  estimatedTokensSaved: number;
};

type KnowledgeCitation = NonNullable<
  TaskMessageAttributes["citations"]
>[number];

type KnowledgeAccumulator = {
  documentKeys: Set<string>;
  sections: Set<string>;
  sourceScores: Map<string, number>;
  topScore: number;
};

function formatCount(
  count: number,
  singular: string,
  plural = `${singular}s`
): string {
  return `${count.toLocaleString()} ${count === 1 ? singular : plural}`;
}

function normalizeScorePercent(score: number): number | null {
  if (!Number.isFinite(score) || score <= 0) return null;
  if (score <= 1.0001) return Math.round(score * 100);
  if (score <= 100) return Math.round(score);
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readStringField(
  source: Record<string, unknown> | null | undefined,
  ...keys: string[]
): string | null {
  if (!source) return null;
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function readNumberField(
  source: Record<string, unknown> | null | undefined,
  ...keys: string[]
): number | null {
  if (!source) return null;
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return null;
}

function trackKnowledgeRecord(
  candidate: unknown,
  accumulator: KnowledgeAccumulator
) {
  if (!isRecord(candidate)) return;

  const nestedCitation = isRecord(candidate.citation)
    ? candidate.citation
    : null;
  const nestedMetadata = isRecord(candidate.metadata)
    ? candidate.metadata
    : null;

  const documentId =
    readStringField(candidate, "documentId", "document_id") ||
    readStringField(nestedCitation, "documentId", "document_id") ||
    readStringField(nestedMetadata, "documentId", "document_id");
  const title =
    readStringField(
      candidate,
      "title",
      "documentTitle",
      "document_title",
      "source",
      "sourceUrl",
      "source_url"
    ) ||
    readStringField(
      nestedCitation,
      "title",
      "documentTitle",
      "document_title",
      "source",
      "sourceUrl",
      "source_url"
    ) ||
    readStringField(
      nestedMetadata,
      "title",
      "documentTitle",
      "document_title",
      "source",
      "sourceUrl",
      "source_url"
    );
  const section =
    readStringField(candidate, "pageOrSection", "page_or_section", "section") ||
    readStringField(
      nestedCitation,
      "pageOrSection",
      "page_or_section",
      "section"
    ) ||
    readStringField(
      nestedMetadata,
      "pageOrSection",
      "page_or_section",
      "section"
    );
  const score =
    readNumberField(candidate, "score", "relevanceScore", "relevance_score") ||
    readNumberField(
      nestedCitation,
      "score",
      "relevanceScore",
      "relevance_score"
    ) ||
    readNumberField(
      nestedMetadata,
      "score",
      "relevanceScore",
      "relevance_score"
    );

  if (documentId || title) {
    accumulator.documentKeys.add(documentId || title || "unknown");
  }
  if (section) {
    accumulator.sections.add(section);
  }
  if (title) {
    accumulator.sourceScores.set(
      title,
      Math.max(accumulator.sourceScores.get(title) ?? 0, score ?? 0)
    );
  }
  if (typeof score === "number" && score > accumulator.topScore) {
    accumulator.topScore = score;
  }
}

function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 1000) {
    return "<1s";
  }

  if (ms < 60_000) {
    const seconds = ms / 1000;
    return `${seconds < 10 ? seconds.toFixed(1) : Math.round(seconds)}s`;
  }

  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1000);
  if (minutes < 60) {
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

function formatStep(step: TraceStep): string {
  const { type, content, metadata } = step;
  if (type === "tool_call" && metadata?.tool)
    return metadata.tool.replace(/_/g, " ");
  if (type === "tool_result") {
    const name =
      metadata?.tool?.replace(/_/g, " ") ||
      metadata?.result?.name?.replace(/_/g, " ") ||
      "tool";
    if (metadata?.result?.error) {
      return `${name} needs attention`;
    }
    const ms = metadata?.duration_ms || metadata?.result?.duration_ms;
    return ms
      ? `${name} completed in ${Math.round(ms)}ms`
      : `${name} completed`;
  }
  if (type === "knowledge_retrieval")
    return content || "Searching domain knowledge";
  return STEP_LABELS[type] || content || "Working";
}

function resolveLiveHeadline(
  phaseLabel: string | null | undefined,
  latestStep?: TraceStep | null
): string {
  const normalizedPhase = phaseLabel?.trim();
  if (normalizedPhase && normalizedPhase.toLowerCase() !== "thinking...") {
    return normalizedPhase;
  }

  switch (latestStep?.type) {
    case "knowledge_retrieval":
      return "Gathering evidence";
    case "tool_call":
      return "Running tools";
    case "tool_result":
      return latestStep?.metadata?.result?.error
        ? "Platform gateway needs attention"
        : "Running tools";
    case "reflecting":
      return "Synthesizing answer";
    case "planning":
      return "Planning next steps";
    case "thinking":
      return "Reasoning through the request";
    case "guardrail":
      return "Validating the request";
    default:
      return "Preparing response";
  }
}

function buildToolPairs(steps: TraceStep[]): ToolPair[] {
  const pairs: ToolPair[] = [];
  const pending: Array<{ name: string; arguments?: Record<string, any> }> = [];
  for (const step of steps) {
    if (step.type === "tool_call" && step.metadata?.tool) {
      pending.push({
        name: step.metadata.tool,
        arguments: step.metadata.arguments,
      });
    } else if (step.type === "tool_result") {
      const call = pending.shift();
      const result = step.metadata?.result;
      pairs.push({
        name: result?.name || call?.name || "unknown",
        arguments: call?.arguments,
        output: result?.output,
        error: result?.error,
        durationMs: result?.duration_ms || step.metadata?.duration_ms,
        isActive: false,
      });
    }
  }
  for (const call of pending) {
    pairs.push({ name: call.name, arguments: call.arguments, isActive: true });
  }
  return pairs;
}

function JsonPreview({ data, maxLines = 6 }: { data: any; maxLines?: number }) {
  if (data == null) return null;
  const text = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  const lines = text.split("\n");
  const display =
    lines.length > maxLines
      ? lines.slice(0, maxLines).join("\n") + "\n..."
      : text;
  return (
    <pre className="text-[10px] leading-relaxed font-mono text-muted-foreground/70 whitespace-pre-wrap break-all bg-muted/40 dark:bg-muted/20 rounded-lg px-3 py-2 mt-1.5 max-h-40 overflow-auto border border-border/30">
      {display}
    </pre>
  );
}

function ToolDetail({
  pair,
  showPayloads,
}: {
  pair: ToolPair;
  showPayloads: boolean;
}) {
  const [open, setOpen] = useState(false);
  const label = pair.name.replace(/_/g, " ");
  const canExpand = showPayloads || Boolean(pair.error);
  return (
    <div className="rounded-lg bg-muted/20 dark:bg-muted/10 border border-border/30 overflow-hidden">
      <button
        onClick={() => {
          if (!canExpand) return;
          setOpen(p => !p);
        }}
        className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-muted/30 transition-colors"
      >
        <Wrench
          className="w-3.5 h-3.5 shrink-0"
          style={{ color: TRACE_ACCENT }}
        />
        <span className="text-[12px] font-semibold text-foreground flex-1 truncate capitalize">
          {label}
        </span>
        {pair.isActive ? (
          <motion.span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ background: TRACE_ACCENT }}
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
        ) : pair.error ? (
          <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />
        ) : (
          <Check
            className="w-3.5 h-3.5 shrink-0"
            style={{ color: TRACE_ACCENT }}
            strokeWidth={2.5}
          />
        )}
        {pair.durationMs != null && (
          <span className="text-[10px] font-mono tabular-nums text-muted-foreground/60">
            {Math.round(pair.durationMs)}ms
          </span>
        )}
        {canExpand &&
          (open ? (
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/50" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50" />
          ))}
      </button>
      {open && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          transition={{ duration: 0.15 }}
          className="px-3 pb-2.5 space-y-1.5"
        >
          {showPayloads &&
            pair.arguments &&
            Object.keys(pair.arguments).length > 0 && (
              <div>
                <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/50">
                  Input
                </span>
                <JsonPreview data={pair.arguments} maxLines={4} />
              </div>
            )}
          {showPayloads && pair.output != null && (
            <div>
              <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/50">
                Output
              </span>
              <JsonPreview data={pair.output} />
            </div>
          )}
          {pair.error && (
            <p className="text-[11px] text-destructive mt-1">{pair.error}</p>
          )}
        </motion.div>
      )}
    </div>
  );
}

function useElapsed(isActive: boolean) {
  const [start, setStart] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (isActive && start === null) {
      setStart(Date.now());
      setElapsed(0);
    } else if (!isActive) setStart(null);
  }, [isActive, start]);
  useEffect(() => {
    if (!isActive || start === null) return;
    const id = setInterval(() => setElapsed(Date.now() - start), 100);
    return () => clearInterval(id);
  }, [isActive, start]);
  return `${(elapsed / 1000).toFixed(1)}s`;
}

// ── Main Component ───────────────────────────────────────────────────────────

interface ThinkingEnvelopeProps {
  steps: TraceStep[];
  isStreaming: boolean;
  phaseLabel?: string | null;
  className?: string;
  fallbackCitations?: TaskMessageAttributes["citations"];
}

export function ThinkingEnvelope({
  steps,
  isStreaming,
  phaseLabel,
  className = "",
  fallbackCitations = [],
}: ThinkingEnvelopeProps) {
  const { canView: canViewFeature } = useFeatureAccess();
  const visibleSteps = useMemo(
    () =>
      steps.filter(
        s => s.type !== "final_response" && s.type !== "memory_store"
      ),
    [steps]
  );
  const latestVisibleStep = visibleSteps[visibleSteps.length - 1] ?? null;
  const elapsed = useElapsed(isStreaming);
  const [isExpanded, setIsExpanded] = useState(false);
  const toolPairs = useMemo(() => buildToolPairs(steps), [steps]);
  const showTracePayloads = canViewFeature("debug.chat.tracePayloads");

  const reasoningSections = useMemo(
    () =>
      steps.filter(
        s =>
          s.type === "thinking" && s.metadata?.reasoning && s.metadata?.section
      ),
    [steps]
  );
  const dedupedSections = useMemo(() => {
    const map = new Map<string, (typeof reasoningSections)[number]>();
    for (const s of reasoningSections) map.set(s.metadata?.section || "", s);
    return Array.from(map.values());
  }, [reasoningSections]);

  const tokenUsage = useMemo(() => {
    const toNum = (v: unknown): number =>
      Number.isFinite(Number(v)) ? Number(v) : 0;
    for (const s of [...steps].reverse()) {
      if (!s.metadata?.token_usage) continue;
      const raw = s.metadata.token_usage as Record<string, unknown>;
      const usage: TokenUsage = {
        prompt_tokens: toNum(raw.prompt_tokens ?? raw.promptTokens),
        completion_tokens: toNum(raw.completion_tokens ?? raw.completionTokens),
        total_tokens: toNum(raw.total_tokens ?? raw.totalTokens),
        llm_calls: Math.max(
          1,
          Math.round(toNum(raw.llm_calls ?? raw.llmCalls ?? 1))
        ),
        kb_used:
          typeof raw.kb_used === "boolean"
            ? raw.kb_used
            : typeof raw.kbUsed === "boolean"
              ? raw.kbUsed
              : undefined,
        kb_chunks_retrieved: toNum(
          raw.kb_chunks_retrieved ?? raw.kbChunksRetrieved
        ),
        kb_search_ms: toNum(raw.kb_search_ms ?? raw.kbSearchMs),
        estimated_ungrounded_total_tokens: toNum(
          raw.estimated_ungrounded_total_tokens ??
            raw.estimatedUngroundedTotalTokens
        ),
        estimated_tokens_saved: toNum(
          raw.estimated_tokens_saved ?? raw.estimatedTokensSaved
        ),
        citations_used: toNum(raw.citations_used ?? raw.citationsUsed),
      };
      return usage;
    }
    return null;
  }, [steps]);

  const hasExplicitKnowledgeTrace = useMemo(
    () =>
      steps.some(step => {
        if (step.type === "knowledge_retrieval") return true;
        if (
          step.type === "tool_call" &&
          step.metadata?.tool === "search_knowledge"
        ) {
          return true;
        }
        if (step.type === "tool_result") {
          return (
            String(step.metadata?.result?.name || "") === "search_knowledge"
          );
        }
        return false;
      }) ||
      Boolean(
        tokenUsage &&
        (tokenUsage.kb_used ||
          tokenUsage.kb_chunks_retrieved ||
          tokenUsage.citations_used)
      ),
    [steps, tokenUsage]
  );

  const knowledgeSignals = useMemo<KnowledgeSignals>(() => {
    let chunksFromTools = 0;
    let citationsFromTools = 0;
    let searchMsTotal = 0;
    let searchMsCount = 0;
    const accumulator: KnowledgeAccumulator = {
      documentKeys: new Set<string>(),
      sections: new Set<string>(),
      sourceScores: new Map<string, number>(),
      topScore: 0,
    };

    for (const step of steps) {
      if (step.type === "knowledge_retrieval") {
        const cits = step.metadata?.citations;
        if (Array.isArray(cits)) {
          citationsFromTools += cits.length;
          for (const citation of cits) {
            trackKnowledgeRecord(citation, accumulator);
          }
        }
      }
      if (step.type !== "tool_result") continue;
      const result = step.metadata?.result;
      if (!result || String(result.name || "") !== "search_knowledge") continue;
      const output = isRecord(result.output)
        ? result.output
        : ({} as Record<string, unknown>);
      const results = Array.isArray(output.results) ? output.results : [];
      const citations = Array.isArray(output.citations) ? output.citations : [];
      const countFromTotal = readNumberField(
        output,
        "total_results",
        "totalResults"
      );
      const chunks = Number.isFinite(countFromTotal)
        ? Number(countFromTotal)
        : results.length;
      chunksFromTools += Math.max(0, chunks);
      citationsFromTools += citations.length;
      for (const citation of citations) {
        trackKnowledgeRecord(citation, accumulator);
      }
      for (const resultEntry of results) {
        trackKnowledgeRecord(resultEntry, accumulator);
      }
      const ms = Number(
        readNumberField(output, "search_time_ms", "searchTimeMs") ??
          result.duration_ms ??
          step.metadata?.duration_ms ??
          0
      );
      if (Number.isFinite(ms) && ms > 0) {
        searchMsTotal += ms;
        searchMsCount += 1;
      }
    }

    if (Array.isArray(fallbackCitations)) {
      for (const citation of fallbackCitations as KnowledgeCitation[]) {
        trackKnowledgeRecord(citation, accumulator);
      }
    }

    const chunksFromUsage = tokenUsage?.kb_chunks_retrieved ?? 0;
    const citationsFromUsage = tokenUsage?.citations_used ?? 0;
    const citationsFromMessage = Array.isArray(fallbackCitations)
      ? fallbackCitations.length
      : 0;
    const avgSearchMs =
      tokenUsage?.kb_search_ms && tokenUsage.kb_search_ms > 0
        ? tokenUsage.kb_search_ms
        : searchMsCount > 0
          ? searchMsTotal / searchMsCount
          : 0;
    const chunksRetrieved = Math.max(chunksFromUsage, chunksFromTools);
    const citationsUsed = Math.max(
      citationsFromUsage,
      citationsFromTools,
      citationsFromMessage
    );
    const kbUsed =
      Boolean(tokenUsage?.kb_used) || chunksRetrieved > 0 || citationsUsed > 0;

    return {
      kbUsed,
      chunksRetrieved,
      citationsUsed,
      avgSearchMs,
      documentCount: accumulator.documentKeys.size,
      sectionCount: accumulator.sections.size,
      topScore: accumulator.topScore,
      topSources: Array.from(accumulator.sourceScores.entries())
        .sort(
          (left, right) => right[1] - left[1] || left[0].localeCompare(right[0])
        )
        .slice(0, 3)
        .map(([title]) => title),
      estimatedTokensSaved: Math.max(
        0,
        tokenUsage?.estimated_tokens_saved ?? 0
      ),
    };
  }, [fallbackCitations, steps, tokenUsage]);

  const completedDuration = useMemo(() => {
    const timestamps = visibleSteps
      .map(step => Date.parse(step.timestamp))
      .filter(timestamp => Number.isFinite(timestamp));

    if (timestamps.length === 0) return null;

    const durationMs = Math.max(
      0,
      timestamps[timestamps.length - 1]! - timestamps[0]!
    );
    return formatDuration(durationMs);
  }, [visibleSteps]);

  const hasTelemetryGap = knowledgeSignals.kbUsed && !hasExplicitKnowledgeTrace;

  const topMatchPercent = useMemo(
    () => normalizeScorePercent(knowledgeSignals.topScore),
    [knowledgeSignals.topScore]
  );

  const knowledgeMetricPills = useMemo(() => {
    const pills: string[] = [];
    if (knowledgeSignals.documentCount > 0) {
      pills.push(formatCount(knowledgeSignals.documentCount, "doc", "docs"));
    }
    if (knowledgeSignals.chunksRetrieved > 0) {
      pills.push(formatCount(knowledgeSignals.chunksRetrieved, "chunk"));
    }
    if (knowledgeSignals.citationsUsed > 0) {
      pills.push(formatCount(knowledgeSignals.citationsUsed, "source"));
    }
    if (topMatchPercent != null) {
      pills.push(`${topMatchPercent}% top match`);
    }
    if (knowledgeSignals.avgSearchMs > 0) {
      pills.push(`${Math.round(knowledgeSignals.avgSearchMs)}ms retrieval`);
    }
    return pills;
  }, [knowledgeSignals, topMatchPercent]);

  const knowledgeExpandedSummary = useMemo(() => {
    if (!knowledgeSignals.kbUsed) return null;

    const parts: string[] = [];
    if (knowledgeSignals.documentCount > 0) {
      parts.push(formatCount(knowledgeSignals.documentCount, "document"));
    }
    if (knowledgeSignals.sectionCount > 0) {
      parts.push(formatCount(knowledgeSignals.sectionCount, "section"));
    }
    if (knowledgeSignals.citationsUsed > 0) {
      parts.push(formatCount(knowledgeSignals.citationsUsed, "source"));
    }

    if (parts.length === 0) {
      return "Grounded answer from knowledge retrieval.";
    }

    return `Grounded answer using ${parts.join(" · ")}.`;
  }, [knowledgeSignals]);

  const knowledgeLiveSummary = useMemo(() => {
    if (!hasExplicitKnowledgeTrace && !knowledgeSignals.kbUsed) {
      return null;
    }

    if (knowledgeSignals.documentCount > 0) {
      const parts = [
        `Grounding across ${formatCount(knowledgeSignals.documentCount, "document")}`,
      ];
      if (knowledgeSignals.sectionCount > 0) {
        parts.push(formatCount(knowledgeSignals.sectionCount, "section"));
      }
      if (knowledgeSignals.avgSearchMs > 0) {
        parts.push(`${Math.round(knowledgeSignals.avgSearchMs)}ms retrieval`);
      }
      return parts.join(" · ");
    }

    if (latestVisibleStep?.type === "knowledge_retrieval") {
      return "Searching domain knowledge for supporting evidence.";
    }

    if (knowledgeSignals.citationsUsed > 0) {
      return `Grounding response with ${formatCount(knowledgeSignals.citationsUsed, "source")}.`;
    }

    return "Knowledge grounding engaged.";
  }, [hasExplicitKnowledgeTrace, knowledgeSignals, latestVisibleStep?.type]);

  const liveStepFeed = useMemo(() => {
    const deduped: Array<{ step: TraceStep; count: number }> = [];
    for (const step of visibleSteps) {
      const label = formatStep(step);
      const previous = deduped[deduped.length - 1];
      if (previous && formatStep(previous.step) === label) {
        previous.count += 1;
      } else {
        deduped.push({ step, count: 1 });
      }
    }
    return deduped.slice(-4);
  }, [visibleSteps]);

  useEffect(() => {
    if (isStreaming) setIsExpanded(false);
  }, [isStreaming]);

  const toggleExpand = useCallback(() => setIsExpanded(p => !p), []);

  const summaryParts = useMemo(() => {
    const parts: string[] = [];
    if (knowledgeSignals.kbUsed) {
      parts.push("Grounded");
      if (knowledgeSignals.documentCount > 0) {
        parts.push(formatCount(knowledgeSignals.documentCount, "doc", "docs"));
      } else if (knowledgeSignals.citationsUsed > 0) {
        parts.push(formatCount(knowledgeSignals.citationsUsed, "source"));
      }
    }
    if (toolPairs.length > 0) {
      parts.push(
        `${toolPairs.length} tool${toolPairs.length !== 1 ? "s" : ""}`
      );
    }
    if (tokenUsage?.total_tokens && parts.length < 3) {
      parts.push(`${tokenUsage.total_tokens.toLocaleString()} tokens`);
    }
    return parts;
  }, [knowledgeSignals, tokenUsage?.total_tokens, toolPairs.length]);

  const hasContent =
    dedupedSections.length > 0 ||
    toolPairs.length > 0 ||
    visibleSteps.length > 0 ||
    knowledgeSignals.kbUsed;
  const hasFailedTool = toolPairs.some(pair => pair.error);
  const liveHeadline = useMemo(
    () => resolveLiveHeadline(phaseLabel, latestVisibleStep),
    [phaseLabel, latestVisibleStep]
  );
  const liveSubline = useMemo(() => {
    if (knowledgeLiveSummary) return knowledgeLiveSummary;
    if (visibleSteps.length > 0) {
      return `${visibleSteps.length} trace event${visibleSteps.length === 1 ? "" : "s"}`;
    }
    return "Initializing runtime";
  }, [knowledgeLiveSummary, visibleSteps.length]);
  const completedSubline = useMemo(() => {
    const parts: string[] = [];
    const failedTools = toolPairs.filter(pair => pair.error).length;
    if (knowledgeSignals.kbUsed) {
      const knowledgeParts: string[] = [];
      if (knowledgeSignals.documentCount > 0) {
        knowledgeParts.push(
          formatCount(knowledgeSignals.documentCount, "doc", "docs")
        );
      }
      if (knowledgeSignals.chunksRetrieved > 0) {
        knowledgeParts.push(
          formatCount(knowledgeSignals.chunksRetrieved, "chunk")
        );
      }
      if (knowledgeSignals.citationsUsed > 0) {
        knowledgeParts.push(
          formatCount(knowledgeSignals.citationsUsed, "source")
        );
      }
      parts.push(
        knowledgeParts.length > 0
          ? knowledgeParts.join(" · ")
          : "knowledge retrieval"
      );
    }
    if (failedTools > 0) {
      parts.push(
        `${failedTools} platform event${failedTools === 1 ? "" : "s"}`
      );
    } else if (toolPairs.length > 0) {
      parts.push(
        `${toolPairs.length} tool call${toolPairs.length === 1 ? "" : "s"}`
      );
    }
    if (dedupedSections.length > 0) parts.push("reasoning");
    if (parts.length === 0) return "Expand for details";
    return parts.join(", ");
  }, [knowledgeSignals.kbUsed, toolPairs, dedupedSections.length]);

  // ── Collapsed post-streaming ──
  if (!isStreaming && hasContent) {
    return (
      <motion.div
        initial={{ opacity: 0.8 }}
        animate={{ opacity: 1 }}
        className={className}
      >
        <div
          className="rounded-2xl overflow-hidden border"
          style={ENVELOPE_SURFACE}
        >
          <button
            onClick={toggleExpand}
            className="flex items-center gap-3 w-full px-3.5 py-2.5 text-left transition-colors hover:bg-background/35"
          >
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
              style={{
                background: hasFailedTool
                  ? "color-mix(in srgb, var(--destructive) 10%, transparent)"
                  : "color-mix(in srgb, var(--primary) 9%, transparent)",
                color: hasFailedTool ? "var(--destructive)" : TRACE_ACCENT,
              }}
            >
              {hasFailedTool ? (
                <AlertTriangle className="h-3.5 w-3.5" />
              ) : (
                <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
              )}
            </span>

            <span className="min-w-0 flex-1">
              <span className="block text-[12px] font-semibold text-foreground">
                {hasFailedTool ? "Trace needs attention" : "Runtime trace"}
              </span>
              <span className="block truncate text-[11px] text-muted-foreground/72">
                {completedDuration ?? ""}
                {completedDuration && completedSubline ? " · " : ""}
                {completedSubline}
              </span>
            </span>

            <span className="text-muted-foreground/45">
              {isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </span>
            <div className="hidden items-center gap-1.5 md:flex">
              {summaryParts.map(p => (
                <span
                  key={p}
                  className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium"
                  style={{
                    background:
                      p === "Grounded"
                        ? "color-mix(in srgb, #10B981 10%, transparent)"
                        : "color-mix(in srgb, var(--muted) 60%, transparent)",
                    color:
                      p === "Grounded" ? "#10B981" : "var(--muted-foreground)",
                    border:
                      p === "Grounded"
                        ? "1px solid color-mix(in srgb, #10B981 20%, var(--border))"
                        : "1px solid var(--border)",
                  }}
                >
                  {p}
                </span>
              ))}
            </div>
          </button>

          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="border-t border-border/30"
              >
                <div className="p-4 space-y-3">
                  {knowledgeSignals.kbUsed && (
                    <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/4 p-3">
                      <div className="flex items-center gap-2">
                        <BookOpen className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                        <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                          Knowledge grounding
                        </p>
                      </div>

                      <p className="mt-1 text-[12px] text-muted-foreground leading-relaxed">
                        {knowledgeExpandedSummary}
                      </p>

                      <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                        {knowledgeSignals.documentCount > 0 && (
                          <div className="rounded-lg border border-border/40 bg-background/70 px-2.5 py-2">
                            <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/60">
                              Documents
                            </p>
                            <p className="mt-1 text-[13px] font-semibold text-foreground tabular-nums">
                              {knowledgeSignals.documentCount.toLocaleString()}
                            </p>
                          </div>
                        )}
                        {knowledgeSignals.chunksRetrieved > 0 && (
                          <div className="rounded-lg border border-border/40 bg-background/70 px-2.5 py-2">
                            <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/60">
                              Chunks
                            </p>
                            <p className="mt-1 text-[13px] font-semibold text-foreground tabular-nums">
                              {knowledgeSignals.chunksRetrieved.toLocaleString()}
                            </p>
                          </div>
                        )}
                        {knowledgeSignals.citationsUsed > 0 && (
                          <div className="rounded-lg border border-border/40 bg-background/70 px-2.5 py-2">
                            <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/60">
                              Sources
                            </p>
                            <p className="mt-1 text-[13px] font-semibold text-foreground tabular-nums">
                              {knowledgeSignals.citationsUsed.toLocaleString()}
                            </p>
                          </div>
                        )}
                        {knowledgeSignals.avgSearchMs > 0 && (
                          <div className="rounded-lg border border-border/40 bg-background/70 px-2.5 py-2">
                            <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/60">
                              Retrieval
                            </p>
                            <p className="mt-1 text-[13px] font-semibold text-foreground tabular-nums">
                              {Math.round(knowledgeSignals.avgSearchMs)}ms
                            </p>
                          </div>
                        )}
                        {topMatchPercent != null && (
                          <div className="rounded-lg border border-border/40 bg-background/70 px-2.5 py-2">
                            <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/60">
                              Top match
                            </p>
                            <p className="mt-1 text-[13px] font-semibold text-foreground tabular-nums">
                              {topMatchPercent}%
                            </p>
                          </div>
                        )}
                      </div>

                      {knowledgeSignals.topSources.length > 0 && (
                        <div className="mt-2.5">
                          <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/50">
                            Top sources
                          </p>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {knowledgeSignals.topSources.map(source => (
                              <span
                                key={source}
                                className="inline-flex rounded-full border border-emerald-500/15 bg-background/80 px-2 py-1 text-[10px] text-muted-foreground"
                              >
                                {source}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {knowledgeSignals.estimatedTokensSaved > 0 && (
                        <p className="mt-2 text-[11px] text-muted-foreground/70">
                          Retrieved context trimmed roughly{" "}
                          {knowledgeSignals.estimatedTokensSaved.toLocaleString()}{" "}
                          tokens from the prompt window.
                        </p>
                      )}

                      {hasTelemetryGap && (
                        <p className="mt-1.5 text-[10px] text-muted-foreground/55">
                          Grounding metrics were inferred from citations because
                          full retrieval traces were not persisted.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Reasoning sections */}
                  {dedupedSections.length > 0 && (
                    <div className="space-y-2">
                      {dedupedSections.map((section, i) => (
                        <div key={i} className="flex items-start gap-2.5">
                          <span className="text-sm mt-0.5">
                            {section.metadata?.icon || "🧠"}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p
                              className="text-[11px] font-bold uppercase tracking-wider"
                              style={{ color: TRACE_ACCENT }}
                            >
                              {section.metadata?.section}
                            </p>
                            <p className="text-[12px] text-muted-foreground leading-relaxed mt-0.5">
                              {section.metadata?.reasoning || section.content}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Tool calls */}
                  {toolPairs.length > 0 && (
                    <div className="space-y-1.5">
                      {toolPairs.map((pair, i) => (
                        <ToolDetail
                          key={i}
                          pair={pair}
                          showPayloads={showTracePayloads}
                        />
                      ))}
                    </div>
                  )}

                  {/* Compact usage summary */}
                  {(tokenUsage || knowledgeSignals.kbUsed) && (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground/70 tabular-nums">
                      {tokenUsage && tokenUsage.total_tokens > 0 && (
                        <span>
                          {tokenUsage.total_tokens.toLocaleString()} tokens
                        </span>
                      )}
                      {tokenUsage && tokenUsage.llm_calls > 1 && (
                        <span>{tokenUsage.llm_calls} LLM calls</span>
                      )}
                      {knowledgeSignals.kbUsed &&
                        knowledgeSignals.chunksRetrieved > 0 && (
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                            {knowledgeSignals.chunksRetrieved} chunks ·{" "}
                            {knowledgeSignals.citationsUsed} sources
                          </span>
                        )}
                      {knowledgeSignals.kbUsed &&
                        knowledgeSignals.chunksRetrieved === 0 &&
                        knowledgeSignals.citationsUsed > 0 && (
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                            {knowledgeSignals.citationsUsed} source
                            {knowledgeSignals.citationsUsed === 1 ? "" : "s"}
                          </span>
                        )}
                      {knowledgeSignals.avgSearchMs > 0 && (
                        <span>
                          {Math.round(knowledgeSignals.avgSearchMs)}ms search
                        </span>
                      )}
                    </div>
                  )}

                  {/* Step timeline (if no sections/tools, show raw steps) */}
                  {dedupedSections.length === 0 && toolPairs.length === 0 && (
                    <div className="space-y-1">
                      {visibleSteps.map((step, i) => (
                        <div key={i} className="flex items-center gap-2 py-0.5">
                          <Check
                            className="w-3 h-3 text-muted-foreground/40 shrink-0"
                            strokeWidth={2}
                          />
                          <span className="text-[12px] text-muted-foreground/60 truncate">
                            {formatStep(step)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    );
  }

  if (!isStreaming) return null;

  // ── Live streaming ──
  return (
    <motion.div
      initial={{ opacity: 1, y: 0 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4, transition: { duration: 0.12 } }}
      className={className}
      role="status"
      aria-live="polite"
    >
      <div
        className="relative rounded-2xl overflow-hidden border"
        style={ENVELOPE_SURFACE}
      >
        <div
          className="absolute inset-x-0 top-0 h-px"
          style={{
            background:
              "linear-gradient(90deg, transparent, color-mix(in srgb, var(--primary) 52%, transparent), transparent)",
          }}
        />

        {/* Header */}
        <div className="flex items-center gap-3 px-3.5 py-3">
          <ThinkingAnimation
            variant="minimal"
            showLabel={false}
            className="relative shrink-0"
          />

          <div className="flex-1 min-w-0">
            <AnimatePresence mode="wait">
              <motion.span
                key={liveHeadline}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className="block truncate text-[13px] font-bold tracking-normal"
                style={{
                  color:
                    "color-mix(in srgb, var(--foreground) 84%, var(--primary) 16%)",
                }}
              >
                {liveHeadline}
              </motion.span>
            </AnimatePresence>
            <span className="mt-0.5 block truncate text-[11px] font-medium text-muted-foreground">
              {liveSubline}
            </span>
          </div>

          <span
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold tabular-nums"
            style={{
              color:
                "color-mix(in srgb, var(--foreground) 74%, var(--primary) 26%)",
              background:
                "color-mix(in srgb, var(--background) 68%, var(--primary) 10%)",
              boxShadow:
                "inset 0 0 0 1px color-mix(in srgb, var(--primary) 26%, var(--border))",
            }}
          >
            <Clock className="h-3 w-3" />
            {elapsed}
          </span>
        </div>

        {knowledgeLiveSummary && (
          <div className="px-3.5 pb-2">
            <div className="rounded-lg border border-emerald-500/15 bg-emerald-500/4 px-3 py-2">
              <div className="flex items-center gap-2">
                <BookOpen className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="text-[11px] font-semibold text-foreground">
                  Knowledge grounding
                </span>
              </div>

              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                {knowledgeLiveSummary}
              </p>

              {knowledgeMetricPills.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {knowledgeMetricPills.slice(0, 4).map(pill => (
                    <span
                      key={pill}
                      className="inline-flex rounded-full border border-emerald-500/15 bg-background/80 px-2 py-1 text-[10px] text-muted-foreground"
                    >
                      {pill}
                    </span>
                  ))}
                </div>
              )}

              {knowledgeSignals.topSources.length > 0 && (
                <p className="mt-2 text-[10px] text-muted-foreground/70 truncate">
                  Top sources: {knowledgeSignals.topSources.join(", ")}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Live step feed — deduplicated consecutive same-label steps */}
        {visibleSteps.length > 0 && (
          <div className="px-3.5 pb-3">
            <div className="relative space-y-1 pl-1">
              <div
                className="absolute bottom-1.5 left-2 top-1.5 w-px"
                style={{
                  background:
                    "linear-gradient(180deg, color-mix(in srgb, var(--primary) 18%, transparent), color-mix(in srgb, var(--border) 86%, transparent))",
                }}
              />
              {liveStepFeed.map(({ step, count }, i, arr) => {
                const isLast = i === arr.length - 1;
                const StepIcon = STEP_ICONS[step.type] || Search;
                const hasError = Boolean(step.metadata?.result?.error);
                return (
                  <motion.div
                    key={`${step.type}-${i}`}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: isLast ? 1 : 0.45, x: 0 }}
                    transition={{
                      duration: 0.15,
                      delay: Math.min(i * 0.03, 0.12),
                    }}
                    className="relative flex items-center gap-2 py-0.5"
                  >
                    {isLast ? (
                      <motion.div
                        className="z-10 w-4 h-4 rounded-md flex items-center justify-center shrink-0"
                        style={{
                          background: hasError
                            ? "color-mix(in srgb, var(--destructive) 12%, var(--card))"
                            : `color-mix(in srgb, ${TRACE_ACCENT} 12%, var(--card))`,
                          boxShadow: hasError
                            ? "inset 0 0 0 1px color-mix(in srgb, var(--destructive) 28%, transparent)"
                            : `inset 0 0 0 1px color-mix(in srgb, ${TRACE_ACCENT} 22%, transparent)`,
                        }}
                        animate={{ opacity: [0.82, 1, 0.82] }}
                        transition={{ duration: 1.8, repeat: Infinity }}
                      >
                        {hasError ? (
                          <AlertTriangle className="w-2.5 h-2.5 text-destructive" />
                        ) : (
                          <StepIcon
                            className="w-2.5 h-2.5"
                            style={{ color: TRACE_ACCENT }}
                          />
                        )}
                      </motion.div>
                    ) : (
                      <div className="z-10 w-4 h-4 rounded-md flex items-center justify-center shrink-0 bg-card">
                        <Check
                          className="w-2.5 h-2.5 text-muted-foreground/40"
                          strokeWidth={2.5}
                        />
                      </div>
                    )}
                    <span
                      className="text-[11px] truncate"
                      style={{
                        color: isLast
                          ? "var(--foreground)"
                          : "var(--muted-foreground)",
                        fontWeight: isLast ? 500 : 400,
                      }}
                    >
                      {formatStep(step)}
                      {count > 1 && ` (×${count})`}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
