/**
 * TrustIndicator — Unified Confidence + Citation Surface
 *
 * A minimal ghost-button pill that matches the app's action-bar style
 * (muted text, no gradients, no custom colors). Expands into a rich
 * popover with confidence details and citation cards.
 *
 * Pill:   🛡 Grounded 85% · [1][2][3] ▾
 * Style:  text-muted-foreground, hover:text-primary — same as ActionBtn
 */

import { useCallback, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  BookOpen,
  ChevronDown,
  Database,
  ExternalLink,
  FileText,
  Globe,
  Library,
  Quote,
} from "lucide-react";
import { useLocation } from "wouter";
import { Button, cn } from "@hki/ui";
import {
  buildKnowledgeLibraryHref,
  openKnowledgeWorkspaceWindow,
  prepareKnowledgeLibraryNavigation,
} from "@/_core/workspace-navigation";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { confidenceConfig, getConfidenceLevel } from "./confidence-indicator";
import type { Evidence, SourceType } from "./evidence-chip";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const SOURCE_ICONS: Record<
  SourceType,
  React.ComponentType<{ className?: string; style?: React.CSSProperties }>
> = {
  document: FileText,
  database: Database,
  web: Globe,
  knowledge_base: BookOpen,
};

const BAR_SPRING = {
  duration: 0.5,
  ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
} as const;

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface TrustIndicatorProps {
  score: number;
  evidences: Evidence[];
  label?: string;
  explanation?: string;
  canViewLibrary?: boolean;
  libraryScopeId?: string | null;
  className?: string;
}

/* ------------------------------------------------------------------ */
/*  CitationCard — single evidence card                                */
/* ------------------------------------------------------------------ */

function CitationCard({
  evidence,
  index,
  canViewLibrary,
  onViewLibrary,
}: {
  evidence: Evidence;
  index: number;
  canViewLibrary: boolean;
  onViewLibrary: (documentId: string) => void;
}) {
  const SourceIcon = SOURCE_ICONS[evidence.type];
  const pct = Math.round(evidence.confidence);
  const docId = evidence.metadata?.documentId;
  const canOpen = canViewLibrary && Boolean(docId);

  return (
    <div
      className={cn(
        "group/cite rounded-lg border px-3 py-2.5",
        "transition-colors duration-150 hover:bg-muted/30"
      )}
    >
      {/* Title row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <SourceIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <p className="min-w-0 truncate text-xs font-semibold text-foreground">
            <span className="mr-1 inline-flex h-4 min-w-4 items-center justify-center rounded bg-muted px-1 text-[9px] font-bold tabular-nums text-muted-foreground">
              {index + 1}
            </span>
            {evidence.title}
          </p>
        </div>
        {pct > 0 && (
          <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold tabular-nums text-muted-foreground">
            {pct}%
          </span>
        )}
      </div>

      {/* Snippet */}
      {evidence.snippet && (
        <div className="mt-1.5 flex items-start gap-1.5 pl-7">
          <Quote className="mt-0.5 h-2.5 w-2.5 shrink-0 text-muted-foreground/40" />
          <p className="line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
            {evidence.snippet}
          </p>
        </div>
      )}

      {/* Actions — revealed on hover/focus */}
      {(canOpen || evidence.url) && (
        <div className="mt-2 flex items-center gap-1.5 pl-7 opacity-0 transition-opacity duration-150 group-hover/cite:opacity-100 focus-within:opacity-100">
          {canOpen && docId && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-6 px-2 text-[10px]"
              onClick={() => onViewLibrary(docId)}
            >
              <Library className="mr-1 h-3 w-3" />
              Library
            </Button>
          )}
          {evidence.url && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-6 px-2 text-[10px]"
              onClick={() =>
                window.open(evidence.url, "_blank", "noopener,noreferrer")
              }
            >
              <ExternalLink className="mr-1 h-3 w-3" />
              Source
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  TrustIndicator                                                     */
/* ------------------------------------------------------------------ */

export function TrustIndicator({
  score,
  evidences,
  label,
  explanation,
  canViewLibrary = false,
  libraryScopeId,
  className,
}: TrustIndicatorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [, setLocation] = useLocation();

  const level = getConfidenceLevel(score);
  const config = confidenceConfig[level];
  const Icon = config.icon;
  const roundedScore = Math.round(score);
  const displayLabel = label || config.label;
  const displayExplanation = explanation || config.description;

  const libraryHref = useMemo(
    () => buildKnowledgeLibraryHref(libraryScopeId),
    [libraryScopeId]
  );

  const openLibraryForEvidence = useCallback(
    (documentId: string) => {
      prepareKnowledgeLibraryNavigation(documentId);
      setIsOpen(false);
      const win = openKnowledgeWorkspaceWindow(libraryHref);
      if (!win) setLocation(libraryHref);
    },
    [libraryHref, setLocation]
  );

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      {/* ── Pill — ghost button, matches ActionBtn style ── */}
      <PopoverTrigger asChild>
        <button
          type="button"
          role="status"
          aria-label={`${displayLabel} ${roundedScore}%, ${evidences.length} citation${evidences.length === 1 ? "" : "s"}`}
          className={cn(
            "inline-flex items-center gap-1 rounded-md px-1.5 py-1",
            "text-[10px] font-medium tabular-nums text-muted-foreground/60",
            "transition-all duration-150",
            "hover:text-foreground hover:bg-muted/60",
            "focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50",
            className
          )}
        >
          <Icon className="h-3 w-3" />
          <span>{displayLabel}</span>
          <span className="font-semibold">{roundedScore}%</span>
          {evidences.length > 0 && (
            <>
              <span className="opacity-30">·</span>
              <span>
                {evidences.length} src{evidences.length === 1 ? "" : "s"}
              </span>
            </>
          )}
          <ChevronDown
            className={cn(
              "h-2.5 w-2.5 opacity-40 transition-transform duration-200",
              isOpen && "rotate-180"
            )}
          />
        </button>
      </PopoverTrigger>

      {/* ── Popover ── */}
      <PopoverContent
        side="top"
        align="end"
        sideOffset={8}
        className="w-80 max-w-[calc(100vw-1rem)] overflow-hidden rounded-xl border p-0"
        collisionPadding={{ top: 16, right: 16, bottom: 112, left: 16 }}
      >
        {/* Header */}
        <div className="border-b px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-[13px] font-semibold text-foreground">
                  {config.headline}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {evidences.length} source{evidences.length === 1 ? "" : "s"}{" "}
                  cited
                </p>
              </div>
            </div>
            <span className="text-lg font-bold tabular-nums text-foreground">
              {roundedScore}%
            </span>
          </div>

          {/* Grounding bar */}
          <div className="mt-3">
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <motion.div
                initial={{ width: 0 }}
                animate={{
                  width: `${Math.max(0, Math.min(score, 100))}%`,
                }}
                transition={BAR_SPRING}
                className="h-full rounded-full bg-primary"
              />
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="space-y-2.5 px-4 py-3">
          <p className="text-xs leading-relaxed text-muted-foreground">
            {displayExplanation}
          </p>

          <div className="rounded-lg border px-3 py-2">
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              <span className="font-semibold text-foreground">Tip: </span>
              {config.recommendation}
            </p>
          </div>
        </div>

        {/* Citations */}
        {evidences.length > 0 && (
          <div className="border-t px-4 py-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Cited Sources ({evidences.length})
            </p>
            <div className="max-h-60 space-y-1.5 overflow-y-auto">
              {evidences.map((ev, i) => (
                <CitationCard
                  key={ev.id}
                  evidence={ev}
                  index={i}
                  canViewLibrary={canViewLibrary}
                  onViewLibrary={openLibraryForEvidence}
                />
              ))}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
