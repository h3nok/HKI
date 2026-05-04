import * as React from "react";
import { cn } from "../../utils";

export interface Stat {
  label: string;
  value: number | string;
  icon?: React.ReactNode;
  color?: "emerald" | "blue" | "violet" | "amber" | "slate";
}

export interface GamificationBadge {
  type: "streak" | "points" | "custom";
  value: string | number;
  icon?: React.ReactNode;
  color?: "orange" | "blue" | "emerald" | "violet";
}

export interface DashboardBannerProps {
  /** Main title */
  title?: string;
  /** Optional subtitle/description */
  subtitle?: string;
  /** Readiness score (0-100) */
  readiness?: number;
  /** Readiness label text */
  readinessLabel?: string;
  /** Quick stats to display */
  stats?: Stat[];
  /** Gamification badges (streak, points, etc) */
  badges?: GamificationBadge[];
  /** Additional actions slot (buttons, etc) */
  actions?: React.ReactNode;
  /** Additional class names */
  className?: string;
}

const colorStyles = {
  emerald: "bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200/60 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400",
  blue: "bg-blue-50 dark:bg-blue-500/10 border border-blue-200/60 dark:border-blue-500/20 text-blue-700 dark:text-blue-400",
  violet: "bg-violet-50 dark:bg-violet-500/10 border border-violet-200/60 dark:border-violet-500/20 text-violet-700 dark:text-violet-400",
  amber: "bg-amber-50 dark:bg-amber-500/10 border border-amber-200/60 dark:border-amber-500/20 text-amber-700 dark:text-amber-400",
  slate: "bg-[#f5f4f1] dark:bg-white/5 border border-[#e0dfdc] dark:border-white/10 text-[#525150] dark:text-[#a3a29f]",
};


/**
 * Dashboard Banner — Professional stats header for dashboard pages.
 * Groups readiness score, key metrics, and gamification into a cohesive banner.
 *
 * @example
 * <DashboardBanner
 *   title="Knowledge Overview"
 *   readiness={75}
 *   readinessLabel="Almost ready"
 *   stats={[
 *     { label: "docs", value: 42, color: "emerald" },
 *     { label: "chunks", value: 156, color: "blue" },
 *   ]}
 *   badges={[{ type: "streak", value: 5 }]}
 * />
 */
export function DashboardBanner({
  title,
  subtitle,
  readiness,
  readinessLabel,
  stats,
  badges,
  actions,
  className,
}: DashboardBannerProps) {

  return (
    <div
      className={cn(
        "relative w-full rounded-2xl overflow-hidden",
        // Lift — layered shadow for real depth
        "shadow-[0_4px_24px_0_rgba(0,0,0,0.10),0_1px_4px_0_rgba(0,0,0,0.06),0_0_0_1px_rgba(0,0,0,0.04)]",
        "dark:shadow-[0_4px_32px_0_rgba(0,0,0,0.5),0_1px_6px_0_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.04)]",
        className
      )}
    >
      {/* ── Background gradient mesh ── */}
      <div className="absolute inset-0 bg-gradient-to-br from-white via-[#f6fdf9] to-[#edfaf4] dark:from-[#181a24] dark:via-[#1a1f2e] dark:to-[#141c1a]" />

      {/* ── Radial glow — top-left emerald bloom ── */}
      <div className="absolute -top-8 -left-8 w-48 h-48 rounded-full bg-emerald-400/20 dark:bg-emerald-500/15 blur-3xl pointer-events-none" />

      {/* ── Reflective shimmer — diagonal highlight ── */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/60 via-transparent to-transparent dark:from-white/5 dark:via-transparent dark:to-transparent pointer-events-none" />

      {/* ── Top accent bar — gradient with glow ── */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-400 via-emerald-300 to-transparent" />
      <div className="absolute top-0 left-0 w-32 h-[2px] bg-emerald-400 blur-sm opacity-60" />

      {/* ── Content ── */}
      <div className="relative flex flex-row items-center gap-5 px-6 py-5">

        {/* Left: Readiness Ring + Title */}
        <div className="flex items-center gap-4 min-w-0">
          {/* Readiness Ring — only show when > 0 */}
          {readiness !== undefined && readiness > 0 && (
            <div className="relative w-16 h-16 shrink-0 drop-shadow-sm">
              {/* Ring glow */}
              <div className="absolute inset-1 rounded-full bg-emerald-400/10 blur-md" />
              <svg viewBox="0 0 44 44" className="relative w-full h-full -rotate-90">
                <circle
                  cx="22" cy="22" r="19"
                  fill="none" strokeWidth="3"
                  className="stroke-black/8 dark:stroke-white/10"
                />
                <circle
                  cx="22" cy="22" r="19"
                  fill="none" strokeWidth="3"
                  strokeLinecap="round"
                  stroke="url(#ringGrad)"
                  strokeDasharray={2 * Math.PI * 19}
                  strokeDashoffset={(2 * Math.PI * 19) * (1 - readiness / 100)}
                  className="transition-all duration-1000 ease-out"
                />
                <defs>
                  <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#34d399" />
                    <stop offset="100%" stopColor="#10b981" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-lg font-black leading-none tabular-nums text-[#1a1a19] dark:text-[#f5f4f1]">
                  {readiness}
                </span>
                <span className="text-[9px] font-bold text-emerald-500 leading-none mt-0.5">%</span>
              </div>
            </div>
          )}

          {/* Title + subtitle */}
          <div className="min-w-0">
            {subtitle && (
              <span className="inline-flex items-center mb-1 text-[11px] font-semibold tracking-widest uppercase px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/8 text-[#8a8986] dark:text-[#6f6e6b]">
                {subtitle}
              </span>
            )}
            {title && (
              <h1 className="text-xl font-bold tracking-tight truncate text-[#1a1a19] dark:text-[#f5f4f1]">
                {title}
              </h1>
            )}
            {readinessLabel && (
              <span className="inline-flex items-center gap-1 mt-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                {readinessLabel}
              </span>
            )}
          </div>
        </div>

        {/* Stats — frosted glass pills, pushed right */}
        {stats && stats.length > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            {stats.map((stat, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-xl",
                  "backdrop-blur-sm",
                  colorStyles[stat.color || "slate"]
                )}
              >
                {stat.icon && (
                  <span className="opacity-70 [&>svg]:w-3.5 [&>svg]:h-3.5">{stat.icon}</span>
                )}
                <span className="text-base font-black tabular-nums leading-none">
                  {stat.value}
                </span>
                <span className="text-[11px] font-semibold opacity-60 uppercase tracking-wide">
                  {stat.label}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Right: Badges + Actions */}
        {(badges?.length || actions) ? (
          <div className="flex items-center gap-2 pl-5 shrink-0"
            style={{ borderLeft: '1px solid rgba(0,0,0,0.07)' }}
          >
            {badges && badges.length > 0 && badges.map((badge, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full backdrop-blur-sm",
                  "shadow-[0_1px_4px_0_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.5)]",
                  "dark:shadow-[0_1px_4px_0_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.06)]",
                  badge.color === 'orange'
                    ? 'bg-orange-50 dark:bg-orange-500/15 border border-orange-200/80 dark:border-orange-500/25 text-orange-600 dark:text-orange-300'
                    : badge.color === 'blue'
                    ? 'bg-blue-50 dark:bg-blue-500/15 border border-blue-200/80 dark:border-blue-500/25 text-blue-600 dark:text-blue-300'
                    : badge.color === 'emerald'
                    ? 'bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200/80 dark:border-emerald-500/25 text-emerald-600 dark:text-emerald-300'
                    : 'bg-violet-50 dark:bg-violet-500/15 border border-violet-200/80 dark:border-violet-500/25 text-violet-600 dark:text-violet-300'
                )}
              >
                {badge.icon ? (
                  <span className="[&>svg]:w-4 [&>svg]:h-4">{badge.icon}</span>
                ) : badge.type === "streak" ? (
                  <span className="text-base leading-none">🔥</span>
                ) : badge.type === "points" ? (
                  <span className="text-sm font-bold leading-none">✦</span>
                ) : null}
                <span className="text-sm font-bold tabular-nums">{badge.value}</span>
              </div>
            ))}
            {actions && <div className="flex items-center gap-2">{actions}</div>}
          </div>
        ) : null}
      </div>
    </div>
  );
}
