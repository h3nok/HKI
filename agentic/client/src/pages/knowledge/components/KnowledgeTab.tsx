/**
 * Knowledge Tab — Unified browse, analyze, and review
 *
 * Two modes:
 *  - Browse: search, filter, manage all indexed documents
 *  - Review: pending approval queue with approve/reject/revision
 *
 * This replaces the old separate "Data Zone", "Documents", and "Review" tabs.
 */

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Loader2, FileText, Trash2, Database, RefreshCw,
  ChevronDown, Hash, CheckCircle, XCircle, Clock,
  RotateCw, Shield, ThumbsUp, Filter,
} from 'lucide-react';
import { cn, useNotifications } from '@hki/ui';
import { trpc } from '@/lib/trpc';
import { getFreshness, cardCls } from '../types';
import { k } from '../theme';

// ── Types ────────────────────────────────────────────────────────────────────

type ViewMode = 'browse' | 'review';

const fadeIn = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.2 },
};

const STATUS_CFG: Record<string, { icon: typeof CheckCircle; color: string; bg: string; label: string }> = {
  pending:   { icon: Clock,       color: 'text-amber-500',   bg: 'bg-amber-500/10', label: 'Pending' },
  approved:  { icon: CheckCircle, color: 'text-primary', bg: 'bg-primary/10', label: 'Approved' },
  rejected:  { icon: XCircle,     color: 'text-red-500',     bg: 'bg-red-500/10', label: 'Rejected' },
  revision:  { icon: RotateCw,    color: 'text-blue-500',    bg: 'bg-blue-500/10', label: 'Revision' },
  published: { icon: ThumbsUp,    color: 'text-primary', bg: 'bg-primary/10', label: 'Published' },
};

// ══════════════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════════════

interface KnowledgeTabProps {
  docsQ: any;
  onStepComplete?: (stepId: string) => void;
}

export default function KnowledgeTab({ docsQ, onStepComplete }: KnowledgeTabProps) {
  const [view, setView] = useState<ViewMode>('browse');

  // Review queue query
  const reviewQ = trpc.knowledge.reviewListPending.useQuery(
    { limit: 50 },
    { retry: false },
  );
  const pendingCount = (reviewQ.data ?? []).length;

  return (
    <div className="w-full min-h-[calc(100vh-200px)]">
      <motion.div {...fadeIn} className="w-full space-y-5">

        {/* ── Page header ── */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className={cn('text-xl font-bold', k.heading)}>
              {view === 'browse' ? 'Knowledge Base' : 'Review Queue'}
            </h1>
            <p className={cn('text-sm mt-0.5', k.muted)}>
              {view === 'browse' ? 'Browse and manage all indexed documents.' : 'Approve, revise, or reject submitted documents.'}
            </p>
          </div>
          {/* ── Mode switcher ── */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-black/3 dark:bg-muted/40">
            <button
              onClick={() => setView('browse')}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all',
                view === 'browse'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground dark:hover:text-foreground',
              )}
            >
              <Database className="w-4 h-4" /> Browse
            </button>
            <button
              onClick={() => setView('review')}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all',
                view === 'review'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground dark:hover:text-foreground',
              )}
            >
              <Shield className="w-4 h-4" /> Review
              {pendingCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/15 text-amber-500 tabular-nums">
                  {pendingCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* ── Content ── */}
        <AnimatePresence mode="wait">
          {view === 'browse' ? (
            <BrowseViewEnhanced key="browse" docsQ={docsQ} />
          ) : (
            <ReviewViewEnhanced key="review" reviewQ={reviewQ} />
          )}
        </AnimatePresence>

      </motion.div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// BROWSE VIEW (Enhanced)
// ══════════════════════════════════════════════════════════════════════════════

import BrowseViewEnhanced from './BrowseViewEnhanced';

// ══════════════════════════════════════════════════════════════════════════════
// REVIEW VIEW (Enhanced)
// ══════════════════════════════════════════════════════════════════════════════

import ReviewViewEnhanced from './ReviewViewEnhanced';
