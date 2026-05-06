import { useState, useCallback, useRef } from "react";
import {
  Upload,
  FileText,
  X,
  CheckCircle,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { Badge, cn } from "@hki/ui";
import type { PreIngestAnalysis } from "@shared/knowledge-types";

const ACCEPTED_EXTENSIONS = ["pdf", "docx", "txt", "csv", "md", "markdown"];
const ACCEPTED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/csv",
  "text/markdown",
];
const DEFAULT_MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB default (platform cap)

export interface FileMetadata {
  title?: string;
  department?: string;
  documentType?: string;
  tags?: string;
}

export type FileAnalysisStatus =
  | "pending"
  | "analyzing"
  | "passed"
  | "flagged"
  | "rejected"
  | "error";

export interface SelectedFile {
  id: string;
  file: File;
  base64: string;
  status: "ready" | "uploading" | "success" | "error";
  error?: string;
  metadata?: FileMetadata;
  /** Per-file pre-ingest analysis status */
  analysisStatus?: FileAnalysisStatus;
  /** Per-file pre-ingest analysis result */
  analysis?: PreIngestAnalysis;
  /** Short reason for flagged/rejected status */
  analysisNote?: string;
}

interface FileDropZoneProps {
  files: SelectedFile[];
  onFilesSelected: (files: SelectedFile[]) => void;
  onRemoveFile: (index: number) => void;
  disabled?: boolean;
  maxFileSizeBytes?: number;
  /** When true, the drop zone won't render its internal file list (use external list instead) */
  hideFileList?: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip the data URL prefix (e.g. "data:application/pdf;base64,")
      const base64 = result.split(",")[1] || "";
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function validateFile(file: File, maxFileSizeBytes: number): string | null {
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  if (!ACCEPTED_EXTENSIONS.includes(ext)) {
    return `Unsupported file type: .${ext}. Allowed: ${ACCEPTED_EXTENSIONS.join(", ")}`;
  }
  if (file.size > maxFileSizeBytes) {
    return `File too large: ${formatFileSize(file.size)} (max ${formatFileSize(maxFileSizeBytes)})`;
  }
  return null;
}

function createSelectedFileId(file: File): string {
  const seed = `${file.name}-${file.size}-${file.lastModified}`;
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${seed}-${crypto.randomUUID()}`;
  }
  return `${seed}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function FileDropZone({
  files,
  onFilesSelected,
  onRemoveFile,
  disabled,
  maxFileSizeBytes = DEFAULT_MAX_FILE_SIZE,
  hideFileList,
}: FileDropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const incoming = Array.from(fileList);
      const results: SelectedFile[] = [];

      // Build a set of existing files (name + size) for duplicate detection
      const existingKeys = new Set(
        files.map(f => `${f.file.name}::${f.file.size}`)
      );

      for (const file of incoming) {
        const error = validateFile(file, maxFileSizeBytes);
        if (error) {
          results.push({
            id: createSelectedFileId(file),
            file,
            base64: "",
            status: "error",
            error,
          });
        } else if (existingKeys.has(`${file.name}::${file.size}`)) {
          results.push({
            id: createSelectedFileId(file),
            file,
            base64: "",
            status: "error",
            error: `"${file.name}" is already in the upload queue`,
          });
        } else {
          try {
            const base64 = await fileToBase64(file);
            existingKeys.add(`${file.name}::${file.size}`);
            results.push({
              id: createSelectedFileId(file),
              file,
              base64,
              status: "ready",
            });
          } catch {
            results.push({
              id: createSelectedFileId(file),
              file,
              base64: "",
              status: "error",
              error: "Failed to read file",
            });
          }
        }
      }

      onFilesSelected(results);
    },
    [files, maxFileSizeBytes, onFilesSelected]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (!disabled && e.dataTransfer.files.length) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [disabled, handleFiles]
  );

  const onDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!disabled) setIsDragOver(true);
    },
    [disabled]
  );

  const onDragLeave = useCallback(() => setIsDragOver(false), []);

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.length) {
        handleFiles(e.target.files);
        e.target.value = "";
      }
    },
    [handleFiles]
  );

  const StatusIcon = ({ status }: { status: SelectedFile["status"] }) => {
    switch (status) {
      case "uploading":
        return <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />;
      case "success":
        return <CheckCircle className="w-3.5 h-3.5 text-primary" />;
      case "error":
        return <AlertTriangle className="w-3.5 h-3.5 text-red-500" />;
      default:
        return <FileText className="w-3.5 h-3.5 text-muted-foreground/60" />;
    }
  };

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => !disabled && inputRef.current?.click()}
        className={cn(
          "relative flex flex-col items-center justify-center gap-3 px-8 py-10 rounded-2xl border border-dashed cursor-pointer transition-all",
          isDragOver
            ? "border-primary/40 bg-primary/5"
            : "border-border/30 bg-muted/10 kb-duotone-border-hover kb-duotone-bg-hover-soft",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <div className="absolute inset-x-6 top-0 h-px bg-primary/20" />
        <div
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-2xl transition-colors",
            isDragOver
              ? "bg-primary/15 text-primary"
              : "bg-muted/60 text-muted-foreground/70"
          )}
        >
          <Upload className="h-5 w-5" />
        </div>
        <div className="space-y-1 text-center">
          <p className="text-sm font-semibold text-foreground">
            {isDragOver ? "Drop files here" : "Drag & drop files here"}
          </p>
          <p className="text-xs text-muted-foreground">
            or <span className="font-medium text-primary">browse</span> to
            select from your device
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Badge
            variant="outline"
            className="border-border/30 bg-muted/20 text-xs"
          >
            PDF, DOCX, TXT, CSV, MD
          </Badge>
          <Badge
            variant="outline"
            className="border-border/30 bg-muted/20 text-xs"
          >
            Max {formatFileSize(maxFileSizeBytes)}
          </Badge>
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED_MIME_TYPES.concat(
            ACCEPTED_EXTENSIONS.map(e => `.${e}`)
          ).join(",")}
          onChange={onInputChange}
          className="hidden"
        />
      </div>

      {/* File list — suppressed when parent renders its own queue */}
      {!hideFileList && files.length > 0 && (
        <div className="space-y-1.5">
          {files.map((f, i) => (
            <div
              key={`${f.file.name}-${i}`}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors",
                f.status === "error"
                  ? "border-red-500/20 bg-red-500/5"
                  : f.status === "success"
                    ? "border-primary/20 bg-primary/5"
                    : "border-border/30 dark:border-border/30 bg-card/90 dark:bg-card/90"
              )}
            >
              <StatusIcon status={f.status} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">
                  {f.file.name}
                </p>
                {f.error ? (
                  <p className="text-xs text-red-500">{f.error}</p>
                ) : (
                  <p className="text-xs text-muted-foreground/60">
                    {formatFileSize(f.file.size)} ·{" "}
                    {f.file.name.split(".").pop()?.toUpperCase()}
                  </p>
                )}
              </div>
              {f.status !== "uploading" && (
                <button
                  onClick={e => {
                    e.stopPropagation();
                    onRemoveFile(i);
                  }}
                  className="p-1 rounded text-muted-foreground/60 hover:text-red-500 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
