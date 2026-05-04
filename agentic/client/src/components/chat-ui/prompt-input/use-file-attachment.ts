/**
 * useFileAttachment — File selection, validation, preview & upload
 *
 * Capabilities:
 *  • Click-to-pick via hidden <input type="file">
 *  • Drag-and-drop onto the capsule (returns dragActive for styling)
 *  • Client-side validation (type, size, count)
 *  • Local image preview via URL.createObjectURL
 *  • Upload placeholder (ready for wiring to tRPC / storage.ts)
 *  • Remove individual files
 *  • Clear all on send
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Attachment } from './prompt-input.types';
import {
  DEFAULT_ACCEPTED_FILE_TYPES,
  DEFAULT_MAX_FILE_SIZE,
  DEFAULT_MAX_ATTACHMENTS,
} from './prompt-input.tokens';

let attachmentIdCounter = 0;
function nextId() {
  return `att-${Date.now()}-${++attachmentIdCounter}`;
}

interface UseFileAttachmentOptions {
  acceptedTypes?: string[];
  maxFileSize?: number;
  maxAttachments?: number;
  disabled?: boolean;
}

export function useFileAttachment({
  acceptedTypes = DEFAULT_ACCEPTED_FILE_TYPES,
  maxFileSize = DEFAULT_MAX_FILE_SIZE,
  maxAttachments = DEFAULT_MAX_ATTACHMENTS,
  disabled = false,
}: UseFileAttachmentOptions = {}) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Validation ────────────────────────────────────────────────────
  const validate = useCallback(
    (file: File): string | null => {
      if (!acceptedTypes.includes(file.type)) {
        const extensions = acceptedTypes
          .map((t) => t.split('/')[1])
          .join(', ');
        return `Unsupported file type. Accepted: ${extensions}`;
      }
      if (file.size > maxFileSize) {
        const sizeMB = (maxFileSize / (1024 * 1024)).toFixed(0);
        return `File exceeds ${sizeMB} MB limit`;
      }
      return null;
    },
    [acceptedTypes, maxFileSize],
  );

  // ── Add files ─────────────────────────────────────────────────────
  const addFiles = useCallback(
    (files: FileList | File[]) => {
      if (disabled) return;

      const fileArray = Array.from(files);

      setAttachments((prev) => {
        const remaining = maxAttachments - prev.length;
        if (remaining <= 0) return prev;

        const newAttachments: Attachment[] = fileArray
          .slice(0, remaining)
          .map((file) => {
            const error = validate(file);
            const isImage = file.type.startsWith('image/');
            return {
              id: nextId(),
              file,
              name: file.name,
              size: file.size,
              type: file.type,
              status: error ? 'error' : 'ready',
              progress: error ? 0 : 100,
              previewUrl: isImage ? URL.createObjectURL(file) : undefined,
              error: error ?? undefined,
            } satisfies Attachment;
          });

        return [...prev, ...newAttachments];
      });
    },
    [disabled, maxAttachments, validate],
  );

  // ── Remove single attachment ──────────────────────────────────────
  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => {
      const att = prev.find((a) => a.id === id);
      if (att?.previewUrl) URL.revokeObjectURL(att.previewUrl);
      return prev.filter((a) => a.id !== id);
    });
  }, []);

  // ── Clear all (call after send) ───────────────────────────────────
  const clearAttachments = useCallback(() => {
    setAttachments((prev) => {
      prev.forEach((a) => {
        if (a.previewUrl) URL.revokeObjectURL(a.previewUrl);
      });
      return [];
    });
  }, []);

  // ── File picker trigger ───────────────────────────────────────────
  const openFilePicker = useCallback(() => {
    if (disabled) return;
    fileInputRef.current?.click();
  }, [disabled]);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) addFiles(e.target.files);
      // Reset so same file can be re-selected
      e.target.value = '';
    },
    [addFiles],
  );

  // ── Drag & drop handlers ──────────────────────────────────────────
  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) setDragActive(true);
    },
    [disabled],
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) setDragActive(true);
    },
    [disabled],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      if (e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles],
  );

  // ── Cleanup blob URLs on unmount to prevent memory leaks ──────────
  useEffect(() => {
    return () => {
      // Intentionally reading the ref-like state — safe in cleanup
      // eslint-disable-next-line react-hooks/exhaustive-deps
      setAttachments((prev) => {
        prev.forEach((a) => {
          if (a.previewUrl) URL.revokeObjectURL(a.previewUrl);
        });
        return [];
      });
    };
  }, []);

  // ── Derived ───────────────────────────────────────────────────────
  const hasAttachments = attachments.length > 0;
  const readyAttachments = useMemo(
    () => attachments.filter((a) => a.status === 'ready'),
    [attachments],
  );
  const canAttachMore = attachments.length < maxAttachments;

  return {
    attachments,
    hasAttachments,
    readyAttachments,
    canAttachMore,
    dragActive,
    fileInputRef,
    addFiles,
    removeAttachment,
    clearAttachments,
    openFilePicker,
    handleFileInputChange,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
  };
}
