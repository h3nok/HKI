/**
 * JourneyCompletion — Celebration when all 6 journey steps are done.
 *
 * Replaces the plain "Production-ready" card in OverviewTab with a
 * premium achievement unlock experience:
 *   - Confetti particle burst (CSS-only, no lib dependency)
 *   - Achievement badge with animated ring
 *   - Stats summary of what was accomplished
 *   - Next-level CTAs (schedule review, explore advanced)
 *
 * Self-contained — no external animation libs beyond Framer Motion.
 */

import { useEffect, useState, useMemo, useCallback } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Award,
  CheckCircle2,
  ChevronRight,
  Rocket,
  Sparkles,
  Star,
  TrendingUp,
  X,
  Zap,
  PartyPopper,
} from "lucide-react";
import { cn } from "@hki/ui";
import { k, ACCENT, ACCENT_RED } from "../theme";

// ── Animation presets ────────────────────────────────────────────────────────
const EASE = [0.22, 1, 0.36, 1] as const;

interface JourneyCompletionProps {
  docCount: number;
  chunkCount: number;
  entityCount: number;
  healthScore: number;
  streamLabel: string;
  onExploreAdvanced?: () => void;
  onDismiss?: () => void;
  primaryActionLabel?: string;
}

// ── CSS Confetti ─────────────────────────────────────────────────────────────
// Lightweight confetti with CSS animations — no canvas or external lib

const CONFETTI_COLORS = [ACCENT, ACCENT_RED, "#0E7C7B", "#2EA39E"];

function ConfettiBurst({ active }: { active: boolean }) {
  const pieces = useMemo(() => {
    return Array.from({ length: 40 }).map((_, i) => ({
      id: i,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      left: `${Math.random() * 100}%`,
      delay: Math.random() * 0.6,
      duration: 1.5 + Math.random() * 1.5,
      rotation: Math.random() * 720 - 360,
      size: 4 + Math.random() * 4,
      shape: i % 3, // 0=square, 1=circle, 2=rect
    }));
  }, []);

  if (!active) return null;

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-50">
      {pieces.map(p => (
        <motion.div
          key={p.id}
          initial={{ y: -20, x: 0, opacity: 1, rotate: 0, scale: 1 }}
          animate={{
            y: 600,
            x: (Math.random() - 0.5) * 200,
            opacity: 0,
            rotate: p.rotation,
            scale: 0.5,
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            ease: [0.25, 0.46, 0.45, 0.94],
          }}
          className="absolute"
          style={{
            left: p.left,
            top: -10,
            width: p.shape === 2 ? p.size * 1.8 : p.size,
            height: p.size,
            borderRadius: p.shape === 1 ? "50%" : "1px",
            backgroundColor: p.color,
          }}
        />
      ))}
    </div>
  );
}

// ── Achievement Badge ────────────────────────────────────────────────────────

function AchievementBadge() {
  return (
    <div className="relative">
      {/* Animated ring */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.6, ease: EASE }}
        className="relative w-28 h-28"
      >
        <svg className="w-full h-full" viewBox="0 0 112 112">
          {/* Outer ring */}
          <motion.circle
            cx="56"
            cy="56"
            r="52"
            fill="none"
            strokeWidth="3"
            stroke={ACCENT}
            strokeLinecap="round"
            strokeDasharray="327"
            initial={{ strokeDashoffset: 327 }}
            animate={{ strokeDashoffset: 0 }}
            transition={{ delay: 0.5, duration: 1.2, ease: EASE }}
            opacity={0.3}
          />
          {/* Inner ring */}
          <motion.circle
            cx="56"
            cy="56"
            r="46"
            fill="none"
            strokeWidth="2"
            stroke={ACCENT}
            strokeLinecap="round"
            strokeDasharray="289"
            initial={{ strokeDashoffset: 289 }}
            animate={{ strokeDashoffset: 0 }}
            transition={{ delay: 0.7, duration: 1, ease: EASE }}
            opacity={0.5}
          />
        </svg>

        {/* Center icon */}
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{
            delay: 0.8,
            duration: 0.5,
            type: "spring",
            stiffness: 200,
            damping: 15,
          }}
          className="absolute inset-0 flex items-center justify-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-primary via-primary to-primary flex items-center justify-center shadow-lg shadow-primary/20">
            <Award className="w-8 h-8 text-white" />
          </div>
        </motion.div>
      </motion.div>

      {/* Corner sparkles */}
      {[
        { x: -8, y: -4, delay: 1.0, size: 14 },
        { x: 100, y: 8, delay: 1.2, size: 12 },
        { x: 4, y: 96, delay: 1.4, size: 10 },
      ].map((s, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: s.delay, duration: 0.3, type: "spring" }}
          className="absolute"
          style={{ left: s.x, top: s.y }}
        >
          <Star
            className="text-primary fill-primary"
            style={{ width: s.size, height: s.size }}
          />
        </motion.div>
      ))}
    </div>
  );
}

// ── Stat pill ────────────────────────────────────────────────────────────────

function StatPill({
  value,
  label,
  delay,
}: {
  value: number | string;
  label: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: EASE }}
      className={cn(
        "flex flex-col items-center gap-0.5 px-4 py-2.5 rounded-xl",
        "bg-card border border-black/6 dark:border-white/8"
      )}
    >
      <span className="text-lg font-black text-foreground">{value}</span>
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {label}
      </span>
    </motion.div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════

export default function JourneyCompletion({
  docCount,
  chunkCount,
  entityCount,
  healthScore,
  streamLabel,
  onExploreAdvanced,
  onDismiss,
  primaryActionLabel = "Explore Advanced Features",
}: JourneyCompletionProps) {
  const reduceMotion = useReducedMotion();
  const [showConfetti, setShowConfetti] = useState(false);

  // Only fire confetti on the very first view (not every visit)
  const confettiKey = `kb-journey-confetti-${streamLabel}`;
  const [hasSeenBefore] = useState(() => {
    try {
      return localStorage.getItem(confettiKey) === "1";
    } catch {
      return false;
    }
  });

  // Trigger confetti on mount only if first time seeing the completion
  useEffect(() => {
    if (reduceMotion || hasSeenBefore) return;
    const t = setTimeout(() => {
      setShowConfetti(true);
      try {
        localStorage.setItem(confettiKey, "1");
      } catch {}
    }, 400);
    return () => clearTimeout(t);
  }, [reduceMotion, hasSeenBefore, confettiKey]);

  // Auto-stop confetti after the burst
  useEffect(() => {
    if (reduceMotion) return;
    if (showConfetti) {
      const t = setTimeout(() => setShowConfetti(false), 3500);
      return () => clearTimeout(t);
    }
  }, [reduceMotion, showConfetti]);

  const isHealthy = healthScore >= 50;

  return (
    <div className="relative w-full flex flex-col items-center px-6 py-10">
      <ConfettiBurst active={!reduceMotion && showConfetti} />

      {/* Dismiss button */}
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="absolute top-3 right-3 z-20 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      <div className="relative z-10 max-w-xl w-full text-center">
        {/* Badge */}
        <div className="flex justify-center mb-6">
          <AchievementBadge />
        </div>

        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0, duration: 0.5, ease: EASE }}
        >
          <div className="flex items-center justify-center gap-2 mb-2">
            <PartyPopper className="w-5 h-5 text-primary" />
            <span className="text-xs font-bold text-primary uppercase tracking-wider">
              {isHealthy ? "Achievement Unlocked" : "Setup Complete"}
            </span>
            <PartyPopper className="w-5 h-5 text-primary scale-x-[-1]" />
          </div>

          <h2 className="text-2xl md:text-3xl font-black text-foreground mb-2">
            {isHealthy ? (
              <>
                Knowledge Domain is{" "}
                <span className="text-primary">Production-Ready</span>
              </>
            ) : (
              <>
                Setup Complete &mdash;{" "}
                <span className="text-primary">Keep Improving</span>
              </>
            )}
          </h2>

          <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
            {isHealthy ? (
              <>
                You've completed all setup steps for{" "}
                <span className="font-semibold text-foreground">
                  {streamLabel}
                </span>
                . Your agent is ready to answer questions for your team.
              </>
            ) : (
              <>
                All setup steps for{" "}
                <span className="font-semibold text-foreground">
                  {streamLabel}
                </span>{" "}
                are done, but health is at {healthScore}%. Improve content
                quality, add more documents, and run evaluations to reach
                production readiness.
              </>
            )}
          </p>
        </motion.div>

        {/* Stats summary */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.3, duration: 0.5, ease: EASE }}
          className="mt-6 grid w-full max-w-lg grid-cols-2 gap-3 sm:grid-cols-4"
        >
          <StatPill value={docCount} label="Documents" delay={1.4} />
          <StatPill
            value={chunkCount.toLocaleString()}
            label="Passages"
            delay={1.5}
          />
          <StatPill value={entityCount} label="Key Topics" delay={1.6} />
          <StatPill value={`${healthScore}%`} label="Health" delay={1.7} />
        </motion.div>

        {/* Completion checklist */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.6, duration: 0.5, ease: EASE }}
          className={cn(k.card, "mt-6 p-4 text-left")}
        >
          <div className="flex items-center gap-2 mb-3">
            <Rocket className="w-4 h-4 text-primary" />
            <span className={k.heading}>All Systems Go</span>
          </div>
          {[
            "Getting-started guide reviewed",
            "Content gap analysis completed",
            "Documents uploaded and processed",
            "Content verified and looking good",
            "Test questions answered correctly",
            "Ready for your team to use",
          ].map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.8 + i * 0.08, duration: 0.3, ease: EASE }}
              className="flex items-center gap-2 py-1"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span className="text-xs text-muted-foreground">{item}</span>
            </motion.div>
          ))}
        </motion.div>

        {/* Next steps */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2.2, duration: 0.5, ease: EASE }}
          className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3"
        >
          {onExploreAdvanced && (
            <button
              onClick={onExploreAdvanced}
              className={cn(
                "inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-xl",
                k.duoToneAccentSolid,
                k.duoToneAccentSolidHover,
                "shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5"
              )}
            >
              <TrendingUp className="w-4 h-4" />
              {primaryActionLabel}
              <ChevronRight className="w-4 h-4" />
            </button>
          )}

          {!reduceMotion && (
            <button
              onClick={() => setShowConfetti(true)}
              className={cn(
                "inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl",
                "text-muted-foreground hover:text-foreground transition-all",
                "bg-muted/50 hover:bg-muted"
              )}
            >
              <Sparkles className="w-4 h-4" />
              Celebrate Again
            </button>
          )}
        </motion.div>
      </div>
    </div>
  );
}
