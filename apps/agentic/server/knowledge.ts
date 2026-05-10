/**
 * Knowledge Self-Service Router
 *
 * Proxies to the knowledge-pipeline-service (ingestion) and
 * knowledge-api (documents, search, graph, stats).
 *
 * Auth: manager+ role (managers and admins). Knowledge curators
 * build the knowledge base that powers the agent — this is a
 * self-service capability, not restricted to platform admins.
 *
 * Downstream services:
 *   knowledge-pipeline-service  :9508  — document ingestion pipeline
 *   knowledge-api               :9509  — AlloyDB (vectors) + Neo4j (graph)
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import type { Role } from "@shared/access-control";
import type { FeatureFlagKey } from "@shared/feature-flags";
import { KNOWLEDGE_EVAL_SUITE_ORIGINS } from "../shared/knowledge-types";
import {
  knowledgeReadProcedure,
  knowledgeWriteProcedure,
  managerProcedure,
  router,
} from "./_core/trpc";
import {
  serviceCall,
  serviceJsonTyped,
  serviceMultipartUpload,
  buildSnakeBody,
  KNOWLEDGE_PIPELINE_URL,
  VECTOR_STORE_URL,
  ANALYTICS_URL,
  ORCHESTRATOR_URL,
  LLM_GATEWAY_BASE_URL,
} from "./service-client";
import { createLogger } from "./_core/logger";
import { sendReviewReminderEmail } from "./email";
import { sendReviewReminderGoogleChat } from "./google-chat";
import { getDb } from "./db";
import {
  knowledgeCollections,
  knowledgeAttestations,
  knowledgeConnectors,
  knowledgeAgentEvalRuns,
  knowledgeEvalSuites,
  knowledgeGapSnapshots,
  knowledgeReleases,
  valueStreams,
  users,
  type KnowledgeAgentEvalRun as KnowledgeAgentEvalRunRow,
  type KnowledgeEvalSuite as KnowledgeEvalSuiteRow,
  type KnowledgeRelease as KnowledgeReleaseRow,
} from "../drizzle/schema";
import { eq, and, inArray, or, desc } from "drizzle-orm";
import { isTerminalJobStatus, startJobWatcher } from "./job-watcher";
import {
  requireAuthorizedStreamId,
  resolveAuthorizedStreamId,
  scopedRequestContext,
} from "./_core/value-stream-access";
import {
  isFeatureEnabledForUser,
  loadFeatureFlagOverrides,
} from "./_core/feature-flags";
import {
  getConnectorStreamId,
  isConnectorVisibleToUser,
} from "./connectors/stream-access";
import {
  buildLocalHvsiAuditStatus,
  summarizeHvsiIssues,
} from "./_core/hvsi-audit";
import {
  buildContextAwareQuestions,
  filterHighQualityQuestions,
  isLowQualityQuestion,
} from "./_core/question-suggestions";
import {
  DEFAULT_KNOWLEDGE_CONFIG,
  normalizeKnowledgeConfig,
  type KnowledgeConfig,
} from "../shared/value-streams";
import type {
  StoreStats,
  GraphStats,
  DocumentListResponse,
  DocumentInventorySummary,
  DocumentDetail,
  SearchResponse,
  IngestResponse,
  JobListResponse,
  JobStatusResponse,
  IngestionJob,
  TaxonomyNode,
  TaxonomyTreeInfo,
  TagValidationResult,
  EvaluationReport,
  ReviewRecord,
  QualityReport,
  PIIRedactResult,
  PIIScanInfo,
  GeneratedAnswer,
  ShadowRetrievalComparison,
  KnowledgeEvalSuiteCase,
  KnowledgeEvalSuiteSummary,
  VersionHistoryResponse,
  DiffResponse,
  RAGEvalResult,
  TraceSummary,
  TraceEvent,
  PreIngestAnalysis,
  DocumentContentExport,
  ReprocessResult,
  RefreshResult,
  MetadataUpdateResult,
  KbAnalyticsSummary,
  AgentEvalRunSummary,
  AgentEvalCaseResult,
  KnowledgeReleaseSummary,
  KnowledgeReleaseSnapshot,
  LaunchReadiness,
  LaunchReadinessCheck,
  ReviewIntelligence,
} from "../shared/knowledge-types";

const log = createLogger("knowledge");
const EMAIL_ADDRESS_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const PLACEHOLDER_DEPARTMENT_FILTERS = new Set(["all", "default", "general"]);

function normalizeDepartmentFilters(
  departments: Array<string | null | undefined>
): string[] {
  const filters = new Set<string>();
  for (const department of departments) {
    const trimmed = department?.trim();
    if (!trimmed) continue;
    if (PLACEHOLDER_DEPARTMENT_FILTERS.has(trimmed.toLowerCase())) continue;
    filters.add(trimmed);
  }
  return Array.from(filters);
}

/**
 * Load the department filters for a stream's knowledge collections.
 * Returns an array of department strings to scope vector search.
 */
async function getStreamDepartments(valueStreamId: string): Promise<string[]> {
  if (!valueStreamId || valueStreamId === "global") return [];
  const db = await getDb();
  if (!db) return [];
  try {
    const collections = await db
      .select({ department: knowledgeCollections.department })
      .from(knowledgeCollections)
      .where(eq(knowledgeCollections.valueStreamId, valueStreamId));
    return normalizeDepartmentFilters(collections.map(c => c.department));
  } catch {
    return [];
  }
}

function isEmailAddress(value: string | null | undefined): value is string {
  return !!value && EMAIL_ADDRESS_RE.test(value.trim());
}

function uniqueEmails(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(
      values
        .map(value => value?.trim())
        .filter((value): value is string => isEmailAddress(value))
    )
  );
}

async function resolveReviewAssigneeEmail(
  record: Pick<ReviewRecord, "assignedTo" | "orgId">
): Promise<string | null> {
  const assignee = record.assignedTo?.trim();
  if (!assignee) return null;
  if (isEmailAddress(assignee)) return assignee;

  const db = await getDb();
  if (!db) return null;

  const matches = await db
    .select({ email: users.email })
    .from(users)
    .where(
      and(
        eq(users.orgId, record.orgId || "default"),
        eq(users.isActive, 1),
        or(eq(users.email, assignee), eq(users.name, assignee))
      )
    )
    .limit(5)
    .catch(() => [] as Array<{ email: string | null }>);

  const emails = uniqueEmails(matches.map(match => match.email));
  return emails.length === 1 ? emails[0]! : null;
}

interface StreamMeta {
  departments: string[];
  knowledgeConfig: KnowledgeConfig | null;
  streamName: string | null;
  streamDescription: string | null;
  sampleQuestions: string[];
}

/**
 * Load departments and knowledgeConfig for a stream in parallel.
 * Used by the search procedure to minimise DB round-trips.
 */
async function getStreamMeta(valueStreamId: string): Promise<StreamMeta> {
  if (!valueStreamId || valueStreamId === "global") {
    return {
      departments: [],
      knowledgeConfig: null,
      streamName: null,
      streamDescription: null,
      sampleQuestions: [],
    };
  }
  const db = await getDb();
  if (!db) {
    return {
      departments: [],
      knowledgeConfig: null,
      streamName: null,
      streamDescription: null,
      sampleQuestions: [],
    };
  }

  const [collections, streamRow] = await Promise.all([
    db
      .select({ department: knowledgeCollections.department })
      .from(knowledgeCollections)
      .where(eq(knowledgeCollections.valueStreamId, valueStreamId))
      .catch(() => [] as Array<{ department: string | null }>),
    db
      .select({
        knowledgeConfig: valueStreams.knowledgeConfig,
        name: valueStreams.name,
        description: valueStreams.description,
        sampleQuestions: valueStreams.sampleQuestions,
      })
      .from(valueStreams)
      .where(eq(valueStreams.id, valueStreamId))
      .limit(1)
      .catch(
        () =>
          [] as Array<{
            knowledgeConfig: string | null;
            name: string;
            description: string | null;
            sampleQuestions: string | null;
          }>
      ),
  ]);

  const departments = normalizeDepartmentFilters(
    collections.map(c => c.department)
  );

  let knowledgeConfig: KnowledgeConfig | null = null;
  if (streamRow[0]?.knowledgeConfig) {
    try {
      knowledgeConfig = normalizeKnowledgeConfig(
        JSON.parse(streamRow[0].knowledgeConfig) as Partial<KnowledgeConfig>
      );
    } catch {
      // Malformed JSON in DB — treat as unconfigured
    }
  }

  const sampleQuestions = safeJsonParse<unknown[]>(
    streamRow[0]?.sampleQuestions,
    []
  )
    .filter((question): question is string => typeof question === "string")
    .map(question => question.trim())
    .filter(Boolean);

  return {
    departments,
    knowledgeConfig,
    streamName: streamRow[0]?.name ?? null,
    streamDescription: streamRow[0]?.description ?? null,
    sampleQuestions,
  };
}

const PLATFORM_MAX_DOC_SIZE_MB = Number(
  process.env.KNOWLEDGE_MAX_DOCUMENT_SIZE_MB || 50
);

async function getEffectiveUploadLimitMb(
  valueStreamId?: string | null
): Promise<{
  platformMaxMb: number;
  streamMaxMb: number | null;
  effectiveMaxMb: number;
}> {
  const platformMaxMb = Number.isFinite(PLATFORM_MAX_DOC_SIZE_MB)
    ? PLATFORM_MAX_DOC_SIZE_MB
    : 50;
  if (!valueStreamId || valueStreamId === "global") {
    return { platformMaxMb, streamMaxMb: null, effectiveMaxMb: platformMaxMb };
  }

  const db = await getDb();
  if (!db) {
    return { platformMaxMb, streamMaxMb: null, effectiveMaxMb: platformMaxMb };
  }

  try {
    const [stream] = await db
      .select({ knowledgeConfig: valueStreams.knowledgeConfig })
      .from(valueStreams)
      .where(eq(valueStreams.id, valueStreamId))
      .limit(1);

    if (!stream?.knowledgeConfig) {
      return {
        platformMaxMb,
        streamMaxMb: null,
        effectiveMaxMb: platformMaxMb,
      };
    }

    const parsed = JSON.parse(stream.knowledgeConfig) as {
      maxDocSizeMb?: unknown;
    };
    const raw = Number(parsed?.maxDocSizeMb);
    if (!Number.isFinite(raw) || raw <= 0) {
      return {
        platformMaxMb,
        streamMaxMb: null,
        effectiveMaxMb: platformMaxMb,
      };
    }
    const streamMaxMb = Math.floor(raw);
    return {
      platformMaxMb,
      streamMaxMb,
      effectiveMaxMb: Math.min(platformMaxMb, streamMaxMb),
    };
  } catch {
    return { platformMaxMb, streamMaxMb: null, effectiveMaxMb: platformMaxMb };
  }
}

function estimateBase64Bytes(base64: string): number {
  return Math.floor((base64.length * 3) / 4);
}

interface ServiceHealthItem {
  name: string;
  ok: boolean;
  latencyMs: number;
  detail?: string | null;
}

interface OrchestratorEvalResponse {
  content?: string;
  confidence?: number;
  toolCalls?: Array<{
    name?: string;
    error?: string;
  }>;
  trace?: Array<{ type?: string; content?: string }>;
  citations?: Array<{
    source?: string;
    title?: string;
  }>;
  guardrails?: {
    passed?: boolean;
    score?: number;
  };
}

function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function toIsoString(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function previewText(value: string | null | undefined, max = 180): string {
  const normalized = String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
  if (!normalized) return "";
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1).trimEnd()}…`;
}

function resolveKnowledgeStreamId(
  ctx: Parameters<typeof resolveAuthorizedStreamId>[0],
  requestedStreamId?: string | null,
  missingSelectionMessage = "Select a value stream explicitly before continuing"
): string {
  return requireAuthorizedStreamId(ctx, requestedStreamId, {
    allowGlobalSelection: false,
    missingSelectionMessage,
  });
}

function resolveKnowledgeRuntimeStreamId(
  ctx: Parameters<typeof resolveAuthorizedStreamId>[0],
  requestedStreamId?: string | null,
  missingSelectionMessage = "Select a value stream explicitly before continuing"
): string {
  return requireAuthorizedStreamId(ctx, requestedStreamId, {
    allowGlobalSelection: false,
    missingSelectionMessage,
  });
}

function shouldWatchJob(
  job: Pick<IngestionJob, "id" | "status" | "streamId">
): boolean {
  if (!job.id || !job.streamId) return false;
  return !isTerminalJobStatus(job.status);
}

interface EvalSuiteCaseDraft {
  id: string;
  query: string;
  expectedAnswer: string;
}

const evalSuiteOriginSchema = z.enum(KNOWLEDGE_EVAL_SUITE_ORIGINS);

function normalizeKnowledgeEvalSuiteCases(
  cases: Array<{
    id?: string | null;
    query: string;
    expectedAnswer?: string | null;
  }>
): KnowledgeEvalSuiteCase[] {
  return cases
    .map(item => ({
      id: item.id?.trim() || nanoid(12),
      query: item.query.trim(),
      expectedAnswer: item.expectedAnswer?.trim() || "",
    }))
    .filter(item => item.query.length > 0);
}

function documentBelongsToSelectedStream(
  doc:
    | {
        streamId?: string | null;
        metadata?: { streamId?: string | null } | null;
      }
    | null
    | undefined,
  streamId: string | null
): boolean {
  if (!streamId || streamId === "global") {
    return true;
  }
  const docStreamId = doc?.streamId ?? doc?.metadata?.streamId ?? null;
  return docStreamId === streamId;
}

function dedupeEvalSuiteCases(
  cases: EvalSuiteCaseDraft[],
  limit: number
): EvalSuiteCaseDraft[] {
  const seen = new Set<string>();
  const deduped: EvalSuiteCaseDraft[] = [];

  for (const candidate of cases) {
    const query = candidate.query.trim();
    if (!query) continue;
    const key = query.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push({
      id: candidate.id,
      query,
      expectedAnswer: candidate.expectedAnswer.trim(),
    });
    if (deduped.length >= limit) break;
  }

  return deduped;
}

function parseGeneratedEvalSuiteCases(
  rawAnswer: string | null | undefined,
  limit: number
): EvalSuiteCaseDraft[] {
  if (!rawAnswer) return [];

  try {
    const match = rawAnswer.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const parsed = JSON.parse(match[0]);
    if (!Array.isArray(parsed)) return [];

    return dedupeEvalSuiteCases(
      parsed
        .map((item, index): EvalSuiteCaseDraft | null => {
          if (typeof item === "string") {
            return {
              id: `generated-${index + 1}`,
              query: item,
              expectedAnswer: "",
            };
          }
          if (!item || typeof item !== "object") return null;
          const record = item as Record<string, unknown>;
          const query = String(record.query ?? record.question ?? "").trim();
          if (!query || isLowQualityQuestion(query)) return null;
          return {
            id: String(record.id ?? `generated-${index + 1}`),
            query,
            expectedAnswer: String(
              record.expectedAnswer ?? record.answer ?? ""
            ).trim(),
          };
        })
        .filter((item): item is EvalSuiteCaseDraft => item !== null),
      limit
    );
  } catch {
    return [];
  }
}

function buildFallbackEvalSuiteCases(opts: {
  documents: Array<{
    title?: string | null;
    department?: string | null;
    documentType?: string | null;
    excerpt?: string | null;
  }>;
  gapTopics: Array<{ topic?: string | null; suggestion?: string | null }>;
  streamName?: string | null;
  limit: number;
}): EvalSuiteCaseDraft[] {
  const cases: EvalSuiteCaseDraft[] = [];

  for (const gap of opts.gapTopics) {
    const topic = gap.topic?.trim();
    if (!topic) continue;
    cases.push({
      id: nanoid(10),
      query: `What is the current guidance for ${topic}?`,
      expectedAnswer: gap.suggestion?.trim() ?? "",
    });
  }

  for (const doc of opts.documents) {
    const prompts = buildContextAwareQuestions({
      title: doc.title,
      content: doc.excerpt,
      count: 2,
      documentType: doc.documentType,
    });

    for (const query of prompts) {
      cases.push({
        id: nanoid(10),
        query,
        expectedAnswer: "",
      });
    }
  }

  if (cases.length === 0) {
    const streamLabel = opts.streamName?.trim() || "this value stream";
    cases.push(
      {
        id: nanoid(10),
        query: `What are the most important policies for ${streamLabel}?`,
        expectedAnswer: "",
      },
      {
        id: nanoid(10),
        query: `Which issues should ${streamLabel} teams escalate immediately?`,
        expectedAnswer: "",
      },
      {
        id: nanoid(10),
        query: `What process mistakes should ${streamLabel} teams avoid?`,
        expectedAnswer: "",
      }
    );
  }

  return dedupeEvalSuiteCases(cases, opts.limit);
}

function daysSince(value: string | null | undefined): number | null {
  if (!value) return null;
  const ts = new Date(value).getTime();
  if (!Number.isFinite(ts)) return null;
  return Math.floor((Date.now() - ts) / 86_400_000);
}

function formatDateLabel(value: string | null | undefined): string {
  if (!value) return "unknown date";
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return "unknown date";
  return parsed.toISOString().slice(0, 10);
}

function buildReviewIntelligenceSummary(analysis: PreIngestAnalysis): string {
  const duplicateCount = analysis.decide.duplicates?.length ?? 0;
  const contradictionCount = analysis.decide.contradictions?.length ?? 0;
  const findings: string[] = [];

  if (duplicateCount > 0) {
    findings.push(
      `${duplicateCount} duplicate match${duplicateCount === 1 ? "" : "es"}`
    );
  }
  if (contradictionCount > 0) {
    findings.push(
      `${contradictionCount} contradiction risk${contradictionCount === 1 ? "" : "s"}`
    );
  }

  const summaryPrefix =
    findings.length > 0
      ? `Submit-time review intelligence found ${findings.join(" and ")}.`
      : "Submit-time review intelligence found no duplicate or contradiction risks.";

  const reasoning = analysis.decide.reasoning?.trim();
  return reasoning ? `${summaryPrefix} ${reasoning}` : summaryPrefix;
}

type KnowledgeSearchInput = {
  query: string;
  limit?: number;
  topK?: number;
  mode?: "hybrid" | "vector" | "keyword";
  shapeContext?: boolean;
  rerank?: boolean;
  includePending?: boolean;
};

type DownstreamRequestContext = Parameters<typeof serviceJsonTyped>[1];

async function runKnowledgeSearchRequest(
  ctx: DownstreamRequestContext,
  resolvedStreamId: string,
  input: KnowledgeSearchInput
): Promise<SearchResponse> {
  const { departments, knowledgeConfig } =
    await getStreamMeta(resolvedStreamId);
  const enableReranking =
    input.rerank ?? knowledgeConfig?.enableReranking ?? false;
  const configuredTopK =
    input.limit ??
    input.topK ??
    knowledgeConfig?.maxResults ??
    DEFAULT_KNOWLEDGE_CONFIG.maxResults;
  const topK = Math.max(1, Math.min(Math.floor(configuredTopK), 50));

  const payload: Record<string, unknown> = {
    query: input.query,
    top_k: topK,
    mode: input.mode ?? "hybrid",
  };
  if (input.shapeContext) payload.shape_context = true;
  if (departments.length > 0) payload.departments = departments;
  if (enableReranking) payload.rerank = true;
  if (input.includePending) payload.include_pending = true;

  return serviceJsonTyped<SearchResponse>(
    `${VECTOR_STORE_URL}/v1/search`,
    scopedRequestContext(ctx, resolvedStreamId),
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}

async function generateGroundedAnswerFromSearch(
  ctx: DownstreamRequestContext,
  resolvedStreamId: string,
  query: string,
  search: SearchResponse
): Promise<GeneratedAnswer | null> {
  const chunks = (search.results ?? []).map(result => ({
    content: result.content || "",
    score: result.score ?? 0,
    scoreScale:
      result.scoreScale ?? (result as { score_scale?: string }).score_scale,
    metadata: (result.metadata ?? {}) as Record<string, unknown>,
  }));

  if (chunks.length === 0) {
    return null;
  }

  try {
    return await serviceJsonTyped<GeneratedAnswer>(
      `${KNOWLEDGE_PIPELINE_URL}/v1/generate/answer`,
      scopedRequestContext(ctx, resolvedStreamId),
      {
        method: "POST",
        body: buildSnakeBody({
          query,
          chunks,
        }),
      }
    );
  } catch (err) {
    log.warn(
      { err, query, resolvedStreamId },
      "Shadow retrieval answer generation failed; continuing with search-only comparison"
    );
    return null;
  }
}

function searchIncludesDocument(
  search: SearchResponse,
  documentId: string | null | undefined
): boolean {
  const candidate = documentId?.trim();
  if (!candidate) return false;
  return (search.results ?? []).some(result => result.documentId === candidate);
}

function buildShadowRetrievalSummary(
  baseline: SearchResponse,
  shadow: SearchResponse,
  baselineAnswer: GeneratedAnswer | null,
  shadowAnswer: GeneratedAnswer | null,
  selectedDocumentId?: string | null
): string {
  const parts = [
    `Current retrieval returned ${(baseline.results ?? []).length} chunk${(baseline.results ?? []).length === 1 ? "" : "s"}.`,
    `Shadow retrieval returned ${(shadow.results ?? []).length} chunk${(shadow.results ?? []).length === 1 ? "" : "s"}.`,
  ];

  if (selectedDocumentId) {
    const baselineHasSelected = searchIncludesDocument(
      baseline,
      selectedDocumentId
    );
    const shadowHasSelected = searchIncludesDocument(
      shadow,
      selectedDocumentId
    );
    if (!baselineHasSelected && shadowHasSelected) {
      parts.push(
        "The selected pending-review document only appears in the shadow comparison."
      );
    } else if (baselineHasSelected && shadowHasSelected) {
      parts.push("The selected document already appears in both result sets.");
    } else if (!shadowHasSelected) {
      parts.push(
        "The selected document does not appear in the compared result sets."
      );
    }
  }

  if (baselineAnswer?.answer && shadowAnswer?.answer) {
    parts.push(
      baselineAnswer.answer.trim() === shadowAnswer.answer.trim()
        ? "The grounded answer does not change between current and shadow modes."
        : "The grounded answer changes when pending-review content is included."
    );
  } else {
    parts.push(
      "One or both answer previews were unavailable, so compare the retrieved chunks as the source of truth."
    );
  }

  return parts.join(" ");
}

async function pingService(
  name: string,
  url: string,
  path = "/health"
): Promise<ServiceHealthItem> {
  const start = Date.now();
  try {
    const res = await fetch(`${url}${path}`, {
      signal: AbortSignal.timeout(3000),
    });
    let detail: string | null = null;

    if (path === "/ready") {
      const payload = await res
        .clone()
        .json()
        .catch(() => null as Record<string, unknown> | null);
      const status =
        payload && typeof payload.status === "string" ? payload.status : null;
      const hvsi =
        payload && typeof payload.hvsi === "object" && payload.hvsi
          ? (payload.hvsi as {
              ready?: boolean;
              issues?: Record<string, number>;
            })
          : null;

      if (hvsi?.ready === false) {
        detail = summarizeHvsiIssues(hvsi.issues ?? {});
      } else if (status && status !== "ready") {
        detail = `Readiness ${status}`;
      }
    }

    return { name, ok: res.ok, latencyMs: Date.now() - start, detail };
  } catch {
    return {
      name,
      ok: false,
      latencyMs: Date.now() - start,
      detail: "unreachable",
    };
  }
}

async function getServiceHealthItems(): Promise<ServiceHealthItem[]> {
  return Promise.all([
    pingService("knowledge-api", VECTOR_STORE_URL, "/ready"),
    pingService("pipeline", KNOWLEDGE_PIPELINE_URL, "/ready"),
    pingService("orchestrator", ORCHESTRATOR_URL),
  ]);
}

async function getLocalHvsiServiceHealthItem(): Promise<ServiceHealthItem | null> {
  const startedAt = Date.now();
  const hvsi = await buildLocalHvsiAuditStatus();
  if (!hvsi.enabled) {
    return null;
  }

  return {
    name: "hvsi-audit",
    ok: hvsi.ready,
    latencyMs: Date.now() - startedAt,
    detail: hvsi.summary,
  };
}

function serializeAgentEvalRun(
  row: KnowledgeAgentEvalRunRow
): AgentEvalRunSummary {
  const parsed = safeJsonParse<{ cases?: AgentEvalCaseResult[] }>(row.results, {
    cases: [],
  });
  return {
    id: row.id,
    orgId: row.orgId,
    valueStreamId: row.valueStreamId,
    suiteName: row.suiteName,
    status: row.status,
    totalCases: row.totalCases,
    passedCases: row.passedCases,
    passRate: row.passRate,
    averageConfidence: row.averageConfidence,
    averageGuardrailScore: row.averageGuardrailScore,
    averageTraceSteps: row.averageTraceSteps,
    passed: row.passed === 1,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    completedAt: toIsoString(row.completedAt),
    cases: parsed.cases ?? [],
  };
}

function serializeKnowledgeRelease(
  row: KnowledgeReleaseRow
): KnowledgeReleaseSummary {
  return {
    id: row.id,
    orgId: row.orgId,
    valueStreamId: row.valueStreamId,
    label: row.label,
    notes: row.notes ?? null,
    status: row.status,
    createdBy: row.createdBy,
    basedOnEvalRunId: row.basedOnEvalRunId ?? null,
    snapshot: safeJsonParse<KnowledgeReleaseSnapshot | null>(
      row.snapshot,
      null
    ),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    promotedAt: toIsoString(row.promotedAt),
    rolledBackAt: toIsoString(row.rolledBackAt),
  };
}

function serializeKnowledgeEvalSuite(
  row: KnowledgeEvalSuiteRow
): KnowledgeEvalSuiteSummary {
  const cases = normalizeKnowledgeEvalSuiteCases(
    safeJsonParse<KnowledgeEvalSuiteCase[]>(row.cases, [])
  );

  return {
    id: row.id,
    orgId: row.orgId,
    valueStreamId: row.valueStreamId,
    name: row.name,
    origin: row.origin,
    basedOnSnapshotId: row.basedOnSnapshotId ?? null,
    caseCount: cases.length,
    cases,
    createdBy: row.createdBy,
    updatedBy: row.updatedBy ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function readStoreDocumentCount(stats?: StoreStats | null): number {
  const raw =
    stats?.totalDocuments ??
    (typeof stats?.["documents"] === "number" ? stats["documents"] : 0);
  return Number(raw || 0);
}

function readStoreChunkCount(stats?: StoreStats | null): number {
  const raw =
    stats?.totalChunks ??
    (typeof stats?.["chunks"] === "number" ? stats["chunks"] : 0);
  return Number(raw || 0);
}

async function buildLaunchReadinessState(
  ctx: { user: any; scopes?: string[]; isGlobalScope?: boolean },
  valueStreamId: string
): Promise<{
  readiness: LaunchReadiness;
  snapshot: KnowledgeReleaseSnapshot;
  latestCompletedEval: AgentEvalRunSummary | null;
  latestPassingEval: AgentEvalRunSummary | null;
  latestPromotedRelease: KnowledgeReleaseSummary | null;
  latestRelease: KnowledgeReleaseSummary | null;
}> {
  const resolvedStreamId = resolveKnowledgeStreamId(
    ctx,
    valueStreamId,
    "Launch readiness requires an explicit value stream"
  );
  const db = await getDb();
  const emptySnapshot: KnowledgeReleaseSnapshot = {
    liveDocumentCount: 0,
    pendingReviewCount: 0,
    attestationCount: 0,
    connectorIssueCount: 0,
    serviceIssueCount: 3,
    latestEvalPassRate: null,
  };

  const unavailableChecks: LaunchReadinessCheck[] = [
    {
      key: "live_content",
      label: "Live content",
      passed: false,
      detail: "Database unavailable for readiness checks",
    },
    {
      key: "attestation",
      label: "Playbook attestation",
      passed: false,
      detail: "Database unavailable for readiness checks",
    },
    {
      key: "review_queue",
      label: "Review queue",
      passed: false,
      detail: "Review readiness could not be verified",
    },
    {
      key: "source_health",
      label: "Source health",
      passed: false,
      detail: "Connector health could not be verified",
    },
    {
      key: "service_health",
      label: "Service health",
      passed: false,
      detail: "Downstream services could not be verified",
    },
    {
      key: "agent_eval",
      label: "Agent E2E eval",
      passed: false,
      detail: "No passing agent evaluation has been recorded",
    },
  ];

  if (!db) {
    return {
      readiness: {
        ready: false,
        score: 0,
        summary:
          "Launch readiness is unavailable because the database is offline.",
        checks: unavailableChecks,
        latestEvalPassRate: null,
        latestEvalCompletedAt: null,
        latestPassingEvalId: null,
        latestPromotedReleaseId: null,
        latestReleaseLabel: null,
      },
      snapshot: emptySnapshot,
      latestCompletedEval: null,
      latestPassingEval: null,
      latestPromotedRelease: null,
      latestRelease: null,
    };
  }

  const orgId = ctx.user.orgId ?? "default";
  const requestCtx = scopedRequestContext(ctx, resolvedStreamId);

  const [
    stats,
    pendingReviewRecords,
    services,
    connectors,
    attestationRows,
    evalRows,
    releaseRows,
  ] = await Promise.all([
    serviceJsonTyped<StoreStats>(
      `${VECTOR_STORE_URL}/v1/stats`,
      requestCtx
    ).catch(() => null as StoreStats | null),
    serviceJsonTyped<ReviewRecord[]>(
      `${KNOWLEDGE_PIPELINE_URL}/v1/review/pending?limit=100&value_stream_id=${encodeURIComponent(resolvedStreamId)}`,
      requestCtx
    ).catch(() => [] as ReviewRecord[]),
    getServiceHealthItems(),
    db
      .select()
      .from(knowledgeConnectors)
      .where(eq(knowledgeConnectors.orgId, orgId))
      .catch(() => [] as any[]),
    db
      .select()
      .from(knowledgeAttestations)
      .where(eq(knowledgeAttestations.valueStreamId, resolvedStreamId))
      .catch(() => [] as any[]),
    db
      .select()
      .from(knowledgeAgentEvalRuns)
      .where(
        and(
          eq(knowledgeAgentEvalRuns.orgId, orgId),
          eq(knowledgeAgentEvalRuns.valueStreamId, resolvedStreamId)
        )
      )
      .orderBy(desc(knowledgeAgentEvalRuns.createdAt))
      .limit(20)
      .catch(() => [] as KnowledgeAgentEvalRunRow[]),
    db
      .select()
      .from(knowledgeReleases)
      .where(
        and(
          eq(knowledgeReleases.orgId, orgId),
          eq(knowledgeReleases.valueStreamId, resolvedStreamId)
        )
      )
      .orderBy(desc(knowledgeReleases.createdAt))
      .limit(20)
      .catch(() => [] as KnowledgeReleaseRow[]),
  ]);

  const liveDocumentCount = readStoreDocumentCount(stats);
  const pendingReviewCount = pendingReviewRecords.filter(record =>
    resolvedStreamId === "global" ? true : record.streamId === resolvedStreamId
  ).length;

  const scopedConnectors = connectors.filter(connector => {
    const connectorStreamId = getConnectorStreamId(connector.config);

    if (!resolvedStreamId) {
      return isConnectorVisibleToUser(ctx, connector.config);
    }

    if (resolvedStreamId === "global") {
      return !connectorStreamId || connectorStreamId === "global";
    }

    return connectorStreamId === resolvedStreamId;
  });

  const connectorIssues = scopedConnectors.reduce(
    (acc, connector) => {
      const isErrored =
        connector.status === "error" || (connector.consecutiveErrors ?? 0) >= 3;
      const isLagging = (() => {
        if (connector.status !== "active") return false;
        if (!connector.lastSyncAt) return true;
        const minutes = Math.floor(
          (Date.now() - new Date(connector.lastSyncAt).getTime()) / 60_000
        );
        return minutes > (connector.syncIntervalMinutes ?? 30) * 2;
      })();
      return {
        errorCount: acc.errorCount + (isErrored ? 1 : 0),
        laggingCount: acc.laggingCount + (isLagging ? 1 : 0),
      };
    },
    { errorCount: 0, laggingCount: 0 }
  );

  const serializedEvals = evalRows.map(serializeAgentEvalRun);
  const latestCompletedEval =
    serializedEvals.find(evalRun => evalRun.status === "completed") ?? null;
  const latestPassingEval =
    serializedEvals.find(
      evalRun => evalRun.status === "completed" && evalRun.passed
    ) ?? null;
  const serializedReleases = releaseRows.map(serializeKnowledgeRelease);
  const latestPromotedRelease =
    serializedReleases.find(release => release.status === "promoted") ?? null;
  const latestRelease = serializedReleases[0] ?? null;

  const latestPassingEvalAgeDays = daysSince(latestPassingEval?.completedAt);
  const evalFresh =
    latestPassingEval !== null &&
    latestPassingEvalAgeDays !== null &&
    latestPassingEvalAgeDays <= 14;
  const serviceIssueCount = services.filter(service => !service.ok).length;
  const connectorIssueCount =
    connectorIssues.errorCount + connectorIssues.laggingCount;

  const checks: LaunchReadinessCheck[] = [
    {
      key: "live_content",
      label: "Live content",
      passed: liveDocumentCount > 0,
      detail: !stats
        ? "Indexed content could not be verified"
        : liveDocumentCount > 0
          ? `${liveDocumentCount} live document${liveDocumentCount === 1 ? "" : "s"} indexed`
          : "No live documents are indexed yet",
    },
    {
      key: "attestation",
      label: "Playbook attestation",
      passed: attestationRows.length > 0,
      detail:
        attestationRows.length > 0
          ? `${attestationRows.length} team attestation${attestationRows.length === 1 ? "" : "s"} on file`
          : "No team member has attested to the playbook",
    },
    {
      key: "review_queue",
      label: "Review queue",
      passed: pendingReviewCount === 0,
      detail:
        pendingReviewCount === 0
          ? "Review queue is clear"
          : `${pendingReviewCount} item${pendingReviewCount === 1 ? "" : "s"} waiting for review`,
    },
    {
      key: "source_health",
      label: "Source health",
      passed: connectorIssueCount === 0,
      detail:
        scopedConnectors.length === 0
          ? "Manual ingest only; no connector drift detected"
          : connectorIssueCount === 0
            ? `${scopedConnectors.length} connector${scopedConnectors.length === 1 ? "" : "s"} healthy`
            : `${connectorIssueCount} connector issue${connectorIssueCount === 1 ? "" : "s"} need attention`,
    },
    {
      key: "service_health",
      label: "Service health",
      passed: services.length > 0 && serviceIssueCount === 0,
      detail:
        services.length > 0 && serviceIssueCount === 0
          ? `${services.length}/${services.length} core services healthy`
          : `${serviceIssueCount} core service${serviceIssueCount === 1 ? "" : "s"} unhealthy`,
    },
    {
      key: "agent_eval",
      label: "Agent E2E eval",
      passed: evalFresh,
      detail: latestPassingEval
        ? evalFresh
          ? `Passing eval at ${latestPassingEval.passRate}% on ${formatDateLabel(latestPassingEval.completedAt)}`
          : `Last passing eval is stale from ${formatDateLabel(latestPassingEval.completedAt)}`
        : latestCompletedEval
          ? `Latest eval scored ${latestCompletedEval.passRate}% on ${formatDateLabel(latestCompletedEval.completedAt)}`
          : "No agent E2E evaluation has been recorded",
    },
  ];

  const passedCount = checks.filter(check => check.passed).length;
  const ready = passedCount === checks.length;
  const score = clampPercent((passedCount / checks.length) * 100);
  const firstFailure = checks.find(check => !check.passed);
  const summary = ready
    ? "All launch checks passed. This stream is ready to promote."
    : `Launch blocked: ${firstFailure?.detail ?? "readiness checks are incomplete"}`;

  return {
    readiness: {
      ready,
      score,
      summary,
      checks,
      latestEvalPassRate: latestCompletedEval?.passRate ?? null,
      latestEvalCompletedAt: latestCompletedEval?.completedAt ?? null,
      latestPassingEvalId: latestPassingEval?.id ?? null,
      latestPromotedReleaseId: latestPromotedRelease?.id ?? null,
      latestReleaseLabel: latestRelease?.label ?? null,
    },
    snapshot: {
      liveDocumentCount,
      pendingReviewCount,
      attestationCount: attestationRows.length,
      connectorIssueCount,
      serviceIssueCount,
      latestEvalPassRate: latestCompletedEval?.passRate ?? null,
    },
    latestCompletedEval,
    latestPassingEval,
    latestPromotedRelease,
    latestRelease,
  };
}

const documentClassificationSchema = z.enum([
  "internal",
  "confidential",
  "restricted",
  "privileged",
]);

const documentAclSchema = z.object({
  allowedUsers: z.array(z.string().max(256)).max(200).optional(),
  allowedGroups: z.array(z.string().max(256)).max(200).optional(),
  deniedUsers: z.array(z.string().max(256)).max(200).optional(),
  deniedGroups: z.array(z.string().max(256)).max(200).optional(),
});

async function requireKnowledgeDeploymentFeature(
  ctx: {
    user: { role: Role; valueStreams: string | null; orgId?: string | null };
  },
  key: FeatureFlagKey,
  message: string
): Promise<void> {
  const db = await getDb();
  const rawOverrides =
    db && typeof db.select === "function"
      ? await loadFeatureFlagOverrides(db, ctx.user.orgId ?? "default").catch(
          () => []
        )
      : [];
  const overrides = Array.isArray(rawOverrides) ? rawOverrides : [];

  if (
    isFeatureEnabledForUser({
      user: ctx.user,
      key,
      overrides,
    })
  ) {
    return;
  }

  throw new TRPCError({
    code: "FORBIDDEN",
    message,
  });
}

async function requireKnowledgeFeatureFlag(
  ctx: {
    user: { role: Role; valueStreams: string | null; orgId?: string | null };
  },
  key: FeatureFlagKey,
  message: string
): Promise<void> {
  await requireKnowledgeDeploymentFeature(ctx, key, message);
}

export const knowledgeRouter = router({
  /** Get effective upload size limits for UI + validation (stream-aware). */
  uploadLimits: knowledgeWriteProcedure
    .input(z.object({ streamId: z.string().max(64).optional() }).optional())
    .query(async ({ input, ctx }) => {
      const resolvedStreamId = resolveKnowledgeStreamId(
        ctx,
        input?.streamId,
        "Select a value stream before checking upload limits"
      );
      return getEffectiveUploadLimitMb(
        resolvedStreamId && resolvedStreamId !== "global"
          ? resolvedStreamId
          : undefined
      );
    }),

  // ═══════════════════════════════════════════════════════════════════════════
  // Pre-Ingestion Analysis — AI content check before indexing
  // ═══════════════════════════════════════════════════════════════════════════

  /** Run the 4-stage AI pipeline as analysis only (Validate → Interpret → Decide). */
  preAnalyze: knowledgeWriteProcedure
    .input(
      z.object({
        content: z.string().min(1, "Content is required"),
        title: z.string().max(256).optional(),
        valueStreamDescription: z.string().max(1024).optional(),
      })
    )
    .mutation(async ({ input, ctx }): Promise<PreIngestAnalysis> => {
      await requireKnowledgeDeploymentFeature(
        ctx,
        "release.knowledge.ingest.textPaste",
        "Text paste is disabled for this deployment"
      );

      return serviceJsonTyped<PreIngestAnalysis>(
        `${KNOWLEDGE_PIPELINE_URL}/v1/pre-ingest/analyze`,
        ctx,
        {
          method: "POST",
          body: buildSnakeBody({
            content: input.content,
            title: input.title || "",
            valueStreamDescription: input.valueStreamDescription || "",
          }),
        }
      );
    }),

  /** Run the 3-stage AI analysis on an uploaded file (extract text → Validate → Interpret → Decide). */
  preAnalyzeFile: knowledgeWriteProcedure
    .input(
      z.object({
        fileBase64: z.string().min(1, "File content is required"),
        filename: z.string().min(1, "Filename is required"),
        contentType: z.string().optional(),
        title: z.string().max(256).optional(),
        valueStreamDescription: z.string().max(1024).optional(),
        streamId: z.string().max(64).optional(),
      })
    )
    .mutation(async ({ input, ctx }): Promise<PreIngestAnalysis> => {
      await requireKnowledgeDeploymentFeature(
        ctx,
        "release.knowledge.ingest.fileUpload",
        "File upload is disabled for this deployment"
      );

      const resolvedStreamId = resolveKnowledgeStreamId(
        ctx,
        input.streamId,
        "Select a value stream before analyzing an upload"
      );
      const limits = await getEffectiveUploadLimitMb(
        resolvedStreamId || undefined
      );
      const estimatedBytes = estimateBase64Bytes(input.fileBase64);
      const maxBytes = limits.effectiveMaxMb * 1024 * 1024;
      if (estimatedBytes > maxBytes) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `File too large for this stream: ${(estimatedBytes / (1024 * 1024)).toFixed(1)} MB (max ${limits.effectiveMaxMb} MB)`,
        });
      }
      return serviceMultipartUpload<PreIngestAnalysis>(
        `${KNOWLEDGE_PIPELINE_URL}/v1/pre-ingest/analyze-file`,
        scopedRequestContext(ctx, resolvedStreamId),
        input.fileBase64,
        input.filename,
        input.contentType || "application/octet-stream",
        {
          title: input.title || "",
          value_stream_description: input.valueStreamDescription || "",
          max_doc_size_mb: String(limits.effectiveMaxMb),
        }
      );
    }),

  // ═══════════════════════════════════════════════════════════════════════════
  // Ingestion — knowledge-pipeline-service
  // ═══════════════════════════════════════════════════════════════════════════

  /** Ingest raw text content through the pipeline (extract → clean → enrich → index). */
  ingestText: knowledgeWriteProcedure
    .input(
      z.object({
        content: z.string().min(1, "Content is required"),
        title: z.string().max(256).optional(),
        department: z.string().max(128).optional(),
        documentType: z.string().max(64).optional(),
        tags: z.array(z.string().max(64)).max(20).optional(),
        classification: documentClassificationSchema.optional(),
        accessControl: documentAclSchema.optional(),
        streamId: z.string().max(64).optional(), // value stream for isolation
        chunkSize: z.number().int().min(64).max(4096).optional(),
        chunkOverlap: z.number().int().min(0).max(512).optional(),
      })
    )
    .mutation(async ({ input, ctx }): Promise<IngestResponse> => {
      await requireKnowledgeDeploymentFeature(
        ctx,
        "release.knowledge.ingest.textPaste",
        "Text paste is disabled for this deployment"
      );

      const resolvedStreamId = resolveKnowledgeStreamId(
        ctx,
        input.streamId,
        "Select a value stream before ingesting content"
      );
      const requestCtx = scopedRequestContext(ctx, resolvedStreamId);
      const result = await serviceJsonTyped<IngestResponse>(
        `${KNOWLEDGE_PIPELINE_URL}/v1/ingest/text`,
        requestCtx,
        {
          method: "POST",
          body: buildSnakeBody({
            content: input.content,
            title: input.title || "",
            department: input.department || "",
            documentType: input.documentType || "general",
            tags: input.tags || [],
            classification: input.classification,
            accessControl: input.accessControl,
            streamId: resolvedStreamId,
            chunkSize: input.chunkSize,
            chunkOverlap: input.chunkOverlap,
          }),
        }
      );
      if (result.jobId) {
        startJobWatcher(result.jobId, ctx.user.id, ctx.user, resolvedStreamId);
      }
      return result;
    }),

  /** Ingest content from a web URL (scrape → clean → enrich → index). */
  ingestUrl: knowledgeWriteProcedure
    .input(
      z.object({
        url: z.string().url("Must be a valid URL"),
        title: z.string().max(256).optional(),
        department: z.string().max(128).optional(),
        documentType: z.string().max(64).optional(),
        tags: z.array(z.string().max(64)).max(20).optional(),
        classification: documentClassificationSchema.optional(),
        accessControl: documentAclSchema.optional(),
        streamId: z.string().max(64).optional(),
        chunkSize: z.number().int().min(64).max(4096).optional(),
        chunkOverlap: z.number().int().min(0).max(512).optional(),
      })
    )
    .mutation(async ({ input, ctx }): Promise<IngestResponse> => {
      await requireKnowledgeDeploymentFeature(
        ctx,
        "release.knowledge.ingest.urlCrawl",
        "URL crawl is disabled for this deployment"
      );

      const resolvedStreamId = resolveKnowledgeStreamId(
        ctx,
        input.streamId,
        "Select a value stream before ingesting a URL"
      );
      const requestCtx = scopedRequestContext(ctx, resolvedStreamId);
      const result = await serviceJsonTyped<IngestResponse>(
        `${KNOWLEDGE_PIPELINE_URL}/v1/ingest/url`,
        requestCtx,
        {
          method: "POST",
          body: buildSnakeBody({
            url: input.url,
            title: input.title || "",
            department: input.department || "",
            documentType: input.documentType || "general",
            tags: input.tags || [],
            classification: input.classification,
            accessControl: input.accessControl,
            streamId: resolvedStreamId,
            chunkSize: input.chunkSize,
            chunkOverlap: input.chunkOverlap,
          }),
        }
      );
      if (result.jobId) {
        startJobWatcher(result.jobId, ctx.user.id, ctx.user, resolvedStreamId);
      }
      return result;
    }),

  /** Upload a file (PDF, DOCX, TXT, CSV, MD) and ingest through the pipeline. */
  uploadFile: knowledgeWriteProcedure
    .input(
      z.object({
        fileBase64: z.string().min(1, "File content is required"),
        filename: z.string().min(1, "Filename is required"),
        contentType: z.string().optional(),
        title: z.string().max(256).optional(),
        department: z.string().max(128).optional(),
        documentType: z.string().max(64).optional(),
        tags: z.array(z.string().max(64)).max(20).optional(),
        classification: documentClassificationSchema.optional(),
        accessControl: documentAclSchema.optional(),
        streamId: z.string().max(64).optional(),
        chunkSize: z.number().int().min(64).max(4096).optional(),
        chunkOverlap: z.number().int().min(0).max(512).optional(),
      })
    )
    .mutation(async ({ input, ctx }): Promise<IngestResponse> => {
      await requireKnowledgeDeploymentFeature(
        ctx,
        "release.knowledge.ingest.fileUpload",
        "File upload is disabled for this deployment"
      );

      const resolvedStreamId = resolveKnowledgeStreamId(
        ctx,
        input.streamId,
        "Select a value stream before uploading a document"
      );
      const limits = await getEffectiveUploadLimitMb(
        resolvedStreamId || undefined
      );
      const estimatedBytes = estimateBase64Bytes(input.fileBase64);
      const maxBytes = limits.effectiveMaxMb * 1024 * 1024;
      if (estimatedBytes > maxBytes) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `File too large for this stream: ${(estimatedBytes / (1024 * 1024)).toFixed(1)} MB (max ${limits.effectiveMaxMb} MB)`,
        });
      }
      const result = await serviceMultipartUpload<IngestResponse>(
        `${KNOWLEDGE_PIPELINE_URL}/v1/ingest/file`,
        scopedRequestContext(ctx, resolvedStreamId),
        input.fileBase64,
        input.filename,
        input.contentType || "application/octet-stream",
        {
          title: input.title || "",
          department: input.department || "",
          document_type: input.documentType || "general",
          tags: (input.tags || []).join(","),
          classification: input.classification || "internal",
          allowed_users: (input.accessControl?.allowedUsers || []).join(","),
          allowed_groups: (input.accessControl?.allowedGroups || []).join(","),
          denied_users: (input.accessControl?.deniedUsers || []).join(","),
          denied_groups: (input.accessControl?.deniedGroups || []).join(","),
          stream_id: resolvedStreamId ?? "",
          chunk_size: String(input.chunkSize || 512),
          chunk_overlap: String(input.chunkOverlap || 64),
          max_doc_size_mb: String(limits.effectiveMaxMb),
        }
      );
      if (result.jobId) {
        startJobWatcher(result.jobId, ctx.user.id, ctx.user, resolvedStreamId);
      }
      return result;
    }),

  // ═══════════════════════════════════════════════════════════════════════════
  // Jobs — knowledge-pipeline-service
  // ═══════════════════════════════════════════════════════════════════════════

  /** List ingestion jobs with pagination. */
  listJobs: knowledgeReadProcedure
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(100).optional(),
          offset: z.number().int().min(0).optional(),
          valueStreamId: z.string().max(64).optional(),
        })
        .optional()
    )
    .query(async ({ input, ctx }): Promise<JobListResponse> => {
      const limit = input?.limit ?? 50;
      const offset = input?.offset ?? 0;
      const resolvedStreamId = resolveKnowledgeRuntimeStreamId(
        ctx,
        input?.valueStreamId,
        "Select a value stream before viewing KB processing jobs"
      );
      const response = await serviceJsonTyped<JobListResponse>(
        `${KNOWLEDGE_PIPELINE_URL}/v1/jobs?limit=${limit}&offset=${offset}`,
        scopedRequestContext(ctx, resolvedStreamId)
      );
      const jobs = response.jobs.filter(
        job => job.streamId === resolvedStreamId
      );
      for (const job of jobs) {
        if (!shouldWatchJob(job)) continue;
        startJobWatcher(job.id, ctx.user.id, ctx.user, resolvedStreamId);
      }
      return {
        ...response,
        jobs,
        total: jobs.length,
      };
    }),

  /** Get detailed status of a specific ingestion job. */
  getJob: knowledgeReadProcedure
    .input(
      z.object({
        jobId: z.string(),
        valueStreamId: z.string().max(64).optional(),
      })
    )
    .query(async ({ input, ctx }): Promise<JobStatusResponse> => {
      const resolvedStreamId = resolveKnowledgeRuntimeStreamId(
        ctx,
        input.valueStreamId,
        "Select a value stream before viewing KB processing jobs"
      );
      const response = await serviceJsonTyped<JobStatusResponse>(
        `${KNOWLEDGE_PIPELINE_URL}/v1/jobs/${input.jobId}`,
        scopedRequestContext(ctx, resolvedStreamId)
      );
      if (response.job.streamId !== resolvedStreamId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Job not found in selected value stream",
        });
      }
      if (shouldWatchJob(response.job)) {
        startJobWatcher(
          response.job.id,
          ctx.user.id,
          ctx.user,
          resolvedStreamId
        );
      }
      return response;
    }),

  /** Cancel an active ingestion job. */
  cancelJob: knowledgeWriteProcedure
    .input(
      z.object({
        jobId: z.string(),
        valueStreamId: z.string().max(64).optional(),
      })
    )
    .mutation(async ({ input, ctx }): Promise<JobStatusResponse> => {
      const resolvedStreamId = resolveKnowledgeRuntimeStreamId(
        ctx,
        input.valueStreamId,
        "Select a value stream before cancelling KB processing jobs"
      );
      const response = await serviceJsonTyped<JobStatusResponse>(
        `${KNOWLEDGE_PIPELINE_URL}/v1/jobs/${input.jobId}/cancel`,
        scopedRequestContext(ctx, resolvedStreamId),
        { method: "POST" }
      );
      if (response.job.streamId !== resolvedStreamId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Job not found in selected value stream",
        });
      }
      return response;
    }),

  // ═══════════════════════════════════════════════════════════════════════════
  // Documents — knowledge-api (AlloyDB)
  // ═══════════════════════════════════════════════════════════════════════════

  /** List all indexed documents with pagination. */
  listDocuments: knowledgeReadProcedure
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(100).optional(),
          offset: z.number().int().min(0).optional(),
          valueStreamId: z.string().max(64).optional(),
        })
        .optional()
    )
    .query(async ({ input, ctx }): Promise<DocumentListResponse> => {
      const limit = input?.limit ?? 50;
      const offset = input?.offset ?? 0;
      const resolvedStreamId = resolveKnowledgeRuntimeStreamId(
        ctx,
        input?.valueStreamId,
        "Select a value stream before viewing documents"
      );
      const requestCtx = scopedRequestContext(ctx, resolvedStreamId);
      return serviceJsonTyped<DocumentListResponse>(
        `${VECTOR_STORE_URL}/v1/documents?limit=${limit}&offset=${offset}`,
        requestCtx
      );
    }),

  /** Aggregate document inventory metrics for overview and library surfaces. */
  documentInventorySummary: knowledgeReadProcedure
    .input(
      z
        .object({
          valueStreamId: z.string().max(64).optional(),
        })
        .optional()
    )
    .query(async ({ input, ctx }): Promise<DocumentInventorySummary> => {
      const resolvedStreamId = resolveKnowledgeRuntimeStreamId(
        ctx,
        input?.valueStreamId,
        "Select a value stream before viewing document inventory"
      );
      return serviceJsonTyped<DocumentInventorySummary>(
        `${VECTOR_STORE_URL}/v1/documents/summary`,
        scopedRequestContext(ctx, resolvedStreamId)
      );
    }),

  /** Get detailed information about a specific document. */
  getDocument: knowledgeReadProcedure
    .input(
      z.object({
        documentId: z.string(),
        valueStreamId: z.string().max(64).optional(),
      })
    )
    .query(async ({ input, ctx }): Promise<DocumentDetail> => {
      const resolvedStreamId = resolveKnowledgeRuntimeStreamId(
        ctx,
        input.valueStreamId,
        "Select a value stream before opening a document"
      );
      return serviceJsonTyped<DocumentDetail>(
        `${VECTOR_STORE_URL}/v1/documents/${input.documentId}`,
        scopedRequestContext(ctx, resolvedStreamId)
      );
    }),

  /** Delete a document and all its chunks from the knowledge base. */
  deleteDocument: knowledgeWriteProcedure
    .input(
      z.object({
        documentId: z.string(),
        valueStreamId: z.string().max(64).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const resolvedStreamId = resolveKnowledgeRuntimeStreamId(
        ctx,
        input.valueStreamId,
        "Select a value stream before deleting a document"
      );
      return serviceJsonTyped<{ deleted: boolean }>(
        `${VECTOR_STORE_URL}/v1/documents/${input.documentId}`,
        scopedRequestContext(ctx, resolvedStreamId),
        { method: "DELETE" }
      );
    }),

  /** Batch delete multiple documents in a single request (max 100). */
  batchDeleteDocuments: knowledgeWriteProcedure
    .input(
      z.object({
        ids: z.array(z.string()).min(1).max(100),
        valueStreamId: z.string().max(64).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const resolvedStreamId = resolveKnowledgeRuntimeStreamId(
        ctx,
        input.valueStreamId,
        "Select a value stream before deleting documents"
      );
      return serviceJsonTyped<{
        deleted: string[];
        failed: string[];
        total_deleted: number;
        total_failed: number;
      }>(
        `${VECTOR_STORE_URL}/v1/documents/batch-delete`,
        scopedRequestContext(ctx, resolvedStreamId),
        {
          method: "POST",
          body: buildSnakeBody({ documentIds: input.ids }),
        }
      );
    }),

  /** Update a document's lifecycle status (archive, restore, etc.). */
  updateDocumentStatus: knowledgeWriteProcedure
    .input(
      z.object({
        documentId: z.string(),
        status: z.enum(["indexed", "archived", "pending"]),
        valueStreamId: z.string().max(64).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const resolvedStreamId = resolveKnowledgeRuntimeStreamId(
        ctx,
        input.valueStreamId,
        "Select a value stream before updating a document"
      );
      return serviceJsonTyped<{ status: string; document_id: string }>(
        `${VECTOR_STORE_URL}/v1/documents/${input.documentId}/status`,
        scopedRequestContext(ctx, resolvedStreamId),
        {
          method: "PATCH",
          body: buildSnakeBody({ status: input.status }),
        }
      );
    }),

  /** Get full document content for export / download. */
  getDocumentContent: knowledgeReadProcedure
    .input(
      z.object({
        documentId: z.string(),
        valueStreamId: z.string().max(64).optional(),
      })
    )
    .query(async ({ input, ctx }): Promise<DocumentContentExport> => {
      const resolvedStreamId = resolveKnowledgeRuntimeStreamId(
        ctx,
        input.valueStreamId,
        "Select a value stream before viewing document content"
      );
      return serviceJsonTyped<DocumentContentExport>(
        `${VECTOR_STORE_URL}/v1/documents/${input.documentId}/content`,
        scopedRequestContext(ctx, resolvedStreamId)
      );
    }),

  /** List all unique tags across the knowledge base (for autocomplete / filtering). */
  listAllTags: knowledgeReadProcedure
    .input(
      z
        .object({
          valueStreamId: z.string().max(64).optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }): Promise<{ tags: string[] }> => {
      const resolvedStreamId = resolveKnowledgeRuntimeStreamId(
        ctx,
        input?.valueStreamId,
        "Select a value stream before viewing knowledge tags"
      );
      return serviceJsonTyped<{ tags: string[] }>(
        `${VECTOR_STORE_URL}/v1/tags`,
        scopedRequestContext(ctx, resolvedStreamId)
      );
    }),

  /** Partially update document metadata (title, department, tags, etc.). */
  updateDocumentMetadata: knowledgeWriteProcedure
    .input(
      z.object({
        documentId: z.string(),
        valueStreamId: z.string().max(64).optional(),
        title: z.string().optional(),
        department: z.string().optional(),
        documentType: z.string().optional(),
        tags: z.array(z.string()).optional(),
        sourceUrl: z.string().optional(),
        classification: documentClassificationSchema.optional(),
        accessControl: documentAclSchema.optional(),
        custom: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .mutation(async ({ input, ctx }): Promise<MetadataUpdateResult> => {
      const { documentId, valueStreamId, ...fields } = input;
      const resolvedStreamId = resolveKnowledgeRuntimeStreamId(
        ctx,
        valueStreamId,
        "Select a value stream before editing document metadata"
      );
      return serviceJsonTyped<MetadataUpdateResult>(
        `${VECTOR_STORE_URL}/v1/documents/${documentId}/metadata`,
        scopedRequestContext(ctx, resolvedStreamId),
        {
          method: "PATCH",
          body: buildSnakeBody(fields),
        }
      );
    }),

  /** Reprocess a document — re-chunk, re-embed, re-index with current pipeline. */
  reprocessDocument: knowledgeWriteProcedure
    .input(
      z.object({
        documentId: z.string(),
        valueStreamId: z.string().max(64).optional(),
        chunkSize: z.number().int().min(64).max(4096).optional(),
        chunkOverlap: z.number().int().min(0).max(512).optional(),
      })
    )
    .mutation(async ({ input, ctx }): Promise<ReprocessResult> => {
      const resolvedStreamId = resolveKnowledgeRuntimeStreamId(
        ctx,
        input.valueStreamId,
        "Select a value stream before reprocessing a document"
      );
      return serviceJsonTyped<ReprocessResult>(
        `${KNOWLEDGE_PIPELINE_URL}/v1/documents/reprocess`,
        scopedRequestContext(ctx, resolvedStreamId),
        {
          method: "POST",
          body: buildSnakeBody({
            documentId: input.documentId,
            chunkSize: input.chunkSize ?? 512,
            chunkOverlap: input.chunkOverlap ?? 64,
          }),
        }
      );
    }),

  /** Refresh a document from its source URL — fetch fresh content and re-ingest if changed. */
  refreshDocument: knowledgeWriteProcedure
    .input(
      z.object({
        documentId: z.string(),
        valueStreamId: z.string().max(64).optional(),
        chunkSize: z.number().int().min(64).max(4096).optional(),
        chunkOverlap: z.number().int().min(0).max(512).optional(),
      })
    )
    .mutation(async ({ input, ctx }): Promise<RefreshResult> => {
      const resolvedStreamId = resolveKnowledgeRuntimeStreamId(
        ctx,
        input.valueStreamId,
        "Select a value stream before refreshing a document"
      );
      return serviceJsonTyped<RefreshResult>(
        `${KNOWLEDGE_PIPELINE_URL}/v1/documents/refresh`,
        scopedRequestContext(ctx, resolvedStreamId),
        {
          method: "POST",
          body: buildSnakeBody({
            documentId: input.documentId,
            chunkSize: input.chunkSize ?? 512,
            chunkOverlap: input.chunkOverlap ?? 64,
          }),
        }
      );
    }),

  // ═══════════════════════════════════════════════════════════════════════════
  // Search — knowledge-api (hybrid: vector + keyword)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Hybrid search against the knowledge base.
   *
   * Reranking: enabled when the resolved stream's knowledgeConfig has
   * enableReranking=true, or when the caller explicitly passes rerank=true.
   * The knowledge-api applies a single LLM reranking pass over the top-k
   * results before returning, improving precision at ~200–400 ms extra cost.
   */
  search: knowledgeReadProcedure
    .input(
      z.object({
        query: z.string().min(1, "Query is required"),
        limit: z.number().int().min(1).max(50).optional(),
        topK: z.number().int().min(1).max(50).optional(),
        mode: z.enum(["hybrid", "vector", "keyword"]).optional(),
        valueStreamId: z.string().optional(),
        shapeContext: z.boolean().optional(),
        /** Override reranking for this request. If omitted, follows the stream's knowledgeConfig. */
        rerank: z.boolean().optional(),
        /** Include pending_review documents (for test sandbox). */
        includePending: z.boolean().optional(),
      })
    )
    .mutation(async ({ input, ctx }): Promise<SearchResponse> => {
      await requireKnowledgeFeatureFlag(
        ctx,
        "release.knowledge.validate.testSandbox",
        "The test sandbox is disabled for this deployment"
      );

      if (input.shapeContext) {
        await requireKnowledgeFeatureFlag(
          ctx,
          "release.knowledge.validate.contextShaping",
          "Context shaping is disabled for this deployment"
        );
      }

      const resolvedStreamId = resolveKnowledgeRuntimeStreamId(
        ctx,
        input.valueStreamId,
        "Select a value stream before testing retrieval"
      );
      return runKnowledgeSearchRequest(ctx, resolvedStreamId, input);
    }),

  /** Compare current retrieval with a shadow run that includes pending-review content. */
  compareShadowRetrieval: managerProcedure
    .input(
      z.object({
        query: z.string().min(1, "Query is required"),
        limit: z.number().int().min(1).max(20).optional(),
        mode: z.enum(["hybrid", "vector", "keyword"]).optional(),
        valueStreamId: z.string().optional(),
        shapeContext: z.boolean().optional(),
        rerank: z.boolean().optional(),
        selectedDocumentId: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }): Promise<ShadowRetrievalComparison> => {
      await requireKnowledgeFeatureFlag(
        ctx,
        "release.knowledge.validate.testSandbox",
        "The test sandbox is disabled for this deployment"
      );
      await requireKnowledgeFeatureFlag(
        ctx,
        "release.knowledge.validate.compare",
        "The published-vs-pending comparison is disabled for this deployment"
      );

      if (input.shapeContext) {
        await requireKnowledgeFeatureFlag(
          ctx,
          "release.knowledge.validate.contextShaping",
          "Context shaping is disabled for this deployment"
        );
      }

      const resolvedStreamId = resolveKnowledgeRuntimeStreamId(
        ctx,
        input.valueStreamId,
        "Select a value stream before comparing shadow retrieval"
      );

      const [baselineSearch, shadowSearch] = await Promise.all([
        runKnowledgeSearchRequest(ctx, resolvedStreamId, {
          query: input.query,
          limit: input.limit,
          mode: input.mode,
          shapeContext: input.shapeContext,
          rerank: input.rerank,
          includePending: false,
        }),
        runKnowledgeSearchRequest(ctx, resolvedStreamId, {
          query: input.query,
          limit: input.limit,
          mode: input.mode,
          shapeContext: input.shapeContext,
          rerank: input.rerank,
          includePending: true,
        }),
      ]);

      const [baselineAnswer, shadowAnswer] = await Promise.all([
        generateGroundedAnswerFromSearch(
          ctx,
          resolvedStreamId,
          input.query,
          baselineSearch
        ),
        generateGroundedAnswerFromSearch(
          ctx,
          resolvedStreamId,
          input.query,
          shadowSearch
        ),
      ]);

      return {
        baseline: {
          search: baselineSearch,
          answer: baselineAnswer,
          includesSelectedDocument: searchIncludesDocument(
            baselineSearch,
            input.selectedDocumentId
          ),
        },
        shadow: {
          search: shadowSearch,
          answer: shadowAnswer,
          includesSelectedDocument: searchIncludesDocument(
            shadowSearch,
            input.selectedDocumentId
          ),
        },
        selectedDocumentId: input.selectedDocumentId ?? null,
        summary: buildShadowRetrievalSummary(
          baselineSearch,
          shadowSearch,
          baselineAnswer,
          shadowAnswer,
          input.selectedDocumentId
        ),
      };
    }),

  // ═══════════════════════════════════════════════════════════════════════════
  // Statistics — knowledge-api + Neo4j
  // ═══════════════════════════════════════════════════════════════════════════

  /** Vector store statistics (document count, chunk count, etc.). */
  stats: knowledgeReadProcedure
    .input(
      z
        .object({
          valueStreamId: z.string().max(64).optional(),
        })
        .optional()
    )
    .query(async ({ input, ctx }): Promise<StoreStats> => {
      const resolvedStreamId = resolveKnowledgeRuntimeStreamId(
        ctx,
        input?.valueStreamId,
        "Select a value stream before viewing KB statistics"
      );
      const stats = await serviceJsonTyped<StoreStats>(
        `${VECTOR_STORE_URL}/v1/stats`,
        scopedRequestContext(ctx, resolvedStreamId)
      );
      return {
        ...stats,
        totalDocuments: readStoreDocumentCount(stats),
        totalChunks: readStoreChunkCount(stats),
      };
    }),

  /** Knowledge graph statistics from Neo4j. */
  graphStats: knowledgeReadProcedure
    .input(
      z
        .object({
          valueStreamId: z.string().max(64).optional(),
        })
        .optional()
    )
    .query(async ({ input, ctx }): Promise<GraphStats> => {
      const resolvedStreamId = resolveKnowledgeRuntimeStreamId(
        ctx,
        input?.valueStreamId,
        "Select a value stream before viewing graph statistics"
      );
      return serviceJsonTyped<GraphStats>(
        `${VECTOR_STORE_URL}/v1/graph/stats`,
        scopedRequestContext(ctx, resolvedStreamId)
      );
    }),

  // ═══════════════════════════════════════════════════════════════════════════
  // Service Health — proxied through BFF (no direct browser→Python calls)
  // ═══════════════════════════════════════════════════════════════════════════

  /** Ping all downstream services and return their health + latency. */
  serviceHealth: knowledgeReadProcedure.query(async () => {
    const [coreServices, llmGateway, hvsiAudit] = await Promise.all([
      getServiceHealthItems(),
      pingService("llm-gateway", LLM_GATEWAY_BASE_URL),
      getLocalHvsiServiceHealthItem(),
    ]);

    return {
      services: hvsiAudit
        ? [...coreServices, llmGateway, hvsiAudit]
        : [...coreServices, llmGateway],
    };
  }),

  /** Fetch live OpenAPI spec from a downstream service. */
  openApiSpec: managerProcedure
    .input(z.object({ service: z.enum(["pipeline", "vectorStore"]) }))
    .query(async ({ input, ctx }) => {
      const url =
        input.service === "pipeline"
          ? KNOWLEDGE_PIPELINE_URL
          : VECTOR_STORE_URL;
      return serviceJsonTyped<Record<string, unknown>>(
        `${url}/openapi.json`,
        ctx
      );
    }),

  // ═══════════════════════════════════════════════════════════════════════════
  // Taxonomy — knowledge-api
  // ═══════════════════════════════════════════════════════════════════════════

  /** Create a taxonomy node. */
  taxonomyCreateNode: managerProcedure
    .input(
      z.object({
        valueStreamId: z.string().max(64).optional(),
        label: z.string().min(1).max(128),
        parentId: z.string().optional(),
        description: z.string().max(500).optional(),
        aliases: z.array(z.string().max(64)).max(10).optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .mutation(async ({ input, ctx }): Promise<TaxonomyNode> => {
      await requireKnowledgeFeatureFlag(
        ctx,
        "release.knowledge.library.taxonomy",
        "Taxonomy is disabled for this deployment"
      );
      const resolvedStreamId = resolveKnowledgeRuntimeStreamId(
        ctx,
        input.valueStreamId,
        "Select a value stream before creating taxonomy nodes"
      );
      const { valueStreamId: _valueStreamId, ...body } = input;

      return serviceJsonTyped<TaxonomyNode>(
        `${VECTOR_STORE_URL}/v1/taxonomy/nodes`,
        scopedRequestContext(ctx, resolvedStreamId),
        {
          method: "POST",
          body: buildSnakeBody(body),
        }
      );
    }),

  /** List root taxonomy nodes. */
  taxonomyListRoots: managerProcedure
    .input(z.object({ valueStreamId: z.string().max(64).optional() }))
    .query(async ({ input, ctx }): Promise<TaxonomyNode[]> => {
      await requireKnowledgeFeatureFlag(
        ctx,
        "release.knowledge.library.taxonomy",
        "Taxonomy is disabled for this deployment"
      );
      const resolvedStreamId = resolveKnowledgeRuntimeStreamId(
        ctx,
        input.valueStreamId,
        "Select a value stream before viewing taxonomy"
      );

      return serviceJsonTyped<TaxonomyNode[]>(
        `${VECTOR_STORE_URL}/v1/taxonomy/nodes`,
        scopedRequestContext(ctx, resolvedStreamId)
      );
    }),

  /** Get a taxonomy node by ID. */
  taxonomyGetNode: managerProcedure
    .input(
      z.object({
        nodeId: z.string(),
        valueStreamId: z.string().max(64).optional(),
      })
    )
    .query(async ({ input, ctx }): Promise<TaxonomyNode> => {
      await requireKnowledgeFeatureFlag(
        ctx,
        "release.knowledge.library.taxonomy",
        "Taxonomy is disabled for this deployment"
      );
      const resolvedStreamId = resolveKnowledgeRuntimeStreamId(
        ctx,
        input.valueStreamId,
        "Select a value stream before viewing taxonomy nodes"
      );

      return serviceJsonTyped<TaxonomyNode>(
        `${VECTOR_STORE_URL}/v1/taxonomy/nodes/${input.nodeId}`,
        scopedRequestContext(ctx, resolvedStreamId)
      );
    }),

  /** Update a taxonomy node. */
  taxonomyUpdateNode: managerProcedure
    .input(
      z.object({
        nodeId: z.string(),
        valueStreamId: z.string().max(64).optional(),
        label: z.string().max(128).optional(),
        description: z.string().max(500).optional(),
        aliases: z.array(z.string().max(64)).max(10).optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .mutation(async ({ input, ctx }): Promise<TaxonomyNode> => {
      await requireKnowledgeFeatureFlag(
        ctx,
        "release.knowledge.library.taxonomy",
        "Taxonomy is disabled for this deployment"
      );
      const resolvedStreamId = resolveKnowledgeRuntimeStreamId(
        ctx,
        input.valueStreamId,
        "Select a value stream before updating taxonomy nodes"
      );

      const { nodeId, valueStreamId: _valueStreamId, ...body } = input;
      return serviceJsonTyped<TaxonomyNode>(
        `${VECTOR_STORE_URL}/v1/taxonomy/nodes/${nodeId}`,
        scopedRequestContext(ctx, resolvedStreamId),
        {
          method: "PUT",
          body: buildSnakeBody(body),
        }
      );
    }),

  /** Delete a taxonomy node (optional cascade). */
  taxonomyDeleteNode: managerProcedure
    .input(
      z.object({
        nodeId: z.string(),
        cascade: z.boolean().optional(),
        valueStreamId: z.string().max(64).optional(),
      })
    )
    .mutation(async ({ input, ctx }): Promise<{ deleted: number }> => {
      await requireKnowledgeFeatureFlag(
        ctx,
        "release.knowledge.library.taxonomy",
        "Taxonomy is disabled for this deployment"
      );
      const resolvedStreamId = resolveKnowledgeRuntimeStreamId(
        ctx,
        input.valueStreamId,
        "Select a value stream before deleting taxonomy nodes"
      );

      const qs = input.cascade ? "?cascade=true" : "";
      return serviceJsonTyped<{ deleted: number }>(
        `${VECTOR_STORE_URL}/v1/taxonomy/nodes/${input.nodeId}${qs}`,
        scopedRequestContext(ctx, resolvedStreamId),
        {
          method: "DELETE",
        }
      );
    }),

  /** List children of a taxonomy node. */
  taxonomyGetChildren: managerProcedure
    .input(
      z.object({
        nodeId: z.string(),
        valueStreamId: z.string().max(64).optional(),
      })
    )
    .query(async ({ input, ctx }): Promise<TaxonomyNode[]> => {
      await requireKnowledgeFeatureFlag(
        ctx,
        "release.knowledge.library.taxonomy",
        "Taxonomy is disabled for this deployment"
      );
      const resolvedStreamId = resolveKnowledgeRuntimeStreamId(
        ctx,
        input.valueStreamId,
        "Select a value stream before viewing taxonomy children"
      );

      return serviceJsonTyped<TaxonomyNode[]>(
        `${VECTOR_STORE_URL}/v1/taxonomy/nodes/${input.nodeId}/children`,
        scopedRequestContext(ctx, resolvedStreamId)
      );
    }),

  /** Get path from root to a node. */
  taxonomyGetPath: managerProcedure
    .input(
      z.object({
        nodeId: z.string(),
        valueStreamId: z.string().max(64).optional(),
      })
    )
    .query(async ({ input, ctx }): Promise<TaxonomyNode[]> => {
      await requireKnowledgeFeatureFlag(
        ctx,
        "release.knowledge.library.taxonomy",
        "Taxonomy is disabled for this deployment"
      );
      const resolvedStreamId = resolveKnowledgeRuntimeStreamId(
        ctx,
        input.valueStreamId,
        "Select a value stream before viewing taxonomy paths"
      );

      return serviceJsonTyped<TaxonomyNode[]>(
        `${VECTOR_STORE_URL}/v1/taxonomy/nodes/${input.nodeId}/path`,
        scopedRequestContext(ctx, resolvedStreamId)
      );
    }),

  /** Move a taxonomy node to a new parent. */
  taxonomyMoveNode: managerProcedure
    .input(
      z.object({
        nodeId: z.string(),
        newParentId: z.string().nullable(),
        valueStreamId: z.string().max(64).optional(),
      })
    )
    .mutation(async ({ input, ctx }): Promise<TaxonomyNode> => {
      await requireKnowledgeFeatureFlag(
        ctx,
        "release.knowledge.library.taxonomy",
        "Taxonomy is disabled for this deployment"
      );
      const resolvedStreamId = resolveKnowledgeRuntimeStreamId(
        ctx,
        input.valueStreamId,
        "Select a value stream before moving taxonomy nodes"
      );

      return serviceJsonTyped<TaxonomyNode>(
        `${VECTOR_STORE_URL}/v1/taxonomy/nodes/${input.nodeId}/move`,
        scopedRequestContext(ctx, resolvedStreamId),
        {
          method: "POST",
          body: buildSnakeBody({ newParentId: input.newParentId }),
        }
      );
    }),

  /** Validate tags against the taxonomy. */
  taxonomyValidateTags: managerProcedure
    .input(
      z.object({
        tags: z.array(z.string().max(64)).max(50),
        valueStreamId: z.string().max(64).optional(),
      })
    )
    .mutation(async ({ input, ctx }): Promise<TagValidationResult> => {
      await requireKnowledgeFeatureFlag(
        ctx,
        "release.knowledge.library.taxonomy",
        "Taxonomy is disabled for this deployment"
      );
      const resolvedStreamId = resolveKnowledgeRuntimeStreamId(
        ctx,
        input.valueStreamId,
        "Select a value stream before validating taxonomy tags"
      );

      return serviceJsonTyped<TagValidationResult>(
        `${VECTOR_STORE_URL}/v1/taxonomy/validate`,
        scopedRequestContext(ctx, resolvedStreamId),
        {
          method: "POST",
          body: JSON.stringify({ tags: input.tags }),
        }
      );
    }),

  /** Get taxonomy tree summary statistics. */
  taxonomyInfo: managerProcedure
    .input(z.object({ valueStreamId: z.string().max(64).optional() }))
    .query(async ({ input, ctx }): Promise<TaxonomyTreeInfo> => {
      await requireKnowledgeFeatureFlag(
        ctx,
        "release.knowledge.library.taxonomy",
        "Taxonomy is disabled for this deployment"
      );
      const resolvedStreamId = resolveKnowledgeRuntimeStreamId(
        ctx,
        input.valueStreamId,
        "Select a value stream before viewing taxonomy summary"
      );

      return serviceJsonTyped<TaxonomyTreeInfo>(
        `${VECTOR_STORE_URL}/v1/taxonomy/info`,
        scopedRequestContext(ctx, resolvedStreamId)
      );
    }),

  // ═══════════════════════════════════════════════════════════════════════════
  // Evaluation — knowledge-api
  // ═══════════════════════════════════════════════════════════════════════════

  /** Run RAGAS-style evaluation on a test suite. */
  evaluateSuite: managerProcedure
    .input(
      z.object({
        valueStreamId: z.string().max(64).optional(),
        suiteName: z.string().optional(),
        cases: z
          .array(
            z.object({
              id: z.string(),
              query: z.string(),
              expectedAnswer: z.string().optional(),
              retrievedContexts: z.array(z.string()).optional(),
              generatedAnswer: z.string().optional(),
            })
          )
          .min(1),
        relevanceThreshold: z.number().min(0).max(1).optional(),
      })
    )
    .mutation(async ({ input, ctx }): Promise<EvaluationReport> => {
      await requireKnowledgeFeatureFlag(
        ctx,
        "release.knowledge.validate.evalSuite",
        "The evaluation suite is disabled for this deployment"
      );
      const resolvedStreamId = resolveKnowledgeRuntimeStreamId(
        ctx,
        input.valueStreamId,
        "Select a value stream before running an evaluation suite"
      );
      const requestCtx = scopedRequestContext(ctx, resolvedStreamId);
      const payload = {
        suiteName: input.suiteName,
        cases: input.cases,
        relevanceThreshold: input.relevanceThreshold,
      };

      return serviceJsonTyped<EvaluationReport>(
        `${VECTOR_STORE_URL}/v1/evaluate`,
        requestCtx,
        {
          method: "POST",
          body: buildSnakeBody(payload),
        }
      );
    }),

  /** Quick single-case evaluation. */
  evaluateSingle: knowledgeReadProcedure
    .input(
      z.object({
        valueStreamId: z.string().max(64).optional(),
        query: z.string().min(1),
        retrievedContexts: z.array(z.string()).optional(),
        expectedAnswer: z.string().optional(),
        generatedAnswer: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }): Promise<EvaluationReport> => {
      await requireKnowledgeFeatureFlag(
        ctx,
        "release.knowledge.validate.testSandbox",
        "The test sandbox is disabled for this deployment"
      );
      const resolvedStreamId = resolveKnowledgeRuntimeStreamId(
        ctx,
        input.valueStreamId,
        "Select a value stream before evaluating an answer"
      );
      const requestCtx = scopedRequestContext(ctx, resolvedStreamId);
      const payload = {
        query: input.query,
        retrievedContexts: input.retrievedContexts,
        expectedAnswer: input.expectedAnswer,
        generatedAnswer: input.generatedAnswer,
      };

      return serviceJsonTyped<EvaluationReport>(
        `${VECTOR_STORE_URL}/v1/evaluate/single`,
        requestCtx,
        {
          method: "POST",
          body: buildSnakeBody(payload),
        }
      );
    }),

  /**
   * Auto-evaluate: search + evaluate in one call.
   * Sends queries through the real retrieval pipeline and scores results.
   */
  evaluateAuto: managerProcedure
    .input(
      z.object({
        suiteName: z.string().optional(),
        cases: z
          .array(
            z.object({
              id: z.string().optional(),
              query: z.string(),
              expectedAnswer: z.string().optional(),
            })
          )
          .min(1)
          .max(50),
        topK: z.number().int().min(1).max(20).optional(),
        relevanceThreshold: z.number().min(0).max(1).optional(),
        valueStreamId: z.string().max(64).optional(),
        includePending: z.boolean().optional(),
      })
    )
    .mutation(async ({ input, ctx }): Promise<EvaluationReport> => {
      await requireKnowledgeFeatureFlag(
        ctx,
        "release.knowledge.validate.evalSuite",
        "The evaluation suite is disabled for this deployment"
      );

      const resolvedStreamId = resolveKnowledgeRuntimeStreamId(
        ctx,
        input.valueStreamId,
        "Select a value stream before running an automated evaluation"
      );
      const requestCtx = scopedRequestContext(ctx, resolvedStreamId);
      const { departments } =
        resolvedStreamId && resolvedStreamId !== "global"
          ? await getStreamMeta(resolvedStreamId)
          : { departments: [] };

      return serviceJsonTyped<EvaluationReport>(
        `${VECTOR_STORE_URL}/v1/evaluate/auto`,
        requestCtx,
        {
          method: "POST",
          body: buildSnakeBody({
            suiteName: input.suiteName,
            cases: input.cases,
            topK: input.topK,
            relevanceThreshold: input.relevanceThreshold,
            includePending: input.includePending,
            departments,
          }),
        }
      );
    }),

  /** Run a full agent E2E evaluation through the orchestrator chat path. */
  runAgentE2EEval: managerProcedure
    .input(
      z.object({
        suiteName: z.string().max(128).optional(),
        cases: z
          .array(
            z.object({
              id: z.string().optional(),
              query: z.string().min(1),
              expectedAnswer: z.string().optional(),
            })
          )
          .min(1)
          .max(25),
        valueStreamId: z.string().max(64).optional(),
        requireCitations: z.boolean().optional(),
      })
    )
    .mutation(async ({ input, ctx }): Promise<AgentEvalRunSummary> => {
      await requireKnowledgeFeatureFlag(
        ctx,
        "release.knowledge.validate.evalSuite",
        "The evaluation suite is disabled for this deployment"
      );

      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database unavailable",
        });
      }

      const resolvedStreamId = resolveKnowledgeStreamId(
        ctx,
        input.valueStreamId,
        "Select a value stream before running an agent evaluation"
      );
      const requestCtx = scopedRequestContext(ctx, resolvedStreamId);
      const orgId = ctx.user.orgId ?? "default";
      const createdBy = ctx.user.id;
      const suiteName = input.suiteName?.trim() || "agent-e2e";
      const runId = nanoid(21);
      const now = new Date();

      await db.insert(knowledgeAgentEvalRuns).values({
        id: runId,
        valueStreamId: resolvedStreamId,
        orgId,
        createdBy,
        suiteName,
        status: "running",
        totalCases: input.cases.length,
        passedCases: 0,
        passRate: 0,
        averageConfidence: 0,
        averageGuardrailScore: 0,
        averageTraceSteps: 0,
        passed: 0,
        results: JSON.stringify({ cases: [] }),
        createdAt: now,
        completedAt: null,
      });

      try {
        const caseResults: AgentEvalCaseResult[] = [];
        for (const inputCase of input.cases) {
          const caseId = inputCase.id?.trim() || nanoid(12);
          try {
            const response = await serviceJsonTyped<OrchestratorEvalResponse>(
              `${ORCHESTRATOR_URL}/v1/chat`,
              requestCtx,
              {
                method: "POST",
                body: buildSnakeBody({
                  conversationId: `kb-e2e-${runId}-${caseId}`,
                  message: inputCase.query,
                  userId: String(ctx.user.id ?? ctx.user.email ?? "kb-e2e"),
                  history: [],
                  scope: resolvedStreamId,
                  scopes:
                    resolvedStreamId === "global"
                      ? ["global"]
                      : [resolvedStreamId],
                }),
              }
            );

            const confidence = clampPercent((response.confidence ?? 0) * 100);
            const guardrailScore = clampPercent(
              (response.guardrails?.score ?? 0) * 100
            );
            const guardrailPassed = response.guardrails?.passed !== false;
            const citations = response.citations ?? [];
            const trace = response.trace ?? [];
            const toolCalls = response.toolCalls ?? [];
            const failureReasons: string[] = [];

            if (!response.content?.trim()) {
              failureReasons.push("No answer returned");
            }
            if (confidence < 50) {
              failureReasons.push("Confidence below 50%");
            }
            if (!guardrailPassed) {
              failureReasons.push("Guardrails flagged the response");
            }
            if ((input.requireCitations ?? true) && citations.length === 0) {
              failureReasons.push("No citations returned");
            }
            if (
              inputCase.expectedAnswer?.trim() &&
              !String(response.content ?? "")
                .toLowerCase()
                .includes(inputCase.expectedAnswer.trim().toLowerCase())
            ) {
              failureReasons.push("Expected answer text was not present");
            }

            caseResults.push({
              caseId,
              query: inputCase.query,
              expectedAnswer: inputCase.expectedAnswer ?? null,
              passed: failureReasons.length === 0,
              confidence,
              guardrailPassed,
              guardrailScore,
              traceCount: trace.length,
              toolCallCount: toolCalls.length,
              citationCount: citations.length,
              contentPreview: previewText(response.content),
              failureReasons,
            });
          } catch (err: any) {
            caseResults.push({
              caseId,
              query: inputCase.query,
              expectedAnswer: inputCase.expectedAnswer ?? null,
              passed: false,
              confidence: 0,
              guardrailPassed: false,
              guardrailScore: 0,
              traceCount: 0,
              toolCallCount: 0,
              citationCount: 0,
              contentPreview: "",
              failureReasons: [
                err?.message ?? "The orchestrator request failed",
              ],
            });
          }
        }

        const passedCases = caseResults.filter(result => result.passed).length;
        const totalCases = caseResults.length;
        const passRate = clampPercent(
          (passedCases / Math.max(totalCases, 1)) * 100
        );
        const averageConfidence = clampPercent(
          caseResults.reduce((sum, result) => sum + result.confidence, 0) /
            Math.max(totalCases, 1)
        );
        const averageGuardrailScore = clampPercent(
          caseResults.reduce((sum, result) => sum + result.guardrailScore, 0) /
            Math.max(totalCases, 1)
        );
        const averageTraceSteps = Math.round(
          caseResults.reduce((sum, result) => sum + result.traceCount, 0) /
            Math.max(totalCases, 1)
        );
        const overallPassed = totalCases > 0 && passRate >= 80;
        const completedAt = new Date();

        await db
          .update(knowledgeAgentEvalRuns)
          .set({
            status: "completed",
            totalCases,
            passedCases,
            passRate,
            averageConfidence,
            averageGuardrailScore,
            averageTraceSteps,
            passed: overallPassed ? 1 : 0,
            results: JSON.stringify({ cases: caseResults }),
            completedAt,
          })
          .where(eq(knowledgeAgentEvalRuns.id, runId));

        return {
          id: runId,
          orgId,
          valueStreamId: resolvedStreamId,
          suiteName,
          status: "completed",
          totalCases,
          passedCases,
          passRate,
          averageConfidence,
          averageGuardrailScore,
          averageTraceSteps,
          passed: overallPassed,
          createdBy,
          createdAt: now.toISOString(),
          completedAt: completedAt.toISOString(),
          cases: caseResults,
        };
      } catch (err) {
        await db
          .update(knowledgeAgentEvalRuns)
          .set({
            status: "failed",
            completedAt: new Date(),
          })
          .where(eq(knowledgeAgentEvalRuns.id, runId));
        throw err;
      }
    }),

  /** List recent agent E2E evaluations for a value stream. */
  listAgentE2EEvals: managerProcedure
    .input(
      z
        .object({
          valueStreamId: z.string().max(64).optional(),
          limit: z.number().int().min(1).max(50).optional(),
        })
        .optional()
    )
    .query(async ({ input, ctx }): Promise<AgentEvalRunSummary[]> => {
      await requireKnowledgeFeatureFlag(
        ctx,
        "release.knowledge.validate.evalSuite",
        "The evaluation suite is disabled for this deployment"
      );

      const db = await getDb();
      if (!db) return [];
      const resolvedStreamId = resolveKnowledgeStreamId(
        ctx,
        input?.valueStreamId,
        "Select a value stream before listing agent evaluations"
      );
      const orgId = ctx.user.orgId ?? "default";

      const rows = await db
        .select()
        .from(knowledgeAgentEvalRuns)
        .where(
          and(
            eq(knowledgeAgentEvalRuns.orgId, orgId),
            eq(knowledgeAgentEvalRuns.valueStreamId, resolvedStreamId)
          )
        )
        .orderBy(desc(knowledgeAgentEvalRuns.createdAt))
        .limit(input?.limit ?? 10)
        .catch(() => [] as KnowledgeAgentEvalRunRow[]);

      return rows.map(serializeAgentEvalRun);
    }),

  /** Compute the current launch-readiness gate for a value stream. */
  launchReadiness: knowledgeReadProcedure
    .input(
      z
        .object({
          valueStreamId: z.string().max(64).optional(),
        })
        .optional()
    )
    .query(async ({ input, ctx }): Promise<LaunchReadiness> => {
      const resolvedStreamId = resolveKnowledgeStreamId(
        ctx,
        input?.valueStreamId,
        "Select a value stream before checking launch readiness"
      );
      const state = await buildLaunchReadinessState(ctx, resolvedStreamId);
      return state.readiness;
    }),

  /** Create a release candidate snapshot for the current stream state. */
  createRelease: managerProcedure
    .input(
      z.object({
        valueStreamId: z.string().max(64).optional(),
        label: z.string().max(128).optional(),
        notes: z.string().max(2000).optional(),
        basedOnEvalRunId: z.string().max(64).optional(),
      })
    )
    .mutation(async ({ input, ctx }): Promise<KnowledgeReleaseSummary> => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database unavailable",
        });
      }

      const resolvedStreamId = resolveKnowledgeStreamId(
        ctx,
        input.valueStreamId,
        "Select a value stream before creating a release"
      );
      const orgId = ctx.user.orgId ?? "default";
      const createdBy = ctx.user.id;
      const launchState = await buildLaunchReadinessState(
        ctx,
        resolvedStreamId
      );

      let basedOnEvalRunId =
        input.basedOnEvalRunId ??
        launchState.latestPassingEval?.id ??
        launchState.latestCompletedEval?.id ??
        null;

      if (basedOnEvalRunId) {
        const [evalRun] = await db
          .select()
          .from(knowledgeAgentEvalRuns)
          .where(
            and(
              eq(knowledgeAgentEvalRuns.id, basedOnEvalRunId),
              eq(knowledgeAgentEvalRuns.orgId, orgId),
              eq(knowledgeAgentEvalRuns.valueStreamId, resolvedStreamId)
            )
          )
          .limit(1);
        if (!evalRun) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Agent evaluation run not found for this stream",
          });
        }
        basedOnEvalRunId = evalRun.id;
      }

      const id = nanoid(21);
      const createdAt = new Date();
      const label =
        input.label?.trim() ||
        `Release ${resolvedStreamId} ${createdAt.toISOString().slice(0, 16)}`;

      await db.insert(knowledgeReleases).values({
        id,
        valueStreamId: resolvedStreamId,
        orgId,
        createdBy,
        label,
        notes: input.notes?.trim() || null,
        status: "candidate",
        basedOnEvalRunId,
        snapshot: JSON.stringify(launchState.snapshot),
        createdAt,
        updatedAt: createdAt,
        promotedAt: null,
        rolledBackAt: null,
      });

      return {
        id,
        orgId,
        valueStreamId: resolvedStreamId,
        label,
        notes: input.notes?.trim() || null,
        status: "candidate",
        createdBy,
        basedOnEvalRunId,
        snapshot: launchState.snapshot,
        createdAt: createdAt.toISOString(),
        updatedAt: createdAt.toISOString(),
        promotedAt: null,
        rolledBackAt: null,
      };
    }),

  /** List release candidates and promoted releases for a value stream. */
  listReleases: knowledgeReadProcedure
    .input(
      z
        .object({
          valueStreamId: z.string().max(64).optional(),
          limit: z.number().int().min(1).max(50).optional(),
        })
        .optional()
    )
    .query(async ({ input, ctx }): Promise<KnowledgeReleaseSummary[]> => {
      const db = await getDb();
      if (!db) return [];
      const resolvedStreamId = resolveKnowledgeStreamId(
        ctx,
        input?.valueStreamId,
        "Select a value stream before listing releases"
      );
      const orgId = ctx.user.orgId ?? "default";

      const rows = await db
        .select()
        .from(knowledgeReleases)
        .where(
          and(
            eq(knowledgeReleases.orgId, orgId),
            eq(knowledgeReleases.valueStreamId, resolvedStreamId)
          )
        )
        .orderBy(desc(knowledgeReleases.createdAt))
        .limit(input?.limit ?? 10)
        .catch(() => [] as KnowledgeReleaseRow[]);

      return rows.map(serializeKnowledgeRelease);
    }),

  /** Promote a release candidate only when launch readiness checks are passing. */
  promoteRelease: managerProcedure
    .input(z.object({ releaseId: z.string().max(64) }))
    .mutation(
      async ({
        input,
        ctx,
      }): Promise<{
        release: KnowledgeReleaseSummary;
        readiness: LaunchReadiness;
      }> => {
        const db = await getDb();
        if (!db) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Database unavailable",
          });
        }

        const orgId = ctx.user.orgId ?? "default";
        const [releaseRow] = await db
          .select()
          .from(knowledgeReleases)
          .where(
            and(
              eq(knowledgeReleases.id, input.releaseId),
              eq(knowledgeReleases.orgId, orgId)
            )
          )
          .limit(1);

        if (!releaseRow) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Release not found",
          });
        }

        const authorizedStreamId = resolveKnowledgeStreamId(
          ctx,
          releaseRow.valueStreamId,
          "Release is not linked to an explicit value stream"
        );

        const launchState = await buildLaunchReadinessState(
          ctx,
          authorizedStreamId
        );
        if (!launchState.readiness.ready) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: launchState.readiness.summary,
          });
        }

        const promotedRows = await db
          .select({ id: knowledgeReleases.id })
          .from(knowledgeReleases)
          .where(
            and(
              eq(knowledgeReleases.orgId, orgId),
              eq(knowledgeReleases.valueStreamId, authorizedStreamId),
              eq(knowledgeReleases.status, "promoted")
            )
          );

        const supersededIds = promotedRows
          .map(row => row.id)
          .filter(id => id !== releaseRow.id);
        if (supersededIds.length > 0) {
          await db
            .update(knowledgeReleases)
            .set({ status: "superseded" })
            .where(inArray(knowledgeReleases.id, supersededIds));
        }

        const promotedAt = new Date();
        await db
          .update(knowledgeReleases)
          .set({
            status: "promoted",
            promotedAt,
            rolledBackAt: null,
            snapshot: JSON.stringify(launchState.snapshot),
          })
          .where(eq(knowledgeReleases.id, releaseRow.id));

        return {
          release: {
            ...serializeKnowledgeRelease(releaseRow),
            status: "promoted",
            snapshot: launchState.snapshot,
            promotedAt: promotedAt.toISOString(),
            rolledBackAt: null,
          },
          readiness: launchState.readiness,
        };
      }
    ),

  /** Roll back to a previous release without re-running launch gates. */
  rollbackRelease: managerProcedure
    .input(z.object({ releaseId: z.string().max(64) }))
    .mutation(async ({ input, ctx }): Promise<KnowledgeReleaseSummary> => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database unavailable",
        });
      }

      const orgId = ctx.user.orgId ?? "default";
      const [targetRelease] = await db
        .select()
        .from(knowledgeReleases)
        .where(
          and(
            eq(knowledgeReleases.id, input.releaseId),
            eq(knowledgeReleases.orgId, orgId)
          )
        )
        .limit(1);

      if (!targetRelease) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Release not found",
        });
      }

      const authorizedStreamId = resolveKnowledgeStreamId(
        ctx,
        targetRelease.valueStreamId,
        "Release is not linked to an explicit value stream"
      );

      if (targetRelease.status === "candidate") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Only previously promoted releases can be restored through rollback",
        });
      }

      const promotedRows = await db
        .select({ id: knowledgeReleases.id })
        .from(knowledgeReleases)
        .where(
          and(
            eq(knowledgeReleases.orgId, orgId),
            eq(knowledgeReleases.valueStreamId, authorizedStreamId),
            eq(knowledgeReleases.status, "promoted")
          )
        );

      const rollbackAt = new Date();
      const currentPromotedIds = promotedRows
        .map(row => row.id)
        .filter(id => id !== targetRelease.id);
      if (currentPromotedIds.length > 0) {
        await db
          .update(knowledgeReleases)
          .set({
            status: "rolled_back",
            rolledBackAt: rollbackAt,
          })
          .where(inArray(knowledgeReleases.id, currentPromotedIds));
      }

      await db
        .update(knowledgeReleases)
        .set({
          status: "promoted",
          promotedAt: rollbackAt,
          rolledBackAt: null,
        })
        .where(eq(knowledgeReleases.id, targetRelease.id));

      return {
        ...serializeKnowledgeRelease(targetRelease),
        status: "promoted",
        promotedAt: rollbackAt.toISOString(),
        rolledBackAt: null,
      };
    }),

  // ═══════════════════════════════════════════════════════════════════════════
  // Review Workflow — knowledge-pipeline-service
  // ═══════════════════════════════════════════════════════════════════════════

  /** Submit a document for review. */
  reviewSubmit: knowledgeWriteProcedure
    .input(
      z.object({
        documentId: z.string(),
        streamId: z.string().optional(),
        title: z.string().min(1, "Title is required").max(256),
        department: z.string().max(128).optional(),
        tags: z.array(z.string().max(64)).max(20).optional(),
        sourceRef: z.string().optional(),
        submittedBy: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }): Promise<ReviewRecord> => {
      await requireKnowledgeFeatureFlag(
        ctx,
        "release.knowledge.govern.reviewQueue",
        "The review workflow is disabled for this deployment"
      );

      const resolvedStreamId = resolveKnowledgeRuntimeStreamId(
        ctx,
        input.streamId,
        "Select a value stream before submitting a document for review"
      );

      const requestCtx = scopedRequestContext(ctx, resolvedStreamId);
      let qualityReport: QualityReport | null = null;
      let trustScore: number | null = null;
      let reviewIntelligence: ReviewIntelligence | null = null;

      try {
        const [contentData, streamMeta] = await Promise.all([
          serviceJsonTyped<DocumentContentExport>(
            `${VECTOR_STORE_URL}/v1/documents/${input.documentId}/content`,
            requestCtx
          ),
          getStreamMeta(resolvedStreamId),
        ]);

        const content = contentData.content?.trim();
        if (content) {
          const reviewTitle =
            input.title.trim() || contentData.title || "Untitled";
          const valueStreamDescription =
            streamMeta.streamDescription ||
            streamMeta.streamName ||
            input.department ||
            "";

          const [qualityResult, analysisResult] = await Promise.allSettled([
            serviceJsonTyped<QualityReport>(
              `${KNOWLEDGE_PIPELINE_URL}/v1/quality/score`,
              requestCtx,
              {
                method: "POST",
                body: buildSnakeBody({
                  text: content,
                  title: reviewTitle,
                }),
              }
            ),
            serviceJsonTyped<PreIngestAnalysis>(
              `${KNOWLEDGE_PIPELINE_URL}/v1/pre-ingest/analyze`,
              requestCtx,
              {
                method: "POST",
                body: buildSnakeBody({
                  content,
                  title: reviewTitle,
                  valueStreamDescription,
                }),
              }
            ),
          ]);

          if (qualityResult.status === "fulfilled") {
            qualityReport = qualityResult.value;
            trustScore = qualityResult.value.overallScore;
          } else {
            log.warn(
              {
                err: qualityResult.reason,
                documentId: input.documentId,
                resolvedStreamId,
              },
              "reviewSubmit quality enrichment failed; continuing without quality snapshot"
            );
          }

          if (analysisResult.status === "fulfilled") {
            const analysis = analysisResult.value;
            reviewIntelligence = {
              duplicates: analysis.decide.duplicates ?? [],
              contradictions: analysis.decide.contradictions ?? [],
              summary: buildReviewIntelligenceSummary(analysis),
              recommendation: analysis.decide.recommendation,
              reasoning: analysis.decide.reasoning,
              generatedAt: new Date().toISOString(),
            };
            if (trustScore == null) {
              trustScore = Math.round(analysis.overallConfidence * 100);
            }
          } else {
            log.warn(
              {
                err: analysisResult.reason,
                documentId: input.documentId,
                resolvedStreamId,
              },
              "reviewSubmit intelligence enrichment failed; continuing without duplicate or contradiction signals"
            );
          }
        }
      } catch (err) {
        log.warn(
          { err, documentId: input.documentId, resolvedStreamId },
          "reviewSubmit could not fetch document content for enrichment; continuing with manual submission"
        );
      }

      return serviceJsonTyped<ReviewRecord>(
        `${KNOWLEDGE_PIPELINE_URL}/v1/review/submit`,
        requestCtx,
        {
          method: "POST",
          body: buildSnakeBody({
            ...input,
            streamId: resolvedStreamId,
            qualityReport,
            trustScore,
            reviewIntelligence,
          }),
        }
      );
    }),

  /** Apply a review decision (approve / reject / request revision). */
  reviewDecide: managerProcedure
    .input(
      z.object({
        recordId: z.string(),
        valueStreamId: z.string().optional(),
        reviewer: z.string().optional(),
        decision: z.enum(["approve", "reject", "request_revision"]),
        comment: z.string().max(1000).optional(),
      })
    )
    .mutation(async ({ input, ctx }): Promise<ReviewRecord> => {
      await requireKnowledgeFeatureFlag(
        ctx,
        "release.knowledge.govern.reviewQueue",
        "The review workflow is disabled for this deployment"
      );

      const reviewer =
        input.reviewer ||
        (ctx.user as { email?: string; name?: string } | null)?.email ||
        (ctx.user as { email?: string; name?: string } | null)?.name ||
        "unknown";
      const { valueStreamId, ...decisionInput } = input;
      const resolvedStreamId = resolveKnowledgeRuntimeStreamId(
        ctx,
        valueStreamId,
        "Select a value stream before applying a review decision"
      );
      return serviceJsonTyped<ReviewRecord>(
        `${KNOWLEDGE_PIPELINE_URL}/v1/review/decide`,
        scopedRequestContext(ctx, resolvedStreamId),
        {
          method: "POST",
          body: buildSnakeBody({ ...decisionInput, reviewer }),
        }
      );
    }),

  /** Publish an approved document. */
  reviewPublish: managerProcedure
    .input(
      z.object({
        recordId: z.string(),
        valueStreamId: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }): Promise<ReviewRecord> => {
      await requireKnowledgeFeatureFlag(
        ctx,
        "release.knowledge.govern.reviewQueue",
        "The review workflow is disabled for this deployment"
      );

      const resolvedStreamId = resolveKnowledgeRuntimeStreamId(
        ctx,
        input.valueStreamId,
        "Select a value stream before publishing reviewed content"
      );

      return serviceJsonTyped<ReviewRecord>(
        `${KNOWLEDGE_PIPELINE_URL}/v1/review/${input.recordId}/publish`,
        scopedRequestContext(ctx, resolvedStreamId),
        {
          method: "POST",
        }
      );
    }),

  /** Resubmit a rejected document. */
  reviewResubmit: managerProcedure
    .input(
      z.object({
        recordId: z.string(),
        valueStreamId: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }): Promise<ReviewRecord> => {
      await requireKnowledgeFeatureFlag(
        ctx,
        "release.knowledge.govern.reviewQueue",
        "The review workflow is disabled for this deployment"
      );

      const resolvedStreamId = resolveKnowledgeRuntimeStreamId(
        ctx,
        input.valueStreamId,
        "Select a value stream before resubmitting reviewed content"
      );

      return serviceJsonTyped<ReviewRecord>(
        `${KNOWLEDGE_PIPELINE_URL}/v1/review/${input.recordId}/resubmit`,
        scopedRequestContext(ctx, resolvedStreamId),
        {
          method: "POST",
        }
      );
    }),

  /** Archive a published document (retire it from agent responses). */
  reviewArchive: managerProcedure
    .input(
      z.object({
        recordId: z.string(),
        valueStreamId: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }): Promise<ReviewRecord> => {
      await requireKnowledgeFeatureFlag(
        ctx,
        "release.knowledge.govern.reviewQueue",
        "The review workflow is disabled for this deployment"
      );

      const resolvedStreamId = resolveKnowledgeRuntimeStreamId(
        ctx,
        input.valueStreamId,
        "Select a value stream before archiving reviewed content"
      );

      return serviceJsonTyped<ReviewRecord>(
        `${KNOWLEDGE_PIPELINE_URL}/v1/review/${input.recordId}/archive`,
        scopedRequestContext(ctx, resolvedStreamId),
        {
          method: "POST",
        }
      );
    }),

  /** List pending reviews. */
  reviewListPending: knowledgeReadProcedure
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(100).optional(),
          valueStreamId: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ input, ctx }): Promise<ReviewRecord[]> => {
      const limit = input?.limit ?? 50;
      const resolvedStreamId = resolveKnowledgeRuntimeStreamId(
        ctx,
        input?.valueStreamId,
        "Select a value stream before opening the review queue"
      );
      try {
        return await serviceJsonTyped<ReviewRecord[]>(
          `${KNOWLEDGE_PIPELINE_URL}/v1/review/pending?limit=${limit}`,
          scopedRequestContext(ctx, resolvedStreamId)
        );
      } catch (err) {
        log.warn(
          { err, limit },
          "reviewListPending unavailable — returning empty queue"
        );
        return [];
      }
    }),

  /** List review history across statuses (org-scoped). */
  reviewListAll: knowledgeReadProcedure
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(200).optional(),
          valueStreamId: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ input, ctx }): Promise<ReviewRecord[]> => {
      const limit = input?.limit ?? 100;
      const resolvedStreamId = resolveKnowledgeRuntimeStreamId(
        ctx,
        input?.valueStreamId,
        "Select a value stream before viewing review history"
      );
      const streamParam = `&value_stream_id=${encodeURIComponent(resolvedStreamId)}`;
      return serviceJsonTyped<ReviewRecord[]>(
        `${KNOWLEDGE_PIPELINE_URL}/v1/review/history?limit=${limit}${streamParam}`,
        scopedRequestContext(ctx, resolvedStreamId)
      );
    }),

  /** Assign ownership of the next review step to a specific person. */
  reviewAssign: managerProcedure
    .input(
      z.object({
        recordId: z.string(),
        valueStreamId: z.string().optional(),
        assignee: z.string().min(1).max(128),
        note: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ input, ctx }): Promise<ReviewRecord> => {
      await requireKnowledgeFeatureFlag(
        ctx,
        "release.knowledge.govern.reviewQueue",
        "The review workflow is disabled for this deployment"
      );

      const { valueStreamId, ...assignInput } = input;
      const resolvedStreamId = resolveKnowledgeRuntimeStreamId(
        ctx,
        valueStreamId,
        "Select a value stream before assigning a review"
      );

      return serviceJsonTyped<ReviewRecord>(
        `${KNOWLEDGE_PIPELINE_URL}/v1/review/${input.recordId}/assign`,
        scopedRequestContext(ctx, resolvedStreamId),
        {
          method: "POST",
          body: buildSnakeBody({
            recordId: assignInput.recordId,
            assignee: assignInput.assignee,
            note: assignInput.note,
          }),
        }
      );
    }),

  /** Self-assign ownership of the next review step (claim). */
  reviewClaim: managerProcedure
    .input(
      z.object({
        recordId: z.string(),
        valueStreamId: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }): Promise<ReviewRecord> => {
      await requireKnowledgeFeatureFlag(
        ctx,
        "release.knowledge.govern.reviewQueue",
        "The review workflow is disabled for this deployment"
      );

      const resolvedStreamId = resolveKnowledgeRuntimeStreamId(
        ctx,
        input.valueStreamId,
        "Select a value stream before claiming a review"
      );

      return serviceJsonTyped<ReviewRecord>(
        `${KNOWLEDGE_PIPELINE_URL}/v1/review/${input.recordId}/claim`,
        scopedRequestContext(ctx, resolvedStreamId),
        { method: "POST" }
      );
    }),

  /** Record a follow-up reminder for the assigned reviewer. */
  reviewRemind: managerProcedure
    .input(
      z.object({
        recordId: z.string(),
        valueStreamId: z.string().optional(),
        message: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ input, ctx }): Promise<ReviewRecord> => {
      await requireKnowledgeFeatureFlag(
        ctx,
        "release.knowledge.govern.reviewQueue",
        "The review workflow is disabled for this deployment"
      );

      const { valueStreamId, ...remindInput } = input;
      const resolvedStreamId = resolveKnowledgeRuntimeStreamId(
        ctx,
        valueStreamId,
        "Select a value stream before reminding a reviewer"
      );

      const record = await serviceJsonTyped<ReviewRecord>(
        `${KNOWLEDGE_PIPELINE_URL}/v1/review/${input.recordId}/remind`,
        scopedRequestContext(ctx, resolvedStreamId),
        {
          method: "POST",
          body: buildSnakeBody({
            recordId: remindInput.recordId,
            message: remindInput.message ?? "",
          }),
        }
      );

      void sendReviewReminderGoogleChat({
        documentTitle: record.title,
        remindedBy:
          (ctx.user as { name?: string | null; email?: string | null } | null)
            ?.name ||
          (ctx.user as { name?: string | null; email?: string | null } | null)
            ?.email ||
          "Knowledge curator",
        assigneeLabel: record.assignedTo || undefined,
        message: input.message?.trim() || undefined,
        sourceRef: record.sourceRef || undefined,
        streamId: record.streamId,
        streamLabel: record.streamId || undefined,
      })
        .then(sent => {
          if (!sent) {
            log.info(
              { recordId: record.id, streamId: record.streamId || null },
              "reviewRemind Google Chat not delivered"
            );
          }
        })
        .catch(err => {
          log.error(
            { err, recordId: record.id, streamId: record.streamId || null },
            "reviewRemind Google Chat failed"
          );
        });

      const assigneeEmail = await resolveReviewAssigneeEmail(record);
      if (!assigneeEmail) {
        log.info(
          { recordId: record.id, assignedTo: record.assignedTo },
          "reviewRemind delivery skipped — assignee email unavailable"
        );
        return record;
      }

      void sendReviewReminderEmail({
        to: assigneeEmail,
        documentTitle: record.title,
        remindedBy:
          (ctx.user as { name?: string | null; email?: string | null } | null)
            ?.name ||
          (ctx.user as { name?: string | null; email?: string | null } | null)
            ?.email ||
          "Knowledge curator",
        assigneeLabel: record.assignedTo,
        message: input.message?.trim() || undefined,
        sourceRef: record.sourceRef || undefined,
      })
        .then(sent => {
          if (!sent) {
            log.warn(
              { recordId: record.id, assigneeEmail },
              "reviewRemind email not delivered"
            );
          }
        })
        .catch(err => {
          log.error(
            { err, recordId: record.id, assigneeEmail },
            "reviewRemind email failed"
          );
        });

      return record;
    }),

  /** Get a review record by ID. */
  reviewGet: managerProcedure
    .input(
      z.object({
        recordId: z.string(),
        valueStreamId: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }): Promise<ReviewRecord> => {
      await requireKnowledgeFeatureFlag(
        ctx,
        "release.knowledge.govern.reviewQueue",
        "The review workflow is disabled for this deployment"
      );

      const resolvedStreamId = resolveKnowledgeRuntimeStreamId(
        ctx,
        input.valueStreamId,
        "Select a value stream before opening a review record"
      );

      return serviceJsonTyped<ReviewRecord>(
        `${KNOWLEDGE_PIPELINE_URL}/v1/review/${input.recordId}`,
        scopedRequestContext(ctx, resolvedStreamId)
      );
    }),

  // ═══════════════════════════════════════════════════════════════════════════
  // Quality Gates — automated validation
  // ═══════════════════════════════════════════════════════════════════════════

  /** Run all quality gates on document text (completeness, PII, readability, etc.). */
  qualityScore: managerProcedure
    .input(
      z.object({
        text: z.string().min(1, "Text is required"),
        title: z.string().max(256).optional(),
      })
    )
    .mutation(async ({ input, ctx }): Promise<QualityReport> => {
      await requireKnowledgeFeatureFlag(
        ctx,
        "release.knowledge.validate.quality",
        "Quality validation is disabled for this deployment"
      );

      return serviceJsonTyped<QualityReport>(
        `${KNOWLEDGE_PIPELINE_URL}/v1/quality/score`,
        ctx,
        {
          method: "POST",
          body: buildSnakeBody({ text: input.text, title: input.title || "" }),
        }
      );
    }),

  /** Scan text for personally identifiable information. */
  piiScan: managerProcedure
    .input(z.object({ text: z.string().min(1, "Text is required") }))
    .mutation(async ({ input, ctx }): Promise<PIIScanInfo> => {
      await requireKnowledgeFeatureFlag(
        ctx,
        "release.knowledge.validate.quality",
        "Quality validation is disabled for this deployment"
      );

      return serviceJsonTyped<PIIScanInfo>(
        `${KNOWLEDGE_PIPELINE_URL}/v1/quality/pii-scan`,
        ctx,
        {
          method: "POST",
          body: buildSnakeBody({ text: input.text }),
        }
      );
    }),

  /** Redact PII from text, replacing matches with safe placeholder tokens. */
  piiRedact: knowledgeWriteProcedure
    .input(
      z.object({
        text: z.string().min(1, "Text is required"),
        categories: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ input, ctx }): Promise<PIIRedactResult> => {
      await requireKnowledgeFeatureFlag(
        ctx,
        "release.knowledge.validate.quality",
        "Quality validation is disabled for this deployment"
      );

      return serviceJsonTyped<PIIRedactResult>(
        `${KNOWLEDGE_PIPELINE_URL}/v1/quality/pii-redact`,
        ctx,
        {
          method: "POST",
          body: buildSnakeBody({
            text: input.text,
            ...(input.categories ? { categories: input.categories } : {}),
          }),
        }
      );
    }),

  // ═══════════════════════════════════════════════════════════════════════════
  // Versioning — document history + diff compare
  // ═══════════════════════════════════════════════════════════════════════════

  /** Get version history for a source reference (URL, filename, etc.). */
  versionHistory: knowledgeReadProcedure
    .input(
      z.object({
        sourceRef: z.string().min(1),
        limit: z.number().int().optional(),
      })
    )
    .query(async ({ input, ctx }): Promise<VersionHistoryResponse> => {
      const encodedRef = encodeURIComponent(input.sourceRef);
      const limit = input.limit ?? 50;
      return serviceJsonTyped<VersionHistoryResponse>(
        `${KNOWLEDGE_PIPELINE_URL}/v1/versions/${encodedRef}?limit=${limit}`,
        ctx
      );
    }),

  /** Compute a line-by-line diff between two text versions. */
  computeDiff: knowledgeReadProcedure
    .input(z.object({ oldText: z.string(), newText: z.string() }))
    .mutation(async ({ input, ctx }): Promise<DiffResponse> => {
      return serviceJsonTyped<DiffResponse>(
        `${KNOWLEDGE_PIPELINE_URL}/v1/versions/diff`,
        ctx,
        {
          method: "POST",
          body: buildSnakeBody({
            oldText: input.oldText,
            newText: input.newText,
          }),
        }
      );
    }),

  // ═══════════════════════════════════════════════════════════════════════════
  // Knowledge Graph — entity search + context (Neo4j)
  // ═══════════════════════════════════════════════════════════════════════════

  /** Search entities in the knowledge graph. */
  entitySearch: managerProcedure
    .input(
      z.object({
        query: z.string().min(1),
        entityType: z.string().optional(),
        limit: z.number().int().min(1).max(100).optional(),
        valueStreamId: z.string().max(64).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireKnowledgeFeatureFlag(
        ctx,
        "release.knowledge.library.graph",
        "Knowledge graph is disabled for this deployment"
      );

      const resolvedStreamId = resolveKnowledgeStreamId(
        ctx,
        input.valueStreamId,
        "Select a value stream before searching the knowledge graph"
      );
      return serviceJsonTyped<{ entities: any[] }>(
        `${VECTOR_STORE_URL}/v1/graph/entities/search`,
        scopedRequestContext(ctx, resolvedStreamId),
        {
          method: "POST",
          body: buildSnakeBody({
            query: input.query,
            entityType: input.entityType,
            limit: input.limit ?? 20,
          }),
        }
      );
    }),

  /** Get entity context — neighbors, documents, relationships. */
  entityContext: managerProcedure
    .input(
      z.object({
        entityName: z.string().min(1),
        entityType: z.string().optional(),
        limit: z.number().int().min(1).max(100).optional(),
        valueStreamId: z.string().max(64).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireKnowledgeFeatureFlag(
        ctx,
        "release.knowledge.library.graph",
        "Knowledge graph is disabled for this deployment"
      );

      const resolvedStreamId = resolveKnowledgeStreamId(
        ctx,
        input.valueStreamId,
        "Select a value stream before opening graph context"
      );
      const raw = await serviceJsonTyped<{
        entity: string;
        org_id: string;
        paths: Array<{
          nodes: Array<Record<string, unknown>>;
          relationships: Array<Record<string, unknown>>;
          weight: number;
        }>;
        total_paths: number;
      }>(
        `${VECTOR_STORE_URL}/v1/graph/entities/context`,
        scopedRequestContext(ctx, resolvedStreamId),
        {
          method: "POST",
          body: buildSnakeBody({
            entityName: input.entityName,
            entityType: input.entityType,
            limit: input.limit ?? 50,
          }),
        }
      );

      // Flatten multi-hop paths into unique neighbor nodes + edges
      const seen = new Set<string>();
      const neighbors: Array<{
        name: string;
        entityType: string;
        properties: Record<string, unknown>;
        relationship: string;
      }> = [];
      const relationships: Array<{
        source: string;
        target: string;
        type: string;
      }> = [];

      for (const path of raw.paths ?? []) {
        for (const node of path.nodes ?? []) {
          const name = (node.name as string) || "";
          if (name && name !== input.entityName && !seen.has(name)) {
            seen.add(name);
            neighbors.push({
              name,
              entityType:
                (node.entity_type as string) ||
                (node.type as string) ||
                "concept",
              properties: (node.properties as Record<string, unknown>) ?? {},
              relationship: "related",
            });
          }
        }
        for (const rel of path.relationships ?? []) {
          const src = (rel.source as string) || (rel.start as string) || "";
          const tgt = (rel.target as string) || (rel.end as string) || "";
          const type = (rel.type as string) || "related_to";
          if (src && tgt) {
            relationships.push({ source: src, target: tgt, type });
            // Update the neighbor's relationship label if it matches
            const nb = neighbors.find(n => n.name === src || n.name === tgt);
            if (nb) nb.relationship = type.replace(/_/g, " ");
          }
        }
      }

      return {
        entity: { name: raw.entity ?? input.entityName },
        neighbors,
        relationships,
      };
    }),

  // ═══════════════════════════════════════════════════════════════════════════
  // Generated Answer — Gemini grounded answer from chunks
  // ═══════════════════════════════════════════════════════════════════════════

  /** Generate a grounded answer from retrieved chunks via Gemini. */
  generateAnswer: knowledgeReadProcedure
    .input(
      z.object({
        valueStreamId: z.string().max(64).optional(),
        query: z.string().min(1),
        chunks: z.array(
          z.object({
            content: z.string(),
            score: z.number().optional(),
            scoreScale: z.enum(["normalized", "raw_rank"]).optional(),
            metadata: z.record(z.string(), z.unknown()).optional(),
          })
        ),
      })
    )
    .mutation(async ({ input, ctx }): Promise<GeneratedAnswer> => {
      await requireKnowledgeFeatureFlag(
        ctx,
        "release.knowledge.validate.testSandbox",
        "The test sandbox is disabled for this deployment"
      );
      const resolvedStreamId = resolveKnowledgeRuntimeStreamId(
        ctx,
        input.valueStreamId,
        "Select a value stream before generating an answer"
      );
      const requestCtx = scopedRequestContext(ctx, resolvedStreamId);

      return serviceJsonTyped<GeneratedAnswer>(
        `${KNOWLEDGE_PIPELINE_URL}/v1/generate/answer`,
        requestCtx,
        {
          method: "POST",
          body: buildSnakeBody({
            query: input.query,
            chunks: input.chunks.map(c => ({
              content: c.content,
              score: c.score ?? 0,
              scoreScale: c.scoreScale,
              metadata: c.metadata ?? {},
            })),
          }),
        }
      );
    }),

  /**
   * Generate an evaluation suite from stream documents and the latest gap snapshot.
   * Used when a value stream does not provide curated eval prompts.
   */
  generateEvalSuite: managerProcedure
    .input(
      z
        .object({
          valueStreamId: z.string().max(64).optional(),
          limit: z.number().int().min(3).max(20).optional(),
        })
        .optional()
    )
    .mutation(async ({ input, ctx }) => {
      await requireKnowledgeFeatureFlag(
        ctx,
        "release.knowledge.validate.evalSuite",
        "The evaluation suite is disabled for this deployment"
      );

      const limit = input?.limit ?? 8;
      const resolvedStreamId = resolveKnowledgeStreamId(
        ctx,
        input?.valueStreamId,
        "Select a value stream before generating an evaluation suite"
      );
      const requestCtx = scopedRequestContext(ctx, resolvedStreamId);
      const streamMeta =
        resolvedStreamId && resolvedStreamId !== "global"
          ? await getStreamMeta(resolvedStreamId)
          : {
              departments: [],
              knowledgeConfig: null,
              streamName: "General HKI context",
              streamDescription: null,
              sampleQuestions: [],
            };

      const docsResponse = await serviceJsonTyped<DocumentListResponse>(
        `${VECTOR_STORE_URL}/v1/documents?limit=${Math.min(limit * 3, 24)}&offset=0`,
        requestCtx
      );

      const searchableDocuments = (docsResponse.documents ?? [])
        .filter(doc => {
          const status = String(doc.status ?? "").toLowerCase();
          return status === "indexed" || status === "published";
        })
        .filter(doc => documentBelongsToSelectedStream(doc, resolvedStreamId))
        .slice(0, Math.min(limit, 6));

      let latestGapSnapshot: {
        id: string;
        summary: string;
        gaps: string;
      } | null = null;
      const db = await getDb();
      if (db && resolvedStreamId && resolvedStreamId !== "global") {
        const snapshots = await db
          .select({
            id: knowledgeGapSnapshots.id,
            summary: knowledgeGapSnapshots.summary,
            gaps: knowledgeGapSnapshots.gaps,
          })
          .from(knowledgeGapSnapshots)
          .where(eq(knowledgeGapSnapshots.valueStreamId, resolvedStreamId))
          .orderBy(desc(knowledgeGapSnapshots.createdAt))
          .limit(1)
          .catch(
            () => [] as Array<{ id: string; summary: string; gaps: string }>
          );

        latestGapSnapshot = snapshots[0] ?? null;
      }

      const gapTopics = safeJsonParse<
        Array<{ topic?: string | null; suggestion?: string | null }>
      >(latestGapSnapshot?.gaps, [])
        .map(gap => ({
          topic: gap.topic?.trim() ?? null,
          suggestion: gap.suggestion?.trim() ?? null,
        }))
        .filter(gap => !!gap.topic)
        .slice(0, 4);

      const documentContext = await Promise.all(
        searchableDocuments.slice(0, 4).map(async doc => {
          let excerpt = "";
          try {
            const contentData = await serviceJsonTyped<DocumentContentExport>(
              `${VECTOR_STORE_URL}/v1/documents/${doc.id}/content`,
              requestCtx
            );
            excerpt = previewText(contentData.content, 900);
          } catch {
            // Non-fatal — continue with metadata only.
          }

          return {
            id: doc.id,
            title: doc.title || "Untitled",
            department: doc.department || "",
            documentType:
              doc.documentType || (doc as { type?: string }).type || "general",
            excerpt,
          };
        })
      );

      let generatedCases: EvalSuiteCaseDraft[] = [];
      if (documentContext.length > 0 || gapTopics.length > 0) {
        const streamLabel =
          streamMeta.streamName?.trim() || resolvedStreamId || "this stream";
        const prompt = [
          `Generate exactly ${limit} evaluation cases for the ${streamLabel} knowledge base.`,
          'Return ONLY a valid JSON array. Each item must be an object with "query" and "expectedAnswer" keys.',
          "Use realistic business questions that test policy recall, procedures, exceptions, approvals, and rollout readiness.",
          "Ground each question in the excerpt content. Ignore system-generated article IDs, URLs, query-string fragments, and document titles that do not describe the business topic.",
          "Do not ask meta questions about what a document provides or when teams should use a KB article.",
          "Questions should sound like what an employee would naturally ask while doing the work.",
          "If the provided material does not support a grounded expected answer, use an empty string for expectedAnswer.",
          streamMeta.streamDescription
            ? `Value stream context: ${streamMeta.streamDescription}`
            : null,
          latestGapSnapshot?.summary
            ? `Latest gap analysis summary: ${latestGapSnapshot.summary}`
            : null,
          gapTopics.length > 0
            ? `Coverage gaps to probe: ${gapTopics
                .map(gap => gap.topic)
                .filter(Boolean)
                .join("; ")}`
            : null,
        ]
          .filter(Boolean)
          .join("\n");

        try {
          const generation = await serviceJsonTyped<GeneratedAnswer>(
            `${KNOWLEDGE_PIPELINE_URL}/v1/generate/answer`,
            requestCtx,
            {
              method: "POST",
              body: buildSnakeBody({
                query: prompt,
                chunks: documentContext.map(doc => ({
                  content: [
                    `Document: ${doc.title}`,
                    doc.department ? `Department: ${doc.department}` : null,
                    doc.documentType ? `Type: ${doc.documentType}` : null,
                    doc.excerpt ? `Excerpt: ${doc.excerpt}` : null,
                  ]
                    .filter(Boolean)
                    .join("\n"),
                  score: 1.0,
                  metadata: {
                    title: doc.title,
                    department: doc.department,
                    documentId: doc.id,
                    streamId: resolvedStreamId,
                  },
                })),
              }),
            }
          );
          generatedCases = parseGeneratedEvalSuiteCases(
            generation.answer,
            limit
          );
        } catch {
          generatedCases = [];
        }
      }

      const fallbackCases = buildFallbackEvalSuiteCases({
        documents: documentContext,
        gapTopics,
        streamName: streamMeta.streamName ?? resolvedStreamId,
        limit,
      });

      const cases =
        generatedCases.length > 0
          ? dedupeEvalSuiteCases([...generatedCases, ...fallbackCases], limit)
          : fallbackCases;

      return {
        source:
          generatedCases.length > 0
            ? ("generated" as const)
            : ("fallback" as const),
        summary:
          generatedCases.length > 0
            ? cases.length > generatedCases.length
              ? `Generated ${generatedCases.length} evaluation cases from ${documentContext.length} indexed documents${latestGapSnapshot ? " and the latest gap snapshot" : ""}, then filled the remainder with ${cases.length - generatedCases.length} content-grounded starter case${cases.length - generatedCases.length === 1 ? "" : "s"}.`
              : `Generated ${cases.length} evaluation cases from ${documentContext.length} indexed documents${latestGapSnapshot ? " and the latest gap snapshot" : ""}.`
            : `Created ${cases.length} starter cases from stream documents${gapTopics.length > 0 ? " and known gap topics" : ""}.`,
        basedOnSnapshotId: latestGapSnapshot?.id ?? null,
        basedOnDocumentCount: searchableDocuments.length,
        cases,
      };
    }),

  /** List maintained evaluation suites for the selected value stream. */
  listEvalSuites: managerProcedure
    .input(
      z
        .object({
          valueStreamId: z.string().max(64).optional(),
          limit: z.number().int().min(1).max(25).optional(),
        })
        .optional()
    )
    .query(async ({ input, ctx }): Promise<KnowledgeEvalSuiteSummary[]> => {
      await requireKnowledgeFeatureFlag(
        ctx,
        "release.knowledge.validate.evalSuite",
        "The evaluation suite is disabled for this deployment"
      );

      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database unavailable",
        });
      }

      const resolvedStreamId = resolveKnowledgeStreamId(
        ctx,
        input?.valueStreamId,
        "Select a value stream before viewing maintained eval suites"
      );
      const orgId = ctx.user.orgId ?? "default";
      const limit = input?.limit ?? 10;

      const rows = await db
        .select()
        .from(knowledgeEvalSuites)
        .where(
          and(
            eq(knowledgeEvalSuites.orgId, orgId),
            eq(knowledgeEvalSuites.valueStreamId, resolvedStreamId)
          )
        )
        .orderBy(desc(knowledgeEvalSuites.updatedAt))
        .limit(limit);

      return rows.map(serializeKnowledgeEvalSuite);
    }),

  /** Save or update a maintained evaluation suite for repeatable regressions. */
  saveEvalSuite: managerProcedure
    .input(
      z.object({
        id: z.string().max(64).optional(),
        valueStreamId: z.string().max(64).optional(),
        name: z.string().min(1).max(128),
        origin: evalSuiteOriginSchema,
        basedOnSnapshotId: z.string().max(64).nullable().optional(),
        cases: z
          .array(
            z.object({
              id: z.string().optional(),
              query: z.string(),
              expectedAnswer: z.string().optional(),
            })
          )
          .min(1)
          .max(50),
      })
    )
    .mutation(async ({ input, ctx }): Promise<KnowledgeEvalSuiteSummary> => {
      await requireKnowledgeFeatureFlag(
        ctx,
        "release.knowledge.validate.evalSuite",
        "The evaluation suite is disabled for this deployment"
      );

      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database unavailable",
        });
      }

      const resolvedStreamId = resolveKnowledgeStreamId(
        ctx,
        input.valueStreamId,
        "Select a value stream before saving an evaluation suite"
      );
      const orgId = ctx.user.orgId ?? "default";
      const suiteName = input.name.trim();
      const basedOnSnapshotId = input.basedOnSnapshotId?.trim() || null;
      const cases = normalizeKnowledgeEvalSuiteCases(input.cases);

      if (!suiteName) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Name this evaluation suite before saving it",
        });
      }
      if (cases.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Add at least one non-empty query before saving this suite",
        });
      }

      if (input.id?.trim()) {
        const existingRows = await db
          .select()
          .from(knowledgeEvalSuites)
          .where(
            and(
              eq(knowledgeEvalSuites.id, input.id.trim()),
              eq(knowledgeEvalSuites.orgId, orgId),
              eq(knowledgeEvalSuites.valueStreamId, resolvedStreamId)
            )
          )
          .limit(1);
        const existing = existingRows[0] ?? null;

        if (!existing) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Maintained eval suite not found for this value stream",
          });
        }

        await db
          .update(knowledgeEvalSuites)
          .set({
            name: suiteName,
            origin: input.origin,
            basedOnSnapshotId,
            cases: JSON.stringify(cases),
            updatedBy: ctx.user.id,
          })
          .where(eq(knowledgeEvalSuites.id, existing.id));

        const updatedRows = await db
          .select()
          .from(knowledgeEvalSuites)
          .where(eq(knowledgeEvalSuites.id, existing.id))
          .limit(1);
        const updated = updatedRows[0] ?? null;

        if (!updated) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Saved eval suite could not be reloaded",
          });
        }

        return serializeKnowledgeEvalSuite(updated);
      }

      const id = nanoid(21);
      await db.insert(knowledgeEvalSuites).values({
        id,
        valueStreamId: resolvedStreamId,
        orgId,
        name: suiteName,
        origin: input.origin,
        basedOnSnapshotId,
        cases: JSON.stringify(cases),
        createdBy: ctx.user.id,
        updatedBy: ctx.user.id,
      });

      const createdRows = await db
        .select()
        .from(knowledgeEvalSuites)
        .where(eq(knowledgeEvalSuites.id, id))
        .limit(1);
      const created = createdRows[0] ?? null;

      if (!created) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Saved eval suite could not be loaded",
        });
      }

      return serializeKnowledgeEvalSuite(created);
    }),

  /** Delete a maintained evaluation suite from the selected value stream. */
  deleteEvalSuite: managerProcedure
    .input(
      z.object({
        id: z.string().max(64),
        valueStreamId: z.string().max(64).optional(),
      })
    )
    .mutation(
      async ({ input, ctx }): Promise<{ deleted: true; id: string }> => {
        await requireKnowledgeFeatureFlag(
          ctx,
          "release.knowledge.validate.evalSuite",
          "The evaluation suite is disabled for this deployment"
        );

        const db = await getDb();
        if (!db) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Database unavailable",
          });
        }

        const resolvedStreamId = resolveKnowledgeStreamId(
          ctx,
          input.valueStreamId,
          "Select a value stream before deleting an evaluation suite"
        );
        const orgId = ctx.user.orgId ?? "default";

        const existingRows = await db
          .select()
          .from(knowledgeEvalSuites)
          .where(
            and(
              eq(knowledgeEvalSuites.id, input.id),
              eq(knowledgeEvalSuites.orgId, orgId),
              eq(knowledgeEvalSuites.valueStreamId, resolvedStreamId)
            )
          )
          .limit(1);
        const existing = existingRows[0] ?? null;

        if (!existing) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Maintained eval suite not found for this value stream",
          });
        }

        await db
          .delete(knowledgeEvalSuites)
          .where(eq(knowledgeEvalSuites.id, existing.id));

        return { deleted: true, id: existing.id };
      }
    ),

  /**
   * Suggest 5 natural test questions for a document.
   * Fetches content from the vector store then asks the LLM to generate
   * questions a user might realistically ask about that document.
   */
  suggestTestQuestions: knowledgeReadProcedure
    .input(
      z.object({
        documentId: z.string(),
        title: z.string().max(256).optional(),
        tags: z.array(z.string()).optional(),
        department: z.string().max(128).optional(),
        valueStreamId: z.string().max(64).optional(),
      })
    )
    .mutation(async ({ input, ctx }): Promise<{ questions: string[] }> => {
      await requireKnowledgeFeatureFlag(
        ctx,
        "release.knowledge.validate.testSandbox",
        "The test sandbox is disabled for this deployment"
      );

      const resolvedStreamId = resolveKnowledgeRuntimeStreamId(
        ctx,
        input.valueStreamId,
        "Select a value stream before generating test questions"
      );
      const requestCtx = scopedRequestContext(ctx, resolvedStreamId);

      // Fetch document content — fall back to title/tags if unavailable
      let content = "";
      try {
        const contentData = await serviceJsonTyped<DocumentContentExport>(
          `${VECTOR_STORE_URL}/v1/documents/${input.documentId}/content`,
          requestCtx
        );
        content = (contentData.content ?? "").slice(0, 3000);
      } catch {
        // Non-fatal — proceed with metadata only
      }

      const metaQuery =
        `Generate exactly 5 concise, specific questions that a user might naturally ask ` +
        `about the following document. Reply ONLY with a valid JSON array of 5 question strings, ` +
        `no markdown, no explanation. ` +
        `Ground every question in the business content, not the article title. ` +
        `Ignore article IDs, URLs, sys_kb_id fragments, and avoid meta questions like what the document provides or when teams should use it. ` +
        `Title: "${input.title ?? ""}". Department: "${input.department ?? ""}". ` +
        `Tags: ${(input.tags ?? []).join(", ")}.`;

      const fallbackQuestions = buildContextAwareQuestions({
        title: input.title,
        content,
        count: 5,
      });

      let questions: string[] = [];
      try {
        const result = await serviceJsonTyped<GeneratedAnswer>(
          `${KNOWLEDGE_PIPELINE_URL}/v1/generate/answer`,
          requestCtx,
          {
            method: "POST",
            body: buildSnakeBody({
              query: metaQuery,
              chunks: content
                ? [
                    {
                      content,
                      score: 1.0,
                      metadata: {
                        title: input.title ?? "",
                        department: input.department ?? "",
                      },
                    },
                  ]
                : [],
            }),
          }
        );

        // Parse JSON array from answer text
        const match = result.answer?.match(/\[[\s\S]*?\]/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          if (Array.isArray(parsed)) {
            questions = filterHighQualityQuestions(
              parsed.filter((q): q is string => typeof q === "string"),
              5
            );
          }
        }

        // Fallback: extract lines containing "?"
        if (questions.length === 0 && result.answer) {
          questions = filterHighQualityQuestions(
            result.answer
              .split(/\n/)
              .map(line => line.replace(/^\d+[\.\)]\s*/, "").trim()),
            5
          );
        }
      } catch {
        questions = [];
      }

      return {
        questions:
          questions.length > 0
            ? filterHighQualityQuestions(
                [...questions, ...fallbackQuestions],
                5
              )
            : fallbackQuestions,
      };
    }),

  // ═══════════════════════════════════════════════════════════════════════════
  // RAG Evaluation — RAGAS-style scoring
  // ═══════════════════════════════════════════════════════════════════════════

  /** Record chunk-level feedback (up/down) for answer quality tracking. */
  chunkFeedback: knowledgeReadProcedure
    .input(
      z.object({
        valueStreamId: z.string().max(64).optional(),
        signal: z.enum(["up", "down"]),
        query: z.string(),
        answer: z.string(),
        chunkIds: z.array(z.string()),
        documentIds: z.array(z.string()).optional(),
        confidence: z.number().optional(),
        evalScore: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireKnowledgeFeatureFlag(
        ctx,
        "release.knowledge.validate.testSandbox",
        "The test sandbox is disabled for this deployment"
      );
      const resolvedStreamId = resolveKnowledgeRuntimeStreamId(
        ctx,
        input.valueStreamId,
        "Select a value stream before recording feedback"
      );
      const requestCtx = scopedRequestContext(ctx, resolvedStreamId);

      return serviceJsonTyped<{ recorded: number; message: string }>(
        `${KNOWLEDGE_PIPELINE_URL}/v1/feedback/chunk`,
        requestCtx,
        {
          method: "POST",
          body: buildSnakeBody({
            signal: input.signal,
            query: input.query,
            answer: input.answer,
            chunkIds: input.chunkIds,
            documentIds: input.documentIds ?? [],
            confidence: input.confidence ?? 0,
            evalScore: input.evalScore ?? 0,
          }),
        }
      );
    }),

  // ═══════════════════════════════════════════════════════════════════════════
  // Observability — trace viewer + summary
  // ═══════════════════════════════════════════════════════════════════════════

  /** Get recent operation traces. */
  observabilityTraces: managerProcedure
    .input(
      z.object({
        limit: z.number().int().optional(),
        operation: z.string().optional(),
        valueStreamId: z.string().max(64).optional(),
      })
    )
    .query(
      async ({
        input,
        ctx,
      }): Promise<{ traces: TraceEvent[]; total: number }> => {
        const params = new URLSearchParams();
        if (input.limit) params.set("limit", String(input.limit));
        if (input.operation) params.set("operation", input.operation);
        const resolvedStreamId = resolveKnowledgeRuntimeStreamId(
          ctx,
          input.valueStreamId,
          "Select a value stream before viewing operation traces"
        );
        const qs = params.toString() ? `?${params.toString()}` : "";
        return serviceJsonTyped<{ traces: TraceEvent[]; total: number }>(
          `${KNOWLEDGE_PIPELINE_URL}/v1/observability/traces${qs}`,
          scopedRequestContext(ctx, resolvedStreamId)
        );
      }
    ),

  /** Get aggregated trace statistics. */
  observabilitySummary: knowledgeReadProcedure
    .input(
      z
        .object({
          valueStreamId: z.string().max(64).optional(),
        })
        .optional()
    )
    .query(async ({ input, ctx }): Promise<TraceSummary> => {
      const emptySummary: TraceSummary = {
        totalTraces: 0,
        errorCount: 0,
        avgDurationMs: 0,
        p95DurationMs: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        operations: {},
      };
      try {
        const resolvedStreamId = resolveKnowledgeRuntimeStreamId(
          ctx,
          input?.valueStreamId,
          "Select a value stream before viewing operation summary"
        );
        return await serviceJsonTyped<TraceSummary>(
          `${KNOWLEDGE_PIPELINE_URL}/v1/observability/summary`,
          scopedRequestContext(ctx, resolvedStreamId)
        );
      } catch (err) {
        log.warn(
          { err },
          "observabilitySummary unavailable — returning empty summary"
        );
        return emptySummary;
      }
    }),

  /** Evaluate a RAG response across faithfulness, relevance, context recall, completeness. */
  evaluateRag: managerProcedure
    .input(
      z.object({
        valueStreamId: z.string().max(64).optional(),
        query: z.string().min(1),
        answer: z.string().min(1),
        chunks: z.array(
          z.object({
            content: z.string(),
            score: z.number().optional(),
            metadata: z.record(z.string(), z.unknown()).optional(),
          })
        ),
        confidence: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }): Promise<RAGEvalResult> => {
      const resolvedStreamId = resolveKnowledgeRuntimeStreamId(
        ctx,
        input.valueStreamId,
        "Select a value stream before evaluating a RAG answer"
      );
      const requestCtx = scopedRequestContext(ctx, resolvedStreamId);

      return serviceJsonTyped<RAGEvalResult>(
        `${KNOWLEDGE_PIPELINE_URL}/v1/evaluate/rag`,
        requestCtx,
        {
          method: "POST",
          body: buildSnakeBody({
            query: input.query,
            answer: input.answer,
            chunks: input.chunks.map(c => ({
              content: c.content,
              score: c.score ?? 0,
              metadata: c.metadata ?? {},
            })),
            confidence: input.confidence ?? 0,
          }),
        }
      );
    }),

  // ═══════════════════════════════════════════════════════════════════════════
  // Playbook Attestation — Agent Success Playbook acceptance tracking
  // ═══════════════════════════════════════════════════════════════════════════

  /** Record that the current user has attested to the Agent Success Playbook for a value stream. */
  attestPlaybook: knowledgeReadProcedure
    .input(z.object({ valueStreamId: z.string().min(1).max(64) }))
    .mutation(
      async ({
        input,
        ctx,
      }): Promise<{ attested: boolean; attestedAt: string }> => {
        const db = await getDb();
        if (!db) throw new Error("Database unavailable");
        const valueStreamId = resolveKnowledgeRuntimeStreamId(
          ctx,
          input.valueStreamId,
          "Select a value stream before attesting the playbook"
        );

        const userId = (ctx.user as any).id as number;

        // Upsert: delete existing then insert fresh (MySQL-compatible)
        await db
          .delete(knowledgeAttestations)
          .where(
            and(
              eq(knowledgeAttestations.userId, userId),
              eq(knowledgeAttestations.valueStreamId, valueStreamId ?? "global")
            )
          );

        const now = new Date();
        await db.insert(knowledgeAttestations).values({
          userId,
          valueStreamId: valueStreamId ?? "global",
          attestedAt: now,
          userName: (ctx.user as any).name ?? null,
          userEmail: (ctx.user as any).email ?? null,
        });

        return { attested: true, attestedAt: now.toISOString() };
      }
    ),

  /** Get attestation status for the current user for a given value stream. */
  getAttestation: knowledgeReadProcedure
    .input(z.object({ valueStreamId: z.string().min(1).max(64) }))
    .query(
      async ({
        input,
        ctx,
      }): Promise<{
        attested: boolean;
        attestedAt: string | null;
        userName: string | null;
      }> => {
        const db = await getDb();
        if (!db) return { attested: false, attestedAt: null, userName: null };
        const valueStreamId = resolveKnowledgeRuntimeStreamId(
          ctx,
          input.valueStreamId,
          "Select a value stream before viewing playbook attestation"
        );

        const userId = (ctx.user as any).id as number;
        try {
          const rows = await db
            .select()
            .from(knowledgeAttestations)
            .where(
              and(
                eq(knowledgeAttestations.userId, userId),
                eq(
                  knowledgeAttestations.valueStreamId,
                  valueStreamId ?? "global"
                )
              )
            )
            .limit(1);

          if (rows.length === 0)
            return { attested: false, attestedAt: null, userName: null };
          return {
            attested: true,
            attestedAt: rows[0].attestedAt.toISOString(),
            userName: rows[0].userName ?? null,
          };
        } catch (err) {
          log.warn(
            { err, valueStreamId },
            "getAttestation failed — returning unattested state"
          );
          return { attested: false, attestedAt: null, userName: null };
        }
      }
    ),

  // ═══════════════════════════════════════════════════════════════════════════
  // Analytics — knowledge-layer metrics from analytics-service
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Knowledge-layer metrics aggregated from analytics-service event stream.
   *
   * Returns CMOS (Context Memory Optimization Score), retrieval quality,
   * and ingest health. Returns safe zero defaults when analytics-service
   * is unavailable — never throws, so the page still loads.
   */
  analyticsMetrics: knowledgeReadProcedure
    .input(
      z
        .object({
          valueStreamId: z.string().max(64).optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }): Promise<KbAnalyticsSummary> => {
      const empty: KbAnalyticsSummary = {
        cmos: 0,
        avgChunksPerSearch: 0,
        avgTopScore: 0,
        totalIngestJobs: 0,
        ingestSuccessRate: 0,
        avgIngestDurationMs: 0,
        p95IngestDurationMs: 0,
        totalChunksIndexed: 0,
        ragasSampleCount: 0,
        ragasCoverageRate: 0,
        avgFaithfulness: 0,
        avgAnswerRelevancy: 0,
        avgContextPrecision: 0,
        avgContextRecall: 0,
        avgAnswerCorrectness: 0,
        totalEvents: 0,
        uniqueUsers: 0,
        eventsByType: {},
        eventsByService: {},
        periodStart: null,
        periodEnd: null,
      };
      try {
        const resolvedStreamId =
          resolveAuthorizedStreamId(ctx, input?.valueStreamId, {
            allowGlobalSelection: true,
          }) ?? null;
        const raw = await serviceJsonTyped<{
          totalEvents?: number;
          uniqueUsers?: number;
          eventsByType?: Record<string, number>;
          eventsByService?: Record<string, number>;
          periodStart?: string;
          periodEnd?: string;
          knowledge?: {
            cmos: number;
            avgChunksPerSearch: number;
            avgTopScore: number;
            totalIngestJobs: number;
            ingestSuccessRate: number;
            avgIngestDurationMs: number;
            p95IngestDurationMs: number;
            totalChunksIndexed: number;
            ragasSampleCount: number;
            ragasCoverageRate: number;
            avgFaithfulness: number;
            avgAnswerRelevancy: number;
            avgContextPrecision: number;
            avgContextRecall: number;
            avgAnswerCorrectness: number;
          };
        }>(
          `${ANALYTICS_URL}/v1/events/summary`,
          scopedRequestContext(ctx, resolvedStreamId)
        );
        const k = raw.knowledge;
        return {
          cmos: k?.cmos ?? 0,
          avgChunksPerSearch: k?.avgChunksPerSearch ?? 0,
          avgTopScore: k?.avgTopScore ?? 0,
          totalIngestJobs: k?.totalIngestJobs ?? 0,
          ingestSuccessRate: k?.ingestSuccessRate ?? 0,
          avgIngestDurationMs: k?.avgIngestDurationMs ?? 0,
          p95IngestDurationMs: k?.p95IngestDurationMs ?? 0,
          totalChunksIndexed: k?.totalChunksIndexed ?? 0,
          ragasSampleCount: k?.ragasSampleCount ?? 0,
          ragasCoverageRate: k?.ragasCoverageRate ?? 0,
          avgFaithfulness: k?.avgFaithfulness ?? 0,
          avgAnswerRelevancy: k?.avgAnswerRelevancy ?? 0,
          avgContextPrecision: k?.avgContextPrecision ?? 0,
          avgContextRecall: k?.avgContextRecall ?? 0,
          avgAnswerCorrectness: k?.avgAnswerCorrectness ?? 0,
          totalEvents: raw.totalEvents ?? 0,
          uniqueUsers: raw.uniqueUsers ?? 0,
          eventsByType: raw.eventsByType ?? {},
          eventsByService: raw.eventsByService ?? {},
          periodStart: raw.periodStart ?? null,
          periodEnd: raw.periodEnd ?? null,
        };
      } catch {
        // Analytics service unavailable — degrade gracefully
        return empty;
      }
    }),

  /**
   * Return agent-detected knowledge gaps from the knowledge-api ring buffer.
   * Gaps are recorded when corrective RAG fails even after query rewriting.
   */
  getAgentGaps: managerProcedure
    .input(
      z.object({
        valueStreamId: z.string().max(64).optional(),
        limit: z.number().int().min(1).max(100).optional(),
      })
    )
    .query(
      async ({
        input,
        ctx,
      }): Promise<{
        gaps: Array<{
          query: string;
          gapDescription: string;
          scope: string;
          conversationId: string | null;
          detectedAt: string;
        }>;
        total: number;
      }> => {
        await requireKnowledgeFeatureFlag(
          ctx,
          "release.knowledge.validate.gaps",
          "Gap analysis is disabled for this deployment"
        );

        const resolvedStreamId = requireAuthorizedStreamId(
          ctx,
          input.valueStreamId,
          {
            missingSelectionMessage:
              "Select a value stream before reviewing agent-detected gaps",
          }
        );

        try {
          const qs = input.limit ? `?limit=${input.limit}` : "";
          const raw = await serviceJsonTyped<{
            gaps: Array<{
              query: string;
              gap_description: string;
              scope: string;
              conversation_id: string | null;
              detected_at: string;
            }>;
            total: number;
          }>(
            `${VECTOR_STORE_URL}/v1/gaps${qs}`,
            scopedRequestContext(ctx, resolvedStreamId)
          );

          return {
            gaps: raw.gaps.map(g => ({
              query: g.query,
              gapDescription: g.gap_description,
              scope: g.scope,
              conversationId: g.conversation_id ?? null,
              detectedAt: g.detected_at,
            })),
            total: raw.total,
          };
        } catch {
          return { gaps: [], total: 0 };
        }
      }
    ),

  /** List all attestations for a value stream (admin view — who has attested). */
  listAttestations: knowledgeReadProcedure
    .input(z.object({ valueStreamId: z.string().min(1).max(64) }))
    .query(
      async ({
        input,
        ctx,
      }): Promise<
        Array<{
          userId: number;
          userName: string | null;
          userEmail: string | null;
          attestedAt: string;
        }>
      > => {
        const db = await getDb();
        if (!db) return [];
        const valueStreamId = resolveKnowledgeRuntimeStreamId(
          ctx,
          input.valueStreamId,
          "Select a value stream before viewing attestation history"
        );

        try {
          const rows = await db
            .select()
            .from(knowledgeAttestations)
            .where(
              eq(knowledgeAttestations.valueStreamId, valueStreamId ?? "global")
            );

          return rows.map(r => ({
            userId: r.userId,
            userName: r.userName,
            userEmail: r.userEmail,
            attestedAt: r.attestedAt.toISOString(),
          }));
        } catch (err) {
          log.warn(
            { err, valueStreamId },
            "listAttestations failed — returning empty list"
          );
          return [];
        }
      }
    ),
});
