/**
 * AdminCommandPalette — ⌘K command palette for the admin hub.
 *
 * Searches across navigation pages, value streams, and users.
 * Full-viewport backdrop with blur, keyboard navigation, highlight matches.
 */

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, CornerDownLeft, type LucideIcon } from "lucide-react";

// ============================================================================
// TYPES
// ============================================================================

export interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon?: LucideIcon;
  section: string;
  path: string;
  shortcut?: string;
}

export interface AdminCommandPaletteProps {
  open: boolean;
  onClose: () => void;
  items: CommandItem[];
  onSelect: (path: string) => void;
}

// ============================================================================
// HELPERS
// ============================================================================

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query || !text) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark
            key={i}
            className="bg-primary/20 text-primary rounded-[3px] px-0.5 not-italic"
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

type ResultSection = {
  label: string;
  items: CommandItem[];
};

function buildSections(items: CommandItem[], query: string): ResultSection[] {
  const q = query.trim().toLowerCase();

  const filtered = q
    ? items.filter(
        it =>
          it.label.toLowerCase().includes(q) ||
          it.description?.toLowerCase().includes(q) ||
          it.section.toLowerCase().includes(q)
      )
    : items;

  const grouped = new Map<string, CommandItem[]>();
  for (const it of filtered) {
    const arr = grouped.get(it.section) ?? [];
    arr.push(it);
    grouped.set(it.section, arr);
  }

  return Array.from(grouped.entries()).map(([label, sectionItems]) => ({
    label,
    items: sectionItems,
  }));
}

function flattenSections(sections: ResultSection[]): CommandItem[] {
  return sections.flatMap(s => s.items);
}

// ============================================================================
// KBD BADGE
// ============================================================================

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      className="inline-flex items-center justify-center min-w-5 h-5 px-1
                 rounded font-mono text-[10px] leading-none
                 border border-border bg-muted text-muted-foreground select-none"
    >
      {children}
    </kbd>
  );
}

// ============================================================================
// RESULT ROW
// ============================================================================

interface ResultRowProps {
  item: CommandItem;
  query: string;
  isActive: boolean;
  onSelect: () => void;
  onHover: () => void;
}

function ResultRow({
  item,
  query,
  isActive,
  onSelect,
  onHover,
}: ResultRowProps) {
  const Icon = item.icon;

  return (
    <button
      type="button"
      role="option"
      aria-selected={isActive}
      onClick={onSelect}
      onMouseEnter={onHover}
      className={`
        group w-full flex items-center gap-3 px-4 py-2.5 text-left
        transition-colors duration-75 outline-none
        ${isActive ? "bg-primary/8" : "hover:bg-muted/40"}
      `}
    >
      {Icon && (
        <div
          className={`
            w-8 h-8 rounded-lg shrink-0 flex items-center justify-center transition-colors
            ${isActive ? "bg-primary/15" : "bg-muted group-hover:bg-muted/80"}
          `}
        >
          <Icon
            className={`w-4 h-4 ${isActive ? "text-primary" : "text-muted-foreground"}`}
            strokeWidth={1.8}
          />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <span
          className={`text-[13px] font-medium truncate block transition-colors ${isActive ? "text-primary" : "text-foreground"}`}
        >
          {query ? highlightMatch(item.label, query) : item.label}
        </span>
        {item.description && (
          <span className="text-[11px] text-muted-foreground truncate block mt-0.5">
            {query ? highlightMatch(item.description, query) : item.description}
          </span>
        )}
      </div>

      {item.shortcut && !isActive && <Kbd>{item.shortcut}</Kbd>}

      <div
        className={`shrink-0 transition-all duration-100 ${isActive ? "opacity-100" : "opacity-0"}`}
      >
        <CornerDownLeft className="w-3.5 h-3.5 text-primary" strokeWidth={2} />
      </div>
    </button>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function AdminCommandPalette({
  open,
  onClose,
  items,
  onSelect,
}: AdminCommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const sections = useMemo(() => buildSections(items, query), [items, query]);
  const flatResults = useMemo(() => flattenSections(sections), [sections]);

  // Clamp active index when results change
  useEffect(() => {
    setActiveIndex(prev => Math.min(prev, Math.max(0, flatResults.length - 1)));
  }, [flatResults.length]);

  // Scroll active item into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const buttons = list.querySelectorAll('[role="option"]');
    (buttons[activeIndex] as HTMLElement | undefined)?.scrollIntoView({
      block: "nearest",
    });
  }, [activeIndex]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setActiveIndex(i => Math.min(i + 1, flatResults.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setActiveIndex(i => Math.max(i - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (flatResults[activeIndex]) {
            onSelect(flatResults[activeIndex].path);
            onClose();
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    },
    [flatResults, activeIndex, onSelect, onClose]
  );

  let globalIndex = 0;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-md"
            onClick={onClose}
            aria-hidden
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: -12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -12 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            role="dialog"
            aria-modal="true"
            aria-label="Admin command palette"
            className="fixed z-[101] left-1/2 -translate-x-1/2"
            style={{ top: "12vh", width: "min(560px, calc(100vw - 32px))" }}
            onKeyDown={handleKeyDown}
          >
            <div
              className="flex flex-col overflow-hidden rounded-2xl border border-border/80
                         shadow-[0_24px_80px_rgba(0,0,0,0.22),0_4px_16px_rgba(0,0,0,0.12)]
                         dark:shadow-[0_24px_80px_rgba(0,0,0,0.7),0_4px_16px_rgba(0,0,0,0.4)]"
              style={{ background: "var(--card)" }}
            >
              {/* Search input */}
              <div className="flex items-center gap-3 px-5 py-4 border-b border-border/60">
                <Search
                  className="w-5 h-5 shrink-0 text-primary"
                  strokeWidth={2}
                />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={e => {
                    setQuery(e.target.value);
                    setActiveIndex(0);
                  }}
                  placeholder="Search pages, streams, users…"
                  className="flex-1 bg-transparent text-[15px] font-medium text-foreground
                             placeholder:text-muted-foreground/60 placeholder:font-normal
                             focus:outline-none"
                  autoComplete="off"
                  spellCheck={false}
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      inputRef.current?.focus();
                    }}
                    className="w-7 h-7 flex items-center justify-center rounded-lg
                               text-muted-foreground hover:text-foreground hover:bg-muted
                               transition-colors shrink-0"
                    aria-label="Clear search"
                  >
                    <X className="w-4 h-4" />
                  </button>
                ) : (
                  <Kbd>ESC</Kbd>
                )}
              </div>

              {/* Results */}
              <div
                ref={listRef}
                className="overflow-y-auto"
                style={{ maxHeight: "min(420px, 55vh)" }}
                role="listbox"
                aria-label="Command results"
              >
                {sections.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-14 gap-3">
                    <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                      <Search
                        className="w-5 h-5 text-muted-foreground/50"
                        strokeWidth={1.5}
                      />
                    </div>
                    <p className="text-[14px] font-medium text-foreground/70">
                      No results for &ldquo;{query}&rdquo;
                    </p>
                    <p className="text-[12px] text-muted-foreground">
                      Try a different search term
                    </p>
                  </div>
                ) : (
                  <div className="py-2">
                    {sections.map(section => (
                      <div key={section.label}>
                        <div className="flex items-center gap-2 px-4 pt-3 pb-1.5">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                            {section.label}
                          </span>
                        </div>
                        {section.items.map(item => {
                          const idx = globalIndex++;
                          return (
                            <ResultRow
                              key={item.id}
                              item={item}
                              query={query}
                              isActive={idx === activeIndex}
                              onSelect={() => {
                                onSelect(item.path);
                                onClose();
                              }}
                              onHover={() => setActiveIndex(idx)}
                            />
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer hints */}
              <div className="flex items-center gap-4 px-5 py-2.5 border-t border-border/40 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Kbd>↑</Kbd>
                  <Kbd>↓</Kbd>
                  navigate
                </span>
                <span className="flex items-center gap-1">
                  <Kbd>↵</Kbd>
                  open
                </span>
                <span className="flex items-center gap-1">
                  <Kbd>esc</Kbd>
                  close
                </span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
