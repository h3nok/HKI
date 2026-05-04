import { useState } from "react";
import { motion } from "framer-motion";
import {
  BookOpen,
  Database,
  ExternalLink,
  FileText,
  Globe,
  Library,
  Quote,
} from "lucide-react";
import { useLocation } from "wouter";
import { Badge as PrimitiveBadge, Button, cn } from "@hki/ui";
import {
  buildKnowledgeLibraryHref,
  openKnowledgeWorkspaceWindow,
  prepareKnowledgeLibraryNavigation,
} from "@/_core/workspace-navigation";
import { Badge as DetailBadge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { BRAND } from "@/design-system/tokens";

export type SourceType = "document" | "database" | "web" | "knowledge_base";

export interface Evidence {
  id: string;
  type: SourceType;
  title: string;
  snippet: string;
  url?: string;
  confidence: number;
  timestamp?: string;
  metadata?: {
    author?: string;
    date?: string;
    category?: string;
    section?: string;
    documentId?: string;
    chunkId?: string;
    [key: string]: unknown;
  };
}

export interface EvidenceChipProps {
  evidence: Evidence;
  index: number;
  onClick?: () => void;
  canViewLibrary?: boolean;
  libraryScopeId?: string | null;
}

const sourceIcons = {
  document: FileText,
  database: Database,
  web: Globe,
  knowledge_base: BookOpen,
};

const sourceStyles = {
  document: {
    ink: BRAND.blue[700],
    border: `color-mix(in srgb, ${BRAND.blue[500]} 18%, var(--border))`,
    chipBackground: `linear-gradient(180deg, color-mix(in srgb, ${BRAND.blue[500]} 7%, var(--card)) 0%, color-mix(in srgb, var(--card) 96%, ${BRAND.blue[500]} 4%) 100%)`,
    panelBackground: `linear-gradient(135deg, color-mix(in srgb, ${BRAND.blue[500]} 10%, var(--card)) 0%, color-mix(in srgb, ${BRAND.blue[500]} 4%, var(--card)) 100%)`,
  },
  database: {
    ink: "#0f766e",
    border: "color-mix(in srgb, #0f766e 18%, var(--border))",
    chipBackground:
      "linear-gradient(180deg, color-mix(in srgb, #0f766e 7%, var(--card)) 0%, color-mix(in srgb, var(--card) 96%, #0f766e 4%) 100%)",
    panelBackground:
      "linear-gradient(135deg, color-mix(in srgb, #0f766e 10%, var(--card)) 0%, color-mix(in srgb, #0f766e 4%, var(--card)) 100%)",
  },
  web: {
    ink: BRAND.red[600],
    border: `color-mix(in srgb, ${BRAND.red[500]} 18%, var(--border))`,
    chipBackground: `linear-gradient(180deg, color-mix(in srgb, ${BRAND.red[500]} 7%, var(--card)) 0%, color-mix(in srgb, var(--card) 96%, ${BRAND.red[500]} 4%) 100%)`,
    panelBackground: `linear-gradient(135deg, color-mix(in srgb, ${BRAND.red[500]} 10%, var(--card)) 0%, color-mix(in srgb, ${BRAND.red[500]} 4%, var(--card)) 100%)`,
  },
  knowledge_base: {
    ink: BRAND.blue[700],
    border: `color-mix(in srgb, ${BRAND.blue[500]} 18%, var(--border))`,
    chipBackground: `linear-gradient(180deg, color-mix(in srgb, ${BRAND.blue[500]} 8%, var(--card)) 0%, color-mix(in srgb, var(--card) 95%, ${BRAND.red[500]} 3%) 100%)`,
    panelBackground: `linear-gradient(135deg, color-mix(in srgb, ${BRAND.blue[500]} 12%, var(--card)) 0%, color-mix(in srgb, ${BRAND.red[500]} 7%, var(--card)) 100%)`,
  },
} as const;

function formatCitationIndex(index: number): string {
  return `[${index}]`;
}

function formatCitationRange(startIndex: number, endIndex: number): string {
  if (startIndex === endIndex) {
    return formatCitationIndex(startIndex);
  }

  return `[${startIndex}-${endIndex}]`;
}

function buildMetadataRows(evidence: Evidence) {
  const rows = [
    { label: "Section", value: evidence.metadata?.section },
    { label: "Author", value: evidence.metadata?.author },
    { label: "Date", value: evidence.metadata?.date },
    { label: "Document ID", value: evidence.metadata?.documentId },
    { label: "Chunk ID", value: evidence.metadata?.chunkId },
  ];

  return rows.filter(
    (row): row is { label: string; value: string } =>
      typeof row.value === "string" && row.value.trim().length > 0
  );
}

export function EvidenceChip({
  evidence,
  index,
  onClick,
  canViewLibrary = false,
  libraryScopeId,
}: EvidenceChipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [, setLocation] = useLocation();
  const SourceIcon = sourceIcons[evidence.type];
  const style = sourceStyles[evidence.type];
  const chipTextColor = `color-mix(in srgb, var(--foreground) 88%, ${style.ink} 12%)`;
  const roundedConfidence = Math.round(evidence.confidence);
  const metadataRows = buildMetadataRows(evidence);
  const category =
    typeof evidence.metadata?.category === "string"
      ? evidence.metadata.category.trim()
      : "";
  const documentId = evidence.metadata?.documentId;
  const libraryHref = buildKnowledgeLibraryHref(libraryScopeId);
  const canOpenLibrary = Boolean(canViewLibrary && documentId);

  const handleChipClick = () => {
    setIsOpen(true);
    onClick?.();
  };

  const handleViewLibrary = () => {
    if (!documentId) {
      return;
    }

    prepareKnowledgeLibraryNavigation(documentId);
    setIsOpen(false);

    const knowledgeWindow = openKnowledgeWorkspaceWindow(libraryHref);
    if (!knowledgeWindow) {
      setLocation(libraryHref);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <motion.button
          type="button"
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleChipClick}
          className="max-w-full"
          aria-label={`Open citation ${formatCitationIndex(index)} for ${evidence.title}`}
        >
          <PrimitiveBadge
            variant="outline"
            className={cn(
              "max-w-full shrink-0 cursor-pointer justify-center rounded-full px-2 py-0.5 text-[10px] font-bold normal-case tracking-normal shadow-none tabular-nums",
              "transition-all duration-200 hover:shadow-sm hover:brightness-[0.97]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
            )}
            style={{
              background: style.chipBackground,
              borderColor: style.border,
              color: chipTextColor,
            }}
          >
            <span className="leading-none">{formatCitationIndex(index)}</span>
          </PrimitiveBadge>
        </motion.button>
      </PopoverTrigger>

      <PopoverContent
        className="w-96 max-w-[calc(100vw-1rem)] overflow-hidden rounded-2xl border p-0"
        align="center"
        side="top"
        sideOffset={10}
        collisionPadding={{ top: 16, right: 16, bottom: 112, left: 16 }}
      >
        <div
          className="border-b px-4 py-4"
          style={{
            background: style.panelBackground,
            borderColor: style.border,
          }}
        >
          <p
            className="text-[10px] font-semibold uppercase tracking-[0.2em]"
            style={{ color: style.ink }}
          >
            {evidence.type === "knowledge_base"
              ? "Knowledge Citation"
              : "Source Citation"}
          </p>
          <div className="mt-2 flex items-start gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
              style={{
                background: `color-mix(in srgb, ${style.ink} 14%, transparent)`,
              }}
            >
              <SourceIcon className="h-4 w-4" style={{ color: style.ink }} />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="line-clamp-2 text-sm font-semibold text-foreground">
                {evidence.title}
              </h4>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <DetailBadge
                  variant="outline"
                  className="capitalize"
                  style={{
                    borderColor: style.border,
                    color: style.ink,
                    background: "transparent",
                  }}
                >
                  {evidence.type.replace("_", " ")}
                </DetailBadge>
                {roundedConfidence > 0 ? (
                  <span className="text-xs font-medium text-muted-foreground">
                    {roundedConfidence}% evidence match
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4 px-4 py-4">
          <div
            className="rounded-xl border px-3 py-3"
            style={{
              borderColor: `color-mix(in srgb, ${style.ink} 16%, var(--border))`,
              background:
                "linear-gradient(180deg, color-mix(in srgb, var(--card) 96%, white 4%) 0%, var(--card) 100%)",
            }}
          >
            <div className="flex items-start gap-2">
              <Quote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <p className="text-sm leading-relaxed text-foreground">
                {evidence.snippet}
              </p>
            </div>
          </div>

          {metadataRows.length > 0 || category ? (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Source Details
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {metadataRows.map(row => (
                  <div
                    key={`${evidence.id}-${row.label}`}
                    className="rounded-xl border px-3 py-2"
                    style={{
                      borderColor: `color-mix(in srgb, ${style.ink} 12%, var(--border))`,
                    }}
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      {row.label}
                    </p>
                    <p className="mt-1 break-all text-xs font-medium text-foreground">
                      {row.value}
                    </p>
                  </div>
                ))}
                {category ? (
                  <div
                    className="rounded-xl border px-3 py-2"
                    style={{
                      borderColor: `color-mix(in srgb, ${style.ink} 12%, var(--border))`,
                    }}
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Category
                    </p>
                    <p className="mt-1 text-xs font-medium text-foreground">
                      {category}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {canOpenLibrary || evidence.url ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              {canOpenLibrary ? (
                <Button
                  size="sm"
                  className="w-full sm:flex-1"
                  style={{
                    background: BRAND.blue[600],
                    borderColor: BRAND.blue[600],
                    color: "white",
                  }}
                  onClick={handleViewLibrary}
                >
                  <Library className="mr-2 h-3.5 w-3.5" />
                  View in Library
                </Button>
              ) : null}
              {evidence.url ? (
                <Button
                  variant={canOpenLibrary ? "outline" : "default"}
                  size="sm"
                  className="w-full sm:flex-1"
                  onClick={() =>
                    window.open(evidence.url, "_blank", "noopener,noreferrer")
                  }
                >
                  <ExternalLink className="mr-2 h-3.5 w-3.5" />
                  View Source
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export interface EvidenceListProps {
  evidences: Evidence[];
  onEvidenceClick?: (evidence: Evidence) => void;
  canViewLibrary?: boolean;
  libraryScopeId?: string | null;
}

const MAX_INLINE_EVIDENCE_CHIPS = 5;

function HiddenEvidenceSummary({
  evidences,
  canViewLibrary,
  libraryScopeId,
  startIndex,
}: {
  evidences: Evidence[];
  canViewLibrary: boolean;
  libraryScopeId?: string | null;
  startIndex: number;
}) {
  const [, setLocation] = useLocation();
  const hiddenCount = evidences.length;
  const endIndex = startIndex + hiddenCount - 1;

  const openLibraryForEvidence = (documentId?: string) => {
    if (!documentId) {
      return;
    }

    prepareKnowledgeLibraryNavigation(documentId);
    const knowledgeWindow = openKnowledgeWorkspaceWindow(
      buildKnowledgeLibraryHref(libraryScopeId)
    );

    if (!knowledgeWindow) {
      setLocation(buildKnowledgeLibraryHref(libraryScopeId));
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Show citations ${formatCitationRange(startIndex, endIndex)}`}
        >
          <PrimitiveBadge
            variant="outline"
            className="shrink-0 cursor-pointer rounded-full px-1.5 py-0.5 text-[9px] font-semibold normal-case tracking-normal shadow-none tabular-nums"
          >
            <span className="leading-none">
              {formatCitationRange(startIndex, endIndex)}
            </span>
          </PrimitiveBadge>
        </button>
      </PopoverTrigger>

      <PopoverContent
        side="top"
        align="start"
        sideOffset={10}
        className="w-80 max-w-[calc(100vw-1rem)] rounded-2xl p-0 overflow-hidden"
      >
        <div className="border-b px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            More Citations
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {hiddenCount} additional source{hiddenCount === 1 ? "" : "s"}
          </p>
        </div>

        <div className="max-h-80 space-y-2 overflow-y-auto px-3 py-3">
          {evidences.map((evidence, index) => {
            const roundedConfidence = Math.round(evidence.confidence);
            const documentId = evidence.metadata?.documentId;
            const citationIndex = startIndex + index;

            return (
              <div
                key={`${evidence.id}-hidden-${index}`}
                className="rounded-xl border px-3 py-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-foreground">
                      {formatCitationIndex(citationIndex)} {evidence.title}
                    </p>
                    <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                      {evidence.snippet}
                    </p>
                  </div>
                  {roundedConfidence > 0 ? (
                    <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold tabular-nums text-muted-foreground">
                      {roundedConfidence}%
                    </span>
                  ) : null}
                </div>

                {(evidence.url || (canViewLibrary && documentId)) && (
                  <div className="mt-2 flex items-center gap-2">
                    {canViewLibrary && documentId ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-[10px]"
                        onClick={() => openLibraryForEvidence(documentId)}
                      >
                        <Library className="mr-1 h-3 w-3" />
                        Library
                      </Button>
                    ) : null}
                    {evidence.url ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-[10px]"
                        onClick={() =>
                          window.open(
                            evidence.url,
                            "_blank",
                            "noopener,noreferrer"
                          )
                        }
                      >
                        <ExternalLink className="mr-1 h-3 w-3" />
                        Source
                      </Button>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function EvidenceList({
  evidences,
  onEvidenceClick,
  canViewLibrary = false,
  libraryScopeId,
}: EvidenceListProps) {
  if (evidences.length === 0) return null;

  const visibleEvidences = evidences.slice(0, MAX_INLINE_EVIDENCE_CHIPS);
  const hiddenEvidences = evidences.slice(MAX_INLINE_EVIDENCE_CHIPS);

  return (
    <div className="inline-flex flex-nowrap items-center gap-1.5">
      {visibleEvidences.map((evidence, index) => (
        <EvidenceChip
          key={`${evidence.id}-${index}`}
          evidence={evidence}
          index={index + 1}
          onClick={() => onEvidenceClick?.(evidence)}
          canViewLibrary={canViewLibrary}
          libraryScopeId={libraryScopeId}
        />
      ))}
      {hiddenEvidences.length > 0 ? (
        <HiddenEvidenceSummary
          evidences={hiddenEvidences}
          canViewLibrary={canViewLibrary}
          libraryScopeId={libraryScopeId}
          startIndex={visibleEvidences.length + 1}
        />
      ) : null}
    </div>
  );
}
