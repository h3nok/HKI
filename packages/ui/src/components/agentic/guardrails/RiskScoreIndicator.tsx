/**
 * RiskScoreIndicator — Animated Risk Gauge
 *
 * Radial score display (0–100) with color-coded arc.
 * Uses design-system motion tokens for smooth animated fill.
 *
 * Risk categories: negligible (0-15), low (16-35), moderate (36-55),
 * high (56-80), critical (81-100)
 */

import { motion } from 'framer-motion';
import { AlertTriangle, Shield, ShieldCheck, ShieldAlert, Skull } from 'lucide-react';
import { cn } from '../../../utils';

// ============================================================================
// Types
// ============================================================================

export type RiskLevel = 'negligible' | 'low' | 'moderate' | 'high' | 'critical';

export interface RiskFactor {
  name: string;
  score: number; // 0-100
  description?: string;
}

export interface RiskScoreIndicatorProps {
  /** Risk score from 0-100 */
  score: number;
  /** Optional breakdown of risk factors */
  factors?: RiskFactor[];
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Show the factor breakdown list */
  showBreakdown?: boolean;
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// Config
// ============================================================================

const getRiskLevel = (score: number): RiskLevel => {
  if (score <= 15) return 'negligible';
  if (score <= 35) return 'low';
  if (score <= 55) return 'moderate';
  if (score <= 80) return 'high';
  return 'critical';
};

const riskConfig: Record<RiskLevel, {
  textColorClass: string;
  arcColor: string; // Used for SVG stroke explicitly
  bgClass: string;
  borderColorClass: string;
  icon: typeof Shield;
  label: string;
  description: string;
}> = {
  negligible: {
    textColorClass: 'text-emerald-600 dark:text-emerald-500',
    arcColor: 'var(--success, #16a34a)',
    bgClass: 'bg-emerald-500/10',
    borderColorClass: 'border-emerald-500/20',
    icon: ShieldCheck,
    label: 'Negligible',
    description: 'No significant risks detected in operation.',
  },
  low: {
    textColorClass: 'text-emerald-600 dark:text-emerald-500',
    arcColor: 'color-mix(in srgb, var(--success, #16a34a) 70%, var(--warning, #d97706) 30%)',
    bgClass: 'bg-emerald-500/10',
    borderColorClass: 'border-emerald-500/20',
    icon: ShieldCheck,
    label: 'Low Risk',
    description: 'Minor risks contained within acceptable tolerance range.',
  },
  moderate: {
    textColorClass: 'text-amber-600 dark:text-amber-500',
    arcColor: 'var(--warning, #d97706)',
    bgClass: 'bg-amber-500/10',
    borderColorClass: 'border-amber-500/20',
    icon: AlertTriangle,
    label: 'Moderate',
    description: 'Noticeable risk factors present. Proceed with operational awareness.',
  },
  high: {
    textColorClass: 'text-destructive',
    arcColor: 'color-mix(in srgb, var(--warning, #d97706) 30%, var(--destructive) 70%)',
    bgClass: 'bg-destructive/10',
    borderColorClass: 'border-destructive/20',
    icon: ShieldAlert,
    label: 'High Risk',
    description: 'Significant potential system or data risks flagged.',
  },
  critical: {
    textColorClass: 'text-destructive',
    arcColor: 'var(--destructive)',
    bgClass: 'bg-destructive/20',
    borderColorClass: 'border-destructive/40',
    icon: Skull,
    label: 'Critical',
    description: 'CRITICAL OPERATION HALT PROTOCOLS RECOMMENDED.',
  },
};

const sizeConfig = {
  sm: { gauge: 80, stroke: 6, fontSize: 18, labelSize: 'text-[10px]' },
  md: { gauge: 120, stroke: 8, fontSize: 26, labelSize: 'text-[11px]' },
  lg: { gauge: 160, stroke: 12, fontSize: 40, labelSize: 'text-sm' },
};

// ============================================================================
// Gauge Sub-Component
// ============================================================================

function RiskGauge({
  score,
  size,
  config,
}: {
  score: number;
  size: 'sm' | 'md' | 'lg';
  config: typeof riskConfig.negligible;
}) {
  const s = sizeConfig[size];
  const radius = (s.gauge - s.stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  // Show 270° arc (3/4 of the circle)
  const arcLength = circumference * 0.75;
  const filledLength = arcLength * (score / 100);
  const center = s.gauge / 2;

  return (
    <div
      className="relative shrink-0 flex items-center justify-center p-2 rounded-2xl bg-black/5 dark:bg-white/5 border border-border/20 shadow-inner"
      style={{ width: s.gauge + 16, height: s.gauge + 16 }}
      role="meter"
      aria-valuenow={Math.round(score)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Risk score: ${Math.round(score)} out of 100`}
    >
      <svg width={s.gauge} height={s.gauge} className="-rotate-135 drop-shadow-md" aria-hidden="true">
        {/* Background arc */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="currentColor"
          className="text-muted/40"
          strokeWidth={s.stroke}
          strokeDasharray={`${arcLength} ${circumference}`}
          strokeLinecap="round"
        />
        {/* Filled arc — animated */}
        <motion.circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={config.arcColor}
          strokeWidth={s.stroke}
          strokeLinecap="round"
          strokeDasharray={`${filledLength} ${circumference}`}
          initial={{ strokeDasharray: `0 ${circumference}` }}
          animate={{ strokeDasharray: `${filledLength} ${circumference}` }}
          transition={{ type: "spring", stiffness: 45, damping: 12, mass: 1, delay: 0.1 }}
        />
      </svg>
      {/* Score text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <motion.span
          className={cn("font-extrabold tabular-nums tracking-tighter mix-blend-plus-darker dark:mix-blend-plus-lighter", config.textColorClass)}
          style={{ fontSize: s.fontSize, lineHeight: 1 }}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 100, damping: 15, delay: 0.3 }}
        >
          {Math.round(score)}
        </motion.span>
        <span
          className={cn('font-bold uppercase tracking-widest mt-0.5 opacity-60')}
          style={{ fontSize: s.gauge > 100 ? 10 : 8 }}
        >
          / 100
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function RiskScoreIndicator({
  score,
  factors,
  size = 'md',
  showBreakdown = true,
  className,
}: RiskScoreIndicatorProps) {
  const clampedScore = Math.max(0, Math.min(100, score));
  const level = getRiskLevel(clampedScore);
  const config = riskConfig[level];
  const Icon = config.icon;

  return (
    <div
      className={cn('rounded-[24px] overflow-hidden bg-card/50 backdrop-blur-2xl border shadow-sm', config.borderColorClass, className)}
      data-component="RiskScoreIndicator"
    >
      {/* Header Container */}
      <div
        className={cn('flex items-center gap-5 p-5 transition-colors duration-500', config.bgClass)}
      >
        <RiskGauge score={clampedScore} size={size} config={config} />

        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-1">
            <div className={cn('p-1.5 rounded-lg bg-black/5 dark:bg-white/5 shadow-inner', config.textColorClass)}>
                <Icon className="h-5 w-5 shrink-0" strokeWidth={2.5}/>
            </div>
            <span
              className={cn('text-[14px] font-extrabold uppercase tracking-widest', config.textColorClass)}
            >
              {config.label}
            </span>
          </div>
          <p className="text-[12px] leading-relaxed font-medium text-foreground/70 tracking-wide mt-1">
            {config.description}
          </p>
        </div>
      </div>

      {/* Breakdown Details */}
      {showBreakdown && factors && factors.length > 0 && (
        <div
          className="p-5 space-y-4 bg-muted/10 border-t border-border/30 relative z-10"
        >
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80">
            Computed Risk Vectors
          </span>
          {factors.map((factor, i) => {
            const factorLevel = getRiskLevel(factor.score);
            const factorConfig = riskConfig[factorLevel];
            return (
              <motion.div 
                key={`${factor.name}-${i}`} 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: i * 0.1 }}
                className="space-y-1.5 p-3 rounded-xl bg-card/60 shadow-sm border border-border/40"
              >
                <div className="flex items-center justify-between pb-1">
                  <span className="text-[12px] font-bold tracking-wide text-foreground/90 uppercase">
                    {factor.name}
                  </span>
                  <span className={cn('text-[13px] font-black tabular-nums tracking-widest', factorConfig.textColorClass)}>
                    {Math.round(factor.score)}
                  </span>
                </div>
                
                {/* Embedded Progress Bar */}
                <div className="h-2 rounded-full overflow-hidden bg-muted/60 relative">
                  <motion.div
                    className="absolute top-0 bottom-0 left-0 rounded-full"
                    style={{ background: factorConfig.arcColor }}
                    initial={{ width: 0 }}
                    animate={{ width: `${factor.score}%` }}
                    transition={{
                      type: "spring",
                      stiffness: 60,
                      damping: 14,
                      delay: i * 0.1 + 0.3,
                    }}
                  />
                  {/* Subtle Ambient Sub-Glow for high risks */}
                  {factor.score > 55 && (
                      <motion.div
                      className="absolute top-0 bottom-0 left-0 rounded-full blur-md opacity-40 mix-blend-color-dodge"
                      style={{ background: factorConfig.arcColor }}
                      initial={{ width: 0 }}
                      animate={{ width: `${factor.score}%` }}
                      transition={{
                        type: "spring",
                        stiffness: 60,
                        damping: 14,
                        delay: i * 0.1 + 0.3,
                      }}
                    />
                  )}
                </div>
                
                {factor.description && (
                  <p className="text-[11px] font-medium text-muted-foreground/70 leading-snug tracking-wide pt-1">
                    {factor.description}
                  </p>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

RiskScoreIndicator.displayName = 'RiskScoreIndicator';

export default RiskScoreIndicator;
