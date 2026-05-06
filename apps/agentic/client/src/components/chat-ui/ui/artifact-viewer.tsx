/**
 * ArtifactViewer - Agent-Generated Artifact Display
 *
 * Displays files, code, and other artifacts produced by the agent with:
 * - File type icons
 * - Syntax-highlighted code preview
 * - Download/copy actions
 * - CSS variable theming
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  FileCode,
  FileImage,
  FileJson,
  File,
  Download,
  Copy,
  Check,
  ChevronDown,
  ExternalLink,
  Eye,
  EyeOff,
} from "lucide-react";

// ============================================================================
// TYPES
// ============================================================================

export type ArtifactType =
  | "code"
  | "text"
  | "image"
  | "json"
  | "markdown"
  | "file";

export interface Artifact {
  id: string;
  name: string;
  type: ArtifactType;
  content?: string;
  language?: string; // for code
  url?: string; // for downloadable files
  size?: number; // in bytes
  createdAt?: string;
}

export interface ArtifactViewerProps {
  artifact: Artifact;
  isExpanded?: boolean;
  onOpen?: (artifact: Artifact) => void;
  className?: string;
}

// ============================================================================
// CONFIG
// ============================================================================

const typeConfig = {
  code: {
    icon: FileCode,
    color: "var(--primary)",
    label: "Code",
  },
  text: {
    icon: FileText,
    color: "var(--muted-foreground)",
    label: "Text",
  },
  image: {
    icon: FileImage,
    color: "var(--success, #16a34a)",
    label: "Image",
  },
  json: {
    icon: FileJson,
    color: "var(--primary)",
    label: "JSON",
  },
  markdown: {
    icon: FileText,
    color: "var(--info, #0284c7)",
    label: "Markdown",
  },
  file: {
    icon: File,
    color: "var(--muted-foreground)",
    label: "File",
  },
};

// ============================================================================
// HELPERS
// ============================================================================

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ArtifactViewer({
  artifact,
  isExpanded: defaultExpanded = false,
  onOpen,
  className = "",
}: ArtifactViewerProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(true);

  const config = typeConfig[artifact.type];
  const Icon = config.icon;

  const handleCopy = async () => {
    if (artifact.content) {
      try {
        await navigator.clipboard.writeText(artifact.content);
      } catch {
        console.warn("[Clipboard] writeText failed");
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    if (artifact.url) {
      window.open(artifact.url, "_blank");
    } else if (artifact.content) {
      const blob = new Blob([artifact.content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = artifact.name;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border overflow-hidden ${className}`}
      style={{
        background: "var(--card)",
        borderColor: "var(--border)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 p-3"
        style={{
          background: "color-mix(in srgb, var(--muted) 30%, transparent)",
          borderBottom: isExpanded ? "1px solid var(--border)" : "none",
        }}
      >
        {/* Icon */}
        <div
          className="flex items-center justify-center w-8 h-8 rounded-xl shrink-0"
          style={{
            background: `color-mix(in srgb, ${config.color} 15%, transparent)`,
          }}
        >
          <Icon className="w-4 h-4" style={{ color: config.color }} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h4
            className="text-sm font-medium truncate"
            style={{ color: "var(--foreground)" }}
          >
            {artifact.name}
          </h4>
          <div
            className="flex items-center gap-2 text-xs"
            style={{ color: "var(--muted-foreground)" }}
          >
            <span>{config.label}</span>
            {artifact.language && (
              <>
                <span>•</span>
                <span className="uppercase">{artifact.language}</span>
              </>
            )}
            {artifact.size !== undefined && (
              <>
                <span>•</span>
                <span>{formatFileSize(artifact.size)}</span>
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {artifact.content && (
            <>
              <motion.button
                type="button"
                onClick={() => setShowPreview(!showPreview)}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="p-1.5 rounded-lg transition-colors"
                style={{
                  color: "var(--muted-foreground)",
                  background: showPreview
                    ? "color-mix(in srgb, var(--muted) 50%, transparent)"
                    : "transparent",
                }}
                title={showPreview ? "Hide preview" : "Show preview"}
              >
                {showPreview ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </motion.button>
              <motion.button
                type="button"
                onClick={handleCopy}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="p-1.5 rounded-lg transition-colors"
                style={{
                  color: copied
                    ? "var(--success, #16a34a)"
                    : "var(--muted-foreground)",
                }}
                title="Copy content"
              >
                {copied ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </motion.button>
            </>
          )}
          <motion.button
            type="button"
            onClick={handleDownload}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: "var(--muted-foreground)" }}
            title="Download"
          >
            <Download className="w-4 h-4" />
          </motion.button>
          {onOpen && (
            <motion.button
              type="button"
              onClick={() => onOpen(artifact)}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: "var(--primary)" }}
              title="Open"
            >
              <ExternalLink className="w-4 h-4" />
            </motion.button>
          )}
        </div>
      </div>

      {/* Content Preview */}
      <AnimatePresence>
        {showPreview && artifact.content && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <pre
              className="p-3 text-xs font-mono overflow-x-auto max-h-48"
              style={{
                background: "color-mix(in srgb, var(--muted) 20%, transparent)",
                color: "var(--foreground)",
              }}
            >
              {artifact.content.slice(0, 500)}
              {artifact.content.length > 500 && (
                <span style={{ color: "var(--muted-foreground)" }}>
                  {"\n\n"}... {artifact.content.length - 500} more characters
                </span>
              )}
            </pre>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Image Preview */}
      {artifact.type === "image" && artifact.url && (
        <div className="p-3">
          <img
            src={artifact.url}
            alt={artifact.name}
            className="max-w-full h-auto rounded-lg"
            style={{ maxHeight: 200 }}
          />
        </div>
      )}
    </motion.div>
  );
}

// ============================================================================
// ARTIFACT LIST
// ============================================================================

export function ArtifactList({
  artifacts,
  onOpen,
  className = "",
}: {
  artifacts: Artifact[];
  onOpen?: (artifact: Artifact) => void;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className}`}>
      <h4
        className="text-xs font-semibold uppercase tracking-wide mb-2"
        style={{ color: "var(--muted-foreground)" }}
      >
        Generated Artifacts ({artifacts.length})
      </h4>
      {artifacts.map((artifact, index) => (
        <motion.div
          key={artifact.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
        >
          <ArtifactViewer artifact={artifact} onOpen={onOpen} />
        </motion.div>
      ))}
    </div>
  );
}
