import { Plus, Minus, Equal } from "lucide-react";
import { cn } from "@hki/ui";
import { FONT_FAMILY } from "@hki/ui";
import type { DiffLine, DiffResponse } from "@shared/knowledge-types";

interface DiffViewerProps {
  diff: DiffResponse;
}

const LINE_STYLES: Record<
  string,
  { bg: string; border: string; icon: typeof Plus; text: string }
> = {
  added: {
    bg: "bg-primary/5 dark:bg-primary/8",
    border: "border-l-primary",
    icon: Plus,
    text: "text-primary",
  },
  removed: {
    bg: "bg-red-500/5 dark:bg-red-500/8",
    border: "border-l-red-500",
    icon: Minus,
    text: "text-red-700 dark:text-red-300",
  },
  unchanged: {
    bg: "",
    border: "border-l-transparent",
    icon: Equal,
    text: "text-muted-foreground dark:text-muted-foreground",
  },
};

export default function DiffViewer({ diff }: DiffViewerProps) {
  const { lines, stats } = diff;

  return (
    <div className="space-y-3">
      {/* Stats bar */}
      <div className="flex items-center gap-4 text-xs">
        <span className="flex items-center gap-1 text-primary dark:text-primary font-semibold">
          <Plus className="w-3 h-3" /> {stats.addedCount} added
        </span>
        <span className="flex items-center gap-1 text-red-600 dark:text-red-400 font-semibold">
          <Minus className="w-3 h-3" /> {stats.removedCount} removed
        </span>
        <span className="flex items-center gap-1 text-muted-foreground/60">
          <Equal className="w-3 h-3" /> {stats.unchangedCount} unchanged
        </span>

        {/* Visual change bar */}
        {stats.addedCount + stats.removedCount + stats.unchangedCount > 0 && (
          <div className="flex items-center h-2 rounded-full overflow-hidden flex-1 max-w-32 bg-muted/60 dark:bg-muted/60">
            <div
              className="h-full bg-primary"
              style={{
                width: `${(stats.addedCount / (stats.addedCount + stats.removedCount + stats.unchangedCount)) * 100}%`,
              }}
            />
            <div
              className="h-full bg-red-500"
              style={{
                width: `${(stats.removedCount / (stats.addedCount + stats.removedCount + stats.unchangedCount)) * 100}%`,
              }}
            />
          </div>
        )}
      </div>

      {/* Diff lines */}
      {lines.length === 0 ? (
        <div className="text-center py-8 text-xs text-muted-foreground/60">
          No differences found
        </div>
      ) : (
        <div
          className="rounded-xl border border-border/30 dark:border-border/30 overflow-hidden max-h-96 overflow-y-auto"
          style={{ fontFamily: FONT_FAMILY.mono }}
        >
          {lines.map((line: DiffLine, i: number) => {
            const style = LINE_STYLES[line.type] ?? LINE_STYLES.unchanged;
            return (
              <div
                key={i}
                className={cn(
                  "flex items-start border-l-2 text-[11px] leading-5",
                  style.bg,
                  style.border
                )}
              >
                {/* Line number gutter */}
                <span className="w-10 shrink-0 text-right pr-2 py-0.5 text-xs text-muted-foreground/60 select-none">
                  {line.lineNumber ?? ""}
                </span>

                {/* Diff marker */}
                <span
                  className={cn(
                    "w-5 shrink-0 text-center py-0.5 select-none",
                    style.text
                  )}
                >
                  {line.type === "added"
                    ? "+"
                    : line.type === "removed"
                      ? "-"
                      : " "}
                </span>

                {/* Content */}
                <span
                  className={cn(
                    "flex-1 py-0.5 pr-3 whitespace-pre-wrap break-all",
                    style.text
                  )}
                >
                  {line.content || "\u00A0"}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
