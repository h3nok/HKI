/**
 * ContextPanel - Agent Memory & Context Display
 * 
 * Shows the agent's current context including:
 * - Active memories
 * - Retrieved documents
 * - Current session info
 * - CSS variable theming
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Database,
    FileText,
    Clock,
    Brain,
    ChevronDown,
    Trash2,
    Pin,
    Search,
    Hash,
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

export type ContextType = 'memory' | 'document' | 'session' | 'retrieval';

export interface ContextItem {
    id: string;
    type: ContextType;
    title: string;
    content: string;
    source?: string;
    timestamp?: string;
    relevance?: number; // 0-1
    isPinned?: boolean;
}

export interface ContextPanelProps {
    items: ContextItem[];
    maxTokens?: number;
    usedTokens?: number;
    onRemove?: (id: string) => void;
    onPin?: (id: string) => void;
    className?: string;
}

// ============================================================================
// CONFIG
// ============================================================================

const typeConfig = {
    memory: {
        icon: Brain,
        color: 'var(--primary)',
        label: 'Memory',
    },
    document: {
        icon: FileText,
        color: 'var(--info, #0284c7)',
        label: 'Document',
    },
    session: {
        icon: Clock,
        color: 'var(--warning, #d97706)',
        label: 'Session',
    },
    retrieval: {
        icon: Search,
        color: 'var(--success, #16a34a)',
        label: 'Retrieved',
    },
};

// ============================================================================
// COMPONENT
// ============================================================================

export function ContextPanel({
    items,
    maxTokens = 128000,
    usedTokens = 0,
    onRemove,
    onPin,
    className = '',
}: ContextPanelProps) {
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [filter, setFilter] = useState<ContextType | 'all'>('all');

    const filteredItems = filter === 'all'
        ? items
        : items.filter(item => item.type === filter);

    const tokenPercent = Math.min((usedTokens / maxTokens) * 100, 100);

    return (
        <div
            className={`rounded-xl border overflow-hidden ${className}`}
            style={{
                background: 'var(--card)',
                borderColor: 'var(--border)',
            }}
        >
            {/* Header */}
            <div
                className="p-3"
                style={{
                    background: 'color-mix(in srgb, var(--muted) 30%, transparent)',
                    borderBottom: '1px solid var(--border)',
                }}
            >
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <Database className="w-4 h-4" style={{ color: 'var(--primary)' }} />
                        <h4
                            className="text-sm font-semibold"
                            style={{ color: 'var(--foreground)' }}
                        >
                            Context
                        </h4>
                        <span
                            className="text-xs px-1.5 py-0.5 rounded-full"
                            style={{
                                background: 'color-mix(in srgb, var(--primary) 15%, transparent)',
                                color: 'var(--primary)',
                            }}
                        >
                            {items.length} items
                        </span>
                    </div>
                    <div
                        className="flex items-center gap-1 text-xs"
                        style={{ color: 'var(--muted-foreground)' }}
                    >
                        <Hash className="w-3 h-3" />
                        {usedTokens.toLocaleString()} / {maxTokens.toLocaleString()}
                    </div>
                </div>

                {/* Token usage bar */}
                <div
                    className="h-1 rounded-full overflow-hidden"
                    style={{ background: 'color-mix(in srgb, var(--muted) 100%, transparent)' }}
                >
                    <motion.div
                        className="h-full rounded-full"
                        style={{
                            background: tokenPercent > 80
                                ? 'var(--destructive)'
                                : tokenPercent > 60
                                    ? 'var(--warning, #d97706)'
                                    : 'var(--primary)',
                        }}
                        initial={{ width: 0 }}
                        animate={{ width: `${tokenPercent}%` }}
                        transition={{ duration: 0.5 }}
                    />
                </div>
            </div>

            {/* Filter tabs */}
            <div
                className="flex gap-1 p-2"
                style={{ borderBottom: '1px solid var(--border)' }}
            >
                {(['all', 'memory', 'document', 'retrieval', 'session'] as const).map((type) => (
                    <button
                        key={type}
                        type="button"
                        onClick={() => setFilter(type)}
                        className="px-2 py-1 rounded-lg text-[11px] font-medium transition-colors capitalize"
                        style={{
                            background: filter === type
                                ? 'color-mix(in srgb, var(--primary) 15%, transparent)'
                                : 'transparent',
                            color: filter === type
                                ? 'var(--primary)'
                                : 'var(--muted-foreground)',
                        }}
                    >
                        {type}
                    </button>
                ))}
            </div>

            {/* Items */}
            <div className="max-h-80 overflow-y-auto">
                {filteredItems.length === 0 ? (
                    <div
                        className="p-6 text-center"
                        style={{ color: 'var(--muted-foreground)' }}
                    >
                        <Database className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">No context items</p>
                    </div>
                ) : (
                    <div className="p-2 space-y-1">
                        {filteredItems.map((item, index) => {
                            const config = typeConfig[item.type];
                            const Icon = config.icon;
                            const isExpanded = expandedId === item.id;

                            return (
                                <motion.div
                                    key={item.id}
                                    initial={{ opacity: 0, x: -8 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.02 }}
                                    className="rounded-lg overflow-hidden"
                                    style={{
                                        background: isExpanded
                                            ? 'color-mix(in srgb, var(--muted) 30%, transparent)'
                                            : 'transparent',
                                    }}
                                >
                                    {/* Item header */}
                                    <button
                                        type="button"
                                        onClick={() => setExpandedId(isExpanded ? null : item.id)}
                                        className="w-full flex items-center gap-2 p-2 transition-colors"
                                    >
                                        <Icon
                                            className="w-3.5 h-3.5 shrink-0"
                                            style={{ color: config.color }}
                                        />
                                        <span
                                            className="flex-1 text-xs font-medium text-left truncate"
                                            style={{ color: 'var(--foreground)' }}
                                        >
                                            {item.title}
                                        </span>
                                        {item.isPinned && (
                                            <Pin
                                                className="w-3 h-3 shrink-0"
                                                style={{ color: 'var(--primary)' }}
                                            />
                                        )}
                                        {item.relevance !== undefined && (
                                            <span
                                                className="text-[10px] px-1 py-0.5 rounded shrink-0"
                                                style={{
                                                    background: 'color-mix(in srgb, var(--muted) 100%, transparent)',
                                                    color: 'var(--muted-foreground)',
                                                }}
                                            >
                                                {Math.round(item.relevance * 100)}%
                                            </span>
                                        )}
                                        <motion.div
                                            animate={{ rotate: isExpanded ? 180 : 0 }}
                                            transition={{ duration: 0.15 }}
                                        >
                                            <ChevronDown
                                                className="w-3 h-3 shrink-0"
                                                style={{ color: 'var(--muted-foreground)' }}
                                            />
                                        </motion.div>
                                    </button>

                                    {/* Expanded content */}
                                    <AnimatePresence>
                                        {isExpanded && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ duration: 0.15 }}
                                                className="overflow-hidden"
                                            >
                                                <div className="px-2 pb-2">
                                                    <p
                                                        className="text-xs leading-relaxed mb-2 p-2 rounded-lg"
                                                        style={{
                                                            background: 'var(--background)',
                                                            color: 'var(--foreground)',
                                                        }}
                                                    >
                                                        {item.content}
                                                    </p>
                                                    <div className="flex items-center justify-between">
                                                        <span
                                                            className="text-[10px]"
                                                            style={{ color: 'var(--muted-foreground)' }}
                                                        >
                                                            {item.source && `Source: ${item.source}`}
                                                        </span>
                                                        <div className="flex gap-1">
                                                            {onPin && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => onPin(item.id)}
                                                                    className="p-1 rounded transition-colors"
                                                                    style={{
                                                                        color: item.isPinned
                                                                            ? 'var(--primary)'
                                                                            : 'var(--muted-foreground)',
                                                                    }}
                                                                >
                                                                    <Pin className="w-3 h-3" />
                                                                </button>
                                                            )}
                                                            {onRemove && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => onRemove(item.id)}
                                                                    className="p-1 rounded transition-colors"
                                                                    style={{ color: 'var(--destructive)' }}
                                                                >
                                                                    <Trash2 className="w-3 h-3" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
