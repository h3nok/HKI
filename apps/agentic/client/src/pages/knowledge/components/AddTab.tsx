import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Upload,
  Globe,
  FileText,
  Loader2,
  Sparkles,
  CheckCircle,
  XCircle,
  Clock,
  File,
  Link2,
} from "lucide-react";
import { toast } from "sonner";
import { cn, fireConfetti, useNotifications } from "@hki/ui";
import { trpc } from "@/lib/trpc";
import { type IngestMode, JOB_STATUS_META } from "../types";
import {
  getPipelineStatusLabel,
  isPipelineProcessingStatus,
} from "../pipelineCopy";
import { k } from "../theme";
import FileDropZone, { type SelectedFile } from "./upload/FileDropZone";
import { GoogleDriveSetup } from "./connectors";

// ── Animation ────────────────────────────────────────────────────────────────
const fadeIn = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.2 },
};

export default function AddTab({
  streamName,
  streamId,
}: {
  streamName?: string;
  streamId?: string;
}) {
  const [mode, setMode] = useState<IngestMode>("file");
  const [showDrive, setShowDrive] = useState(false);
  const [form, setForm] = useState({ content: "", url: "", title: "" });
  const [files, setFiles] = useState<SelectedFile[]>([]);
  const utils = trpc.useUtils();
  const { notify } = useNotifications();

  const connectorsQ = trpc.connectors.list.useQuery(undefined, {
    retry: false,
  });
  const jobsQ = trpc.knowledge.listJobs.useQuery(
    streamId ? { valueStreamId: streamId } : undefined,
    {
      retry: false,
      enabled: Boolean(streamId),
    }
  );
  const driveConnected = (connectorsQ.data ?? []).some(
    (c: any) => c.type === "google_drive"
  );

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

  const onIngested = (d: any, source: string) => {
    const resolvedTitle = d.title || source;
    notify({
      title:
        d.status === "completed"
          ? `Ready: ${resolvedTitle}`
          : `Processing started: ${resolvedTitle}`,
      description:
        d.status === "completed"
          ? `${d.chunkCount ?? 0} chunks indexed and ready for retrieval.`
          : "The upload was accepted by the pipeline. It will appear in the library after processing finishes.",
      severity: d.status === "completed" ? "success" : "info",
      group: "ingest",
    });
    setForm({ content: "", url: "", title: "" });
    setFiles([]);
    utils.knowledge.listJobs.invalidate();
    utils.knowledge.listDocuments.invalidate();
    utils.knowledge.stats.invalidate();
    contributeMut.mutate({
      action: "upload",
      valueStreamId: streamId || undefined,
      documentId: d.documentId ?? undefined,
      metadata: { source, chunks: d.chunkCount ?? 0 },
    });
  };

  // ── Mutations ──
  const ingestTextMut = trpc.knowledge.ingestText.useMutation({
    onSuccess: d => onIngested(d, "text"),
    onError: e =>
      notify({
        title: "Ingestion failed",
        description: e.message,
        severity: "error",
        group: "ingest",
      }),
  });
  const ingestUrlMut = trpc.knowledge.ingestUrl.useMutation({
    onSuccess: d => onIngested(d, "url"),
    onError: e =>
      notify({
        title: "URL crawl failed",
        description: e.message,
        severity: "error",
        group: "ingest",
      }),
  });
  const uploadFileMut = trpc.knowledge.uploadFile.useMutation({
    onSuccess: d => onIngested(d, "file"),
    onError: e => {
      notify({
        title: "File upload failed",
        description: e.message,
        severity: "error",
        group: "ingest",
      });
      setFiles(prev =>
        prev.map(f =>
          f.status === "uploading"
            ? { ...f, status: "error" as const, error: e.message }
            : f
        )
      );
    },
  });

  const handleIngest = useCallback(() => {
    const title = form.title || undefined;
    if (mode === "file") {
      const ready = files.filter(f => f.status === "ready");
      if (!ready.length)
        return notify({ title: "No files ready", severity: "warning" });
      setFiles(prev =>
        prev.map(f =>
          f.status === "ready" ? { ...f, status: "uploading" as const } : f
        )
      );
      for (const sf of ready) {
        uploadFileMut.mutate({
          fileBase64: sf.base64,
          filename: sf.file.name,
          contentType: sf.file.type,
          title,
          streamId: streamId || undefined,
        });
      }
    } else if (mode === "text") {
      if (!form.content.trim())
        return notify({
          title: "Paste some content first",
          severity: "warning",
        });
      ingestTextMut.mutate({
        content: form.content,
        title,
        streamId: streamId || undefined,
      });
    } else {
      if (!form.url.trim())
        return notify({ title: "Enter a URL", severity: "warning" });
      ingestUrlMut.mutate({
        url: form.url,
        title,
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
    notify,
    streamId,
  ]);

  const isIngesting =
    ingestTextMut.isPending ||
    ingestUrlMut.isPending ||
    uploadFileMut.isPending;
  const jobs = (jobsQ.data?.jobs ?? []).slice(0, 8) as any[];

  // ── Google Drive setup flow ──
  if (showDrive) {
    return (
      <motion.div {...fadeIn}>
        <GoogleDriveSetup
          streamName={streamName}
          streamId={streamId}
          onBack={() => setShowDrive(false)}
          onConnected={() => {
            notify({
              title: "Google Drive connected",
              description: "Documents will sync automatically.",
              severity: "success",
              group: "connector",
            });
            connectorsQ.refetch();
            setShowDrive(false);
          }}
        />
      </motion.div>
    );
  }

  return (
    <div className="flex flex-col items-center min-h-[calc(100vh-200px)]">
      <motion.div {...fadeIn} className="w-full max-w-3xl mx-auto space-y-6">
        {/* ── Mode tabs ── */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-muted/50 w-fit">
          {[
            { key: "file" as const, icon: File, label: "Upload Files" },
            { key: "text" as const, icon: FileText, label: "Paste Text" },
            { key: "url" as const, icon: Link2, label: "URL" },
          ].map(m => (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              className={cn(
                "flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium transition-all",
                mode === m.key
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground dark:hover:text-white/80"
              )}
            >
              <m.icon className="w-3.5 h-3.5" />
              {m.label}
            </button>
          ))}
        </div>

        {/* ── Main input area ── */}
        <div className={cn(k.card, "overflow-hidden")}>
          <div className="p-5 space-y-4">
            {mode === "file" ? (
              <FileDropZone
                files={files}
                onFilesSelected={newFiles =>
                  setFiles(prev => [...prev, ...newFiles])
                }
                onRemoveFile={idx =>
                  setFiles(prev => prev.filter((_, i) => i !== idx))
                }
                disabled={isIngesting}
              />
            ) : mode === "text" ? (
              <textarea
                value={form.content}
                onChange={e =>
                  setForm(f => ({ ...f, content: e.target.value }))
                }
                placeholder="Paste knowledge content here — SOPs, policies, FAQs, training materials..."
                rows={8}
                className={cn(k.input, "resize-none text-xs leading-relaxed")}
              />
            ) : (
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-muted-foreground/60 shrink-0" />
                <input
                  value={form.url}
                  onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                  placeholder="https://docs.example.com/page-to-crawl"
                  className={cn(k.input, "flex-1")}
                  onKeyDown={e => e.key === "Enter" && handleIngest()}
                />
              </div>
            )}

            {/* Optional title */}
            <input
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Title (optional — AI auto-detects if empty)"
              className={cn(k.input, "text-xs")}
            />

            {/* Submit */}
            <div className="flex items-center justify-between">
              <p className={cn("text-xs", k.muted)}>
                AI auto-detects title, department, tags, and document type.
              </p>
              <button
                onClick={handleIngest}
                disabled={
                  isIngesting ||
                  (mode === "file"
                    ? !files.some(f => f.status === "ready")
                    : mode === "text"
                      ? !form.content.trim()
                      : !form.url.trim())
                }
                className={k.btnPrimary}
              >
                {isIngesting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Upload className="w-3.5 h-3.5" />
                )}
                {isIngesting
                  ? "Processing…"
                  : mode === "file"
                    ? `Upload ${files.filter(f => f.status === "ready").length} File(s)`
                    : mode === "text"
                      ? "Ingest Text"
                      : "Crawl URL"}
              </button>
            </div>
          </div>
        </div>

        {/* ── Google Drive connector ── */}
        <button
          onClick={() => setShowDrive(true)}
          className={cn(
            "w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-all",
            driveConnected
              ? "border-primary/30 bg-primary/5 dark:bg-primary/8"
              : "border-black/6 dark:border-white/6 kb-duotone-border-hover-strong hover:shadow-sm"
          )}
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-500/10 text-lg shrink-0">
            📁
          </div>
          <div className="flex-1 min-w-0">
            <p className={cn("text-sm font-semibold", k.heading)}>
              {driveConnected
                ? "Google Drive Connected"
                : "Connect Google Drive"}
            </p>
            <p className={cn("text-[11px] mt-0.5", k.muted)}>
              {driveConnected
                ? "Documents sync automatically on schedule"
                : "Auto-sync your team's shared folders — read-only OAuth"}
            </p>
          </div>
          {driveConnected ? (
            <CheckCircle className="w-5 h-5 text-primary shrink-0" />
          ) : (
            <span
              className={cn(
                "text-xs font-semibold px-2.5 py-1 rounded-lg shrink-0",
                k.accentBgSubtle,
                k.accentText
              )}
            >
              Set up
            </span>
          )}
        </button>

        {/* ── Recent jobs ── */}
        {jobs.length > 0 && (
          <div>
            <h3 className={cn(k.label, "mb-2")}>Recent Ingestion Jobs</h3>
            <div className="space-y-1">
              {jobs.map((job: any) => {
                const meta =
                  JOB_STATUS_META[job.status] ?? JOB_STATUS_META.queued;
                const StatusIcon = meta.Icon;
                return (
                  <div
                    key={job.id ?? job.jobId}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-black/2 dark:hover:bg-white/2 transition-colors"
                  >
                    <StatusIcon
                      className={cn(
                        "w-3.5 h-3.5 shrink-0",
                        meta.color,
                        isPipelineProcessingStatus(job.status) && "animate-spin"
                      )}
                    />
                    <span className="text-xs font-medium text-foreground truncate flex-1">
                      {job.title || job.source || "Untitled"}
                    </span>
                    <span className={cn("text-xs font-medium", meta.color)}>
                      {getPipelineStatusLabel(job.status, { tone: "compact" })}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
