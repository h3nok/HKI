/**
 * TaskProgress - Agent Task Progress Indicator
 * 
 * Shows overall progress of an agentic task with:
 * - Visual step indicators
 * - Current step highlight
 * - Time estimates
 * - CSS variable theming
 */

import { motion } from 'framer-motion';
import {
    CheckCircle2,
    Circle,
    Loader2,
    Clock,
    AlertCircle
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

export type StepStatus = 'pending' | 'running' | 'complete' | 'error';

export interface TaskStep {
    id: string;
    label: string;
    status: StepStatus;
    duration?: number; // in ms
}

export interface TaskProgressProps {
    steps: TaskStep[];
    currentStepId?: string;
    estimatedTimeRemaining?: number; // in seconds
    className?: string;
}

// ============================================================================
// CONFIG
// ============================================================================

const statusConfig = {
    pending: {
        icon: Circle,
        color: 'var(--muted-foreground)',
        bgColor: 'transparent',
    },
    running: {
        icon: Loader2,
        color: 'var(--primary)',
        bgColor: 'color-mix(in srgb, var(--primary) 15%, transparent)',
    },
    complete: {
        icon: CheckCircle2,
        color: 'var(--success, #16a34a)',
        bgColor: 'color-mix(in srgb, var(--success, #16a34a) 15%, transparent)',
    },
    error: {
        icon: AlertCircle,
        color: 'var(--destructive)',
        bgColor: 'color-mix(in srgb, var(--destructive) 15%, transparent)',
    },
};

// ============================================================================
// HELPERS
// ============================================================================

function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ${seconds % 60}s`;
}

function formatTimeRemaining(seconds: number): string {
    if (seconds < 60) return `~${seconds}s remaining`;
    const minutes = Math.floor(seconds / 60);
    return `~${minutes}m remaining`;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function TaskProgress({
    steps,
    currentStepId,
    estimatedTimeRemaining,
    className = '',
}: TaskProgressProps) {
    const completedSteps = steps.filter(s => s.status === 'complete').length;
    const progressPercent = (completedSteps / steps.length) * 100;

    return (
        <div
            className={`rounded-xl border p-4 ${className}`}
            style={{
                background: 'var(--card)',
                borderColor: 'var(--border)',
            }}
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <span
                        className="text-sm font-semibold"
                        style={{ color: 'var(--foreground)' }}
                    >
                        Task Progress
                    </span>
                    <span
                        className="text-xs font-medium px-2 py-0.5 rounded-full"
                        style={{
                            background: 'color-mix(in srgb, var(--primary) 15%, transparent)',
                            color: 'var(--primary)',
                        }}
                    >
                        {completedSteps}/{steps.length}
                    </span>
                </div>
                {estimatedTimeRemaining !== undefined && (
                    <div
                        className="flex items-center gap-1 text-xs"
                        style={{ color: 'var(--muted-foreground)' }}
                    >
                        <Clock className="w-3 h-3" />
                        {formatTimeRemaining(estimatedTimeRemaining)}
                    </div>
                )}
            </div>

            {/* Progress Bar */}
            <div
                className="h-1.5 rounded-full mb-4 overflow-hidden"
                style={{ background: 'color-mix(in srgb, var(--muted) 100%, transparent)' }}
            >
                <motion.div
                    className="h-full rounded-full"
                    style={{ background: 'var(--primary)' }}
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercent}%` }}
                    transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                />
            </div>

            {/* Steps */}
            <div className="space-y-2">
                {steps.map((step, index) => {
                    const config = statusConfig[step.status];
                    const Icon = config.icon;
                    const isCurrent = step.id === currentStepId;

                    return (
                        <motion.div
                            key={step.id}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.03 }}
                            className="flex items-center gap-3 p-2 rounded-lg transition-colors"
                            style={{
                                background: isCurrent ? config.bgColor : 'transparent',
                            }}
                        >
                            {/* Status Icon */}
                            <div className="relative">
                                {step.status === 'running' ? (
                                    <motion.div
                                        animate={{ rotate: 360 }}
                                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                    >
                                        <Icon
                                            className="w-4 h-4"
                                            style={{ color: config.color }}
                                        />
                                    </motion.div>
                                ) : (
                                    <Icon
                                        className="w-4 h-4"
                                        style={{ color: config.color }}
                                    />
                                )}

                                {/* Pulse for current step */}
                                {isCurrent && step.status === 'running' && (
                                    <motion.div
                                        className="absolute inset-0 rounded-full"
                                        style={{ border: `2px solid ${config.color}` }}
                                        animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                                        transition={{ duration: 1, repeat: Infinity }}
                                    />
                                )}
                            </div>

                            {/* Label */}
                            <span
                                className="flex-1 text-sm"
                                style={{
                                    color: step.status === 'pending'
                                        ? 'var(--muted-foreground)'
                                        : 'var(--foreground)',
                                    fontWeight: isCurrent ? 500 : 400,
                                }}
                            >
                                {step.label}
                            </span>

                            {/* Duration */}
                            {step.duration !== undefined && step.status === 'complete' && (
                                <span
                                    className="text-[11px]"
                                    style={{ color: 'var(--muted-foreground)' }}
                                >
                                    {formatDuration(step.duration)}
                                </span>
                            )}
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
}

// ============================================================================
// COMPACT VARIANT
// ============================================================================

export function TaskProgressCompact({
    steps,
    className = '',
}: { steps: TaskStep[]; className?: string }) {
    const completedSteps = steps.filter(s => s.status === 'complete').length;
    const progressPercent = (completedSteps / steps.length) * 100;

    return (
        <div className={`flex items-center gap-2 ${className}`}>
            <div
                className="flex-1 h-1 rounded-full overflow-hidden"
                style={{ background: 'color-mix(in srgb, var(--muted) 100%, transparent)' }}
            >
                <motion.div
                    className="h-full rounded-full"
                    style={{ background: 'var(--primary)' }}
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercent}%` }}
                    transition={{ duration: 0.3 }}
                />
            </div>
            <span
                className="text-[11px] font-medium shrink-0"
                style={{ color: 'var(--muted-foreground)' }}
            >
                {completedSteps}/{steps.length}
            </span>
        </div>
    );
}
