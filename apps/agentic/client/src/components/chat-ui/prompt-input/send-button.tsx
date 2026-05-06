/**
 * SendButton — Clean send / interrupt control
 *
 * Action first, brand second:
 * - Send: upward arrow only
 * - Loading: same arrow, subtle pulse
 * - Interrupt: hard switch to stop square
 */

import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@hki/ui";

import type { SendButtonProps } from "./prompt-input.types";

type ButtonMode = "ready" | "loading" | "interrupt" | "disabled";

function UpArrowGlyph({
  size,
  mode,
}: {
  size: number;
  mode: Exclude<ButtonMode, "interrupt">;
}) {
  const isDisabled = mode === "disabled";
  const stroke = isDisabled ? "currentColor" : "white";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <motion.g
        animate={
          isDisabled
            ? undefined
            : mode === "loading"
              ? { y: [0, -0.7, 0], opacity: [0.88, 1, 0.88] }
              : { y: [0, -1.25, 0], opacity: [0.96, 1, 0.96] }
        }
        transition={{
          duration: mode === "loading" ? 1 : 1.45,
          repeat: isDisabled ? 0 : Infinity,
          ease: "easeInOut",
        }}
      >
        <motion.path
          d="M12 16.3V7.8"
          stroke={stroke}
          strokeWidth="2"
          strokeLinecap="round"
          animate={
            isDisabled
              ? undefined
              : mode === "loading"
                ? { pathLength: [0.84, 1, 0.84] }
                : { pathLength: [0.9, 1, 0.9] }
          }
          transition={{
            duration: mode === "loading" ? 1 : 1.45,
            repeat: isDisabled ? 0 : Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.path
          d="M8.7 11.1L12 7.5L15.3 11.1"
          stroke={stroke}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          animate={
            isDisabled
              ? undefined
              : mode === "loading"
                ? { pathLength: [0.86, 1, 0.86] }
                : { pathLength: [0.92, 1, 0.92] }
          }
          transition={{
            duration: mode === "loading" ? 1 : 1.45,
            repeat: isDisabled ? 0 : Infinity,
            ease: "easeInOut",
          }}
        />
      </motion.g>
    </svg>
  );
}

function StopGlyph({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect x="2.5" y="2.5" width="11" height="11" rx="2.2" />
    </svg>
  );
}

export function SendButton({
  onClick,
  disabled,
  isLoading,
  isStoppable,
  onStop,
  size,
  iconSize,
}: SendButtonProps) {
  const showInterrupt = isLoading && isStoppable;
  const mode: ButtonMode = showInterrupt
    ? "interrupt"
    : isLoading
      ? "loading"
      : disabled
        ? "disabled"
        : "ready";
  const glyphMode: Exclude<ButtonMode, "interrupt"> =
    mode === "interrupt" ? "loading" : mode;
  const isInteractive = mode === "ready" || mode === "interrupt";

  const buttonStyle =
    mode === "interrupt"
      ? {
          color: "white",
          background:
            "linear-gradient(180deg, color-mix(in srgb, var(--foreground) 88%, white) 0%, color-mix(in srgb, var(--foreground) 96%, black) 100%)",
          borderColor:
            "color-mix(in srgb, var(--primary) 18%, rgba(255, 255, 255, 0.08))",
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.08), 0 14px 24px -22px rgba(0,0,0,0.42)",
        }
      : mode === "disabled"
        ? {
            color:
              "color-mix(in srgb, var(--muted-foreground) 70%, transparent)",
            background:
              "linear-gradient(180deg, color-mix(in srgb, var(--muted) 82%, white) 0%, color-mix(in srgb, var(--muted) 88%, var(--background) 12%) 100%)",
            borderColor: "color-mix(in srgb, var(--border) 88%, transparent)",
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,0.34), 0 6px 12px -18px rgba(15,23,42,0.1)",
          }
        : {
            color: "white",
            background:
              mode === "loading"
                ? "linear-gradient(180deg, color-mix(in srgb, var(--primary) 90%, white) 0%, color-mix(in srgb, var(--primary) 76%, black) 100%)"
                : "linear-gradient(180deg, color-mix(in srgb, var(--primary) 96%, white) 0%, color-mix(in srgb, var(--primary) 78%, black) 100%)",
            borderColor:
              mode === "loading"
                ? "color-mix(in srgb, var(--primary) 36%, transparent)"
                : "color-mix(in srgb, var(--primary) 44%, transparent)",
            boxShadow:
              mode === "loading"
                ? "inset 0 1px 0 rgba(255,255,255,0.22), 0 12px 20px -18px color-mix(in srgb, var(--primary) 22%, transparent)"
                : "inset 0 1px 0 rgba(255,255,255,0.28), 0 16px 26px -18px color-mix(in srgb, var(--primary) 34%, transparent)",
          };

  return (
    <motion.button
      type={showInterrupt ? "button" : "submit"}
      onClick={showInterrupt ? onStop : onClick}
      disabled={disabled && !showInterrupt}
      whileHover={isInteractive ? { scale: 1.04, y: -1 } : undefined}
      whileTap={isInteractive ? { scale: 0.96, y: 0 } : undefined}
      className={cn(
        "relative shrink-0 overflow-hidden border",
        "flex items-center justify-center rounded-[18px]",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        disabled && !showInterrupt && "cursor-not-allowed"
      )}
      style={{
        width: size,
        height: size,
        ...buttonStyle,
      }}
      title={
        showInterrupt
          ? "Interrupt response (Esc)"
          : isLoading
            ? "Preparing message..."
            : disabled
              ? "Type a message to send"
              : "Send message (Enter)"
      }
      aria-label={
        showInterrupt
          ? "Interrupt response"
          : isLoading
            ? "Preparing message"
            : "Send message"
      }
      aria-busy={isLoading}
    >
      <AnimatePresence>
        {mode === "ready" && (
          <motion.span
            key="ready-aura"
            className="absolute inset-0 rounded-[inherit] pointer-events-none"
            initial={{ opacity: 0.18 }}
            animate={{ opacity: [0.12, 0.22, 0.12] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2.1, repeat: Infinity, ease: "easeInOut" }}
            style={{
              background:
                "radial-gradient(circle at 50% 38%, rgba(255,255,255,0.16) 0%, transparent 68%)",
            }}
          />
        )}
      </AnimatePresence>

      <span className="relative z-10 flex items-center justify-center">
        <AnimatePresence mode="wait" initial={false}>
          {showInterrupt ? (
            <motion.span
              key="interrupt"
              initial={{ opacity: 0, scale: 0.86, rotate: -10 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, scale: 0.86, rotate: 10 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              className="relative flex items-center justify-center"
            >
              <motion.span
                className="absolute inset-[-7px] rounded-[14px]"
                animate={{ opacity: [0.12, 0.28, 0.12] }}
                transition={{
                  duration: 1.25,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                style={{
                  boxShadow:
                    "inset 0 0 0 1px color-mix(in srgb, var(--primary) 28%, transparent), 0 0 0 1px color-mix(in srgb, var(--primary) 18%, transparent)",
                }}
              />
              <StopGlyph size={Math.max(16, iconSize * 0.88)} />
            </motion.span>
          ) : (
            <motion.span
              key={mode}
              initial={{ opacity: 0, scale: 0.84, y: 2 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.84, y: -2 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="flex items-center justify-center"
            >
              <UpArrowGlyph
                size={Math.max(iconSize + 4, 22)}
                mode={glyphMode}
              />
            </motion.span>
          )}
        </AnimatePresence>
      </span>
    </motion.button>
  );
}
