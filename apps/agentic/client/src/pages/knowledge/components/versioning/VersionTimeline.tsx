import { GitCommitVertical, Plus, Pencil, Minus, Hash } from "lucide-react";
import { cn } from "@hki/ui";
import { FONT_FAMILY } from "@hki/ui";
import type { DocumentVersion } from "@shared/knowledge-types";

interface VersionTimelineProps {
  versions: DocumentVersion[];
  selectedId?: string;
  onSelect: (version: DocumentVersion) => void;
}

const CHANGE_ICON: Record<string, typeof Plus> = {
  new: Plus,
  modified: Pencil,
  unchanged: Minus,
};

const CHANGE_COLOR: Record<string, string> = {
  new: "text-primary bg-primary/10",
  modified: "text-primary bg-primary/10",
  unchanged: "text-muted-foreground bg-muted/60",
};

export default function VersionTimeline({
  versions,
  selectedId,
  onSelect,
}: VersionTimelineProps) {
  if (!versions.length) {
    return (
      <div className="text-center py-8">
        <GitCommitVertical className="w-6 h-6 text-muted-foreground/40 mx-auto mb-2" />
        <p className="text-xs text-muted-foreground/60">
          No version history yet
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Vertical connector line */}
      <div className="absolute left-4 top-6 bottom-6 w-px bg-muted dark:bg-muted" />

      <div className="space-y-1">
        {versions.map((v, i) => {
          const Icon = CHANGE_ICON[v.changeType] ?? Hash;
          const colorCls = CHANGE_COLOR[v.changeType] ?? CHANGE_COLOR.unchanged;
          const isSelected = v.id === selectedId;
          const date = new Date(v.createdAt);

          return (
            <button
              key={v.id}
              type="button"
              onClick={() => onSelect(v)}
              className={cn(
                "w-full flex items-start gap-3 px-2 py-2.5 rounded-xl text-left transition-colors relative",
                isSelected
                  ? "bg-primary/8 border border-primary/20"
                  : "hover:bg-muted/60 dark:hover:bg-card border border-transparent"
              )}
            >
              {/* Icon dot */}
              <div
                className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-full shrink-0 z-10",
                  colorCls
                )}
              >
                <Icon className="w-3.5 h-3.5" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-foreground">
                    v{v.version}
                  </span>
                  <span
                    className={cn(
                      "px-1.5 py-0.5 text-xs font-semibold rounded uppercase tracking-wider",
                      colorCls
                    )}
                  >
                    {v.changeType}
                  </span>
                  {i === 0 && (
                    <span className="px-1.5 py-0.5 text-xs font-semibold rounded kb-duotone-fill uppercase tracking-wider">
                      latest
                    </span>
                  )}
                </div>

                {v.diffSummary && (
                  <p className="text-xs text-muted-foreground dark:text-muted-foreground mt-0.5 truncate">
                    {v.diffSummary}
                  </p>
                )}

                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-muted-foreground/60">
                    {date.toLocaleDateString()}{" "}
                    {date.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span
                    className="text-xs text-muted-foreground/60"
                    style={{ fontFamily: FONT_FAMILY.mono }}
                  >
                    {v.fingerprint.wordCount.toLocaleString()} words
                  </span>
                  <span
                    className="text-xs text-muted-foreground/60"
                    style={{ fontFamily: FONT_FAMILY.mono }}
                  >
                    {v.fingerprint.sha256.slice(0, 8)}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
