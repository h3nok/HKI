/**
 * prompt-input/ barrel export
 *
 * Public API:
 *   import { PromptInput }         from './prompt-input';  // main component
 *   import { usePromptInput }      from './prompt-input';  // text + send hook
 *   import { useFileAttachment }   from './prompt-input';  // file hook
 *   import { useVoiceRecorder }    from './prompt-input';  // voice hook
 *   import { ActionButton }        from './prompt-input';  // reusable button
 *   import { AttachmentPreview }   from './prompt-input';  // file preview strip
 *   import { VoiceRecorderOverlay } from './prompt-input'; // recording UI
 */

// ── Components ──────────────────────────────────────────────────────────
export { PromptInput } from './prompt-input';
export { ActionButton } from './action-button';
export { SendButton } from './send-button';
export { AttachmentPreview } from './attachment-preview';
export { VoiceRecorderOverlay } from './voice-recorder-overlay';

// ── Hooks ───────────────────────────────────────────────────────────────
export { usePromptInput } from './use-prompt-input';
export { useFileAttachment } from './use-file-attachment';
export { useVoiceRecorder } from './use-voice-recorder';

// ── Types ───────────────────────────────────────────────────────────────
export type {
  PromptInputProps,
  ActionButtonProps,
  SendButtonProps,
  InteractionState,
  PromptInputSize,
  Attachment,
  AttachmentStatus,
  RecordingState,
} from './prompt-input.types';
