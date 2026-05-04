/**
 * ConfidenceIndicator - Agent Confidence Score Display
 * 
 * Shows how confident the agent is in its response with visual feedback.
 * Helps users understand the reliability of agent outputs.
 * 
 * Features:
 * - Color-coded confidence levels
 * - Animated progress bar
 * - Tooltip with explanation
 * - Thresholds: High (80+), Medium (50-79), Low (<50)
 */

import { motion } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Info,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../tooltip';
import { cn } from '../../../utils';

// ============================================================================
// TYPES
// ============================================================================

export interface ConfidenceIndicatorProps {
  score: number; // 0-100
  label?: string;
  showBar?: boolean;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
  explanation?: string;
  className?: string;
}

// ============================================================================
// DESIGN CONFIG
// ============================================================================

const getConfidenceLevel = (score: number) => {
  if (score >= 80) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
};

const confidenceConfig = {
  high: {
    color: 'var(--success, #16a34a)',
    bgColor: 'color-mix(in srgb, var(--success, #16a34a) 12%, transparent)',
    label: 'High Confidence',
    icon: TrendingUp,
    description: 'The agent is highly confident in this response based on strong evidence.',
  },
  medium: {
    color: 'var(--warning, #d97706)',
    bgColor: 'color-mix(in srgb, var(--warning, #d97706) 12%, transparent)',
    label: 'Medium Confidence',
    icon: Minus,
    description: 'The agent has moderate confidence. Consider verifying critical details.',
  },
  low: {
    color: 'var(--destructive)',
    bgColor: 'color-mix(in srgb, var(--destructive) 12%, transparent)',
    label: 'Low Confidence',
    icon: TrendingDown,
    description: 'The agent has low confidence. Please verify this information independently.',
  },
};

const sizeConfig = {
  sm: {
    text: 'text-xs',
    barHeight: 'h-1',
    icon: 'h-3 w-3',
    padding: 'px-2 py-0.5',
  },
  md: {
    text: 'text-sm',
    barHeight: 'h-1.5',
    icon: 'h-3.5 w-3.5',
    padding: 'px-2.5 py-1',
  },
  lg: {
    text: 'text-base',
    barHeight: 'h-2',
    icon: 'h-4 w-4',
    padding: 'px-3 py-1.5',
  },
};

// ============================================================================
// COMPONENT
// ============================================================================

export function ConfidenceIndicator({
  score,
  label,
  showBar = true,
  showIcon = true,
  size = 'sm',
  explanation,
  className,
}: ConfidenceIndicatorProps) {
  const level = getConfidenceLevel(score);
  const config = confidenceConfig[level];
  const sizeStyles = sizeConfig[size];
  const Icon = config.icon;

  const displayLabel = label || config.label;
  const displayExplanation = explanation || config.description;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "inline-flex items-center gap-2 rounded-lg",
              "transition-all duration-200",
              sizeStyles.padding,
              className
            )}
            style={{
              background: config.bgColor,
              border: `1px solid color-mix(in srgb, ${config.color} 25%, var(--border))`,
            }}
          >
            {/* Icon */}
            {showIcon && (
              <Icon
                className={cn(sizeStyles.icon, "shrink-0")}
                style={{ color: config.color }}
              />
            )}

            {/* Label and Score */}
            <div className="flex items-center gap-2">
              <span
                className={cn("font-medium", sizeStyles.text)}
                style={{ color: config.color }}
              >
                {displayLabel}
              </span>
              <span
                className={cn("font-bold", sizeStyles.text)}
                style={{ color: config.color }}
              >
                {Math.round(score)}%
              </span>
            </div>

            {/* Info Icon */}
            <Info
              className={cn(sizeStyles.icon, "shrink-0 opacity-60")}
              style={{ color: config.color }}
            />
          </div>
        </TooltipTrigger>

        <TooltipContent
          side="top"
          className="max-w-xs"
          style={{
            background: 'var(--popover, var(--card))',
            color: 'var(--popover-foreground, var(--card-foreground))',
            border: '1px solid var(--border)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          }}
        >
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4" style={{ color: config.color }} />
              <span className="font-semibold" style={{ color: 'var(--foreground)' }}>
                {config.label}
              </span>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
              {displayExplanation}
            </p>
            {showBar && (
              <div className="pt-2">
                <div
                  className={cn("w-full rounded-full overflow-hidden", sizeStyles.barHeight)}
                  style={{ background: 'var(--muted)' }}
                >
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${score}%` }}
                    transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                    className="h-full"
                    style={{ background: config.color }}
                  />
                </div>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ============================================================================
// COMPACT VARIANT - Progress Bar Only
// ============================================================================

export interface ConfidenceBarProps {
  score: number;
  height?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export function ConfidenceBar({
  score,
  height = 'sm',
  showLabel = false,
  className,
}: ConfidenceBarProps) {
  const level = getConfidenceLevel(score);
  const config = confidenceConfig[level];
  const heightClass = height === 'sm' ? 'h-1' : height === 'md' ? 'h-1.5' : 'h-2';

  return (
    <div className={cn("w-full space-y-1", className)}>
      {showLabel && (
        <div className="flex items-center justify-between text-xs">
          <span style={{ color: 'var(--muted-foreground)' }}>Confidence</span>
          <span className="font-medium" style={{ color: config.color }}>
            {Math.round(score)}%
          </span>
        </div>
      )}
      <div
        className={cn("w-full rounded-full overflow-hidden", heightClass)}
        style={{ background: 'var(--muted)' }}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="h-full"
          style={{ background: config.color }}
        />
      </div>
    </div>
  );
}
