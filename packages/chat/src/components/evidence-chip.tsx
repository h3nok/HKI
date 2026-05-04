/**
 * EvidenceChip - World-Class Agentic Citation Component
 * 
 * Features:
 * - CSS variable theming for light/dark modes
 * - Reliability indicators with semantic colors
 * - Smooth animations with Framer Motion
 * - Accessible and keyboard-friendly
 */

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ExternalLink,
    FileText,
    ChevronDown,
    CheckCircle2,
    Database,
    Globe,
    FileCode
} from 'lucide-react';
import type { Citation } from '../types';

// ============================================================================
// TYPES
// ============================================================================

export interface EvidenceChipProps {
    citation: Citation;
    variant?: 'inline' | 'compact' | 'expanded';
    onClick?: (citation: Citation) => void;
    className?: string;
}

export interface EvidenceListProps {
    citations: Citation[];
    variant?: 'compact' | 'expanded';
    maxVisible?: number;
    className?: string;
}

// ============================================================================
// DESIGN TOKENS
// ============================================================================

const TOKENS = {
    animation: {
        duration: 0.2,
        ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
    },
} as const;

// ============================================================================
// RELIABILITY CONFIG
// ============================================================================

interface ReliabilityConfig {
    color: string;
    bgColor: string;
    label: string;
}

function getReliabilityConfig(score: number): ReliabilityConfig {
    if (score >= 0.9) {
        return {
            color: 'var(--success, #16a34a)',
            bgColor: 'color-mix(in srgb, var(--success, #16a34a) 12%, transparent)',
            label: 'High',
        };
    }
    if (score >= 0.7) {
        return {
            color: 'var(--primary)',
            bgColor: 'color-mix(in srgb, var(--primary) 12%, transparent)',
            label: 'Good',
        };
    }
    if (score >= 0.5) {
        return {
            color: 'var(--warning, #d97706)',
            bgColor: 'color-mix(in srgb, var(--warning, #d97706) 12%, transparent)',
            label: 'Medium',
        };
    }
    return {
        color: 'var(--destructive)',
        bgColor: 'color-mix(in srgb, var(--destructive) 12%, transparent)',
        label: 'Low',
    };
}

// Get source icon based on source type
function getSourceIcon(source: string) {
    if (source.includes('database') || source.includes('db')) return Database;
    if (source.includes('http') || source.includes('www')) return Globe;
    if (source.includes('code') || source.includes('api')) return FileCode;
    return FileText;
}

// ============================================================================
// EVIDENCE CHIP
// ============================================================================

export function EvidenceChip({
    citation,
    variant = 'inline',
    onClick,
    className = '',
}: EvidenceChipProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const chipRef = useRef<HTMLButtonElement>(null);
    const reliability = getReliabilityConfig(citation.relevanceScore);
    const SourceIcon = getSourceIcon(citation.source);

    const handleClick = () => {
        if (variant === 'inline') {
            setIsExpanded(!isExpanded);
        }
        onClick?.(citation);
    };

    // Compact: Just a number badge (like [1])
    if (variant === 'compact') {
        return (
            <motion.button
                ref={chipRef}
                type="button"
                onClick={handleClick}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`inline-flex items-center justify-center font-medium rounded-md transition-colors ${className}`}
                style={{
                    minWidth: 20,
                    height: 20,
                    padding: '0 6px',
                    fontSize: 11,
                    background: 'color-mix(in srgb, var(--primary) 15%, transparent)',
                    color: 'var(--primary)',
                }}
                title={citation.title}
                aria-label={`Citation: ${citation.title}`}
            >
                {citation.id}
            </motion.button>
        );
    }

    // Inline: Pill with source name
    if (variant === 'inline') {
        return (
            <span className={`inline-flex flex-col ${className}`}>
                <motion.button
                    ref={chipRef}
                    type="button"
                    onClick={handleClick}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="inline-flex items-center gap-1.5 rounded-full transition-all duration-150"
                    style={{
                        padding: '4px 10px',
                        fontSize: 12,
                        fontWeight: 500,
                        background: reliability.bgColor,
                        color: reliability.color,
                    }}
                    aria-expanded={isExpanded}
                >
                    <SourceIcon className="w-3 h-3 shrink-0" />
                    <span className="truncate max-w-24">{citation.source}</span>
                    <span style={{ opacity: 0.7 }}>
                        {Math.round(citation.relevanceScore * 100)}%
                    </span>
                    <motion.div
                        animate={{ rotate: isExpanded ? 180 : 0 }}
                        transition={{ duration: 0.15 }}
                    >
                        <ChevronDown className="w-3 h-3 shrink-0" />
                    </motion.div>
                </motion.button>

                {/* Expanded preview */}
                <AnimatePresence>
                    {isExpanded && (
                        <motion.div
                            initial={{ opacity: 0, height: 0, y: -8 }}
                            animate={{ opacity: 1, height: 'auto', y: 0 }}
                            exit={{ opacity: 0, height: 0, y: -8 }}
                            transition={{ duration: TOKENS.animation.duration, ease: TOKENS.animation.ease }}
                            className="overflow-hidden"
                        >
                            <div
                                className="mt-2 p-3 rounded-xl text-sm"
                                style={{
                                    background: 'var(--card)',
                                    border: '1px solid var(--border)',
                                    boxShadow: '0 4px 16px -4px color-mix(in srgb, var(--neutral-900) 10%, transparent)',
                                }}
                            >
                                <div className="flex items-start justify-between gap-2 mb-2">
                                    <h4
                                        className="font-medium line-clamp-2"
                                        style={{ color: 'var(--foreground)' }}
                                    >
                                        {citation.title}
                                    </h4>
                                    <span
                                        className="shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold"
                                        style={{
                                            background: reliability.bgColor,
                                            color: reliability.color,
                                        }}
                                    >
                                        {reliability.label}
                                    </span>
                                </div>
                                <p
                                    className="line-clamp-3 mb-2"
                                    style={{
                                        fontSize: 12,
                                        color: 'var(--muted-foreground)',
                                    }}
                                >
                                    {citation.snippet}
                                </p>
                                {citation.url && (
                                    <a
                                        href={citation.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-xs transition-colors hover:underline"
                                        style={{ color: 'var(--primary)' }}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        View source <ExternalLink className="w-3 h-3" />
                                    </a>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </span>
        );
    }

    // Expanded: Full card view
    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: TOKENS.animation.duration, ease: TOKENS.animation.ease }}
            className={`flex flex-col gap-2 p-4 rounded-xl ${className}`}
            style={{
                background: 'var(--card)',
                border: '1px solid var(--border)',
                boxShadow: '0 2px 8px -4px color-mix(in srgb, var(--neutral-900) 8%, transparent)',
            }}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                    <div
                        className="shrink-0 p-2 rounded-xl"
                        style={{ background: reliability.bgColor }}
                    >
                        <SourceIcon
                            className="w-4 h-4"
                            style={{ color: reliability.color }}
                        />
                    </div>
                    <div className="min-w-0">
                        <h4
                            className="font-medium text-sm truncate"
                            style={{ color: 'var(--foreground)' }}
                        >
                            {citation.title}
                        </h4>
                        <p
                            className="text-xs truncate"
                            style={{ color: 'var(--muted-foreground)' }}
                        >
                            {citation.source}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                    <CheckCircle2
                        className="w-4 h-4"
                        style={{ color: reliability.color }}
                    />
                    <span
                        className="text-xs font-semibold"
                        style={{ color: reliability.color }}
                    >
                        {Math.round(citation.relevanceScore * 100)}%
                    </span>
                </div>
            </div>

            <p
                className="line-clamp-2"
                style={{
                    fontSize: 12,
                    color: 'var(--muted-foreground)',
                }}
            >
                {citation.snippet}
            </p>

            {citation.url && (
                <a
                    href={citation.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs self-start transition-colors hover:underline"
                    style={{ color: 'var(--primary)' }}
                >
                    View source <ExternalLink className="w-3 h-3" />
                </a>
            )}
        </motion.div>
    );
}

// ============================================================================
// EVIDENCE LIST
// ============================================================================

export function EvidenceList({
    citations,
    variant = 'compact',
    maxVisible = 5,
    className = '',
}: EvidenceListProps) {
    const [showAll, setShowAll] = useState(false);

    const visible = showAll ? citations : citations.slice(0, maxVisible);
    const hasMore = citations.length > maxVisible;

    if (variant === 'compact') {
        return (
            <div className={`flex flex-wrap items-center gap-2 ${className}`}>
                <span
                    className="text-xs font-medium"
                    style={{ color: 'var(--muted-foreground)' }}
                >
                    Sources:
                </span>
                {visible.map((citation, index) => (
                    <motion.div
                        key={citation.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.05 }}
                    >
                        <EvidenceChip citation={citation} variant="inline" />
                    </motion.div>
                ))}
                {hasMore && !showAll && (
                    <motion.button
                        type="button"
                        onClick={() => setShowAll(true)}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="text-xs font-medium transition-colors hover:underline"
                        style={{ color: 'var(--primary)' }}
                    >
                        +{citations.length - maxVisible} more
                    </motion.button>
                )}
            </div>
        );
    }

    return (
        <div className={`flex flex-col gap-3 ${className}`}>
            <h4
                className="text-xs font-semibold uppercase tracking-wide"
                style={{ color: 'var(--muted-foreground)' }}
            >
                Sources ({citations.length})
            </h4>
            {visible.map((citation, index) => (
                <motion.div
                    key={citation.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                >
                    <EvidenceChip citation={citation} variant="expanded" />
                </motion.div>
            ))}
            {hasMore && !showAll && (
                <motion.button
                    type="button"
                    onClick={() => setShowAll(true)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="text-sm font-medium self-start transition-colors hover:underline"
                    style={{ color: 'var(--primary)' }}
                >
                    Show {citations.length - maxVisible} more sources
                </motion.button>
            )}
        </div>
    );
}
