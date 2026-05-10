/**
 * ConversationGroup - Date-based grouping for conversations
 * 
 * Groups conversations by:
 * - Today
 * - Yesterday
 * - Previous 7 Days
 * - Previous 30 Days
 * - Older
 */

import { memo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { MOTION } from '@/design-system/tokens';

export type ConversationGroupProps = {
    label: string;
    count?: number;
    children: React.ReactNode;
    defaultExpanded?: boolean;
};

export const ConversationGroup = memo(function ConversationGroup({
    label,
    count,
    children,
    defaultExpanded = true,
}: ConversationGroupProps) {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    return (
        <div className="mb-1.5">
            {/* Group Header — Refined Command Center Style */}
            <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="agentic-conversation-group-header w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg
                           text-foreground/68 hover:text-foreground
                           transition-all duration-200 group"
                aria-expanded={isExpanded}
                aria-controls={`group-${label.toLowerCase().replace(/\s+/g, '-')}`}
            >
                <span className="font-semibold uppercase tracking-[0.08em] text-[10px]">
                    {label}
                </span>
                <div className="flex items-center gap-2">
                    {count !== undefined && (
                        <span className="agentic-conversation-group-count inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-md
                                         text-[10px] font-medium tabular-nums">
                            {count}
                        </span>
                    )}
                    <motion.div
                        animate={{ rotate: isExpanded ? 0 : -90 }}
                        transition={{ duration: MOTION.fast / 1000 }}
                        className="text-muted-foreground/50 group-hover:text-muted-foreground/70"
                    >
                        <ChevronDown className="w-3.5 h-3.5" />
                    </motion.div>
                </div>
            </button>

            {/* Group Content */}
            <AnimatePresence initial={false}>
                {isExpanded && (
                    <motion.div
                        id={`group-${label.toLowerCase().replace(/\s+/g, '-')}`}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: MOTION.normal / 1000, ease: MOTION.easeOut }}
                        className="overflow-hidden"
                    >
                        <div className="flex flex-col gap-1 pt-1.5 pb-1">
                            {children}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
});

// Helper function to categorize conversations by date
export type DateCategory = 'pinned' | 'today' | 'yesterday' | 'previous7days' | 'previous30days' | 'older';

export function getDateCategory(date: Date, isPinned?: boolean): DateCategory {
    if (isPinned) return 'pinned';

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(today);
    monthAgo.setDate(monthAgo.getDate() - 30);

    const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (targetDate >= today) return 'today';
    if (targetDate >= yesterday) return 'yesterday';
    if (targetDate >= weekAgo) return 'previous7days';
    if (targetDate >= monthAgo) return 'previous30days';
    return 'older';
}

export const DATE_CATEGORY_LABELS: Record<DateCategory, string> = {
    pinned: 'Pinned',
    today: 'Today',
    yesterday: 'Yesterday',
    previous7days: 'Previous 7 Days',
    previous30days: 'Previous 30 Days',
    older: 'Older',
};

export default ConversationGroup;
