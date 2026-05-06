/**
 * CreateProjectModal — Premium modal for creating new projects
 *
 * Features:
 * - Centered modal with backdrop blur
 * - Emoji picker grid with visual selection
 * - Color palette selection (6 theme-aware presets)
 * - Live preview of the project as it will appear
 * - Keyboard: Enter to submit, Escape to close
 * - Focus trap on mount
 *
 * @module task-sidebar/create-project-modal
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, FolderPlus } from "lucide-react";

// ============================================================================
// CONSTANTS
// ============================================================================

const EMOJI_GRID = [
  "📁",
  "🛒",
  "📊",
  "🔍",
  "💡",
  "🎯",
  "📦",
  "🏷️",
  "🧪",
  "⚡",
  "🤖",
  "📋",
  "🚀",
  "🔧",
  "🛡️",
  "🎨",
  "📈",
  "💬",
  "🌐",
  "🧠",
  "🏪",
  "🏗️",
  "📝",
  "🔔",
];

const COLOR_PRESETS = [
  { name: "default", value: "" },
  { name: "blue", value: "#3b82f6" },
  { name: "emerald", value: "#10b981" },
  { name: "teal", value: "#0e7c7b" },
  { name: "rose", value: "#f43f5e" },
  { name: "violet", value: "#8b5cf6" },
  { name: "cyan", value: "#06b6d4" },
];

// ============================================================================
// TYPES
// ============================================================================

export interface CreateProjectModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (params: {
    name: string;
    emoji?: string;
    color?: string;
  }) => Promise<any>;
  /** Pre-fill the name input (e.g. when creating from a task) */
  initialName?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

/** Generate smart name suggestions based on current date and context */
function getNameSuggestions(): string[] {
  const now = new Date();
  const month = now.toLocaleDateString("en-US", { month: "short" });
  const day = now.getDate();
  const weekday = now.toLocaleDateString("en-US", { weekday: "long" });
  return [
    `${month} ${day} Research`,
    `${weekday} Tasks`,
    `${month} Sprint`,
    `Q${Math.ceil((now.getMonth() + 1) / 3)} Planning`,
  ];
}

// ============================================================================
// COMPONENT
// ============================================================================

export function CreateProjectModal({
  open,
  onClose,
  onSubmit,
  initialName = "",
}: CreateProjectModalProps) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("📁");
  const [color, setColor] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestions = getNameSuggestions();

  // Reset state on open
  useEffect(() => {
    if (open) {
      setName(initialName || "");
      setEmoji("📁");
      setColor("");
      setIsSubmitting(false);
      // Focus input after animation settles
      setTimeout(() => {
        inputRef.current?.focus();
        if (initialName) inputRef.current?.select();
      }, 80);
    }
  }, [open, initialName]);

  // Escape to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const handleSubmit = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        name: trimmed,
        emoji: emoji || undefined,
        color: color || undefined,
      });
      onClose();
    } catch {
      // Error toast handled by parent
    } finally {
      setIsSubmitting(false);
    }
  }, [name, emoji, color, isSubmitting, onSubmit, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 16 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="relative bg-card border border-border rounded-2xl shadow-2xl w-[420px] max-w-[90vw] overflow-hidden z-[101]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-project-title"
        onClick={e => e.stopPropagation()}
      >
        {/* Header — Command Center Style */}
        <div className="flex items-center justify-between px-6 pt-5 pb-2">
          <div className="flex items-center gap-3">
            <FolderPlus className="w-5 h-5 text-primary" strokeWidth={2} />
            <h2
              id="create-project-title"
              className="text-[15px] font-semibold tracking-wide text-foreground uppercase"
            >
              New Project
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-muted-foreground/70 hover:text-foreground hover:bg-sidebar-accent/60 transition-all"
            aria-label="Close"
          >
            <X className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>

        <div className="px-6 pb-6 pt-3 space-y-5">
          {/* ── Live Preview ── */}
          <div className="flex items-center gap-3 p-3 rounded-xl border border-border/60 bg-muted/30">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 transition-colors"
              style={{
                background: color
                  ? `color-mix(in srgb, ${color} 15%, transparent)`
                  : "color-mix(in srgb, var(--primary) 10%, transparent)",
                border: color
                  ? `1.5px solid ${color}30`
                  : "1.5px solid transparent",
              }}
            >
              {emoji}
            </div>
            <div className="min-w-0">
              <div className="font-medium text-sm text-foreground truncate">
                {name.trim() || "Project name"}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                0 tasks
              </div>
            </div>
          </div>

          {/* ── Name Input ── */}
          <div>
            <label
              htmlFor="project-name"
              className="block text-xs font-medium text-foreground/80 mb-1.5 uppercase tracking-wider"
            >
              Name
            </label>
            <input
              ref={inputRef}
              id="project-name"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder="e.g. Kirkland Research"
              maxLength={200}
              autoComplete="off"
              className="w-full px-3 py-2.5 text-sm rounded-xl
                                       bg-background border border-border
                                       focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50
                                       text-foreground placeholder:text-muted-foreground/50
                                       transition-all duration-150"
            />
            {/* Quick-fill suggestions */}
            {!name && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {suggestions.map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setName(s)}
                    className="px-2 py-1 text-[11px] font-medium rounded-lg
                                                   bg-muted/60 text-muted-foreground
                                                   hover:bg-primary/10 hover:text-primary
                                                   transition-colors duration-100"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Emoji Picker ── */}
          <div>
            <label className="block text-xs font-medium text-foreground/80 mb-1.5">
              Icon
            </label>
            <div className="grid grid-cols-8 gap-1">
              {EMOJI_GRID.map(e => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEmoji(e)}
                  className={`
                                        w-8 h-8 flex items-center justify-center rounded-lg text-sm
                                        transition-all duration-100
                                        ${
                                          emoji === e
                                            ? "bg-primary/15 ring-1.5 ring-primary/50 scale-110"
                                            : "hover:bg-primary/8 hover:scale-105"
                                        }
                                    `}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          {/* ── Color Picker ── */}
          <div>
            <label className="block text-xs font-medium text-foreground/80 mb-1.5">
              Accent Color
            </label>
            <div className="flex items-center gap-2">
              {COLOR_PRESETS.map(c => (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => setColor(c.value)}
                  className={`
                                        w-7 h-7 rounded-full border-2 transition-all duration-100
                                        ${
                                          color === c.value
                                            ? "scale-115 ring-2 ring-offset-2 ring-offset-card ring-primary"
                                            : "hover:scale-110"
                                        }
                                    `}
                  style={{
                    background: c.value || "var(--muted)",
                    borderColor:
                      color === c.value
                        ? c.value || "var(--primary)"
                        : "transparent",
                  }}
                  title={c.name === "default" ? "Default" : c.name}
                  aria-label={c.name}
                />
              ))}
            </div>
          </div>

          {/* ── Actions ── */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-[13px] font-medium rounded-xl
                                       text-muted-foreground
                                       hover:text-foreground hover:bg-sidebar-accent/50
                                       transition-all duration-200"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!name.trim() || isSubmitting}
              className="px-5 py-2 text-[13px] font-semibold rounded-xl
                                       border border-primary text-primary
                                       hover:bg-primary hover:text-primary-foreground
                                       transition-all duration-200
                                       disabled:opacity-40 disabled:cursor-not-allowed
                                       flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />
                  Creating…
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Create Project
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default CreateProjectModal;
