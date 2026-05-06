/**
 * PromptInput — Design Tokens
 *
 * Local sizing tokens that extend the global design system.
 * Animation & radius pull from the shared design system;
 * size-grid values are input-specific.
 */

import { MOTION, RADIUS } from "@/design-system/tokens";

// ── Input-specific sizing (8 px grid) ───────────────────────────────────

export const INPUT_SIZES = {
  button: { default: 40, large: 44 },
  icon: { default: 20, large: 22 },
  padding: { default: 8, large: 12 },
} as const;

// ── Re-export shared tokens the sub-components need ─────────────────────

export const TRANSITION = {
  fast: MOTION.fast / 1000, // 0.15 s
  normal: MOTION.normal / 1000, // 0.20 s
  slow: MOTION.slow / 1000, // 0.30 s
} as const;

export const EASE = MOTION.easeOut;

export const CONTAINER_RADIUS = RADIUS.full; // pill "9999px"

export const MAX_CHARS = 2000;
export const CHAR_WARN_THRESHOLD = 500;
export const CHAR_DANGER_THRESHOLD = 1800;
export const MAX_TEXTAREA_HEIGHT = 200;

// ── File attachment defaults ────────────────────────────────────────────

export const DEFAULT_ACCEPTED_FILE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/csv",
  "text/plain",
  "application/json",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // xlsx
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // docx
];

export const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
export const DEFAULT_MAX_ATTACHMENTS = 5;

// ── Voice recording defaults ────────────────────────────────────────────

export const VOICE_MAX_DURATION_MS = 120_000; // 2 minutes
export const VOICE_MIME_TYPE = "audio/webm;codecs=opus";
export const VOICE_FALLBACK_MIME = "audio/webm";
