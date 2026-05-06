/**
 * BrandLoader — Reusable HKI-branded loading indicator
 *
 * Uses the animated Agentic mark to provide a
 * consistent platform loading state across the app:
 *
 *  • Full-screen app bootstrap   (variant="fullscreen")
 *  • Inline content loading      (variant="inline")
 *  • Compact sidebar / card      (variant="compact")
 *
 * This is the SINGLE SOURCE OF TRUTH for loading UI. If you need a loading
 * state anywhere, import this instead of rolling a custom loader.
 */

import { motion, AnimatePresence } from "framer-motion";
import { AgenticIcon } from "@/components/ui/icons/AgenticIcon";
import { useEffect, useState } from "react";

// ── Rotating status messages for fullscreen loader ─────────────────────
const LOADING_MESSAGES = [
  "Initializing Agent Core…",
  "Loading Agent Modules…",
  "Connecting to Knowledge Graph…",
  "Syncing Context Vectors…",
  "Optimizing Inference Engine…",
];

// ── Types ──────────────────────────────────────────────────────────────
export type BrandLoaderVariant = "fullscreen" | "inline" | "compact";

export interface BrandLoaderProps {
  /** Visual size/layout preset */
  variant?: BrandLoaderVariant;
  /** Static message shown below the animation (overrides rotating messages) */
  message?: string;
  /** Extra Tailwind classes on the outermost wrapper */
  className?: string;
}

// ── Component ──────────────────────────────────────────────────────────
export function BrandLoader({
  variant = "inline",
  message,
  className = "",
}: BrandLoaderProps) {
  // Rotating messages only used in fullscreen mode when no static message
  const [msgIndex, setMsgIndex] = useState(0);
  useEffect(() => {
    if (variant !== "fullscreen" || message) return;
    const timer = setInterval(
      () => setMsgIndex(i => (i + 1) % LOADING_MESSAGES.length),
      2200
    );
    return () => clearInterval(timer);
  }, [variant, message]);

  /* ── fullscreen ───────────────────────────────────────────────────── */
  if (variant === "fullscreen") {
    const displayMsg = message ?? LOADING_MESSAGES[msgIndex];
    return (
      <div
        className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-background transition-colors duration-500 overflow-hidden ${className}`}
      >
        {/* Runtime field */}
        <div className="absolute inset-0 pointer-events-none opacity-80">
          <div
            className="absolute inset-x-12 top-1/2 h-px"
            style={{
              background:
                "linear-gradient(90deg, transparent, color-mix(in srgb, var(--primary) 14%, transparent), transparent)",
            }}
          />
          <div
            className="absolute inset-y-20 left-1/2 w-px"
            style={{
              background:
                "linear-gradient(180deg, transparent, color-mix(in srgb, var(--foreground) 8%, transparent), transparent)",
            }}
          />
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="relative z-10 flex flex-col items-center"
        >
          {/* Branded hermetic isolation animation */}
          <div className="mb-6">
            <AgenticIcon size={86} animated aria-hidden="true" />
          </div>

          {/* Rotating status text */}
          <div className="h-6 flex items-center justify-center overflow-hidden relative w-72">
            <AnimatePresence mode="wait">
              <motion.p
                key={displayMsg}
                initial={{ y: 16, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -16, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="absolute text-xs font-medium text-muted-foreground uppercase tracking-widest text-center w-full"
              >
                {displayMsg}
              </motion.p>
            </AnimatePresence>
          </div>

          {/* Progress bar */}
          <div className="w-48 h-1 bg-muted rounded-full mt-6 overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{
                background:
                  "linear-gradient(90deg, color-mix(in srgb, var(--foreground) 34%, var(--primary) 66%), var(--primary))",
              }}
              animate={{ width: ["0%", "100%"] }}
              transition={{
                duration: 2.5,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          </div>
        </motion.div>
      </div>
    );
  }

  /* ── inline — centered column with optional message ───────────────── */
  if (variant === "inline") {
    return (
      <div
        className={`flex flex-col items-center justify-center py-12 ${className}`}
      >
        <AgenticIcon size={48} animated aria-hidden="true" />
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-3 text-xs text-muted-foreground"
        >
          {message ?? "Loading…"}
        </motion.p>
      </div>
    );
  }

  /* ── compact — small horizontal pill for sidebars / cards ─────────── */
  return (
    <div className={`flex items-center gap-2 px-3 py-2 ${className}`}>
      <AgenticIcon size={28} animated aria-hidden="true" />
      {message && (
        <span className="text-xs text-muted-foreground">{message}</span>
      )}
    </div>
  );
}
