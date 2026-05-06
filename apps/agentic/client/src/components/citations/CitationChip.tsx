/**
 * Evidence Citation Component
 * Inline citation chips with source previews and reliability scores
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Shield,
  Calendar,
  User,
  Hash,
  X,
} from "lucide-react";
import { cn } from "@hki/ui";

/* ── Types ────────────────────────────────────────────────────── */

export interface Citation {
  id: string;
  index: number;
  source: string;
  title: string;
  url?: string;
  excerpt: string;
  reliability: "high" | "medium" | "low";
  timestamp?: Date;
  author?: string;
  documentType?: string;
  chunkId?: string;
}

interface CitationChipProps {
  citation: Citation;
  inline?: boolean;
}

interface CitationPopupProps {
  citation: Citation;
  isOpen: boolean;
  onClose: () => void;
  position?: { x: number; y: number };
}

/* ── Reliability Config ───────────────────────────────────────── */

const RELIABILITY_CONFIG = {
  high: {
    icon: CheckCircle2,
    label: "High Confidence",
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/20",
  },
  medium: {
    icon: AlertTriangle,
    label: "Medium Confidence",
    color: "text-primary",
    bgColor: "bg-primary/10",
    borderColor: "border-primary/20",
  },
  low: {
    icon: XCircle,
    label: "Low Confidence",
    color: "text-red-500",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/20",
  },
};

/* ── Citation Chip ────────────────────────────────────────────── */

export function CitationChip({ citation, inline = true }: CitationChipProps) {
  const [showPopup, setShowPopup] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const config = RELIABILITY_CONFIG[citation.reliability];
  const ReliabilityIcon = config.icon;

  const handleClick = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setPosition({ x: rect.left, y: rect.bottom + 8 });
    setShowPopup(true);
  };

  return (
    <>
      <button
        onClick={handleClick}
        className={cn(
          "inline-flex items-center gap-1 rounded-md transition-all cursor-pointer",
          inline
            ? "px-1.5 py-0.5 text-[10px] font-semibold"
            : "px-2.5 py-1.5 text-xs font-medium",
          config.bgColor,
          config.color,
          "hover:ring-2 hover:ring-offset-1",
          config.borderColor.replace("border-", "hover:ring-")
        )}
      >
        <FileText className={cn(inline ? "w-2.5 h-2.5" : "w-3 h-3")} />
        {citation.index}
      </button>

      <CitationPopup
        citation={citation}
        isOpen={showPopup}
        onClose={() => setShowPopup(false)}
        position={position}
      />
    </>
  );
}

/* ── Citation Popup ───────────────────────────────────────────── */

function CitationPopup({
  citation,
  isOpen,
  onClose,
  position,
}: CitationPopupProps) {
  const config = RELIABILITY_CONFIG[citation.reliability];
  const ReliabilityIcon = config.icon;

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-40"
      />

      {/* Popup */}
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -4 }}
          transition={{ duration: 0.15 }}
          style={{
            position: "fixed",
            left: position?.x || 0,
            top: position?.y || 0,
            zIndex: 50,
          }}
          className="w-96 max-w-[calc(100vw-2rem)]"
        >
          <div className="rounded-xl border shadow-xl bg-card border-black/[0.08] dark:border-white/[0.08] overflow-hidden">
            {/* Header */}
            <div className="flex items-start gap-3 p-4 border-b border-black/[0.06] dark:border-white/[0.06]">
              <div
                className={cn(
                  "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
                  config.bgColor
                )}
              >
                <FileText className={cn("w-4 h-4", config.color)} />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-foreground leading-tight">
                  {citation.title}
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {citation.source}
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-1 rounded-lg hover:bg-black/[0.05] dark:hover:bg-white/[0.05] transition-colors shrink-0"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {/* Reliability Badge */}
            <div className="p-4 border-b border-black/[0.04] dark:border-white/[0.04]">
              <div
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg border",
                  config.bgColor,
                  config.borderColor
                )}
              >
                <ReliabilityIcon className={cn("w-4 h-4", config.color)} />
                <div className="flex-1">
                  <p className={cn("text-xs font-semibold", config.color)}>
                    {config.label}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {citation.reliability === "high" &&
                      "This source is highly reliable and verified"}
                    {citation.reliability === "medium" &&
                      "This source is generally reliable but may need verification"}
                    {citation.reliability === "low" &&
                      "This source should be verified from additional sources"}
                  </p>
                </div>
              </div>
            </div>

            {/* Excerpt */}
            <div className="p-4 border-b border-black/[0.04] dark:border-white/[0.04]">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 block">
                Excerpt
              </label>
              <p className="text-xs text-foreground leading-relaxed">
                "{citation.excerpt}"
              </p>
            </div>

            {/* Metadata */}
            <div className="p-4 space-y-2">
              {citation.author && (
                <div className="flex items-center gap-2 text-xs">
                  <User className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="font-medium text-foreground">
                    {citation.author}
                  </span>
                </div>
              )}
              {citation.timestamp && (
                <div className="flex items-center gap-2 text-xs">
                  <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    {citation.timestamp.toLocaleDateString()}
                  </span>
                </div>
              )}
              {citation.documentType && (
                <div className="flex items-center gap-2 text-xs">
                  <Shield className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground capitalize">
                    {citation.documentType}
                  </span>
                </div>
              )}
              {citation.chunkId && (
                <div className="flex items-center gap-2 text-xs">
                  <Hash className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground font-mono text-[10px]">
                    {citation.chunkId}
                  </span>
                </div>
              )}
            </div>

            {/* Actions */}
            {citation.url && (
              <div className="p-4 border-t border-black/[0.06] dark:border-white/[0.06]">
                <a
                  href={citation.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  View Source
                </a>
              </div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </>
  );
}

/* ── Citations List ───────────────────────────────────────────── */

interface CitationsListProps {
  citations: Citation[];
  title?: string;
}

export function CitationsList({
  citations,
  title = "Sources & Citations",
}: CitationsListProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      <div className="space-y-2">
        {citations.map(citation => (
          <div
            key={citation.id}
            className="flex items-start gap-3 p-3 rounded-lg bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.04] dark:border-white/[0.04]"
          >
            <CitationChip citation={citation} inline={false} />
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-semibold text-foreground truncate">
                {citation.title}
              </h4>
              <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                {citation.source}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default CitationChip;
