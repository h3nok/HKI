/**
 * SuggestionGrid — Responsive prompt suggestion tiles
 *
 * Renders prompts as clean, equal-height tiles in a responsive layout.
 * Always stacks vertically on narrow viewports, switches to horizontal
 * at wider widths. Each tile has a clear arrow affordance.
 *
 *   1 prompt  → single centered tile
 *   2 prompts → side-by-side (stacked on mobile)
 *   3 prompts → three columns (stacked on mobile)
 */

import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { cn } from "@hki/ui";

// ── Types ────────────────────────────────────────────────────────────────

export interface SuggestionGridProps {
  prompts: string[];
  onSelect: (prompt: string) => void;
  disabled?: boolean;
  className?: string;
}

// ── Animation ────────────────────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const tileVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
    },
  },
};

// ── Component ────────────────────────────────────────────────────────────

export function SuggestionGrid({
  prompts,
  onSelect,
  disabled = false,
  className,
}: SuggestionGridProps) {
  if (prompts.length === 0) return null;

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className={cn("w-full mx-auto", className)}
    >
      <div
        className={cn(
          "flex flex-col gap-2.5",
          prompts.length > 1 && "sm:flex-row sm:gap-3"
        )}
      >
        {prompts.map(prompt => (
          <SuggestionTile
            key={prompt}
            prompt={prompt}
            disabled={disabled}
            onSelect={() => onSelect(prompt)}
          />
        ))}
      </div>
    </motion.div>
  );
}

// ── Tile sub-component ───────────────────────────────────────────────────

interface SuggestionTileProps {
  prompt: string;
  disabled: boolean;
  onSelect: () => void;
}

function SuggestionTile({ prompt, disabled, onSelect }: SuggestionTileProps) {
  return (
    <motion.button
      type="button"
      variants={tileVariants}
      onClick={onSelect}
      disabled={disabled}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.985 }}
      className={cn(
        "agentic-suggestion-tile group relative flex items-center gap-3 text-left w-full",
        "rounded-xl border border-border/50 bg-card/40",
        "hover:bg-card/80 hover:border-border/80 hover:shadow-sm",
        "disabled:opacity-40 disabled:pointer-events-none",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
        "transition-all duration-200 cursor-pointer",
        "px-4 py-3.5 sm:flex-1 sm:min-w-0"
      )}
    >
      <span className="agentic-suggestion-glyph" aria-hidden>
        <Sparkles className="h-3.5 w-3.5" />
      </span>

      {/* Prompt text */}
      <span className="flex-1 min-w-0 text-[13px] leading-relaxed text-muted-foreground group-hover:text-foreground transition-colors">
        {prompt}
      </span>

      {/* Arrow */}
      <ArrowRight className="w-3.5 h-3.5 shrink-0 text-muted-foreground/30 group-hover:text-primary/60 transition-colors" />
    </motion.button>
  );
}
