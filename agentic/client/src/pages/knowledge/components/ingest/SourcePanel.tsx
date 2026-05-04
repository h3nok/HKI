/**
 * Enhanced SourcePanel — Left card of Knowledge Studio with retail-grade features.
 *
 * New capabilities:
 *   - Batch actions toolbar (select all, analyze selected, clear)
 *   - File type icons with preview triggers
 *   - Connector sync log (last sync, errors, next scheduled)
 *   - Quick stats: total size, file count, estimated tokens
 */

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  Globe,
  FileText,
  File,
  FileSpreadsheet,
  Plug,
  CheckCircle,
  ArrowRight,
  Plus,
  FolderInput,
  Trash2,
  Play,
  X,
  RefreshCw,
  Clock,
  AlertTriangle,
  CheckSquare,
  Square,
  Database,
  Loader2,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import {
  cn,
  Badge,
  Input,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@hki/ui";
import type { IngestMode } from "../../types";
import { k } from "../../theme";
import FileDropZone, {
  type SelectedFile,
  type FileAnalysisStatus,
} from "../upload/FileDropZone";
import type { IngestFormState } from "./types";

interface SourcePanelProps {
  mode: IngestMode;
  setMode: (m: IngestMode) => void;
  form: IngestFormState;
  setForm: React.Dispatch<React.SetStateAction<IngestFormState>>;
  files: SelectedFile[];
  setFiles: React.Dispatch<React.SetStateAction<SelectedFile[]>>;
  isIngesting: boolean;
  isAnalyzing: boolean;
  hasAnalysis: boolean;
  onReset: () => void;
  onAnalyze: () => void;
  onAnalyzeSelected?: (indices: number[]) => void;
  driveConnected: boolean;
  driveLastSync?: string;
  driveSyncStatus?: "idle" | "syncing" | "error";
  onSetupDrive: () => void;
  onSyncDrive?: () => void;
}

const SOURCE_MODES: { key: IngestMode; icon: typeof File; label: string }[] = [
  { key: "file", icon: Upload, label: "Files" },
  { key: "text", icon: FileText, label: "Text" },
  { key: "url", icon: Globe, label: "URL" },
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  if (["pdf"].includes(ext))
    return { icon: FileText, color: "text-red-500", bg: "bg-red-500/10" };
  if (["docx", "doc"].includes(ext))
    return { icon: FileText, color: "text-blue-500", bg: "bg-blue-500/10" };
  if (["xlsx", "xls", "csv"].includes(ext))
    return {
      icon: FileSpreadsheet,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    };
  if (["md", "txt"].includes(ext))
    return { icon: FileText, color: "text-muted-foreground", bg: "bg-muted" };
  return { icon: File, color: "text-muted-foreground", bg: "bg-muted" };
}

export default function SourcePanelEnhanced({
  mode,
  setMode,
  form,
  setForm,
  files,
  setFiles,
  isIngesting,
  isAnalyzing,
  hasAnalysis,
  onReset,
  onAnalyze,
  onAnalyzeSelected,
  driveConnected,
  driveLastSync,
  driveSyncStatus,
  onSetupDrive,
  onSyncDrive,
}: SourcePanelProps) {
  const [selectedFiles, setSelectedFiles] = useState<Set<number>>(new Set());
  const [showSyncLog, setShowSyncLog] = useState(false);

  const stats = useMemo(() => {
    const totalBytes = files.reduce((sum, f) => sum + f.file.size, 0);
    const avgFileSize = files.length > 0 ? totalBytes / files.length : 0;
    // Rough estimate: 1 token ≈ 4 chars ≈ 4 bytes for text files
    const estimatedTokens = Math.round(totalBytes / 4);
    return {
      count: files.length,
      totalSize: formatFileSize(totalBytes),
      avgSize: formatFileSize(avgFileSize),
      estimatedTokens:
        estimatedTokens > 1000
          ? `${(estimatedTokens / 1000).toFixed(1)}k`
          : estimatedTokens.toString(),
    };
  }, [files]);

  const allSelected = files.length > 0 && selectedFiles.size === files.length;
  const someSelected =
    selectedFiles.size > 0 && selectedFiles.size < files.length;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(files.map((_, i) => i)));
    }
  };

  const toggleSelect = (idx: number) => {
    const next = new Set(selectedFiles);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    setSelectedFiles(next);
  };

  const clearSelection = () => setSelectedFiles(new Set());

  const removeSelected = () => {
    setFiles(prev => prev.filter((_, i) => !selectedFiles.has(i)));
    setSelectedFiles(new Set());
  };

  const handleAnalyzeSelected = () => {
    if (onAnalyzeSelected && selectedFiles.size > 0) {
      onAnalyzeSelected(Array.from(selectedFiles));
      clearSelection();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* ── Card Header ── */}
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-border/30">
        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <FolderInput className="w-3.5 h-3.5 text-primary" />
        </div>
        <div>
          <p className={k.heading}>Content Sources</p>
          <p className={k.caption}>Add or connect content</p>
        </div>
      </div>

      {/* ── Mode Selector ── */}
      <div className="px-3 pt-3">
        <div className={cn(k.inset, "flex items-center gap-0.5 p-0.5")}>
          {SOURCE_MODES.map(m => {
            const active = mode === m.key;
            return (
              <button
                key={m.key}
                onClick={() => {
                  setMode(m.key);
                  onReset();
                  setSelectedFiles(new Set());
                }}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-bold transition-all",
                  active
                    ? "bg-card text-primary shadow-sm"
                    : "text-muted-foreground/60 hover:text-muted-foreground"
                )}
              >
                <m.icon className="w-3.5 h-3.5" />
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Input Zone ── */}
      <div className="flex-1 px-3 pt-3 pb-2 overflow-y-auto min-h-0">
        <div className={cn(k.inset, "p-2.5 h-full")}>
          <AnimatePresence mode="wait">
            <motion.div
              key={mode}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.1 }}
              className="h-full"
            >
              {mode === "file" ? (
                <div className="flex flex-col h-full gap-2">
                  <FileDropZone
                    files={files}
                    onFilesSelected={newFiles => {
                      setFiles(prev => [...prev, ...newFiles]);
                      setSelectedFiles(new Set());
                    }}
                    onRemoveFile={idx => {
                      setFiles(prev => prev.filter((_, i) => i !== idx));
                      setSelectedFiles(prev => {
                        const next = new Set<number>();
                        prev.forEach(i => {
                          if (i < idx) next.add(i);
                          if (i > idx) next.add(i - 1);
                        });
                        return next;
                      });
                    }}
                    disabled={isIngesting || isAnalyzing}
                  />

                  {/* File list with selection */}
                  {files.length > 0 && (
                    <div className="flex-1 overflow-y-auto min-h-0">
                      {/* Batch toolbar */}
                      <div className="flex items-center justify-between mb-2 px-0.5">
                        <button
                          onClick={toggleSelectAll}
                          className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground kb-duotone-text-hover transition-colors"
                        >
                          {allSelected ? (
                            <CheckSquare className="w-3.5 h-3.5" />
                          ) : someSelected ? (
                            <div className="w-3.5 h-3.5 rounded-sm border-2 border-primary bg-primary/20" />
                          ) : (
                            <Square className="w-3.5 h-3.5" />
                          )}
                          {selectedFiles.size > 0
                            ? `${selectedFiles.size} selected`
                            : "Select all"}
                        </button>
                        {selectedFiles.size > 0 && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={handleAnalyzeSelected}
                              disabled={isAnalyzing}
                              className="flex items-center gap-1 px-2 py-1 rounded-md kb-duotone-fill text-xs font-bold kb-duotone-bg-hover-strong transition-colors"
                            >
                              <Play className="w-3 h-3" />
                              Analyze
                            </button>
                            <button
                              onClick={removeSelected}
                              className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Files */}
                      <div className="space-y-1">
                        {files.map((f, i) => {
                          const selected = selectedFiles.has(i);
                          const fileIcon = getFileIcon(f.file.name);
                          const Icon = fileIcon.icon;
                          return (
                            <div
                              key={`${f.file.name}-${i}`}
                              onClick={() => toggleSelect(i)}
                              className={cn(
                                "flex items-center gap-2 px-2 py-1.5 rounded-lg border transition-all cursor-pointer",
                                selected
                                  ? "border-primary/40 bg-primary/5"
                                  : "border-border/50 bg-card kb-duotone-border-hover"
                              )}
                            >
                              <div
                                className={cn(
                                  "w-6 h-6 rounded-md flex items-center justify-center shrink-0",
                                  fileIcon.bg
                                )}
                              >
                                <Icon
                                  className={cn("w-3 h-3", fileIcon.color)}
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-foreground truncate">
                                  {f.file.name}
                                </p>
                                <p className={k.muted}>
                                  {formatFileSize(f.file.size)}
                                </p>
                              </div>
                              {/* Per-file analysis status badge */}
                              {f.analysisStatus === "analyzing" && (
                                <Loader2 className="w-3.5 h-3.5 text-primary animate-spin shrink-0" />
                              )}
                              {f.analysisStatus === "passed" && (
                                <Badge
                                  variant="success"
                                  className="text-[10px] px-1.5 py-0 h-4 shrink-0"
                                >
                                  Pass
                                </Badge>
                              )}
                              {f.analysisStatus === "flagged" && (
                                <Badge
                                  variant="warning"
                                  className="text-[10px] px-1.5 py-0 h-4 shrink-0"
                                >
                                  Review
                                </Badge>
                              )}
                              {f.analysisStatus === "rejected" && (
                                <Badge
                                  variant="destructive"
                                  className="text-[10px] px-1.5 py-0 h-4 shrink-0"
                                >
                                  Reject
                                </Badge>
                              )}
                              {f.analysisStatus === "error" && (
                                <XCircle className="w-3.5 h-3.5 text-destructive shrink-0" />
                              )}
                              {f.analysisStatus === "pending" && (
                                <Clock className="w-3 h-3 text-muted-foreground/40 shrink-0" />
                              )}
                              {!f.analysisStatus && selected && (
                                <CheckCircle className="w-3.5 h-3.5 text-primary shrink-0" />
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Stats footer */}
                      {files.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-border/50">
                          <div
                            className={cn(
                              "flex items-center justify-between",
                              k.muted
                            )}
                          >
                            <span>
                              {stats.count} files · {stats.totalSize}
                            </span>
                            <span>~{stats.estimatedTokens} tokens</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : mode === "text" ? (
                <div className="flex flex-col h-full gap-1.5">
                  <textarea
                    value={form.content}
                    onChange={e => {
                      setForm(f => ({ ...f, content: e.target.value }));
                      if (hasAnalysis) onReset();
                    }}
                    placeholder="Paste knowledge content here…&#10;&#10;SOPs, policies, FAQs, runbooks…"
                    className={cn(
                      "flex-1 w-full px-2.5 py-2 text-xs leading-relaxed rounded-lg resize-none",
                      "bg-card border border-border/30",
                      "text-foreground",
                      "placeholder:text-muted-foreground/50",
                      "focus:outline-none focus:ring-2 focus:ring-primary/30"
                    )}
                    autoFocus
                  />
                  {form.content.length > 0 && (
                    <div
                      className={cn(
                        "flex items-center justify-between px-0.5",
                        k.muted
                      )}
                    >
                      <span>
                        {form.content.trim().split(/\s+/).length} words
                      </span>
                      <span>{form.content.length} chars</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-2 pt-1">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Globe className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <Input
                      value={form.url}
                      onChange={e =>
                        setForm(f => ({ ...f, url: e.target.value }))
                      }
                      placeholder="https://docs.example.com"
                      className="flex-1 h-8 text-xs"
                      onKeyDown={e => e.key === "Enter" && onAnalyze()}
                      autoFocus
                    />
                  </div>
                  <p className={cn(k.muted, "px-0.5")}>
                    Scraped, cleaned & chunked automatically
                  </p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* ── Metadata Section ── */}
      <div className="border-t border-border/30 px-3 py-2.5">
        <p className={cn(k.label, "mb-2")}>Metadata</p>
        <div className="space-y-1.5">
          <Input
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="Title (auto-detected if empty)"
            className="h-8 text-xs"
          />
          <div className="flex gap-1.5">
            <Input
              value={form.department}
              onChange={e =>
                setForm(f => ({ ...f, department: e.target.value }))
              }
              placeholder="Department"
              className="flex-1 h-8 text-xs"
            />
            <Select
              value={form.documentType}
              onValueChange={v => setForm(f => ({ ...f, documentType: v }))}
            >
              <SelectTrigger className="flex-1 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">General</SelectItem>
                <SelectItem value="policy">Policy</SelectItem>
                <SelectItem value="sop">SOP</SelectItem>
                <SelectItem value="faq">FAQ</SelectItem>
                <SelectItem value="training">Training</SelectItem>
                <SelectItem value="report">Report</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Input
            value={form.tags}
            onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
            placeholder="Tags (comma-separated)"
            className="h-8 text-xs"
          />
        </div>
      </div>

      {/* ── Connectors Section ── */}
      <div className="border-t border-border/30 px-3 py-2.5">
        <div className="flex items-center justify-between mb-2">
          <p className={cn(k.label)}>Connected Sources</p>
          {driveConnected && (
            <button
              onClick={() => setShowSyncLog(!showSyncLog)}
              className="text-xs text-primary hover:underline"
            >
              {showSyncLog ? "Hide" : "Status"}
            </button>
          )}
        </div>

        <div className="space-y-1.5">
          {/* Google Drive connector */}
          <div
            className={cn(
              "w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-all",
              driveConnected
                ? "bg-primary/6 dark:bg-primary/8 border border-primary/20"
                : "border border-border/50 kb-duotone-border-hover-strong"
            )}
          >
            <div
              className={cn(
                "w-6 h-6 rounded-md flex items-center justify-center shrink-0",
                driveConnected ? "bg-primary/15" : "bg-muted"
              )}
            >
              {driveConnected ? (
                <Database className="w-3 h-3 text-primary" />
              ) : (
                <Plug className="w-3 h-3 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className={cn(k.heading, "leading-none")}>Google Drive</p>
                {driveSyncStatus === "syncing" && (
                  <RefreshCw className="w-3 h-3 text-primary animate-spin" />
                )}
                {driveSyncStatus === "error" && (
                  <AlertTriangle className="w-3 h-3 text-destructive" />
                )}
              </div>
              <p className={cn(k.muted, "mt-0.5")}>
                {driveConnected
                  ? `Last sync: ${driveLastSync || "Never"}`
                  : "Connect to auto-sync"}
              </p>
            </div>
            {driveConnected ? (
              <button
                onClick={onSyncDrive}
                disabled={driveSyncStatus === "syncing"}
                className="p-1 rounded-md text-primary kb-duotone-bg-hover transition-colors"
              >
                <RefreshCw
                  className={cn(
                    "w-3.5 h-3.5",
                    driveSyncStatus === "syncing" && "animate-spin"
                  )}
                />
              </button>
            ) : (
              <button
                onClick={onSetupDrive}
                className="flex items-center gap-1 px-2 py-1 rounded-md kb-duotone-fill text-xs font-bold kb-duotone-bg-hover-strong transition-colors"
              >
                Connect
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Sync log expandable */}
          <AnimatePresence>
            {showSyncLog && driveConnected && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="pl-8 space-y-1">
                  <div className={cn("flex items-center gap-2", k.muted)}>
                    <Clock className="w-3 h-3 text-muted-foreground" />
                    <span>Next sync: Daily at 2:00 AM</span>
                  </div>
                  <div className={cn("flex items-center gap-2", k.muted)}>
                    <CheckCircle className="w-3 h-3 text-emerald-500" />
                    <span>42 documents synced</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Placeholder for more connectors */}
          <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg border border-dashed border-border/40 opacity-50">
            <div className="w-6 h-6 rounded-md bg-muted flex items-center justify-center">
              <Plus className="w-3 h-3 text-muted-foreground" />
            </div>
            <p className={k.muted}>SharePoint, S3, Confluence coming soon</p>
          </div>
        </div>
      </div>
    </div>
  );
}
