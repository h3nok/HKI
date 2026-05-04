/**
 * GuardrailAlert Component
 *
 * Category: guardrails
 * Priority: P0 (Core)
 * Complexity: Medium
 *
 * Displays safety guardrail check results with expandable details.
 * - Glassmorphic agentic styling (surface-tinted variants)
 * - Animated expanding/collapsing lists
 * - Premium HKI brand safety colors
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronDown,
} from 'lucide-react';
import { cn } from '../../../utils';

// ============================================================================
// Types
// ============================================================================

export type GuardrailCheckStatus = 'pass' | 'warn' | 'fail';
export type GuardrailOverallStatus = 'safe' | 'warning' | 'blocked';

export interface GuardrailCheck {
  /** Name of the guardrail check */
  name: string;
  /** Check result status */
  status: GuardrailCheckStatus;
  /** Optional message explaining the result */
  message?: string;
}

export interface GuardrailAlertProps {
  /** Array of guardrail checks */
  checks: GuardrailCheck[];
  /** Overall status based on all checks */
  overallStatus: GuardrailOverallStatus;
  /** Additional CSS classes */
  className?: string;
  /** Whether to show in compact mode */
  compact?: boolean;
  /** Callback when alert is clicked */
  onClick?: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const overallStatusConfig: Record<GuardrailOverallStatus, {
  icon: React.ElementType;
  colorClass: string;
  bgClass: string;
  borderClass: string;
  surfaceClass: string;
  label: string;
}> = {
  safe: {
    icon: ShieldCheck,
    colorClass: 'text-emerald-600 dark:text-emerald-500',
    bgClass: 'bg-emerald-500/10',
    borderClass: 'border-emerald-500/20',
    surfaceClass: 'bg-emerald-500/[0.03] border-emerald-500/[0.12]',
    label: 'Safe',
  },
  warning: {
    icon: ShieldAlert,
    colorClass: 'text-amber-600 dark:text-amber-500',
    bgClass: 'bg-amber-500/10',
    borderClass: 'border-amber-500/20',
    surfaceClass: 'bg-amber-500/[0.03] border-amber-500/[0.12]',
    label: 'Warning',
  },
  blocked: {
    icon: XCircle,
    colorClass: 'text-destructive',
    bgClass: 'bg-destructive/10',
    borderClass: 'border-destructive/20',
    surfaceClass: 'surface-tinted-red', // Core red warning pattern
    label: 'Blocked',
  },
};

const checkStatusConfig: Record<GuardrailCheckStatus, {
  icon: React.ElementType;
  colorClass: string;
}> = {
  pass: {
    icon: CheckCircle2,
    colorClass: 'text-emerald-600 dark:text-emerald-500',
  },
  warn: {
    icon: AlertTriangle,
    colorClass: 'text-amber-600 dark:text-amber-500',
  },
  fail: {
    icon: XCircle,
    colorClass: 'text-destructive',
  },
};

// ============================================================================
// Main Component
// ============================================================================

export const GuardrailAlert: React.FC<GuardrailAlertProps> = ({
  checks,
  overallStatus,
  className,
  compact = false,
  onClick,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const config = overallStatusConfig[overallStatus];
  const StatusIcon = config.icon;

  const passedChecks = checks.filter((c) => c.status === 'pass').length;
  const totalChecks = checks.length;
  const hasChecks = totalChecks > 0;

  // COMPACT MODE
  if (compact) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'inline-flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs font-semibold backdrop-blur-sm transition-all hover:brightness-110 active:scale-95 border',
          config.bgClass,
          config.colorClass,
          config.borderClass,
          className
        )}
        data-component="GuardrailAlert"
      >
        <Shield className="h-3.5 w-3.5 opacity-90" />
        <span className="tracking-wide uppercase leading-none">{config.label}</span>
        <span className="opacity-60 font-medium">
          ({passedChecks}/{totalChecks})
        </span>
      </button>
    );
  }

  return (
    <motion.div
      initial={overallStatus === 'blocked' ? { x: [-10, 10, -10, 10, 0] } : false}
      transition={{ duration: 0.4, ease: 'easeInOut' }}
      className={cn(
        'rounded-2xl overflow-hidden backdrop-blur-xl shadow-lg transition-colors border relative',
        config.surfaceClass,
        overallStatus === 'blocked' && 'ring-1 ring-destructive pointer-events-none',
        className
      )}
      data-component="GuardrailAlert"
    >
      {/* Hazard Striping Array for Lockdown State */}
      {overallStatus === 'blocked' && (
         <div className="absolute inset-x-0 top-0 h-1.5 opacity-60" 
              style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(239, 68, 68, 0.4) 10px, rgba(239, 68, 68, 0.4) 20px)' }} 
         />
      )}
      {/* Header Button */}
      <button
        type="button"
        className={cn(
          'w-full flex items-center gap-4 px-5 py-4 text-left transition-colors relative outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
          hasChecks && 'cursor-pointer hover:bg-black/5 dark:hover:bg-white/5'
        )}
        onClick={() => hasChecks && setIsExpanded(!isExpanded)}
        aria-expanded={hasChecks ? isExpanded : undefined}
        aria-label={`Safety guardrails: ${config.label}. ${passedChecks} of ${totalChecks} checks passed.`}
      >
        {/* Glow effect for blocked states */}
        {overallStatus === 'blocked' && (
          <div className="absolute inset-x-0 -top-full h-full bg-destructive/10 blur-xl pointer-events-none" />
        )}

        <div className={cn('rounded-xl p-2.5 border shadow-sm', config.bgClass, config.borderClass)}>
          <StatusIcon className={cn('h-5 w-5', config.colorClass)} />
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-2.5">
            <h4 className="font-bold text-[13px] tracking-wide text-foreground uppercase">
              Security Protocol
            </h4>
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border',
                config.bgClass,
                config.colorClass,
                config.borderClass
              )}
            >
              {config.label}
            </span>
          </div>
          <p className="text-xs mt-1 text-muted-foreground/80 font-medium tracking-wide">
            {passedChecks} of {totalChecks} checks verified
          </p>
        </div>

        {hasChecks && (
          <div className="flex items-center justify-center p-1 rounded-full hover:bg-muted/50 transition-colors">
            <motion.div
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              <ChevronDown className="h-4 w-4 text-muted-foreground/70" />
            </motion.div>
          </div>
        )}
      </button>

      {/* Expanded Checks List */}
      <AnimatePresence initial={false}>
        {isExpanded && hasChecks && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
            className="overflow-hidden"
          >
            <div className="px-6 py-4 space-y-3.5 border-t border-border/40 bg-card/40 backdrop-blur-sm">
              {checks.map((check, index) => {
                const checkConfig = checkStatusConfig[check.status];
                const CheckIcon = checkConfig.icon;

                return (
                  <motion.div
                    key={`${check.name}-${index}`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05, duration: 0.3 }}
                    className="flex items-start gap-3 relative"
                  >
                    <CheckIcon
                      className={cn('h-4 w-4 mt-0.5 shrink-0 shadow-sm rounded-full', checkConfig.colorClass)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-foreground/90 tracking-tight">
                        {check.name}
                      </p>
                      {check.message && (
                        <p className="text-[11px] mt-1 text-muted-foreground/80 leading-relaxed font-medium">
                          {check.message}
                        </p>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

GuardrailAlert.displayName = 'GuardrailAlert';

export default GuardrailAlert;
