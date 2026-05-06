/**
 * OnboardingHero — Simple first-time welcome
 *
 * Shown once when the domain library is empty and the user hasn't
 * read the getting-started guide yet. One clear button: "Get Started".
 * After the guide is done this hero never appears again.
 */

import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  BookOpen,
  Sparkles,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@hki/ui";
import { ACCENT, ACCENT_RED, k } from "../theme";

const EASE = [0.22, 1, 0.36, 1] as const;
const BLUE = ACCENT;
const RED = ACCENT_RED;

interface OnboardingHeroProps {
  streamLabel: string;
  onGetStarted: () => void;
}

// ── Ambient background ───────────────────────────────────────────────────────

function Background({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <motion.div
        className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-150 h-100 rounded-full opacity-[0.06]"
        style={{
          background: `radial-gradient(circle, ${BLUE} 0%, transparent 70%)`,
        }}
        animate={
          reduceMotion
            ? undefined
            : { scale: [1, 1.1, 1], opacity: [0.04, 0.08, 0.04] }
        }
        transition={
          reduceMotion
            ? undefined
            : { duration: 8, repeat: Infinity, ease: "easeInOut" }
        }
      />
      <motion.div
        className="absolute bottom-0 right-1/4 w-100 h-100 rounded-full opacity-[0.03]"
        style={{
          background: `radial-gradient(circle, ${RED} 0%, transparent 70%)`,
        }}
        animate={
          reduceMotion
            ? undefined
            : { scale: [1, 1.15, 1], opacity: [0.02, 0.05, 0.02] }
        }
        transition={
          reduceMotion
            ? undefined
            : {
                duration: 10,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 2,
              }
        }
      />
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN
// ═════════════════════════════════════════════════════════════════════════════

export default function OnboardingHero({
  streamLabel,
  onGetStarted,
}: OnboardingHeroProps) {
  const reduceMotion = useReducedMotion() ?? false;

  return (
    <div className="relative flex w-full min-h-[calc(100svh-120px)] flex-col items-center justify-center py-8 sm:py-12">
      <Background reduceMotion={reduceMotion} />

      <div className="relative z-10 flex flex-col items-center px-6 py-12 max-w-lg mx-auto w-full">
        {/* Emblem */}
        <motion.div
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: EASE }}
          className="mb-5"
        >
          <div className="relative">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-md"
              style={{
                background: `linear-gradient(135deg, ${BLUE}, ${BLUE}dd)`,
              }}
            >
              <BookOpen className="w-8 h-8 text-white" />
            </div>
            <motion.div
              className="absolute -top-1 -right-1"
              animate={
                reduceMotion
                  ? undefined
                  : { rotate: [0, 12, -12, 0], scale: [1, 1.15, 1] }
              }
              transition={
                reduceMotion
                  ? undefined
                  : { duration: 3, repeat: Infinity, ease: "easeInOut" }
              }
            >
              <Sparkles className="w-4 h-4 text-primary" />
            </motion.div>
          </div>
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5, ease: EASE }}
          className="text-2xl font-bold tracking-tight text-foreground text-center leading-snug"
        >
          Welcome to your <span className={k.accentText}>Knowledge</span>{" "}
          <span className={k.brandRedText}>Base</span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.4, ease: EASE }}
          className="text-sm text-muted-foreground text-center max-w-sm mt-2 leading-relaxed"
        >
          This is where you teach your AI agent what it needs to know. We'll
          walk you through it — no technical skills needed.
        </motion.p>

        {/* Stream badge */}
        {streamLabel && streamLabel !== "All Domains" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.35, duration: 0.3, ease: EASE }}
            className="mt-2.5 px-3 py-1 rounded-full text-xs font-medium border kb-duotone-chip-border"
          >
            {streamLabel}
          </motion.div>
        )}

        {/* What to expect */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.4, ease: EASE }}
          className="mt-8 grid w-full grid-cols-1 gap-3 sm:grid-cols-3"
        >
          {[
            {
              icon: BookOpen,
              text: "Short guide to read",
              sub: "6 easy sections",
            },
            {
              icon: Clock,
              text: "Takes about 5 min",
              sub: "One-time only",
            },
            {
              icon: CheckCircle2,
              text: "Then you're ready",
              sub: "Step-by-step after",
            },
          ].map((item, i) => (
            <motion.div
              key={item.text}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + i * 0.08, duration: 0.3, ease: EASE }}
              className="flex flex-col items-center gap-1.5 rounded-2xl border border-border/35 bg-background/60 px-3 py-3 text-center"
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-primary/10">
                <item.icon className="w-4 h-4 text-primary" />
              </div>
              <p className="text-xs font-semibold text-foreground leading-tight">
                {item.text}
              </p>
              <p className="text-xs text-muted-foreground">{item.sub}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* Single CTA */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65, duration: 0.4, ease: EASE }}
          className="mt-8"
        >
          <button
            data-testid="kb-onboarding-get-started"
            onClick={onGetStarted}
            className={cn(
              "inline-flex items-center gap-2.5 px-7 py-3 text-sm font-semibold rounded-xl",
              "shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all",
              "kb-duotone-accent-solid kb-duotone-accent-solid-hover"
            )}
          >
            Get Started
            <ArrowRight className="w-4 h-4" />
          </button>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.85, duration: 0.3 }}
          className="mt-3 max-w-sm text-center text-xs text-muted-foreground/50"
        >
          You'll read a short guide first, then set up your content step by step
        </motion.p>
      </div>
    </div>
  );
}
