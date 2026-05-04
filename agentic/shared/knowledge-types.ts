/**
 * Knowledge Layer — Shared Type Contracts
 *
 * TypeScript interfaces mirroring the Python Pydantic models from
 * knowledge-api and knowledge-pipeline-service.
 *
 * ALL response shapes use camelCase (TS convention). The BFF
 * normalizes snake_case → camelCase at the boundary so components
 * never see Python naming.
 *
 * Source of truth:
 *   knowledge-api/src/domain/models.py
 *   knowledge-pipeline-service/src/domain/models.py
 *   knowledge-api/src/domain/evaluation.py
 *   knowledge-api/src/domain/taxonomy.py
 *   knowledge-api/src/domain/context_shaping.py
 *   knowledge-pipeline-service/src/domain/versioning.py
 *   knowledge-pipeline-service/src/domain/synthesis.py
 *   knowledge-pipeline-service/src/domain/review.py
 */

// ═══════════════════════════════════════════════════════════════════════════════
// Enums — single source of truth (replaces hardcoded arrays in types.ts)
// ═══════════════════════════════════════════════════════════════════════════════

export const JOB_STATUSES = [
  "queued",
  "extracting",
  "cleaning",
  "enriching",
  "chunking",
  "embedding",
  "indexing",
  "completed",
  "failed",
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const DOCUMENT_STATUSES = [
  "pending",
  "processing",
  "pending_review",
  "indexed",
  "published",
  "failed",
  "archived",
] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export const SEARCHABLE_DOCUMENT_STATUSES = ["indexed", "published"] as const;
export type SearchableDocumentStatus =
  (typeof SEARCHABLE_DOCUMENT_STATUSES)[number];

export function isSearchableDocumentStatus(
  status: string | null | undefined
): status is SearchableDocumentStatus {
  return status === "indexed" || status === "published";
}

export const DOCUMENT_TYPES = [
  "general",
  "policy",
  "sop",
  "product",
  "faq",
  "training",
  "report",
  "procedure",
  "memo",
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const SEARCH_MODES = ["hybrid", "vector", "keyword"] as const;
export type SearchMode = (typeof SEARCH_MODES)[number];
export const RETRIEVAL_SCORE_SCALES = ["normalized", "raw_rank"] as const;
export type RetrievalScoreScale = (typeof RETRIEVAL_SCORE_SCALES)[number];
export const DOCUMENT_CLASSIFICATIONS = [
  "internal",
  "confidential",
  "restricted",
  "privileged",
] as const;
export type DocumentClassification = (typeof DOCUMENT_CLASSIFICATIONS)[number];

export const SOURCE_TYPES = [
  "text",
  "url",
  "html",
  "markdown",
  "file",
] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

// ═══════════════════════════════════════════════════════════════════════════════
// Vector Store Service — Documents & Search
// ═══════════════════════════════════════════════════════════════════════════════

export interface DocumentAccessControl {
  allowedUsers: string[];
  allowedGroups: string[];
  deniedUsers: string[];
  deniedGroups: string[];
}

export interface DocumentMetadata {
  title: string;
  author: string;
  department: string;
  documentType: DocumentType;
  sourceUrl: string;
  tags: string[];
  language: string;
  version: string;
  classification: DocumentClassification;
  accessControl: DocumentAccessControl;
  streamId?: string | null;
  createdAt: string;
  updatedAt: string;
  custom: Record<string, unknown>;
}

export interface DocumentSummary {
  id: string;
  orgId: string;
  streamId?: string | null;
  title: string;
  department: string;
  documentType: string;
  classification?: DocumentClassification;
  status: DocumentStatus;
  chunkCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentDetail extends DocumentSummary {
  content: string;
  contentPreview?: string;
  metadata: DocumentMetadata;
}

export interface DocumentListResponse {
  documents: DocumentSummary[];
  total: number;
}

export interface DepartmentCount {
  label: string;
  value: number;
}

export interface DocumentFreshnessSummary {
  currentCount: number;
  reviewCount: number;
  staleCount: number;
  unknownCount: number;
}

export interface DocumentInventorySummary {
  totalDocuments: number;
  liveCount: number;
  pendingReviewCount: number;
  processingCount: number;
  archivedCount: number;
  failedCount: number;
  missingLabelsCount: number;
  topDepartments: DepartmentCount[];
  freshness: DocumentFreshnessSummary;
}

export interface StoreStats {
  totalDocuments: number;
  totalChunks: number;
  [key: string]: unknown;
}

export interface GraphStats {
  totalEntities?: number;
  entityCount?: number;
  message?: string;
  documents?: number;
  chunks?: number;
  relationships?: number;
  [key: string]: unknown;
}

// ── Search ───────────────────────────────────────────────────────────────────

export interface Citation {
  documentId: string;
  documentTitle: string;
  chunkId: string;
  contentPreview: string;
  relevanceScore: number;
  relevanceScoreScale?: RetrievalScoreScale;
  sourceUrl: string;
  pageOrSection: string;
  highlight: string;
}

export interface SearchResult {
  chunkId: string;
  documentId: string;
  content: string;
  // Overall result score.
  score: number;
  scoreScale?: RetrievalScoreScale;
  // Cosine similarity component when semantic ranking is active.
  vectorScore: number;
  vectorScoreScale?: RetrievalScoreScale;
  // BM25 / ts_rank_cd component.
  keywordScore: number;
  keywordScoreScale?: RetrievalScoreScale;
  citation: Citation | null;
  metadata: Record<string, unknown>;
}

export interface SearchResponse {
  query: string;
  mode: SearchMode;
  results: SearchResult[];
  totalResults: number;
  citations: Citation[];
  searchTimeMs: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Knowledge Pipeline Service — Jobs & Ingestion
// ═══════════════════════════════════════════════════════════════════════════════

export interface IngestionJob {
  id: string;
  orgId: string;
  streamId?: string | null;
  status: JobStatus;
  sourceType: SourceType;
  sourceRef: string;
  title: string;
  department: string;
  documentType: string;
  tags: string[];
  classification?: DocumentClassification;
  accessControl?: DocumentAccessControl;
  documentId: string | null;
  chunkCount: number;
  entityCount: number;
  error: string | null;
  failedAtStage: string | null;
  rawSizeBytes: number;
  cleanSizeBytes: number;
  processingTimeMs: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface JobListResponse {
  jobs: IngestionJob[];
  total: number;
}

export interface JobStatusResponse {
  job: IngestionJob;
  stagesCompleted: string[];
}

export interface IngestResponse {
  jobId: string;
  status: JobStatus;
  title: string;
  documentId: string | null;
  chunkCount: number;
  message: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Taxonomy Management (knowledge-api)
// ═══════════════════════════════════════════════════════════════════════════════

export interface TaxonomyNode {
  id: string;
  orgId: string;
  label: string;
  slug: string;
  parentId: string | null;
  description: string;
  aliases: string[];
  sortOrder: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface TaxonomyTreeInfo {
  totalNodes: number;
  rootCount: number;
  maxDepth: number;
  orgId: string;
}

export interface TagValidationResult {
  allValid: boolean;
  valid: string[];
  invalid: string[];
  suggestions: Record<string, string[]>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Evaluation Pipeline (knowledge-api)
// ═══════════════════════════════════════════════════════════════════════════════

export const METRIC_NAMES = [
  "context_relevance",
  "context_precision",
  "context_recall",
  "answer_similarity",
  "faithfulness",
  "answer_correctness",
  "chunk_utilization",
] as const;
export type MetricName = (typeof METRIC_NAMES)[number];

export interface MetricResult {
  name: MetricName;
  score: number;
  details: Record<string, unknown>;
  latencyMs?: number;
}

export interface CaseResult {
  caseId: string;
  query: string;
  metrics: MetricResult[];
}

export interface MetricSummary {
  mean: number;
  stddev: number;
  ciLower: number;
  ciUpper: number;
  median: number;
  p5: number;
  p95: number;
  min: number;
  max: number;
  n: number;
  avgLatencyMs: number;
}

export interface EvaluationReport {
  suiteName: string;
  totalCases: number;
  caseResults: CaseResult[];
  summary: Record<string, number>;
  statistics?: Record<string, MetricSummary>;
  evalTimeMs: number;
  // Cost tracking
  embeddingCalls?: number;
  llmJudgeCalls?: number;
  estimatedCostUsd?: number;
}

export interface EvaluationCase {
  id: string;
  query: string;
  expectedAnswer: string;
  retrievedContexts: string[];
  generatedAnswer: string;
}

export const AGENT_EVAL_RUN_STATUSES = [
  "running",
  "completed",
  "failed",
] as const;
export type AgentEvalRunStatus = (typeof AGENT_EVAL_RUN_STATUSES)[number];

export interface AgentEvalCaseResult {
  caseId: string;
  query: string;
  expectedAnswer: string | null;
  passed: boolean;
  confidence: number;
  guardrailPassed: boolean;
  guardrailScore: number;
  traceCount: number;
  toolCallCount: number;
  citationCount: number;
  contentPreview: string;
  failureReasons: string[];
}

export interface AgentEvalRunSummary {
  id: string;
  orgId: string;
  valueStreamId: string;
  suiteName: string;
  status: AgentEvalRunStatus;
  totalCases: number;
  passedCases: number;
  passRate: number;
  averageConfidence: number;
  averageGuardrailScore: number;
  averageTraceSteps: number;
  passed: boolean;
  createdBy: number;
  createdAt: string;
  completedAt: string | null;
  cases: AgentEvalCaseResult[];
}

export const KNOWLEDGE_RELEASE_STATUSES = [
  "candidate",
  "promoted",
  "superseded",
  "rolled_back",
] as const;
export type KnowledgeReleaseStatus =
  (typeof KNOWLEDGE_RELEASE_STATUSES)[number];

export interface KnowledgeReleaseSnapshot {
  liveDocumentCount: number;
  pendingReviewCount: number;
  attestationCount: number;
  connectorIssueCount: number;
  serviceIssueCount: number;
  latestEvalPassRate: number | null;
}

export interface KnowledgeReleaseSummary {
  id: string;
  orgId: string;
  valueStreamId: string;
  label: string;
  notes: string | null;
  status: KnowledgeReleaseStatus;
  createdBy: number;
  basedOnEvalRunId: string | null;
  snapshot: KnowledgeReleaseSnapshot | null;
  createdAt: string;
  updatedAt: string;
  promotedAt: string | null;
  rolledBackAt: string | null;
}

export interface LaunchReadinessCheck {
  key:
    | "live_content"
    | "attestation"
    | "review_queue"
    | "source_health"
    | "service_health"
    | "agent_eval";
  label: string;
  passed: boolean;
  detail: string;
}

export interface LaunchReadiness {
  ready: boolean;
  score: number;
  summary: string;
  checks: LaunchReadinessCheck[];
  latestEvalPassRate: number | null;
  latestEvalCompletedAt: string | null;
  latestPassingEvalId: string | null;
  latestPromotedReleaseId: string | null;
  latestReleaseLabel: string | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Review Workflow (knowledge-pipeline-service)
// ═══════════════════════════════════════════════════════════════════════════════

export const REVIEW_STATUSES = [
  "draft",
  "pending_review",
  "approved",
  "rejected",
  "revision_requested",
  "published",
] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const REVIEW_DECISIONS = [
  "approve",
  "reject",
  "request_revision",
] as const;
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];

export interface ReviewComment {
  id: string;
  author: string;
  text: string;
  createdAt: string;
}

export interface ReviewRecord {
  id: string;
  orgId: string;
  documentId: string;
  streamId?: string | null;
  title: string;
  department: string;
  tags: string[];
  sourceRef: string;
  status: ReviewStatus;
  submittedBy: string;
  submittedAt: string | null;
  reviewedBy: string;
  reviewedAt: string | null;
  assignedTo: string;
  assignedBy: string;
  assignedAt: string | null;
  lastRemindedAt: string | null;
  publishedAt: string | null;
  archivedAt: string | null;
  autoApproved: boolean;
  autoApproveRule: string;
  qualityReport?: QualityReport | null;
  trustScore?: number | null;
  reviewIntelligence?: ReviewIntelligence | null;
  comments: ReviewComment[];
  createdAt: string;
  updatedAt: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Versioning / Incremental Ingestion (knowledge-pipeline-service)
// ═══════════════════════════════════════════════════════════════════════════════

export const CHANGE_TYPES = ["new", "modified", "unchanged"] as const;
export type ChangeType = (typeof CHANGE_TYPES)[number];

export interface ContentFingerprint {
  sha256: string;
  contentLength: number;
  wordCount: number;
}

export interface DocumentVersion {
  id: string;
  orgId: string;
  sourceRef: string;
  version: number;
  fingerprint: ContentFingerprint;
  documentId: string;
  changeType: ChangeType;
  diffSummary: string;
  createdAt: string;
}

export interface ChangeDetectionResult {
  sourceRef: string;
  changeType: ChangeType;
  shouldReingest: boolean;
  currentFingerprint: ContentFingerprint;
  previousVersion: DocumentVersion | null;
  nextVersionNumber: number;
  diffSummary: string;
}

export interface VersionHistoryResponse {
  sourceRef: string;
  versions: DocumentVersion[];
  total: number;
}

export interface DiffLine {
  type: "added" | "removed" | "unchanged";
  content: string;
  lineNumber: number | null;
}

export interface DiffResponse {
  lines: DiffLine[];
  stats: {
    addedCount: number;
    removedCount: number;
    unchangedCount: number;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Quality Gates — automated validation before human review
// ═══════════════════════════════════════════════════════════════════════════════

export interface QualityDimension {
  score: number;
  details: string;
}

export interface ReadabilityInfo {
  fleschKincaidGrade: number;
  fleschReadingEase: number;
  gradeLabel: string;
  wordCount: number;
  sentenceCount: number;
}

export interface PIIScanInfo {
  piiDetected: boolean;
  categoriesFound: string[];
  matchCount: number;
  summary: string;
}

export interface PIIRedactResult {
  redactedText: string;
  originalLength: number;
  redactedLength: number;
  redactionsApplied: number;
  categoriesRedacted: string[];
}

export interface QualityReport {
  overallScore: number;
  completeness: QualityDimension;
  specificity: QualityDimension;
  accuracySignals: QualityDimension;
  actionability: QualityDimension;
  readability: ReadabilityInfo;
  piiScan: PIIScanInfo;
  autoApproveEligible: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Generated Answer Preview — LLM-grounded answer with citations
// ═══════════════════════════════════════════════════════════════════════════════

export interface CitationInfo {
  index: number;
  title: string;
  score: number;
  scoreScale?: RetrievalScoreScale;
  documentId: string;
}

export interface GeneratedAnswer {
  answer: string;
  confidence: number;
  citations: CitationInfo[];
  error?: string;
}

export interface ShadowRetrievalSnapshot {
  search: SearchResponse;
  answer: GeneratedAnswer | null;
  includesSelectedDocument: boolean;
}

export interface ShadowRetrievalComparison {
  baseline: ShadowRetrievalSnapshot;
  shadow: ShadowRetrievalSnapshot;
  selectedDocumentId: string | null;
  summary: string;
}

export const KNOWLEDGE_EVAL_SUITE_ORIGINS = [
  "curated",
  "generated",
  "fallback",
  "manual",
] as const;
export type KnowledgeEvalSuiteOrigin =
  (typeof KNOWLEDGE_EVAL_SUITE_ORIGINS)[number];

export interface KnowledgeEvalSuiteCase {
  id: string;
  query: string;
  expectedAnswer: string;
}

export interface KnowledgeEvalSuiteSummary {
  id: string;
  orgId: string;
  valueStreamId: string;
  name: string;
  origin: KnowledgeEvalSuiteOrigin;
  basedOnSnapshotId: string | null;
  caseCount: number;
  cases: KnowledgeEvalSuiteCase[];
  createdBy: number;
  updatedBy: number | null;
  createdAt: string;
  updatedAt: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// RAG Evaluation Suite — RAGAS-style scoring
// ═══════════════════════════════════════════════════════════════════════════════

export interface RAGEvalDimension {
  name: string;
  score: number;
  rationale: string;
}

export interface RAGEvalResult {
  faithfulness: RAGEvalDimension;
  relevance: RAGEvalDimension;
  contextRecall: RAGEvalDimension;
  completeness: RAGEvalDimension;
  overallScore: number;
  grade: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Observability — LLM traces, latency, token usage
// ═══════════════════════════════════════════════════════════════════════════════

export interface TraceEvent {
  id: string;
  operation: string;
  status: string;
  durationMs: number;
  timestamp: string;
  metadata: Record<string, unknown>;
  error: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
}

export interface TraceSummary {
  totalTraces: number;
  errorCount: number;
  avgDurationMs: number;
  p95DurationMs: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  operations: Record<string, number>;
}

// ── Pre-Ingestion Analysis ──────────────────────────────────────────────────

export interface PIIJudgeResult {
  judge: string; // "regex" | "gemini"
  piiDetected: boolean;
  categories: string[];
  details: string[];
  confidence: number; // 0.0–1.0
}

export interface PreIngestValidate {
  qualityScore: number;
  completeness: number;
  specificity: number;
  accuracySignals: number;
  actionability: number;
  wordCount: number;
  sentenceCount: number;
  readabilityGrade: string;
  readingEase: number;
  piiDetected: boolean;
  piiCategories: string[];
  contactInfoDetected?: boolean;
  contactInfoCategories?: string[];
  issues: string[];
  passed: boolean;
  piiJudges?: PIIJudgeResult[];
}

export interface ExtractedDocumentMetadata {
  sourceId: string;
  sourceSystem: string;
  sourceUrl: string;
  articleId: string;
  detectedTitle: string;
  environment: string;
  systemName: string;
  author: string;
  publishDate: string;
  version: string;
  sectionsFound: string[];
}

export interface PreIngestInterpret {
  detectedType: string;
  department: string;
  tags: string[];
  entities: string[];
  summary: string;
  language: string;
  confidence: number;
  passed: boolean;
  extractedMetadata?: ExtractedDocumentMetadata;
}

export interface DuplicateMatch {
  documentId: string;
  title: string;
  similarity: number;
  chunkPreview: string;
  matchType?: "exact" | "similar";
}

export interface ContradictionMatch {
  documentId: string;
  title: string;
  candidateClaim: string;
  conflictingClaim: string;
  chunkPreview: string;
  confidence: number;
  rationale?: string;
}

export interface ReviewIntelligence {
  duplicates: DuplicateMatch[];
  contradictions: ContradictionMatch[];
  summary: string;
  recommendation?: "ingest" | "review" | "reject";
  reasoning?: string;
  generatedAt?: string;
}

export interface PreIngestDecide {
  recommendation: "ingest" | "review" | "reject";
  relevanceScore: number;
  reasoning: string;
  valueStreamMatch: boolean;
  passed: boolean;
  duplicates: DuplicateMatch[];
  contradictions: ContradictionMatch[];
}

export interface PreIngestAnalysis {
  validate: PreIngestValidate;
  interpret: PreIngestInterpret;
  decide: PreIngestDecide;
  overallPass: boolean;
  overallConfidence: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Document Lifecycle — reprocess, refresh, export, metadata updates
// ═══════════════════════════════════════════════════════════════════════════════

export interface DocumentContentExport {
  documentId: string;
  title: string;
  content: string;
  contentLength: number;
  wordCount: number;
  metadata: Record<string, unknown>;
  status: string;
  chunkCount: number;
}

export interface ReprocessResult {
  jobId: string;
  documentId: string;
  status: string;
  message: string;
}

export interface RefreshResult {
  jobId: string | null;
  documentId: string;
  status: string;
  message: string;
  contentChanged: boolean;
}

export interface MetadataUpdateResult {
  documentId: string;
  updatedFields: string[];
  metadata: Record<string, unknown>;
}

// ── Analytics — knowledge layer metrics from analytics-service ──────────────

/**
 * Knowledge-layer metrics returned by GET /v1/events/summary → knowledge block.
 *
 * cmos              Context Memory Optimization Score — avg tokens_in_context
 *                   per search. Lower is better. Improves with better chunking,
 *                   retrieval tuning, and well-structured documents.
 *
 * avgTopScore       Avg relevance score of the top retrieved chunk (0–1).
 *                   Higher is better. Reflects overall KB quality.
 *
 * ingestSuccessRate Fraction of ingestion jobs that completed (0–1).
 *                   Should be ≥ 0.95 in a healthy system.
 */
export interface KbAnalyticsSummary {
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
  totalEvents: number;
  uniqueUsers: number;
  eventsByType: Record<string, number>;
  eventsByService: Record<string, number>;
  periodStart: string | null;
  periodEnd: string | null;
}
