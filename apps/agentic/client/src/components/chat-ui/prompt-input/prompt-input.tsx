/**
 * PromptInput — Enterprise Chat Input Capsule
 *
 * Architecture (11 files, modular):
 *  ┌─ prompt-input.types.ts       – shared type definitions
 *  ├─ prompt-input.tokens.ts      – sizing, file/voice constants
 *  ├─ action-button.tsx           – reusable icon button (badge, active)
 *  ├─ send-button.tsx             – clean send arrow + interrupt control
 *  ├─ attachment-preview.tsx      – file thumbnail strip
 *  ├─ voice-recorder-overlay.tsx  – recording UI (waveform, timer)
 *  ├─ use-prompt-input.ts         – text + send business logic
 *  ├─ use-file-attachment.ts      – file pick, drag-drop, validation
 *  ├─ use-voice-recorder.ts       – MediaRecorder state machine
 *  ├─ prompt-input.tsx            – presentational shell (this file)
 *  └─ index.ts                    – barrel export
 *
 * Features:
 *  ✅ Theme-aware glass capsule (light + dark via CSS vars)
 *  ✅ File attachments (click + drag-drop, type/size validation, previews)
 *  ✅ Voice recording (MediaRecorder, waveform, timer, auto-stop)
 *  ✅ Auto-resize textarea
 *  ✅ Character count warning
 *  ✅ Keyboard hints (Enter to send, Shift+Enter for newline)
 *  ✅ Full ARIA accessibility
 *  ✅ Framer Motion micro-interactions
 */

import { useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, FolderClosed, Mic, Paperclip, ShieldCheck } from 'lucide-react';
import { cn, StreamIcon, STREAM_ICON_OPTIONS } from '@hki/ui';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

import type { PromptInputProps, InteractionState } from './prompt-input.types';
import {
  INPUT_SIZES,
  TRANSITION,
  EASE,
  CHAR_WARN_THRESHOLD,
  CHAR_DANGER_THRESHOLD,
  MAX_CHARS,
} from './prompt-input.tokens';
import { ActionButton } from './action-button';
import { SendButton } from './send-button';
import { AttachmentPreview } from './attachment-preview';
import { VoiceRecorderOverlay } from './voice-recorder-overlay';
import { usePromptInput } from './use-prompt-input';
import { useFileAttachment } from './use-file-attachment';
import { useVoiceRecorder } from './use-voice-recorder';

// ── Capsule style builder ───────────────────────────────────────────────

const KNOWN_STREAM_ICON_IDS = new Set(
  STREAM_ICON_OPTIONS.map((option) => option.id),
);

function capsuleStyle(state: InteractionState, dragActive: boolean) {
  const base = {
    padding: 6,
    borderRadius: 28,
    transition: `all ${TRANSITION.normal}s cubic-bezier(${EASE.join(',')})`,
  };

  if (dragActive) {
    return {
      ...base,
      background: 'var(--capsule-bg-focus)',
      boxShadow: 'var(--capsule-shadow-focus), inset 0 0 0 1.5px color-mix(in srgb, var(--primary) 60%, transparent)',
    };
  }

  switch (state) {
    case 'focus':
      return {
        ...base,
        background: 'var(--capsule-bg-focus)',
        boxShadow: 'var(--capsule-shadow-focus)',
      };
    case 'hover':
      return {
        ...base,
        background: 'var(--capsule-bg-hover)',
        boxShadow: 'var(--capsule-shadow-hover), inset 0 0 0 1px var(--capsule-border-hover)',
      };
    default:
      return {
        ...base,
        background: 'var(--capsule-bg)',
        boxShadow: 'var(--capsule-shadow-idle), inset 0 0 0 1px var(--capsule-border)',
      };
  }
}

function formatScopeLabel(scope: string | undefined): string {
  if (!scope || scope === 'global') return 'General HKI context';
  return scope
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function isRenderableScopeIcon(icon: string | null | undefined): icon is string {
  return Boolean(icon && icon.trim() && icon !== 'global');
}

function isEmojiIcon(icon: string | null | undefined): boolean {
  if (!icon) return false;
  return Array.from(icon).some((char) => (char.codePointAt(0) ?? 0) > 0xff);
}

function PromptScopeGlyph({ icon }: { icon: string | null }) {
  if (
    icon &&
    KNOWN_STREAM_ICON_IDS.has(
      icon as (typeof STREAM_ICON_OPTIONS)[number]['id'],
    )
  ) {
    return (
      <StreamIcon
        id={icon as (typeof STREAM_ICON_OPTIONS)[number]['id']}
        size={13}
        className="agentic-prompt-context-icon"
        aria-hidden
      />
    );
  }

  if (isEmojiIcon(icon)) {
    return (
      <span className="agentic-prompt-context-emoji" aria-hidden>
        {icon}
      </span>
    );
  }

  return <ShieldCheck className="agentic-prompt-context-icon" aria-hidden />;
}

// ── Component ───────────────────────────────────────────────────────────

export function PromptInput({
  userId,
  disabled = false,
  placeholder = 'Describe your task...',
  className,
  size = 'default',
  value,
  onPromptChange,
  enableAttachments = true,
  enableVoice = true,
  acceptedFileTypes,
  maxFileSize,
  maxAttachments,
  onSendingStateChange,
  activeProjectId,
  activeProjectName,
  activeScope,
  activeScopeName,
  activeScopeIcon,
  isScopeLocked,
  runtimeStateLabel,
  runtimeStateTone,
}: PromptInputProps) {
  // ── Text + send hook ────────────────────────────────────────────────
  const {
    prompt,
    inputRef,
    isLoading,
    isSending,
    canSend: canSendText,
    currentState,
    handlePromptChange,
    handleSend: handleSendText,
    handleKeyDown,
    handleMouseEnter,
    handleMouseLeave,
    handleFocus,
    handleBlur,
    setAttachmentsForSend,
    cancelSend,
  } = usePromptInput({ userId, disabled, value, onPromptChange, onSendingStateChange, activeProjectId, activeScope });

  // ── File attachment hook ────────────────────────────────────────────
  const {
    attachments,
    hasAttachments,
    readyAttachments,
    dragActive,
    fileInputRef,
    removeAttachment,
    clearAttachments,
    openFilePicker,
    handleFileInputChange,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
  } = useFileAttachment({
    acceptedTypes: acceptedFileTypes,
    maxFileSize,
    maxAttachments,
    disabled,
  });

  // ── tRPC mutations for media ────────────────────────────────────────
  const uploadMutation = trpc.media.upload.useMutation();
  const transcribeMutation = trpc.media.transcribe.useMutation();

  // ── Voice recorder hook ─────────────────────────────────────────────
  const handleRecordingComplete = useCallback(
    async (blob: Blob, _durationMs: number) => {
      try {
        // 1. Convert blob to base64
        const arrayBuffer = await blob.arrayBuffer();
        const base64 = btoa(
          new Uint8Array(arrayBuffer).reduce(
            (data, byte) => data + String.fromCharCode(byte),
            '',
          ),
        );

        // 2. Upload to storage
        const uploadResult = await uploadMutation.mutateAsync({
          data: base64,
          fileName: `voice-${Date.now()}.webm`,
          contentType: blob.type || 'audio/webm',
        });

        // 3. Transcribe
        const transcription = await transcribeMutation.mutateAsync({
          audioUrl: uploadResult.url,
        });

        // 4. Insert transcribed text into the prompt
        if (transcription.text) {
          const currentPrompt = inputRef.current?.value ?? '';
          const separator = currentPrompt.length > 0 ? ' ' : '';
          handlePromptChange(currentPrompt + separator + transcription.text);
          // Focus the textarea so user can review/edit before sending
          inputRef.current?.focus();
        }
      } catch (error) {
        console.error('Voice transcription failed:', error);
        toast.error('Voice transcription failed. Please try again or type your message.');
      }
    },
    [uploadMutation, transcribeMutation, handlePromptChange, inputRef],
  );

  const {
    isRecording,
    formattedTime,
    toggleRecording,
    stopRecording,
    cancelRecording,
  } = useVoiceRecorder({
    onRecordingComplete: handleRecordingComplete,
    disabled,
  });

  // ── Upload ready attachments and sync URLs to send hook ─────────────
  // Note: readyAttachments is memoized in useFileAttachment so the
  // reference only changes when the underlying attachments array changes.
  useEffect(() => {
    if (!hasAttachments) {
      setAttachmentsForSend([]);
      return;
    }
    // Collect URLs from attachments that are ready (local validation passed)
    // Actual upload happens at send time — readyAttachments have valid files
    const urls = readyAttachments
      .map((a) => a.url)
      .filter((url): url is string => url != null);
    setAttachmentsForSend(urls);
  }, [hasAttachments, readyAttachments, setAttachmentsForSend]);

  // ── Combined send ───────────────────────────────────────────────────
  const canSend = canSendText || (hasAttachments && readyAttachments.length > 0);
  const scopeLabel = activeScopeName?.trim() || formatScopeLabel(activeScope);
  const projectLabel = activeProjectName?.trim() || (activeProjectId ? 'Project selected' : null);
  const stateLabel = runtimeStateLabel ?? (isLoading ? 'Working' : 'Ready');
  const stateTone = runtimeStateTone ?? (isLoading ? 'working' : 'ready');
  const scopeIcon = isRenderableScopeIcon(activeScopeIcon) ? activeScopeIcon : null;

  const handleSend = useCallback(async () => {
    // If there are attachments that haven't been uploaded yet, upload them first
    if (readyAttachments.length > 0) {
      const uploadedUrls: string[] = [];
      for (const att of readyAttachments) {
        if (att.url) {
          // Already uploaded
          uploadedUrls.push(att.url);
        } else {
          try {
            const arrayBuffer = await att.file.arrayBuffer();
            const base64 = btoa(
              new Uint8Array(arrayBuffer).reduce(
                (data, byte) => data + String.fromCharCode(byte),
                '',
              ),
            );
            const result = await uploadMutation.mutateAsync({
              data: base64,
              fileName: att.name,
              contentType: att.type,
            });
            uploadedUrls.push(result.url);
          } catch (error) {
            console.error(`Failed to upload ${att.name}:`, error);
          }
        }
      }
      setAttachmentsForSend(uploadedUrls);
    }

    await handleSendText();
    clearAttachments();
  }, [readyAttachments, handleSendText, clearAttachments, uploadMutation, setAttachmentsForSend]);

  // ── Derived sizing ──────────────────────────────────────────────────
  const sizing = useMemo(
    () => ({
      button: INPUT_SIZES.button[size],
      icon: INPUT_SIZES.icon[size],
      padding: INPUT_SIZES.padding[size],
    }),
    [size],
  );

  const styles = capsuleStyle(currentState, dragActive);

  return (
    <div className={cn('relative', className)}>
      {/* ── Focus ring glow ─────────────────────────────────────────── */}
      <AnimatePresence>
        {(currentState === 'focus' || dragActive) && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: TRANSITION.fast }}
            className="absolute -inset-1.5 rounded-full pointer-events-none"
            style={{
              background: dragActive
                ? 'linear-gradient(135deg, color-mix(in srgb, var(--primary) 18%, transparent) 0%, color-mix(in srgb, var(--primary) 10%, transparent) 100%)'
                : 'linear-gradient(135deg, color-mix(in srgb, var(--primary) 12%, transparent) 0%, color-mix(in srgb, var(--primary) 6%, transparent) 100%)',
              filter: 'blur(12px)',
            }}
            aria-hidden
          />
        )}
      </AnimatePresence>

      {/* ── Main capsule ────────────────────────────────────────────── */}
      <motion.div
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onDragEnter={enableAttachments ? handleDragEnter : undefined}
        onDragLeave={enableAttachments ? handleDragLeave : undefined}
        onDragOver={enableAttachments ? handleDragOver : undefined}
        onDrop={enableAttachments ? handleDrop : undefined}
        animate={{ scale: currentState === 'focus' ? 1.002 : 1 }}
        transition={{ duration: TRANSITION.fast, ease: EASE }}
        className={cn(
          'agentic-prompt-capsule relative overflow-hidden',
          'backdrop-blur-2xl backdrop-saturate-150',
        )}
        style={styles}
      >
        {/* Focus border — clean box-shadow ring, no mask hack */}
        <AnimatePresence>
          {currentState === 'focus' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 rounded-[inherit] pointer-events-none"
              style={{
                boxShadow: 'inset 0 0 0 1.5px color-mix(in srgb, var(--primary) 50%, transparent)',
              }}
            />
          )}
        </AnimatePresence>

        {/* Drag-drop overlay label */}
        <AnimatePresence>
          {dragActive && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-20 flex items-center justify-center rounded-[inherit] bg-primary/5 backdrop-blur-sm pointer-events-none"
            >
              <span className="text-sm font-medium text-primary">
                Drop files here
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Attachment previews (above input row) */}
        {hasAttachments && (
          <AttachmentPreview
            attachments={attachments}
            onRemove={removeAttachment}
          />
        )}

        {/* Inner glass layer */}
        <div
          className={cn(
            'agentic-prompt-inner relative z-10 flex flex-col gap-1.5',
            currentState === 'focus' && 'agentic-prompt-inner--focus',
          )}
          style={{
            padding: 4,
            borderRadius: 22,
            transition: `background ${TRANSITION.fast}s, box-shadow ${TRANSITION.fast}s`,
          }}
        >
          <div className="agentic-prompt-context" aria-label="Prompt context">
            <span
              className="agentic-prompt-context-chip"
              data-kind="scope"
              data-tone={isScopeLocked ? 'locked' : 'scope'}
              title={isScopeLocked ? `Locked to ${scopeLabel}` : `Scope: ${scopeLabel}`}
            >
              <PromptScopeGlyph icon={scopeIcon} />
              <span className="agentic-prompt-context-label">{scopeLabel}</span>
            </span>

            {projectLabel && (
              <span
                className="agentic-prompt-context-chip"
                data-kind="project"
                data-tone="project"
                title={`Project: ${projectLabel}`}
              >
                <FolderClosed className="agentic-prompt-context-icon" aria-hidden />
                <span className="agentic-prompt-context-label">{projectLabel}</span>
              </span>
            )}

            <span
              className="agentic-prompt-context-chip"
              data-kind="runtime"
              data-tone={stateTone}
              title={`Agent state: ${stateLabel}`}
            >
              <Activity className="agentic-prompt-context-icon" aria-hidden />
              <span className="agentic-prompt-context-label">{stateLabel}</span>
            </span>
          </div>

          <div className="flex w-full items-center gap-2">
            {/* Attachment button */}
            {enableAttachments && (
              <ActionButton
                icon={Paperclip}
                size={sizing.button}
                iconSize={sizing.icon}
                disabled={disabled || isRecording}
                tooltip="Attach files"
                ariaLabel="Attach files"
                onClick={openFilePicker}
                badge={hasAttachments ? attachments.length : undefined}
              />
            )}

            {/* Textarea or Voice Overlay */}
            <AnimatePresence mode="wait">
              {isRecording ? (
                <VoiceRecorderOverlay
                  key="voice"
                  formattedTime={formattedTime}
                  onStop={stopRecording}
                  onCancel={cancelRecording}
                />
              ) : (
                <motion.textarea
                  key="textarea"
                  ref={inputRef}
                  value={prompt}
                  onChange={(e) => handlePromptChange(e.target.value)}
                  onKeyDown={(e) => {
                    // Override: send on Enter (with or without attachments)
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    } else {
                      handleKeyDown(e);
                    }
                  }}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  placeholder={placeholder}
                  disabled={disabled || isLoading}
                  rows={1}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  aria-label="Message input"
                  aria-describedby={
                    prompt.length > CHAR_WARN_THRESHOLD ? 'char-count' : undefined
                  }
                  className={cn(
                    'flex-1 bg-transparent resize-none outline-none min-w-0 mx-2',
                    'text-foreground placeholder:text-muted-foreground/60',
                    'leading-relaxed',
                    size === 'large'
                      ? 'text-base py-3 min-h-11'
                      : 'text-[15px] py-2.5 min-h-10',
                    'max-h-50',
                    'transition-colors duration-150',
                  )}
                  style={{ fontWeight: 400, letterSpacing: 0 }}
                />
              )}
            </AnimatePresence>

            {/* Right actions */}
            <div className="flex items-center gap-1">
              {/* Voice button */}
              {enableVoice && (
                <ActionButton
                  icon={Mic}
                  size={sizing.button}
                  iconSize={sizing.icon}
                  disabled={disabled || isLoading}
                  tooltip={isRecording ? 'Stop recording' : 'Voice input'}
                  ariaLabel={isRecording ? 'Stop recording' : 'Voice input'}
                  onClick={toggleRecording}
                  active={isRecording}
                />
              )}

              {/* Send / Stop button — dual-mode like ChatGPT */}
              <SendButton
                onClick={handleSend}
                disabled={!canSend}
                isLoading={isLoading}
                isStoppable={isSending}
                onStop={cancelSend}
                size={sizing.button}
                iconSize={sizing.icon}
              />
            </div>
          </div>
        </div>

        {/* Active indicator (bottom gradient line) */}
        <AnimatePresence>
          {currentState === 'focus' && !isRecording && (
            <motion.div
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              exit={{ scaleX: 0, opacity: 0 }}
              transition={{ duration: TRANSITION.slow, ease: EASE }}
              className="absolute bottom-0 left-4 right-4 h-0.5 origin-center"
              style={{
                background:
                  'linear-gradient(90deg, transparent 0%, var(--primary) 50%, transparent 100%)',
                borderRadius: 1,
              }}
              aria-hidden
            />
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── Hidden file input ───────────────────────────────────────── */}
      {enableAttachments && (
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          accept={acceptedFileTypes?.join(',') ?? undefined}
          onChange={handleFileInputChange}
          aria-hidden
          tabIndex={-1}
        />
      )}

      {/* ── Character count ─────────────────────────────────────────── */}
      {prompt.length > CHAR_WARN_THRESHOLD && (
        <motion.div
          id="char-count"
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute -top-8 right-0 text-xs text-muted-foreground"
        >
          <span
            className={prompt.length > CHAR_DANGER_THRESHOLD ? 'text-destructive' : ''}
          >
            {prompt.length}
          </span>
          <span className="opacity-60"> / {MAX_CHARS}</span>
        </motion.div>
      )}
    </div>
  );
}
