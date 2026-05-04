/**
 * NextStepBanner — Contextual guidance that appears inside each tab
 *
 * Shows after completing a key action (e.g., ingesting docs, running gap analysis).
 * Always one banner max per tab. Dismissible per-session. Links to next step.
 *
 * Design: Inline card with left accent border, icon, prose, and single CTA.
 * Never a modal. Never stacked. Never annoying.
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  X,
  CheckCircle2,
  FlaskConical,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@hki/ui";
import { type KnowledgeTab } from "../types";
import { k } from "../theme";

// ── Banner definition ────────────────────────────────────────────────────────
export interface BannerConfig {
  id: string;
  icon: LucideIcon;
  title: string;
  body: string;
  cta: string;
  tab: KnowledgeTab;
  section?: "test" | "gaps" | "quality";
  urgency: "success" | "info" | "warning";
}

interface NextStepBannerProps {
  banner: BannerConfig | null;
  onNavigate: (
    tab: KnowledgeTab,
    section?: "test" | "gaps" | "quality"
  ) => void;
}

// ── Urgency styles ───────────────────────────────────────────────────────────
const urgencyMap = {
  success: {
    border: "border-l-green-500",
    bg: "bg-green-500/10 dark:bg-green-500/12",
    iconBg: "bg-green-500/15",
    iconColor: "text-green-600 dark:text-green-400",
  },
  info: {
    border: "border-l-primary",
    bg: "bg-primary/8 dark:bg-primary/12",
    iconBg: "bg-primary/12",
    iconColor: "text-primary",
  },
  warning: {
    border: "border-l-amber-500",
    bg: "bg-amber-500/10 dark:bg-amber-500/12",
    iconBg: "bg-amber-500/15",
    iconColor: "text-amber-600 dark:text-amber-400",
  },
} as const;

// ── Pre-built banners for each transition ────────────────────────────────────
export const BANNERS = {
  afterIngest: (docCount: number, chunkCount: number): BannerConfig => ({
    id: "after-ingest",
    icon: CheckCircle2,
    title: `${docCount} document${docCount !== 1 ? "s" : ""} ingested · ${chunkCount} chunks indexed`,
    body: "Browse your knowledge to verify the content was extracted correctly. Look for any documents that seem incomplete or incorrectly parsed.",
    cta: "Browse Knowledge",
    tab: "library",
    urgency: "success",
  }),

  afterGapAnalysis: (coverageScore: number): BannerConfig => ({
    id: "after-gaps",
    icon: FlaskConical,
    title: `Gap analysis complete · Coverage: ${coverageScore}%`,
    body: "Test your knowledge base with real questions your users will ask. This verifies the agent retrieves relevant, accurate chunks for each query.",
    cta: "Test Retrieval",
    tab: "validate",
    section: "test",
    urgency: "success",
  }),

  afterTest: (): BannerConfig => ({
    id: "after-test",
    icon: TrendingUp,
    title: "Testing complete — great progress",
    body: "If the answers looked accurate, your agent is ready to use. If something seemed off, add more content on those topics and test again.",
    cta: "Add More Content",
    tab: "ingest",
    urgency: "info",
  }),
} as const;

// ── Component ────────────────────────────────────────────────────────────────
export default function NextStepBanner({
  banner,
  onNavigate,
}: NextStepBannerProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  if (!banner || dismissed.has(banner.id)) return null;

  const style = urgencyMap[banner.urgency];
  const Icon = banner.icon;

  return (
    <AnimatePresence>
      <motion.div
        key={banner.id}
        initial={{ opacity: 0, height: 0, marginBottom: 0 }}
        animate={{ opacity: 1, height: "auto", marginBottom: 16 }}
        exit={{ opacity: 0, height: 0, marginBottom: 0 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      >
        <div
          className={cn(
            "rounded-xl p-4 flex items-start gap-3",
            "border border-border/30",
            "border-l-4",
            style.border,
            style.bg
          )}
        >
          {/* Icon */}
          <div
            className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
              style.iconBg
            )}
          >
            <Icon className={cn("w-4 h-4", style.iconColor)} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground leading-tight">
              {banner.title}
            </p>
            <p className={cn(k.muted, "mt-1 leading-relaxed")}>{banner.body}</p>
            <div className="flex items-center gap-3 mt-3">
              <button
                onClick={() => onNavigate(banner.tab, banner.section)}
                className={cn(k.btnPrimary)}
              >
                {banner.cta}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() =>
                  setDismissed(prev => new Set(prev).add(banner.id))
                }
                className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                I'll do this later
              </button>
            </div>
          </div>

          {/* Dismiss */}
          <button
            onClick={() => setDismissed(prev => new Set(prev).add(banner.id))}
            className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors shrink-0"
          >
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
