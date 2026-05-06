/**
 * Message Actions
 * Action buttons for chat messages (copy, regenerate, edit, etc.)
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Copy,
  Check,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  MoreHorizontal,
  Edit3,
  Share2,
  Bookmark,
} from 'lucide-react';
import { cn } from '@hki/ui';
import { toast } from 'sonner';

/* ── Types ────────────────────────────────────────────────────── */

export interface MessageActionsProps {
  messageId: string;
  content: string;
  onCopy?: () => void;
  onRegenerate?: () => void;
  onEdit?: () => void;
  onFeedback?: (type: 'up' | 'down') => void;
  onShare?: () => void;
  onBookmark?: () => void;
  showCopy?: boolean;
  showRegenerate?: boolean;
  showEdit?: boolean;
  showFeedback?: boolean;
  showMore?: boolean;
  className?: string;
}

/* ── Component ────────────────────────────────────────────────── */

export default function MessageActions({
  messageId,
  content,
  onCopy,
  onRegenerate,
  onEdit,
  onFeedback,
  onShare,
  onBookmark,
  showCopy = true,
  showRegenerate = false,
  showEdit = false,
  showFeedback = true,
  showMore = true,
  className,
}: MessageActionsProps) {
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    toast.success('Copied to clipboard');
    onCopy?.();
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFeedback = (type: 'up' | 'down') => {
    setFeedback(type);
    onFeedback?.(type);
    toast.success(type === 'up' ? 'Thanks for the feedback!' : 'Feedback recorded');
  };

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {/* Copy */}
      {showCopy && (
        <button
          onClick={handleCopy}
          className={cn(
            'p-1.5 rounded-lg transition-all',
            copied
              ? 'bg-emerald-500/10 text-emerald-500'
              : 'hover:bg-black/[0.05] dark:hover:bg-white/[0.05] text-muted-foreground'
          )}
          title="Copy message"
        >
          <motion.div
            initial={false}
            animate={{ scale: copied ? [1, 1.2, 1] : 1 }}
            transition={{ duration: 0.3 }}
          >
            {copied ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </motion.div>
        </button>
      )}

      {/* Regenerate */}
      {showRegenerate && (
        <button
          onClick={onRegenerate}
          className="p-1.5 rounded-lg hover:bg-black/[0.05] dark:hover:bg-white/[0.05] text-muted-foreground hover:text-blue-500 transition-all"
          title="Regenerate response"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Edit */}
      {showEdit && (
        <button
          onClick={onEdit}
          className="p-1.5 rounded-lg hover:bg-black/[0.05] dark:hover:bg-white/[0.05] text-muted-foreground hover:text-violet-500 transition-all"
          title="Edit message"
        >
          <Edit3 className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Feedback */}
      {showFeedback && (
        <>
          <div className="w-px h-4 bg-black/[0.06] dark:bg-white/[0.06] mx-0.5" />
          <button
            onClick={() => handleFeedback('up')}
            className={cn(
              'p-1.5 rounded-lg transition-all',
              feedback === 'up'
                ? 'bg-emerald-500/10 text-emerald-500'
                : 'hover:bg-black/[0.05] dark:hover:bg-white/[0.05] text-muted-foreground hover:text-emerald-500'
            )}
            title="Good response"
          >
            <ThumbsUp className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleFeedback('down')}
            className={cn(
              'p-1.5 rounded-lg transition-all',
              feedback === 'down'
                ? 'bg-red-500/10 text-red-500'
                : 'hover:bg-black/[0.05] dark:hover:bg-white/[0.05] text-muted-foreground hover:text-red-500'
            )}
            title="Bad response"
          >
            <ThumbsDown className="w-3.5 h-3.5" />
          </button>
        </>
      )}

      {/* More menu */}
      {showMore && (
        <>
          <div className="w-px h-4 bg-black/[0.06] dark:bg-white/[0.06] mx-0.5" />
          <div className="relative">
            <button
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              className="p-1.5 rounded-lg hover:bg-black/[0.05] dark:hover:bg-white/[0.05] text-muted-foreground transition-all"
              title="More actions"
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>

            {/* Dropdown menu */}
            <AnimatePresence>
              {showMoreMenu && (
                <>
                  {/* Backdrop */}
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowMoreMenu(false)}
                  />

                  {/* Menu */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -4 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-1 z-50 w-40 rounded-lg border shadow-lg bg-card border-black/[0.08] dark:border-white/[0.08] overflow-hidden"
                  >
                    {onShare && (
                      <button
                        onClick={() => {
                          onShare();
                          setShowMoreMenu(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors"
                      >
                        <Share2 className="w-3.5 h-3.5 text-muted-foreground" />
                        Share
                      </button>
                    )}
                    {onBookmark && (
                      <button
                        onClick={() => {
                          onBookmark();
                          setShowMoreMenu(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors"
                      >
                        <Bookmark className="w-3.5 h-3.5 text-muted-foreground" />
                        Bookmark
                      </button>
                    )}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </>
      )}
    </div>
  );
}

/* ── Compact Actions (for bubbles) ────────────────────────────── */

interface CompactMessageActionsProps {
  content: string;
  onCopy?: () => void;
  onFeedback?: (type: 'up' | 'down') => void;
}

export function CompactMessageActions({
  content,
  onCopy,
  onFeedback,
}: CompactMessageActionsProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    onCopy?.();
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
      <button
        onClick={handleCopy}
        className={cn(
          'p-1 rounded transition-colors',
          copied
            ? 'bg-emerald-500/10 text-emerald-500'
            : 'hover:bg-black/[0.08] dark:hover:bg-white/[0.08] text-muted-foreground'
        )}
      >
        {copied ? (
          <Check className="w-3 h-3" />
        ) : (
          <Copy className="w-3 h-3" />
        )}
      </button>
      {onFeedback && (
        <>
          <button
            onClick={() => onFeedback('up')}
            className="p-1 rounded hover:bg-black/[0.08] dark:hover:bg-white/[0.08] text-muted-foreground hover:text-emerald-500 transition-colors"
          >
            <ThumbsUp className="w-3 h-3" />
          </button>
          <button
            onClick={() => onFeedback('down')}
            className="p-1 rounded hover:bg-black/[0.08] dark:hover:bg-white/[0.08] text-muted-foreground hover:text-red-500 transition-colors"
          >
            <ThumbsDown className="w-3 h-3" />
          </button>
        </>
      )}
    </div>
  );
}
