/**
 * StreamingIndicator — Agent Activity Status
 *
 * Clean, understated activity indicator.
 * Single animation per state — no stacking.
 *
 * Statuses: thinking, planning, searching, executing, generating
 */

import { motion } from 'framer-motion';
import { Brain, Zap, Search, Wrench, Sparkles } from 'lucide-react';
import { cn } from '../../../utils';

// ============================================================================
// TYPES
// ============================================================================

export type StreamingStatus =
    | 'thinking'
    | 'planning'
    | 'searching'
    | 'executing'
    | 'generating';

export interface StreamingIndicatorProps {
    status: StreamingStatus;
    message?: string;
    className?: string;
}

// ============================================================================
// CONFIG
// ============================================================================

const statusConfig: Record<StreamingStatus, {
    icon: typeof Brain;
    label: string;
    textColor: string;
    bgColor: string;
    borderColor: string;
}> = {
    thinking: {
        icon: Brain,
        label: 'Thinking',
        textColor: 'text-primary',
        bgColor: 'bg-primary/10',
        borderColor: 'border-primary/20',
    },
    planning: {
        icon: Zap,
        label: 'Planning',
        textColor: 'text-amber-500',
        bgColor: 'bg-amber-500/10',
        borderColor: 'border-amber-500/20',
    },
    searching: {
        icon: Search,
        label: 'Searching',
        textColor: 'text-sky-500',
        bgColor: 'bg-sky-500/10',
        borderColor: 'border-sky-500/20',
    },
    executing: {
        icon: Wrench,
        label: 'Executing',
        textColor: 'text-primary',
        bgColor: 'bg-primary/10',
        borderColor: 'border-primary/20',
    },
    generating: {
        icon: Sparkles,
        label: 'Generating',
        textColor: 'text-emerald-500',
        bgColor: 'bg-emerald-500/10',
        borderColor: 'border-emerald-500/20',
    },
};

// ============================================================================
// COMPONENT — clean, single-animation
// ============================================================================

export function StreamingIndicator({
    status,
    message,
    className = '',
}: StreamingIndicatorProps) {
    const config = statusConfig[status];
    const Icon = config.icon;

    return (
        <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-2xl border backdrop-blur-xl relative overflow-hidden',
                config.bgColor,
                config.borderColor,
                className
            )}
        >
            {/* Ambient Underglow Pulse */}
            <motion.div
                className={cn('absolute inset-0 opacity-[0.15] blur-xl rounded-full', config.bgColor)}
                animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.25, 0.1] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            />

            {/* Icon — single gentle pulse */}
            <motion.div
                animate={{ opacity: [0.6, 1, 0.6] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                className={cn('relative z-10 shrink-0 p-1.5 rounded-lg border', config.bgColor, config.borderColor)}
            >
                <Icon className={cn('w-4 h-4', config.textColor)} />
            </motion.div>

            {/* Content */}
            <div className="flex-1 min-w-0 relative z-10">
                <span className={cn('text-[13px] font-bold tracking-wide uppercase', config.textColor)}>
                    {config.label}
                </span>
                {message && (
                    <p className="text-[11px] font-medium truncate mt-0.5 text-foreground/60">
                        {message}
                    </p>
                )}
            </div>

            {/* Premium Orb Dots */}
            <span className="flex gap-1 shrink-0 relative z-10 p-1">
                {[0, 1, 2].map((i) => (
                    <motion.div
                        key={i}
                        className={cn('rounded-full w-1.5 h-1.5', config.bgColor.replace('/10', '/80'))}
                        initial={{ opacity: 0.2, scale: 0.8 }}
                        animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.1, 0.8] }}
                        transition={{
                            duration: 1.2,
                            repeat: Infinity,
                            delay: i * 0.2,
                            ease: 'easeInOut',
                        }}
                    />
                ))}
            </span>
        </motion.div>
    );
}

// ============================================================================
// COMPACT — pill variant
// ============================================================================

export function StreamingIndicatorCompact({
    status,
    className = '',
}: { status: StreamingStatus; className?: string }) {
    const config = statusConfig[status];
    const Icon = config.icon;

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={cn(
                'inline-flex items-center gap-2 px-3 py-1.5 rounded-full border backdrop-blur-md relative overflow-hidden',
                config.bgColor,
                config.borderColor,
                className
            )}
        >
            <motion.div
                className={cn('absolute inset-0 opacity-[0.1]', config.bgColor.replace('/10', '/60'))}
                animate={{ opacity: [0.05, 0.15, 0.05] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            />
            
            <motion.div
                animate={{ opacity: [0.6, 1, 0.6], scale: [0.95, 1, 0.95] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                className="relative z-10"
            >
                <Icon className={cn('w-3.5 h-3.5', config.textColor)} strokeWidth={2.5} />
            </motion.div>
            <span className={cn('text-[11px] font-bold tracking-wider uppercase relative z-10', config.textColor)}>
                {config.label}
            </span>
        </motion.div>
    );
}
