/**
 * FactCheckIndicator — Claim Verification Status
 *
 * Shows users how well AI claims are supported by source evidence.
 * Designed for inline use alongside AI-generated text.
 *
 * Statuses: verified, partially_verified, unverified, disputed
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ShieldX,
  ChevronDown,
  ExternalLink,
} from 'lucide-react';
import { cn } from '../../../utils';

// ============================================================================
// Types
// ============================================================================

export type VerificationStatus = 'verified' | 'partially_verified' | 'unverified' | 'disputed';

export interface SourceEvidence {
  title: string;
  url?: string;
  reliability: 'high' | 'medium' | 'low';
}

export interface FactCheckIndicatorProps {
  /** Verification status */
  status: VerificationStatus;
  /** The claim being checked */
  claim?: string;
  /** Number of sources that support this claim */
  sourceCount?: number;
  /** Source quality score (0-100) */
  sourceQuality?: number;
  /** List of source evidence */
  sources?: SourceEvidence[];
  /** Variant: inline badge or full card */
  variant?: 'badge' | 'card';
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// Config
// ============================================================================

const statusConfig: Record<VerificationStatus, {
  icon: typeof CheckCircle2;
  textColor: string;
  bgClass: string;
  borderColorClass: string;
  label: string;
  description: string;
}> = {
  verified: {
    icon: CheckCircle2,
    textColor: 'text-emerald-600 dark:text-emerald-500',
    bgClass: 'bg-emerald-500/10',
    borderColorClass: 'border-emerald-500/20',
    label: 'Verified',
    description: 'This claim is directly supported by high-reliability enterprise sources.',
  },
  partially_verified: {
    icon: AlertCircle,
    textColor: 'text-amber-600 dark:text-amber-500',
    bgClass: 'bg-amber-500/10',
    borderColorClass: 'border-amber-500/20',
    label: 'Partially Verified',
    description: 'Portions of this claim are verifiable, but some context is missing or ambiguous.',
  },
  unverified: {
    icon: HelpCircle,
    textColor: 'text-muted-foreground',
    bgClass: 'bg-muted/50',
    borderColorClass: 'border-border/60',
    label: 'Unverified',
    description: 'No authoritative records exist within the datastore to corroborate this claim.',
  },
  disputed: {
    icon: ShieldX,
    textColor: 'text-destructive',
    bgClass: 'bg-destructive/10',
    borderColorClass: 'border-destructive/20',
    label: 'Disputed',
    description: 'Active records directly contradict this generated claim. Proceed with caution.',
  },
};

const reliabilityColors: Record<string, string> = {
  high: 'bg-emerald-500',
  medium: 'bg-amber-500',
  low: 'bg-destructive',
};

// ============================================================================
// Badge Variant
// ============================================================================

function FactCheckBadge({
  status,
  sourceCount,
  className,
}: Pick<FactCheckIndicatorProps, 'status' | 'sourceCount' | 'className'>) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-widest uppercase transition-all duration-300 border backdrop-blur-md',
        config.bgClass,
        config.textColor,
        config.borderColorClass,
        className
      )}
      data-component="FactCheckIndicator"
    >
      <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />
      <span>{config.label}</span>
      {sourceCount !== undefined && (
        <span className={cn('text-[9px] opacity-70 ml-0.5 font-bold')}>
          ({sourceCount})
        </span>
      )}
    </span>
  );
}

// ============================================================================
// Card Variant (Expandable)
// ============================================================================

function FactCheckCard({
  status,
  claim,
  sourceCount,
  sourceQuality,
  sources,
  className,
}: FactCheckIndicatorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        'rounded-2xl overflow-hidden glass-card transition-colors shadow-sm bg-card/50 backdrop-blur-xl border',
        config.borderColorClass,
        className
      )}
      data-component="FactCheckIndicator"
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'w-full flex items-center gap-4 p-4 text-left transition-all duration-300 outline-none focus-visible:ring-2 focus-visible:ring-primary/50 relative z-10',
          isExpanded ? config.bgClass.replace('/10', '/5') : 'hover:bg-black/5 dark:hover:bg-white/5'
        )}
        aria-expanded={isExpanded}
        aria-label={`${config.label}: ${claim || 'Fact check details'}. ${sourceCount !== undefined ? `${sourceCount} sources.` : ''}`}
      >
        <div
          className={cn(
            'flex items-center justify-center w-9 h-9 rounded-xl shrink-0 shadow-sm border',
            config.bgClass,
            config.borderColorClass
          )}
        >
          <Icon className={cn('h-5 w-5', config.textColor)} strokeWidth={2} />
        </div>

        <div className="flex-1 min-w-0 pr-2">
          <div className="flex items-center gap-2 mb-0.5">
            <span
              className={cn('text-[13px] font-bold uppercase tracking-wider', config.textColor)}
            >
              {config.label}
            </span>
            {sourceCount !== undefined && (
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-muted/50 text-muted-foreground font-bold tracking-widest border border-border/50 uppercase">
                {sourceCount} Src
              </span>
            )}
          </div>
          {claim && (
            <p className="text-[12px] font-medium truncate text-foreground/80">
              "{claim}"
            </p>
          )}
        </div>

        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="shrink-0 p-1 rounded-md text-muted-foreground/60 hover:text-foreground/80 hover:bg-muted/50 transition-colors"
        >
          <ChevronDown className="h-5 w-5" />
        </motion.div>
      </button>

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
            className="overflow-hidden bg-muted/10 relative z-0 border-t border-border/40"
          >
            <div className="p-4 space-y-5">
              {/* Description */}
              <p className="text-[13px] leading-relaxed font-medium text-foreground/80 pl-1 border-l-2 border-primary/20">
                {config.description}
              </p>

              {/* Source Quality */}
              {sourceQuality !== undefined && (
                <div className="space-y-1.5 p-3 rounded-xl bg-card/60 border border-border/50 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Quality Index
                    </span>
                    <span
                      className={cn(
                        'text-[12px] font-bold tracking-widest',
                        sourceQuality >= 70 ? 'text-emerald-500' : sourceQuality >= 40 ? 'text-amber-500' : 'text-destructive'
                      )}
                    >
                      {sourceQuality}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden bg-muted/60 relative isolate">
                    <motion.div
                      className={cn(
                        'absolute top-0 bottom-0 left-0 rounded-full',
                        sourceQuality >= 70 ? 'bg-emerald-500' : sourceQuality >= 40 ? 'bg-amber-500' : 'bg-destructive'
                      )}
                      initial={{ width: 0 }}
                      animate={{ width: `${sourceQuality}%` }}
                      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
                    />
                    {/* Ambient Glow */}
                    <motion.div
                      className={cn(
                        'absolute top-0 bottom-0 left-0 rounded-full blur-sm opacity-50',
                        sourceQuality >= 70 ? 'bg-emerald-500' : sourceQuality >= 40 ? 'bg-amber-500' : 'bg-destructive'
                      )}
                      initial={{ width: 0 }}
                      animate={{ width: `${sourceQuality}%` }}
                      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
                    />
                  </div>
                </div>
              )}

              {/* Sources List */}
              {sources && sources.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1">
                    Verified Sources
                  </span>
                  <div className="space-y-1.5">
                    {sources.map((source, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -5 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.2, delay: i * 0.05 + 0.1 }}
                        className="flex items-start gap-3 rounded-lg p-2.5 transition-colors hover:bg-black/5 dark:hover:bg-white/5 border border-transparent hover:border-border/50"
                      >
                        <div
                          className={cn('w-2 h-2 rounded-full shrink-0 mt-[5.5px] shadow-sm', reliabilityColors[source.reliability])}
                        />
                        <span className="text-[13px] font-medium leading-snug flex-1 text-foreground/90">
                          {source.title}
                        </span>
                        {source.url && (
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 p-1 rounded-md opacity-40 hover:opacity-100 hover:bg-primary/10 hover:text-primary transition-all"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ============================================================================
// Main Export
// ============================================================================

export function FactCheckIndicator(props: FactCheckIndicatorProps) {
  if (props.variant === 'badge') {
    return <FactCheckBadge {...props} />;
  }
  return <FactCheckCard {...props} />;
}

FactCheckIndicator.displayName = 'FactCheckIndicator';

export default FactCheckIndicator;
