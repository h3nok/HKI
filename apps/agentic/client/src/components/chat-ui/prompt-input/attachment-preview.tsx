/**
 * AttachmentPreview — Thumbnail strip for queued file attachments
 *
 * Shows a horizontal row of chips above the input bar.
 * Each chip has: file-type icon or image thumbnail, name, size, remove button.
 * Errors are highlighted in destructive colour.
 */

import { motion, AnimatePresence } from 'framer-motion';
import { X, FileText, Image as ImageIcon, FileSpreadsheet, File } from 'lucide-react';
import { cn } from '@hki/ui';
import type { Attachment } from './prompt-input.types';

interface AttachmentPreviewProps {
  attachments: Attachment[];
  onRemove: (id: string) => void;
}

// ── File-type icon mapper ───────────────────────────────────────────────

function FileTypeIcon({ type, className }: { type: string; className?: string }) {
  if (type.startsWith('image/')) return <ImageIcon className={className} />;
  if (type === 'application/pdf') return <FileText className={className} />;
  if (type.includes('spreadsheet') || type === 'text/csv')
    return <FileSpreadsheet className={className} />;
  return <File className={className} />;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Component ───────────────────────────────────────────────────────────

export function AttachmentPreview({ attachments, onRemove }: AttachmentPreviewProps) {
  if (attachments.length === 0) return null;

  return (
    <div className="flex items-center gap-2 px-3 pb-2 overflow-x-auto scrollbar-hidden">
      <AnimatePresence mode="popLayout">
        {attachments.map((att) => (
          <motion.div
            key={att.id}
            layout
            initial={{ opacity: 0, scale: 0.8, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.7, y: -4 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              'relative group flex items-center gap-2',
              'pl-2 pr-7 py-1.5 rounded-lg',
              'border text-xs shrink-0 max-w-48',
              att.status === 'error'
                ? 'bg-destructive/10 border-destructive/30 text-destructive'
                : 'bg-muted/60 border-border/50 text-foreground',
            )}
          >
            {/* Thumbnail or icon */}
            {att.previewUrl ? (
              <img
                src={att.previewUrl}
                alt={att.name}
                className="w-8 h-8 rounded object-cover shrink-0"
              />
            ) : (
              <FileTypeIcon
                type={att.type}
                className={cn(
                  'w-4 h-4 shrink-0',
                  att.status === 'error'
                    ? 'text-destructive'
                    : 'text-muted-foreground',
                )}
              />
            )}

            {/* Name + size */}
            <div className="min-w-0">
              <p className="truncate font-medium leading-tight">
                {att.name}
              </p>
              <p
                className={cn(
                  'text-[10px] leading-tight',
                  att.status === 'error'
                    ? 'text-destructive/70'
                    : 'text-muted-foreground',
                )}
              >
                {att.status === 'error' ? att.error : formatSize(att.size)}
              </p>
            </div>

            {/* Remove button */}
            <button
              type="button"
              onClick={() => onRemove(att.id)}
              className={cn(
                'absolute top-1 right-1',
                'w-5 h-5 rounded-full flex items-center justify-center',
                'opacity-0 group-hover:opacity-100 transition-opacity',
                'hover:bg-destructive/20 text-muted-foreground hover:text-destructive',
                'focus:outline-none focus-visible:ring-1 focus-visible:ring-ring',
              )}
              aria-label={`Remove ${att.name}`}
            >
              <X className="w-3 h-3" />
            </button>

            {/* Upload progress bar */}
            {att.status === 'uploading' && (
              <motion.div
                className="absolute bottom-0 left-0 h-0.5 bg-primary rounded-b-lg"
                initial={{ width: '0%' }}
                animate={{ width: `${att.progress}%` }}
                transition={{ duration: 0.3 }}
              />
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
