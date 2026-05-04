/**
 * StreamSwitcher — Dropdown for switching between value streams.
 *
 * Used in chat header and knowledge sidebar.
 * Reads from useScope() but accepts props so it can be composed
 * in different layouts without re-fetching.
 */

import { ChevronDown, Layers, Globe2 } from "lucide-react";
import { StreamIcon, STREAM_ICON_OPTIONS } from "@hki/ui";
import type { ValueStreamDef } from "@shared/value-streams";

export interface StreamSwitcherProps {
  activeScope: string;
  activeScopeDef?: ValueStreamDef;
  availableScopes: ValueStreamDef[];
  hasMultipleScopes: boolean;
  onScopeChange: (scopeId: string) => void;
  compact?: boolean;
}

const KNOWN_STREAM_ICON_IDS = new Set(
  STREAM_ICON_OPTIONS.map(option => option.id)
);

function isEmojiIcon(icon: string | undefined | null): boolean {
  if (!icon) return false;
  return Array.from(icon).some(char => (char.codePointAt(0) ?? 0) > 0xff);
}

function ScopeGlyph({ icon }: { icon?: string }) {
  if (
    icon &&
    KNOWN_STREAM_ICON_IDS.has(
      icon as (typeof STREAM_ICON_OPTIONS)[number]["id"]
    )
  ) {
    return <StreamIcon id={icon} size={16} className="shrink-0" />;
  }
  if (isEmojiIcon(icon)) {
    return <span className="text-sm shrink-0 leading-none">{icon}</span>;
  }
  return <Globe2 className="w-4 h-4 shrink-0 text-primary/70" />;
}

export function StreamSwitcher({
  activeScope,
  activeScopeDef,
  availableScopes,
  hasMultipleScopes,
  onScopeChange,
  compact = false,
}: StreamSwitcherProps) {
  const label = activeScopeDef?.name || "Global";
  const icon = activeScopeDef?.icon;

  if (!hasMultipleScopes) {
    return (
      <div
        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium
                     text-muted-foreground bg-muted/50 border border-border/60
                     ${compact ? "max-w-[140px]" : "max-w-[200px]"}`}
      >
        <ScopeGlyph icon={icon} />
        <span className="truncate">{label}</span>
      </div>
    );
  }

  return (
    <div className="relative group">
      <button
        type="button"
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold
                     text-primary bg-primary/5 border border-primary/20
                     hover:bg-primary/10 hover:border-primary/30
                     active:scale-[0.98]
                     transition-all duration-200 ease-out
                     ${compact ? "max-w-[140px]" : "max-w-[220px]"}`}
        aria-label="Switch workspace"
        aria-haspopup="listbox"
      >
        <ScopeGlyph icon={icon} />
        <span className="truncate">{label}</span>
        <ChevronDown className="w-3 h-3 shrink-0 text-primary/60 group-hover:text-primary transition-colors" />
      </button>

      <div
        className="absolute left-0 top-full mt-1.5 z-50 min-w-[220px] max-w-[280px]
                    rounded-xl border border-border bg-popover shadow-lg
                    opacity-0 invisible group-focus-within:opacity-100 group-focus-within:visible
                    transition-all duration-200 ease-out"
        role="listbox"
        aria-label="Available workspaces"
      >
        <div className="p-1.5 max-h-[320px] overflow-y-auto">
          <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
            <Layers className="w-3 h-3 inline-block mr-1.5 -mt-px" />
            Workspaces
          </div>

          {availableScopes.map(scope => {
            const isActive = scope.id === activeScope;
            return (
              <button
                key={scope.id}
                type="button"
                role="option"
                aria-selected={isActive}
                onClick={() => {
                  onScopeChange(scope.id);
                  (document.activeElement as HTMLElement)?.blur();
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left
                             text-xs transition-all duration-150
                             ${
                               isActive
                                 ? "bg-primary/10 text-primary font-semibold border border-primary/20"
                                 : "text-foreground/80 hover:bg-muted hover:text-foreground"
                             }`}
              >
                <ScopeGlyph icon={scope.icon} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{scope.name}</div>
                  {scope.description && (
                    <div className="truncate text-[10px] text-muted-foreground/70 mt-0.5">
                      {scope.description}
                    </div>
                  )}
                </div>
                {isActive && (
                  <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
