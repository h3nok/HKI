/**
 * useIngestPipeline — Encapsulates all ingestion state, mutations, and handlers.
 *
 * Returns everything the UI modules need to render and interact with the pipeline.
 *
 * Bulk-file analysis: every file is individually analyzed with a concurrency-
 * limited queue.  Only files that pass (or that the user manually approves) are
 * forwarded to the upload phase.  Up to 150 files are supported in a single
 * batch.
 */

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { toast } from "sonner";
import { fireConfetti, useNotifications } from "@hki/ui";
import { trpc } from "@/lib/trpc";
import type {
  DocumentAccessControl,
  DocumentClassification,
  IngestionJob,
  IngestResponse,
  PreIngestAnalysis,
  PIIRedactResult,
} from "@shared/knowledge-types";
import {
  type IngestMode,
  humanizeError,
  isSensitiveDocumentClassification,
} from "../../types";
import type { StageStatus, IngestFormState } from "./types";
import type { SelectedFile, FileAnalysisStatus } from "../upload/FileDropZone";

interface UseIngestPipelineOptions {
  onStepComplete?: (stepId: string) => void;
  streamId?: string;
}

// ── Concurrency tuning ──────────────────────────────────────────────────────
/** Max files analyzed in parallel (each calls the pre-ingest API). */
const ANALYSIS_CONCURRENCY = 5;
/** Max files uploaded in parallel (each sends base64 to the BFF). */
const UPLOAD_CONCURRENCY = 5;
/** Absolute max files allowed per batch. */
const MAX_BATCH_SIZE = 150;

// ── Critical PII categories that require hard block (must redact) ───────────
const CRITICAL_PII_CATEGORIES = new Set([
  "SSN",
  "Credit Card",
  "Medical Record",
]);

/** Aggregate summary of per-file analysis across the batch. */
export interface BatchAnalysisSummary {
  total: number;
  analyzed: number;
  passed: number;
  flagged: number;
  rejected: number;
  errors: number;
  pending: number;
  avgQuality: number;
  avgConfidence: number;
  avgRelevance: number;
  piiFileCount: number;
  duplicateFileCount: number;
}

export type FlowStep = "add" | "analyze" | "review" | "ingest" | "track";

type TrackedJobStatus = IngestResponse["status"] | "manual_check";

type TrackedIngestResult = {
  jobId?: string;
  status?: TrackedJobStatus;
  title: string;
  chunkCount: number;
  documentId?: string;
  message?: string;
  suggestionSeed?: string;
  classification?: DocumentClassification;
  accessControl?: DocumentAccessControl;
};

// ── sessionStorage persistence ──────────────────────────────────────────────
const SS_KEY_PREFIX = "ingest-pipeline-state";
const EMPTY_FORM: IngestFormState = {
  content: "",
  url: "",
  title: "",
  department: "",
  documentType: "general",
  tags: "",
  classification: "internal",
  allowedGroups: "",
  deniedGroups: "",
};
const IDLE_STAGES: StageStatus[] = ["idle", "idle", "idle", "idle"];

function parseCsvTokenList(value: string): string[] {
  return value
    .split(",")
    .map(token => token.trim())
    .filter(Boolean);
}

export function buildAccessControl(
  form: IngestFormState,
  currentUserId?: string
): DocumentAccessControl | undefined {
  const allowedGroups = parseCsvTokenList(form.allowedGroups);
  const deniedGroups = parseCsvTokenList(form.deniedGroups);
  const preserveCreatorAccess =
    !!currentUserId &&
    (isSensitiveDocumentClassification(form.classification) ||
      allowedGroups.length > 0 ||
      deniedGroups.length > 0);
  const allowedUsers = preserveCreatorAccess ? [currentUserId] : [];

  if (!allowedUsers.length && !allowedGroups.length && !deniedGroups.length) {
    return undefined;
  }
  return {
    allowedUsers,
    allowedGroups,
    deniedUsers: [],
    deniedGroups,
  };
}

interface PersistedState {
  mode: IngestMode;
  form: IngestFormState;
  stages: StageStatus[];
  analysis: PreIngestAnalysis | null;
  lastIngestResult: TrackedIngestResult | null;
}

function getPersistedStateKey(streamId?: string): string {
  return `${SS_KEY_PREFIX}:${streamId || "unselected"}`;
}

function loadPersistedState(storageKey: string): Partial<PersistedState> {
  try {
    const raw = sessionStorage.getItem(storageKey);
    if (!raw) return {};
    return JSON.parse(raw) as Partial<PersistedState>;
  } catch {
    return {};
  }
}

function savePersistedState(storageKey: string, s: PersistedState) {
  try {
    sessionStorage.setItem(storageKey, JSON.stringify(s));
  } catch {
    /* quota exceeded — non-critical */
  }
}

export function useIngestPipeline({
  onStepComplete,
  streamId,
}: UseIngestPipelineOptions = {}) {
  const persistedStateKey = getPersistedStateKey(streamId);
  const [hydrated] = useState(() => loadPersistedState(persistedStateKey));
  const [mode, setMode] = useState<IngestMode>(hydrated.mode ?? "file");
  const [form, setForm] = useState<IngestFormState>(
    hydrated.form ? { ...EMPTY_FORM, ...hydrated.form } : EMPTY_FORM
  );
  const [files, setFiles] = useState<SelectedFile[]>([]);
  const [stages, setStages] = useState<StageStatus[]>(
    hydrated.stages ?? IDLE_STAGES
  );
  const [analysis, setAnalysis] = useState<PreIngestAnalysis | null>(
    hydrated.analysis ?? null
  );
  const [lastIngestResult, setLastIngestResult] =
    useState<TrackedIngestResult | null>(hydrated.lastIngestResult ?? null);

  // Sync serializable state to sessionStorage on change
  useEffect(() => {
    savePersistedState(persistedStateKey, {
      mode,
      form,
      stages,
      analysis,
      lastIngestResult,
    });
  }, [persistedStateKey, mode, form, stages, analysis, lastIngestResult]);

  // Guard: clear stale file-mode analysis after a true page refresh / HMR.
  // files[] cannot be persisted (contains File objects + base64), so if
  // the component was *unmounted and remounted from scratch* with zero files
  // but a hydrated analysis we'd be stuck in the Review phase with nothing
  // to ingest.  Only runs on first mount (hydrated is set once).
  useEffect(() => {
    if (hydrated.analysis && mode === "file" && files.length === 0) {
      setAnalysis(null);
      setStages(IDLE_STAGES);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // mount-only

  // Warn before browser tab close / refresh when work is in progress
  const hasUnsavedWork =
    files.length > 0 || analysis !== null || lastIngestResult !== null;
  useEffect(() => {
    if (!hasUnsavedWork) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsavedWork]);

  const utils = trpc.useUtils();
  const { notify } = useNotifications();
  const meQ = trpc.auth.me.useQuery(undefined, {
    retry: false,
    staleTime: 60_000,
  });
  const currentUserId = meQ.data?.id ? String(meQ.data.id) : undefined;

  // ── Gamification ──
  const contributeMut = trpc.gamification.recordContribution.useMutation({
    onSuccess: result => {
      if (result.newBadges?.length) {
        fireConfetti();
        for (const badge of result.newBadges) {
          toast.success(`${badge.icon} Badge Unlocked: ${badge.name}`, {
            description: badge.flavorText,
            duration: 5000,
          });
        }
      }
      utils.gamification.getProfile.invalidate();
    },
  });

  const pendingUploadsRef = useRef(0);
  const pendingTitleRef = useRef("");
  const activeFileIdsRef = useRef<string[] | null>(null);
  const uploadingFileIdsRef = useRef<string[]>([]);
  const successfulFileIdsRef = useRef<string[]>([]);
  const [isMultiFileUploading, setIsMultiFileUploading] = useState(false);

  // ── Reset ──
  const resetPipeline = useCallback(() => {
    setAnalysis(null);
    setStages(["idle", "idle", "idle", "idle"]);
    activeFileIdsRef.current = null;
    uploadingFileIdsRef.current = [];
    successfulFileIdsRef.current = [];
    pendingUploadsRef.current = 0;
    pendingTitleRef.current = "";
    setIsMultiFileUploading(false);
    batchAnalysisAbortRef.current = true;
    setIsBatchAnalyzing(false);
    // Clear per-file analysis state
    setFiles(prev =>
      prev.map(f => ({
        ...f,
        analysisStatus: undefined,
        analysis: undefined,
        analysisNote: undefined,
      }))
    );
  }, []);

  // ── Phase 1: Pre-Analyze (text + file) ──
  const onAnalysisSuccess = useCallback((data: PreIngestAnalysis) => {
    setAnalysis(data);
    const v: StageStatus = data.validate.passed ? "done" : "rejected";
    const i: StageStatus = data.interpret.passed ? "done" : "rejected";
    const d: StageStatus = data.decide.passed ? "done" : "rejected";
    setStages([v, i, d, "idle"]);

    // Auto-apply AI-suggested tags if the user hasn't entered any yet
    if (data.interpret.tags?.length) {
      setForm(prev => {
        const existing = prev.tags.trim();
        if (existing) return prev; // user already entered tags — don't overwrite
        return { ...prev, tags: data.interpret.tags.join(", ") };
      });
    }
    // Auto-apply detected department & type if blank
    if (data.interpret.department) {
      setForm(prev =>
        prev.department
          ? prev
          : { ...prev, department: data.interpret.department }
      );
    }
    if (data.interpret.detectedType) {
      const VALID_DOC_TYPES = new Set([
        "policy",
        "sop",
        "product",
        "faq",
        "training",
        "report",
        "general",
      ]);
      const raw = data.interpret.detectedType.toLowerCase();
      const mapped = VALID_DOC_TYPES.has(raw) ? raw : "general";
      setForm(prev =>
        prev.documentType !== "general"
          ? prev
          : { ...prev, documentType: mapped }
      );
    }
    // Auto-populate title from extracted metadata if the user hasn't set one
    const em = data.interpret.extractedMetadata;
    if (em) {
      setForm(prev => {
        const updates: Partial<typeof prev> = {};
        // Use detected title (from content) if the form title is blank or matches a filename
        if (
          em.detectedTitle &&
          (!prev.title || /\.\w{2,5}$/.test(prev.title))
        ) {
          const prefix = em.sourceId ? `${em.sourceId} — ` : "";
          updates.title = `${prefix}${em.detectedTitle}`;
        }
        return Object.keys(updates).length > 0 ? { ...prev, ...updates } : prev;
      });
    }
  }, []);
  const onAnalysisError = useCallback(
    (e: { message: string }) => {
      setStages(["rejected", "idle", "idle", "idle"]);
      notify({
        title: "Analysis failed",
        description: e.message,
        severity: "error",
        group: "ingest",
      });
    },
    [notify]
  );

  const preAnalyzeMut = trpc.knowledge.preAnalyze.useMutation({
    onSuccess: onAnalysisSuccess,
    onError: onAnalysisError,
  });
  // NOTE: No onSuccess/onError — batch analysis handles results per-file
  // in analyzeFileSelection(). The global onAnalysisSuccess would overwrite
  // the shared form title with whichever file analyzed last.
  const preAnalyzeFileMut = trpc.knowledge.preAnalyzeFile.useMutation();

  // ── Phase 2: Ingestion callbacks ──
  const onIngested = useCallback(
    (d: IngestResponse, source: string) => {
      const resolvedTitle = d.title || pendingTitleRef.current || source;

      setStages([
        "done",
        "done",
        "done",
        d.status === "completed" ? "done" : "active",
      ]);
      setIsMultiFileUploading(false);
      setLastIngestResult({
        jobId: d.jobId,
        status: d.status,
        title: resolvedTitle,
        chunkCount: d.chunkCount ?? 0,
        documentId: d.documentId ?? undefined,
        message: d.message,
        suggestionSeed:
          form.content.trim().slice(0, 8000) ||
          analysis?.interpret.summary?.slice(0, 8000) ||
          undefined,
        classification: form.classification,
        accessControl: buildAccessControl(form, currentUserId),
      });
      notify({
        title:
          d.status === "completed"
            ? `Ready: ${resolvedTitle}`
            : `Processing started: ${resolvedTitle}`,
        description:
          d.status === "completed"
            ? `${d.chunkCount ?? 0} chunks indexed and ready for retrieval.`
            : "The upload was accepted by the pipeline. It will become searchable after processing finishes.",
        severity: d.status === "completed" ? "success" : "info",
        group: "ingest",
      });
      setForm({
        ...EMPTY_FORM,
      });
      setFiles([]);
      setAnalysis(null);
      utils.knowledge.listJobs.invalidate();
      utils.knowledge.listDocuments.invalidate();
      utils.knowledge.stats.invalidate();
      contributeMut.mutate({
        action: "upload",
        valueStreamId: streamId || undefined,
        documentId: d.documentId ?? undefined,
        metadata: { source, chunks: d.chunkCount ?? 0 },
      });
      onStepComplete?.("first-ingest");
    },
    [
      notify,
      utils,
      contributeMut,
      onStepComplete,
      form.content,
      analysis,
      form.classification,
      currentUserId,
      streamId,
    ]
  );

  const finalizeFileBatch = useCallback(
    (lastSuccess?: IngestResponse) => {
      const successfulIds = new Set(successfulFileIdsRef.current);
      const remainingFilesCount = files.filter(
        file => !successfulIds.has(file.id)
      ).length;

      setFiles(prev => prev.filter(file => !successfulIds.has(file.id)));
      setIsMultiFileUploading(false);
      pendingUploadsRef.current = 0;
      pendingTitleRef.current = "";
      activeFileIdsRef.current = null;
      uploadingFileIdsRef.current = [];
      successfulFileIdsRef.current = [];
      setAnalysis(null);

      utils.knowledge.listJobs.invalidate();
      utils.knowledge.listDocuments.invalidate();
      utils.knowledge.stats.invalidate();

      if (lastSuccess) {
        contributeMut.mutate({
          action: "upload",
          valueStreamId: streamId || undefined,
          documentId: lastSuccess.documentId ?? undefined,
          metadata: { source: "file", chunks: lastSuccess.chunkCount ?? 0 },
        });
      }

      if (remainingFilesCount > 0) {
        setStages(IDLE_STAGES);
        setLastIngestResult(null);
        if (successfulIds.size > 0) {
          notify({
            title: `${successfulIds.size} file${successfulIds.size !== 1 ? "s" : ""} started`,
            description: `${remainingFilesCount} file${remainingFilesCount !== 1 ? "s" : ""} remain in the upload queue.`,
            severity: "success",
            group: "ingest",
          });
        }
        return;
      }

      if (!lastSuccess) {
        setStages(IDLE_STAGES);
        setLastIngestResult(null);
        notify({
          title: "No files were started",
          description:
            "Fix the errored files or adjust your selection, then try again.",
          severity: "error",
          group: "ingest",
        });
        return;
      }

      setStages([
        "done",
        "done",
        "done",
        lastSuccess.status === "completed" ? "done" : "active",
      ]);
      setLastIngestResult({
        jobId: lastSuccess.jobId,
        status: lastSuccess.status,
        title: lastSuccess.title || "file",
        chunkCount: lastSuccess.chunkCount ?? 0,
        documentId: lastSuccess.documentId ?? undefined,
        message: lastSuccess.message,
        suggestionSeed:
          form.content.trim().slice(0, 8000) ||
          analysis?.interpret.summary?.slice(0, 8000) ||
          undefined,
        classification: form.classification,
        accessControl: buildAccessControl(form, currentUserId),
      });
      notify({
        title:
          lastSuccess.status === "completed"
            ? `Ready: ${lastSuccess.title || "file"}`
            : `Processing started: ${lastSuccess.title || "file"}`,
        description:
          lastSuccess.status === "completed"
            ? `${lastSuccess.chunkCount ?? 0} chunks indexed and ready for retrieval.`
            : "The upload was accepted by the pipeline. It will become searchable after processing finishes.",
        severity: lastSuccess.status === "completed" ? "success" : "info",
        group: "ingest",
      });
      setForm({
        ...EMPTY_FORM,
      });
      onStepComplete?.("first-ingest");
    },
    [
      files,
      form,
      analysis,
      notify,
      utils,
      contributeMut,
      onStepComplete,
      currentUserId,
      streamId,
    ]
  );

  const onFileUploadSuccess = useCallback(
    (fileId: string, d: IngestResponse) => {
      successfulFileIdsRef.current = [...successfulFileIdsRef.current, fileId];
      setFiles(prev =>
        prev.map(file =>
          file.id === fileId ? { ...file, status: "success" as const } : file
        )
      );

      pendingUploadsRef.current = Math.max(0, pendingUploadsRef.current - 1);
      if (pendingUploadsRef.current > 0) {
        return;
      }

      finalizeFileBatch(d);
    },
    [finalizeFileBatch]
  );

  const onFileUploadError = useCallback(
    (fileId: string, message: string) => {
      setFiles(prev =>
        prev.map(file =>
          file.id === fileId
            ? { ...file, status: "error" as const, error: message }
            : file
        )
      );
      notify({
        title: "File upload failed",
        description: humanizeError(message),
        severity: "error",
        group: "ingest",
      });

      pendingUploadsRef.current = Math.max(0, pendingUploadsRef.current - 1);
      if (pendingUploadsRef.current > 0) {
        return;
      }

      finalizeFileBatch();
    },
    [finalizeFileBatch, notify]
  );

  const syncTrackedIngest = useCallback((job: IngestionJob) => {
    setLastIngestResult(prev =>
      prev
        ? {
            ...prev,
            jobId: job.id,
            status: job.status,
            title: job.title || prev.title,
            chunkCount: job.chunkCount ?? prev.chunkCount,
            documentId: job.documentId ?? prev.documentId,
            message: job.error ?? prev.message,
            classification: job.classification ?? prev.classification,
            accessControl: job.accessControl ?? prev.accessControl,
          }
        : prev
    );
    setStages(prev => [
      prev[0]!,
      prev[1]!,
      prev[2]!,
      job.status === "completed"
        ? "done"
        : job.status === "failed"
          ? "rejected"
          : "active",
    ]);
  }, []);

  const markTrackedIngestManualCheck = useCallback((message?: string) => {
    setLastIngestResult(prev =>
      prev
        ? {
            ...prev,
            status: "manual_check",
            message: message || prev.message,
          }
        : prev
    );
    setStages(prev => [prev[0]!, prev[1]!, prev[2]!, "idle"]);
  }, []);

  const onIngestError = useCallback(
    (title: string, message: string) => {
      setStages(
        prev => prev.map((s, i) => (i === 3 ? "rejected" : s)) as StageStatus[]
      );
      notify({
        title,
        description: message,
        severity: "error",
        group: "ingest",
      });
      setTimeout(
        () =>
          setStages(
            prev => prev.map((s, i) => (i === 3 ? "idle" : s)) as StageStatus[]
          ),
        3000
      );
    },
    [notify]
  );

  const ingestTextMut = trpc.knowledge.ingestText.useMutation({
    onSuccess: d => onIngested(d, "text"),
    onError: e => onIngestError("Ingestion failed", humanizeError(e.message)),
  });
  const ingestUrlMut = trpc.knowledge.ingestUrl.useMutation({
    onSuccess: d => onIngested(d, "url"),
    onError: e => onIngestError("URL crawl failed", humanizeError(e.message)),
  });
  const uploadFileMut = trpc.knowledge.uploadFile.useMutation();

  // ── PII Redaction ──
  const piiRedactMut = trpc.knowledge.piiRedact.useMutation();
  const [isRedacting, setIsRedacting] = useState(false);

  // ── Handlers ──
  const handleIngest = useCallback(() => {
    const sharedTitle = form.title || undefined;
    const sharedDepartment = form.department || undefined;
    const sharedDocumentType = form.documentType || undefined;
    const sharedClassification = form.classification;
    const sharedTags = form.tags ? parseCsvTokenList(form.tags) : undefined;
    const sharedAccessControl = buildAccessControl(form, currentUserId);
    pendingTitleRef.current = form.title || "";
    setStages(prev => [prev[0]!, prev[1]!, prev[2]!, "active"]);
    if (mode === "file") {
      // Gate: only upload files that passed analysis or were user-approved (flagged).
      // If no analysis was run (skip-analysis shortcut), upload all ready files.
      const hasAnyAnalysis = files.some(f => f.analysisStatus != null);
      const activeIds = activeFileIdsRef.current;
      const eligible = hasAnyAnalysis
        ? files.filter(
            f =>
              f.status === "ready" &&
              (f.analysisStatus === "passed" || f.analysisStatus === "flagged")
          )
        : files.filter(
            f =>
              f.status === "ready" &&
              (!activeIds?.length || activeIds.includes(f.id))
          );
      if (!eligible.length)
        return notify({
          title: "No files approved for upload",
          description: hasAnyAnalysis
            ? "All files were rejected during analysis. Review or add different files."
            : "No files ready",
          severity: "warning",
        });
      pendingUploadsRef.current = eligible.length;
      uploadingFileIdsRef.current = eligible.map(file => file.id);
      successfulFileIdsRef.current = [];
      setIsMultiFileUploading(true);
      setFiles(prev =>
        prev.map(f =>
          eligible.some(file => file.id === f.id)
            ? { ...f, status: "uploading" as const }
            : f
        )
      );
      // Upload files with a concurrency limit so TRPC doesn't batch all
      // base64 payloads into a single HTTP request (which causes 413).
      const queue = [...eligible];
      const runNext = async (): Promise<void> => {
        const sf = queue.shift();
        if (!sf) return;
        const fileMeta = sf.metadata;
        // Explicit intake metadata should win when the user supplies it.
        // Auto-detected file metadata only fills blanks, except in multi-file
        // uploads where per-file titles remain the safer default.
        const fileTitle =
          eligible.length === 1 && sharedTitle
            ? sharedTitle
            : fileMeta?.title || sharedTitle;
        const fileDept = sharedDepartment || fileMeta?.department;
        const fileDocType = sharedDocumentType || fileMeta?.documentType;
        const fileTags =
          sharedTags && sharedTags.length > 0
            ? sharedTags
            : fileMeta?.tags
              ? fileMeta.tags
                  .split(",")
                  .map(t => t.trim())
                  .filter(Boolean)
              : undefined;
        // Fallback: derive title from analysis if metadata wasn't populated
        const resolvedTitle =
          fileTitle ||
          (() => {
            const em = sf.analysis?.interpret.extractedMetadata;
            if (!em?.detectedTitle) return sf.file.name;
            return `${em.sourceId ? `${em.sourceId} — ` : ""}${em.detectedTitle}`;
          })();
        try {
          const d = await uploadFileMut.mutateAsync({
            fileBase64: sf.base64,
            filename: sf.file.name,
            contentType: sf.file.type,
            title: resolvedTitle,
            department: fileDept,
            documentType: fileDocType,
            tags: fileTags,
            classification: sharedClassification,
            accessControl: sharedAccessControl,
            streamId: streamId || undefined,
          });
          onFileUploadSuccess(sf.id, d);
        } catch (e: any) {
          onFileUploadError(sf.id, e?.message ?? "Upload failed");
        }
        return runNext();
      };
      // Start `UPLOAD_CONCURRENCY` parallel lanes
      void Promise.all(
        Array.from(
          { length: Math.min(UPLOAD_CONCURRENCY, eligible.length) },
          () => runNext()
        )
      );
    } else if (mode === "text") {
      ingestTextMut.mutate({
        content: form.content,
        title: sharedTitle,
        department: sharedDepartment,
        documentType: sharedDocumentType,
        tags: sharedTags,
        classification: sharedClassification,
        accessControl: sharedAccessControl,
        streamId: streamId || undefined,
      });
    } else {
      ingestUrlMut.mutate({
        url: form.url,
        title: sharedTitle,
        department: sharedDepartment,
        documentType: sharedDocumentType,
        tags: sharedTags,
        classification: sharedClassification,
        accessControl: sharedAccessControl,
        streamId: streamId || undefined,
      });
    }
  }, [
    mode,
    form,
    files,
    ingestTextMut,
    ingestUrlMut,
    uploadFileMut,
    onFileUploadSuccess,
    onFileUploadError,
    notify,
    streamId,
    currentUserId,
  ]);

  const handleRedactAndIngest = useCallback(async () => {
    if (mode !== "text" || !form.content.trim()) return;
    setIsRedacting(true);
    try {
      const result: PIIRedactResult = await piiRedactMut.mutateAsync({
        text: form.content,
      });
      // Update form with redacted content
      setForm(prev => ({ ...prev, content: result.redactedText }));
      // Update analysis PII flags in-place so UI reflects clean state
      if (analysis) {
        setAnalysis({
          ...analysis,
          validate: {
            ...analysis.validate,
            piiDetected: false,
            piiCategories: [],
            contactInfoDetected: false,
            contactInfoCategories: [],
          },
        });
      }
      notify({
        title: "PII Redacted",
        description: `${result.redactionsApplied} item(s) replaced across ${result.categoriesRedacted.length} categories.`,
        severity: "success",
        group: "ingest",
      });
      // Now ingest the redacted content
      const title = form.title || undefined;
      const department = form.department || undefined;
      const documentType = form.documentType || undefined;
      const classification = form.classification;
      const tags = form.tags ? parseCsvTokenList(form.tags) : undefined;
      const accessControl = buildAccessControl(form, currentUserId);
      setStages(prev => [prev[0]!, prev[1]!, prev[2]!, "active"]);
      ingestTextMut.mutate({
        content: result.redactedText,
        title,
        department,
        documentType,
        tags,
        classification,
        accessControl,
        streamId: streamId || undefined,
      });
    } catch (e: any) {
      notify({
        title: "Redaction failed",
        description: e.message ?? "Unknown error",
        severity: "error",
        group: "ingest",
      });
    } finally {
      setIsRedacting(false);
    }
  }, [
    mode,
    form,
    analysis,
    notify,
    piiRedactMut,
    ingestTextMut,
    streamId,
    currentUserId,
    setForm,
    setAnalysis,
    setStages,
  ]);

  // ── Per-file batch analysis with concurrency limit ──
  const batchAnalysisAbortRef = useRef(false);
  const [isBatchAnalyzing, setIsBatchAnalyzing] = useState(false);

  /** Resolve per-file analysis verdict from the raw result. */
  const classifyAnalysis = useCallback(
    (a: PreIngestAnalysis): { status: FileAnalysisStatus; note: string } => {
      const hasPII =
        a.validate.piiDetected &&
        a.validate.piiCategories.some(c => CRITICAL_PII_CATEGORIES.has(c));
      if (a.decide.recommendation === "reject") {
        return {
          status: "rejected",
          note: a.decide.reasoning || "Rejected by quality gate",
        };
      }
      if (hasPII) {
        return {
          status: "flagged",
          note: `Critical PII: ${a.validate.piiCategories.join(", ")}`,
        };
      }
      if (a.decide.recommendation === "review" || !a.overallPass) {
        return {
          status: "flagged",
          note: a.decide.reasoning || "Needs manual review",
        };
      }
      return { status: "passed", note: "" };
    },
    []
  );

  const analyzeFileSelection = useCallback(
    (targetIds?: string[]) => {
      const ready = files.filter(
        file =>
          file.status === "ready" &&
          (!targetIds?.length || targetIds.includes(file.id))
      );
      if (!ready.length) {
        return notify({ title: "Drop a file first", severity: "warning" });
      }
      if (ready.length > MAX_BATCH_SIZE) {
        return notify({
          title: `Too many files (${ready.length})`,
          description: `Maximum batch size is ${MAX_BATCH_SIZE} files.`,
          severity: "warning",
        });
      }

      activeFileIdsRef.current = ready.map(file => file.id);
      batchAnalysisAbortRef.current = false;
      setIsBatchAnalyzing(true);
      setAnalysis(null);
      setStages(["active", "idle", "idle", "idle"]);

      // Mark every target file as "pending" analysis
      const readyIdSet = new Set(ready.map(f => f.id));
      setFiles(prev =>
        prev.map(f =>
          readyIdSet.has(f.id)
            ? {
                ...f,
                analysisStatus: "pending" as const,
                analysis: undefined,
                analysisNote: undefined,
              }
            : f
        )
      );

      if (ready.length > 1) {
        notify({
          title: `Analyzing ${ready.length} files`,
          description: `Each file will be checked individually (${ANALYSIS_CONCURRENCY} at a time).`,
          severity: "info",
          group: "ingest",
        });
      }

      // Concurrency-limited per-file analysis queue
      const queue = [...ready];
      let firstResult: PreIngestAnalysis | null = null;

      const runNextAnalysis = async (): Promise<void> => {
        if (batchAnalysisAbortRef.current) return;
        const sf = queue.shift();
        if (!sf) return;

        // Mark this file as "analyzing"
        setFiles(prev =>
          prev.map(f =>
            f.id === sf.id ? { ...f, analysisStatus: "analyzing" as const } : f
          )
        );

        try {
          const result = await preAnalyzeFileMut.mutateAsync({
            fileBase64: sf.base64,
            filename: sf.file.name,
            contentType: sf.file.type,
            title: form.title || undefined,
            streamId: streamId || undefined,
          });

          if (!firstResult) firstResult = result;

          const verdict = classifyAnalysis(result);

          // Build per-file metadata from this file's own extracted metadata
          // so each file gets its own title during upload (not the shared form's).
          const em = result.interpret.extractedMetadata;
          const perFileTitle = em?.detectedTitle
            ? `${em.sourceId ? `${em.sourceId} — ` : ""}${em.detectedTitle}`
            : undefined;
          const perFileDept = result.interpret.department || undefined;
          const perFileDocType = result.interpret.detectedType || undefined;
          const perFileTags = result.interpret.tags?.join(", ") || undefined;

          setFiles(prev =>
            prev.map(f =>
              f.id === sf.id
                ? {
                    ...f,
                    analysisStatus: verdict.status,
                    analysis: result,
                    analysisNote: verdict.note,
                    metadata: {
                      ...f.metadata,
                      ...(perFileTitle && { title: perFileTitle }),
                      ...(perFileDept && { department: perFileDept }),
                      ...(perFileDocType && { documentType: perFileDocType }),
                      ...(perFileTags && { tags: perFileTags }),
                    },
                  }
                : f
            )
          );
        } catch (e: any) {
          setFiles(prev =>
            prev.map(f =>
              f.id === sf.id
                ? {
                    ...f,
                    analysisStatus: "error" as const,
                    analysisNote: e?.message ?? "Analysis failed",
                  }
                : f
            )
          );
        }

        return runNextAnalysis();
      };

      void Promise.all(
        Array.from(
          { length: Math.min(ANALYSIS_CONCURRENCY, ready.length) },
          () => runNextAnalysis()
        )
      ).then(() => {
        if (batchAnalysisAbortRef.current) return;
        setIsBatchAnalyzing(false);

        // Use the first file's result as the "representative" aggregate analysis
        // for the Review phase (preserves existing IntelligencePanel compatibility).
        if (firstResult) {
          setAnalysis(firstResult);
          const v: StageStatus = firstResult.validate.passed
            ? "done"
            : "rejected";
          const i: StageStatus = firstResult.interpret.passed
            ? "done"
            : "rejected";
          const d: StageStatus = firstResult.decide.passed
            ? "done"
            : "rejected";
          setStages([v, i, d, "idle"]);
        } else {
          setStages(["rejected", "idle", "idle", "idle"]);
        }
      });
    },
    [files, notify, preAnalyzeFileMut, form.title, streamId, classifyAnalysis]
  );

  const handleAnalyzeFiles = useCallback(
    (fileIds: string[]) => {
      if (mode !== "file") return;
      analyzeFileSelection(fileIds);
    },
    [mode, analyzeFileSelection]
  );

  const handleAnalyze = useCallback(() => {
    if (mode === "text") {
      if (!form.content.trim())
        return notify({
          title: "Paste some content first",
          severity: "warning",
        });
      setAnalysis(null);
      setStages(["active", "idle", "idle", "idle"]);
      preAnalyzeMut.mutate({
        content: form.content,
        title: form.title || undefined,
      });
    } else if (mode === "file") {
      analyzeFileSelection();
    } else if (mode === "url") {
      if (!form.url.trim())
        return notify({ title: "Enter a URL", severity: "warning" });
      // URL mode: skip analysis and go directly to ingestion since the
      // pipeline handles scraping, extraction, and indexing in one step.
      // Show a notification so the user knows what's happening.
      notify({
        title: "URL ingestion started",
        description:
          "The pipeline will crawl, extract, and index the content. Track progress below.",
        severity: "info",
        group: "ingest",
      });
      handleIngest();
    }
  }, [mode, form, notify, preAnalyzeMut, analyzeFileSelection, handleIngest]);

  // ── Derived state ──
  const isAnalyzing =
    preAnalyzeMut.isPending || preAnalyzeFileMut.isPending || isBatchAnalyzing;
  const isIngesting =
    ingestTextMut.isPending ||
    ingestUrlMut.isPending ||
    uploadFileMut.isPending ||
    isMultiFileUploading;
  const hasAnalysis = !!analysis;
  const canAnalyze =
    mode === "file"
      ? files.some(f => f.status === "ready")
      : mode === "text"
        ? !!form.content.trim()
        : !!form.url.trim();

  const hasCriticalPII =
    analysis?.validate.piiDetected === true &&
    analysis.validate.piiCategories.some(c => CRITICAL_PII_CATEGORIES.has(c));

  // ── Batch analysis summary (computed from per-file results) ──
  const batchSummary = useMemo<BatchAnalysisSummary | null>(() => {
    const analyzed = files.filter(f => f.analysisStatus != null);
    if (analyzed.length === 0) return null;

    const passed = files.filter(f => f.analysisStatus === "passed");
    const flagged = files.filter(f => f.analysisStatus === "flagged");
    const rejected = files.filter(f => f.analysisStatus === "rejected");
    const errors = files.filter(f => f.analysisStatus === "error");
    const pending = files.filter(
      f => f.analysisStatus === "pending" || f.analysisStatus === "analyzing"
    );

    const withAnalysis = files.filter(f => f.analysis);
    const avgQuality =
      withAnalysis.length > 0
        ? withAnalysis.reduce(
            (sum, f) => sum + (f.analysis?.validate.qualityScore ?? 0),
            0
          ) / withAnalysis.length
        : 0;
    const avgConfidence =
      withAnalysis.length > 0
        ? withAnalysis.reduce(
            (sum, f) => sum + (f.analysis?.overallConfidence ?? 0),
            0
          ) / withAnalysis.length
        : 0;
    const avgRelevance =
      withAnalysis.length > 0
        ? withAnalysis.reduce(
            (sum, f) => sum + (f.analysis?.decide.relevanceScore ?? 0),
            0
          ) / withAnalysis.length
        : 0;

    const piiFileCount = withAnalysis.filter(
      f => f.analysis?.validate.piiDetected
    ).length;
    const duplicateFileCount = withAnalysis.filter(
      f => (f.analysis?.decide.duplicates?.length ?? 0) > 0
    ).length;

    return {
      total: files.filter(f => f.status === "ready" || f.analysisStatus != null)
        .length,
      analyzed: withAnalysis.length,
      passed: passed.length,
      flagged: flagged.length,
      rejected: rejected.length,
      errors: errors.length,
      pending: pending.length,
      avgQuality,
      avgConfidence,
      avgRelevance,
      piiFileCount,
      duplicateFileCount,
    };
  }, [files]);

  /** Files that are approved for upload (passed + user-approved flagged). */
  const uploadableFiles = useMemo(
    () =>
      files.filter(
        f =>
          f.status === "ready" &&
          (f.analysisStatus === "passed" || f.analysisStatus === "flagged")
      ),
    [files]
  );

  const analysisApproved =
    mode === "file" && files.some(f => f.analysisStatus != null)
      ? uploadableFiles.length > 0
      : analysis?.decide.recommendation !== "reject";

  /** Toggle a flagged/rejected file's approval (flip between flagged ↔ rejected). */
  const toggleFileApproval = useCallback(
    (fileId: string) => {
      setFiles(prev =>
        prev.map(f => {
          if (f.id !== fileId) return f;
          if (f.analysisStatus === "flagged") {
            return {
              ...f,
              analysisStatus: "rejected" as const,
              analysisNote: "Excluded by user",
            };
          }
          if (f.analysisStatus === "rejected") {
            return {
              ...f,
              analysisStatus: "flagged" as const,
              analysisNote: "Re-included by user",
            };
          }
          return f;
        })
      );
    },
    [setFiles]
  );

  // ── Flow step (derived, no extra state) ──
  const flowStep: FlowStep = (() => {
    if (lastIngestResult) return "track";
    if (isIngesting) return "ingest";
    if (hasAnalysis) return "review";
    if (isAnalyzing) return "analyze";
    return "add";
  })();

  // Start fresh flow (clears completion state too)
  const startFresh = useCallback(() => {
    resetPipeline();
    setLastIngestResult(null);
    setForm(EMPTY_FORM);
    setFiles([]);
    try {
      sessionStorage.removeItem(persistedStateKey);
    } catch {
      /* noop */
    }
  }, [persistedStateKey, resetPipeline]);

  return {
    // State
    mode,
    setMode,
    form,
    setForm,
    files,
    setFiles,
    stages,
    analysis,
    lastIngestResult,
    currentUserId,

    // Derived
    isAnalyzing,
    isBatchAnalyzing,
    isIngesting,
    isRedacting,
    hasAnalysis,
    analysisApproved,
    canAnalyze,
    hasCriticalPII,
    flowStep,
    batchSummary,
    uploadableFiles,

    // Actions
    handleAnalyze,
    handleAnalyzeFiles,
    handleIngest,
    handleRedactAndIngest,
    toggleFileApproval,
    resetPipeline,
    startFresh,
    syncTrackedIngest,
    markTrackedIngestManualCheck,
  };
}
