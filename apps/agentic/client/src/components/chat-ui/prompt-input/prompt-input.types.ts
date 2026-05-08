/**
 * PromptInput — Type Definitions
 *
 * Shared types for the modular prompt-input system.
 */

// ── Attachment types ────────────────────────────────────────────────────

export type AttachmentStatus = "pending" | "uploading" | "ready" | "error";

export interface Attachment {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  status: AttachmentStatus;
  /** Upload progress 0–100 */
  progress: number;
  /** Local preview URL (images only) */
  previewUrl?: string;
  /** Remote URL after upload completes */
  url?: string;
  /** Error message if upload failed */
  error?: string;
}

// ── Voice recording types ───────────────────────────────────────────────

export type RecordingState =
  | "idle"
  | "requesting"
  | "recording"
  | "processing"
  | "error";

// ── Component props ─────────────────────────────────────────────────────

export type PromptInputSize = "default" | "large";

export type InteractionState =
  | "idle"
  | "hover"
  | "focus"
  | "active"
  | "disabled";

export type PromptRuntimeTone = "ready" | "working" | "live" | "offline";

export interface PromptInputProps {
  userId: number;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  size?: PromptInputSize;
  /** Controlled value (omit for internal state) */
  value?: string;
  onPromptChange?: (value: string) => void;
  /** Enable / disable file attachments (default: true) */
  enableAttachments?: boolean;
  /** Enable / disable voice recording (default: true) */
  enableVoice?: boolean;
  /** Accepted file MIME types (default: images, PDFs, CSV, text) */
  acceptedFileTypes?: string[];
  /** Max file size in bytes (default: 10 MB) */
  maxFileSize?: number;
  /** Max number of attachments per message (default: 5) */
  maxAttachments?: number;
  /** Intercept send: if provided, receives the message content and prevents default send.
   *  Use for P01 Intent Confirmation — parent captures intent, shows confirmation, then sends. */
  onBeforeSend?: (content: string, attachments: string[]) => void;
  /** Callback fired when send-related work changes (task creation or message send).
   *  True means the chat should enter its thinking state immediately, even before the first response streams in. */
  onSendingStateChange?: (isSending: boolean) => void;
  /** Active project ID — new tasks created from prompt will auto-assign to this project */
  activeProjectId?: string | null;
  /** Active project display name for prompt context chrome */
  activeProjectName?: string | null;
  /** Active domain scope — threads through to orchestrator for agent routing */
  activeScope?: string;
  /** Active domain display name for prompt context chrome */
  activeScopeName?: string | null;
  /** Active domain icon, when configured by the stream */
  activeScopeIcon?: string | null;
  /** True when the URL fixes the active domain and prevents stream switching */
  isScopeLocked?: boolean;
  /** Runtime label rendered in the prompt context chrome */
  runtimeStateLabel?: string;
  /** Runtime tone rendered in the prompt context chrome */
  runtimeStateTone?: PromptRuntimeTone;
}

// ── Sub-component props ─────────────────────────────────────────────────

export interface ActionButtonProps {
  icon: React.ComponentType<{
    className?: string;
    style?: React.CSSProperties;
  }>;
  size: number;
  iconSize: number;
  disabled?: boolean;
  tooltip?: string;
  ariaLabel: string;
  onClick?: () => void;
  /** Active state (e.g., recording) */
  active?: boolean;
  /** Badge count (e.g., attachment count) */
  badge?: number;
}

export interface SendButtonProps {
  onClick: () => void;
  disabled: boolean;
  isLoading: boolean;
  /** When true, the button shows a stop icon instead of spinner */
  isStoppable?: boolean;
  /** Called when user clicks stop */
  onStop?: () => void;
  size: number;
  iconSize: number;
}
