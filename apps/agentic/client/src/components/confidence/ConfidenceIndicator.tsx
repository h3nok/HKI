/**
 * Confidence Indicator
 * Visual representation of AI confidence scores with explanations
 */

import { useState } from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { cn } from "@hki/ui";

/* ── Types ────────────────────────────────────────────────────── */

export interface ConfidenceScore {
  value: number; // 0-1
  reasoning?: string;
  factors?: Array<{
    name: string;
    impact: "positive" | "negative" | "neutral";
    description: string;
  }>;
}

interface ConfidenceIndicatorProps {
  score: ConfidenceScore;
  size?: "sm" | "md" | "lg";
  showExplanation?: boolean;
  className?: string;
}

/* ── Helpers ──────────────────────────────────────────────────── */

function getConfidenceLevel(score: number): {
  label: string;
  color: string;
  bgColor: string;
  icon: typeof CheckCircle2;
} {
  if (score >= 0.8) {
    return {
      label: "High Confidence",
      color: "text-emerald-500",
      bgColor: "bg-emerald-500",
      icon: CheckCircle2,
    };
  }
  if (score >= 0.5) {
    return {
      label: "Moderate Confidence",
      color: "text-primary",
      bgColor: "bg-primary",
      icon: AlertTriangle,
    };
  }
  return {
    label: "Low Confidence",
    color: "text-red-500",
    bgColor: "bg-red-500",
    icon: AlertCircle,
  };
}

/* ── Component ────────────────────────────────────────────────── */

export default function ConfidenceIndicator({
  score,
  size = "md",
  showExplanation = false,
  className,
}: ConfidenceIndicatorProps) {
  const [showDetails, setShowDetails] = useState(false);
  const level = getConfidenceLevel(score.value);
  const Icon = level.icon;
  const percentage = Math.round(score.value * 100);

  const sizes = {
    sm: { ring: 40, stroke: 3, text: "text-xs", icon: "w-3 h-3" },
    md: { ring: 56, stroke: 4, text: "text-sm", icon: "w-4 h-4" },
    lg: { ring: 80, stroke: 5, text: "text-lg", icon: "w-5 h-5" },
  };

  const config = sizes[size];
  const radius = (config.ring - config.stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - score.value * circumference;

  return (
    <div className={cn("inline-flex flex-col items-center gap-2", className)}>
      {/* Confidence Ring */}
      <button
        onClick={() =>
          showExplanation && score.reasoning && setShowDetails(!showDetails)
        }
        className={cn(
          "relative",
          showExplanation &&
            score.reasoning &&
            "cursor-pointer hover:scale-105 transition-transform"
        )}
        style={{ width: config.ring, height: config.ring }}
      >
        {/* Background ring */}
        <svg
          width={config.ring}
          height={config.ring}
          className="absolute inset-0 -rotate-90"
        >
          <circle
            cx={config.ring / 2}
            cy={config.ring / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={config.stroke}
            className="text-black/[0.06] dark:text-white/[0.06]"
          />
          {/* Confidence arc */}
          <motion.circle
            cx={config.ring / 2}
            cy={config.ring / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={config.stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
            className={level.color}
          />
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <Icon className={cn(config.icon, level.color, "mb-0.5")} />
          <span
            className={cn(
              config.text,
              "font-bold tabular-nums",
              "text-foreground"
            )}
          >
            {percentage}
          </span>
        </div>

        {/* Info indicator */}
        {showExplanation && score.reasoning && (
          <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center">
            <Info className="w-2.5 h-2.5 text-white" />
          </div>
        )}
      </button>

      {/* Label */}
      <div className="text-center">
        <p className={cn("text-[10px] font-semibold", level.color)}>
          {level.label}
        </p>
      </div>

      {/* Explanation */}
      {showDetails && score.reasoning && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-64 p-3 rounded-lg border bg-card border-black/[0.08] dark:border-white/[0.08] shadow-lg"
        >
          <p className="text-xs text-foreground leading-relaxed mb-3">
            {score.reasoning}
          </p>

          {score.factors && score.factors.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                Contributing Factors
              </label>
              {score.factors.map((factor, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 text-[10px] p-2 rounded bg-black/[0.02] dark:bg-white/[0.02]"
                >
                  {factor.impact === "positive" && (
                    <TrendingUp className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />
                  )}
                  {factor.impact === "negative" && (
                    <TrendingDown className="w-3 h-3 text-red-500 shrink-0 mt-0.5" />
                  )}
                  {factor.impact === "neutral" && (
                    <Minus className="w-3 h-3 text-muted-foreground shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground">
                      {factor.name}
                    </p>
                    <p className="text-muted-foreground leading-snug mt-0.5">
                      {factor.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}

/* ── Inline Confidence Badge ──────────────────────────────────── */

interface ConfidenceBadgeProps {
  score: number;
  showLabel?: boolean;
  size?: "xs" | "sm" | "md";
}

export function ConfidenceBadge({
  score,
  showLabel = true,
  size = "sm",
}: ConfidenceBadgeProps) {
  const level = getConfidenceLevel(score);
  const Icon = level.icon;
  const percentage = Math.round(score * 100);

  const sizeClasses = {
    xs: "px-1.5 py-0.5 text-[9px] gap-0.5",
    sm: "px-2 py-1 text-[10px] gap-1",
    md: "px-2.5 py-1.5 text-xs gap-1.5",
  };

  const iconSizes = {
    xs: "w-2.5 h-2.5",
    sm: "w-3 h-3",
    md: "w-3.5 h-3.5",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full font-semibold",
        sizeClasses[size],
        "bg-black/[0.04] dark:bg-white/[0.04]",
        level.color
      )}
    >
      <Icon className={iconSizes[size]} />
      <span className="tabular-nums">{percentage}%</span>
      {showLabel && size !== "xs" && (
        <>
          <span className="text-muted-foreground">•</span>
          <span>{level.label.split(" ")[0]}</span>
        </>
      )}
    </div>
  );
}
