/**
 * SearchOverlay — Full-viewport command palette (⌘K)
 *
 * Design:
 * - Full screen backdrop with heavy blur — the entire app recedes
 * - Large centered panel (max 680px) sitting at 20vh from top
 * - Results grouped by section: Pinned, Today, Recent
 * - Rich result rows: title, last-message preview, relative date, scope badge
 * - Keyboard navigation: ↑↓ to move, Enter to open, Esc to close
 * - Empty state with contextual messaging
 */

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  X,
  MessageSquare,
  Pin,
  Clock,
  CornerDownLeft,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import type { Task } from "../types";

// ============================================================================
// TYPES
// ============================================================================

export interface SearchOverlayProps {
  open: boolean;
  onClose: () => void;
  tasks: Task[];
  onSelect: (taskId: string) => void;
}

type ResultSection = {
  label: string;
  icon: typeof Pin;
  items: Task[];
};

// ============================================================================
// HELPERS
// ============================================================================

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

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

// Build flat list of tasks grouped into sections, in display order
function buildSections(tasks: Task[], query: string): ResultSection[] {
  const q = query.trim().toLowerCase();

  if (q) {
    const matches = tasks.filter(
      (t) =>
        t.description?.toLowerCase().includes(q) ||
        t.lastMessage?.toLowerCase().includes(q)
    );
    return matches.length > 0
      ? [{ label: "Results", icon: Search, items: matches }]
      : [];
  }

  const pinned = tasks.filter((t) => t.isPinned);
  const todayMs = Date.now() - 86_400_000;
  const today = tasks.filter(
    (t) => !t.isPinned && new Date(t.updated_at).getTime() > todayMs
  );
  const older = tasks.filter(
    (t) => !t.isPinned && new Date(t.updated_at).getTime() <= todayMs
  );

  const sections: ResultSection[] = [];
  if (pinned.length > 0) sections.push({ label: "Pinned", icon: Pin, items: pinned });
  if (today.length > 0) sections.push({ label: "Today", icon: Clock, items: today });
  if (older.length > 0)
    sections.push({ label: "Recent", icon: MessageSquare, items: older.slice(0, 10) });

  return sections;
}

// Flatten sections into an indexed list for keyboard nav
function flattenSections(sections: ResultSection[]): Task[] {
  return sections.flatMap((s) => s.items);
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
  task: Task;
  query: string;
  isActive: boolean;
  onSelect: () => void;
  onHover: () => void;
}

function ResultRow({ task, query, isActive, onSelect, onHover }: ResultRowProps) {
  const title = task.description || "New Task";
  const date = formatRelativeDate(task.updated_at);

  return (
    <button
      type="button"
      role="option"
      aria-selected={isActive}
      onClick={onSelect}
      onMouseEnter={onHover}
      className={`
        group w-full flex items-center gap-3 px-4 py-3 text-left
        transition-colors duration-75 outline-none
        ${isActive ? "bg-primary/8" : "hover:bg-muted/40"}
      `}
    >
      {/* Icon */}
      <div
        className={`
          w-8 h-8 rounded-lg shrink-0 flex items-center justify-center transition-colors
          ${isActive ? "bg-primary/15" : "bg-muted group-hover:bg-muted/80"}
        `}
      >
        {task.isPinned ? (
          <Pin
            className={`w-3.5 h-3.5 ${isActive ? "text-primary" : "text-muted-foreground"}`}
            strokeWidth={2}
          />
        ) : (
          <MessageSquare
            className={`w-3.5 h-3.5 ${isActive ? "text-primary" : "text-muted-foreground"}`}
            strokeWidth={1.8}
          />
        )}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span
            className={`text-[13px] font-medium truncate transition-colors ${isActive ? "text-primary" : "text-foreground"}`}
          >
            {query ? highlightMatch(title, query) : title}
          </span>
          <span className="text-[11px] text-muted-foreground shrink-0 tabular-nums">
            {date}
          </span>
        </div>
        {task.lastMessage && (
          <p className="text-[12px] text-muted-foreground truncate mt-0.5 leading-relaxed">
            {query ? highlightMatch(task.lastMessage, query) : task.lastMessage}
          </p>
        )}
      </div>

      {/* Active arrow */}
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

export function SearchOverlay({ open, onClose, tasks, onSelect }: SearchOverlayProps) {
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

  const sections = useMemo(() => buildSections(tasks, query), [tasks, query]);
  const flatResults = useMemo(() => flattenSections(sections), [sections]);

  // Clamp active index when results change
  useEffect(() => {
    setActiveIndex((prev) => Math.min(prev, Math.max(0, flatResults.length - 1)));
  }, [flatResults.length]);

  // Scroll active item into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    // Find the active button inside the list
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
          setActiveIndex((i) => Math.min(i + 1, flatResults.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setActiveIndex((i) => Math.max(i - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (flatResults[activeIndex]) {
            onSelect(flatResults[activeIndex].id);
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

  const handleSelect = useCallback(
    (id: string) => {
      onSelect(id);
      onClose();
    },
    [onSelect, onClose]
  );

  // Track cumulative index across sections for keyboard nav
  let globalIndex = 0;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* ── Full-viewport backdrop ─────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-100 bg-black/50 backdrop-blur-md"
            onClick={onClose}
            aria-hidden
          />

          {/* ── Panel ──────────────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: -12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -12 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            role="dialog"
            aria-modal="true"
            aria-label="Search conversations"
            className="fixed z-101 left-1/2 -translate-x-1/2"
            style={{ top: "12vh", width: "min(680px, calc(100vw - 32px))" }}
            onKeyDown={handleKeyDown}
          >
            <div
              className="flex flex-col overflow-hidden rounded-2xl border border-border/80
                         shadow-[0_24px_80px_rgba(0,0,0,0.22),0_4px_16px_rgba(0,0,0,0.12)]
                         dark:shadow-[0_24px_80px_rgba(0,0,0,0.7),0_4px_16px_rgba(0,0,0,0.4)]"
              style={{ background: "var(--card)" }}
            >
              {/* ── Search input row ──────────────────────────────────── */}
              <div className="flex items-center gap-3 px-5 py-4 border-b border-border/60">
                <Search
                  className="w-5 h-5 shrink-0 text-primary"
                  strokeWidth={2}
                />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setActiveIndex(0);
                  }}
                  placeholder="Search your conversations…"
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

              {/* ── Results ──────────────────────────────────────────── */}
              <div
                ref={listRef}
                className="overflow-y-auto"
                style={{ maxHeight: "min(520px, 60vh)" }}
                role="listbox"
                aria-label="Search results"
              >
                {sections.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                      <Search className="w-5 h-5 text-muted-foreground/50" strokeWidth={1.5} />
                    </div>
                    <div className="text-center">
                      <p className="text-[14px] font-medium text-foreground/70">
                        {query ? `No results for "${query}"` : "No conversations yet"}
                      </p>
                      {query && (
                        <p className="text-[12px] text-muted-foreground mt-1">
                          Try a different term or start a new task
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="py-2">
                    {sections.map((section) => {
                      const SectionIcon = section.icon;
                      return (
                        <div key={section.label}>
                          {/* Section label */}
                          <div className="flex items-center gap-2 px-4 pt-3 pb-1.5">
                            <SectionIcon
                              className="w-3 h-3 text-muted-foreground/50"
                              strokeWidth={2}
                            />
                            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                              {section.label}
                            </span>
                          </div>

                          {/* Section items */}
                          {section.items.map((task) => {
                            const idx = globalIndex++;
                            return (
                              <ResultRow
                                key={task.id}
                                task={task}
                                query={query}
                                isActive={idx === activeIndex}
                                onSelect={() => handleSelect(task.id)}
                                onHover={() => setActiveIndex(idx)}
                              />
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ── Footer ───────────────────────────────────────────── */}
              <div className="flex items-center justify-between gap-4 px-5 py-3 border-t border-border/60">
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Kbd><ArrowUp className="w-2.5 h-2.5" /></Kbd>
                    <Kbd><ArrowDown className="w-2.5 h-2.5" /></Kbd>
                    navigate
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Kbd><CornerDownLeft className="w-2.5 h-2.5" /></Kbd>
                    open
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Kbd>ESC</Kbd>
                    close
                  </span>
                </div>
                {flatResults.length > 0 && (
                  <span className="text-[11px] text-muted-foreground/60 shrink-0">
                    {flatResults.length} conversation{flatResults.length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
