/**
 * usePromptInput — Business-logic hook for the prompt input
 *
 * Owns:
 *  • controlled / uncontrolled value management
 *  • task creation + message sending (tRPC)
 *  • interaction-state machine (idle → hover → focus → active → disabled)
 *  • auto-resize, keyboard handling
 *
 * The PromptInput component stays purely presentational when this hook
 * handles all side-effects.
 */

import { useCallback, useState, useRef, useEffect } from "react";
import { useSendMessage } from "../hooks/use-task-messages";
import { useCreateTask } from "../hooks/use-tasks";
import {
  useSafeSearchParams,
  SearchParamKey,
} from "../hooks/use-search-params";
import { GLOBAL_SCOPE } from "@shared/value-streams";
import type { TextContent } from "../types";
import type { InteractionState, PromptInputProps } from "./prompt-input.types";
import { MAX_TEXTAREA_HEIGHT, MAX_CHARS } from "./prompt-input.tokens";

type UsePromptInputArgs = Pick<
  PromptInputProps,
  | "userId"
  | "disabled"
  | "value"
  | "onPromptChange"
  | "onSendingStateChange"
  | "activeProjectId"
  | "activeScope"
>;

export function usePromptInput({
  userId,
  disabled = false,
  value,
  onPromptChange,
  onSendingStateChange,
  activeProjectId,
  activeScope,
}: UsePromptInputArgs) {
  // ── Internal state ──────────────────────────────────────────────────
  const [internalPrompt, setInternalPrompt] = useState("");
  const [interactionState, setInteractionState] =
    useState<InteractionState>("idle");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [attachmentUrls, setAttachmentUrls] = useState<string[]>([]);

  const isControlled = value !== undefined;
  const prompt = isControlled ? value : internalPrompt;

  // ── API hooks ───────────────────────────────────────────────────────
  const { taskID, updateParams } = useSafeSearchParams();
  const { sendMessage, cancelSend, isLoading: isSending } = useSendMessage();
  const { createTask, isLoading: isCreating } = useCreateTask(userId);

  // ── Derived ─────────────────────────────────────────────────────────
  const isLoading = isSending || isCreating;
  const hasText = prompt.trim().length > 0;
  const hasAttachments = attachmentUrls.length > 0;
  const canSend = !disabled && !isLoading && (hasText || hasAttachments);
  const currentState: InteractionState = disabled
    ? "disabled"
    : interactionState;

  // ── Propagate send/create busy state to parent ──────────────────────
  const prevBusyRef = useRef(false);
  useEffect(() => {
    // Only fire when busy state actually changes to prevent cascading re-renders
    if (prevBusyRef.current !== isLoading) {
      prevBusyRef.current = isLoading;
      onSendingStateChange?.(isLoading);
    }
  }, [isLoading, onSendingStateChange]);

  // ── Handlers ────────────────────────────────────────────────────────
  const handlePromptChange = useCallback(
    (newValue: string) => {
      // Enforce character limit
      const clamped =
        newValue.length > MAX_CHARS ? newValue.slice(0, MAX_CHARS) : newValue;
      if (!isControlled) setInternalPrompt(clamped);
      onPromptChange?.(clamped);
    },
    [isControlled, onPromptChange]
  );

  /** Set attachment URLs that will be included in the next send */
  const setAttachmentsForSend = useCallback((urls: string[]) => {
    setAttachmentUrls(urls);
  }, []);

  const resolveCurrentScope = useCallback(() => {
    if (typeof window === "undefined") {
      return activeScope || GLOBAL_SCOPE;
    }

    const scopeFromUrl = new URLSearchParams(window.location.search).get(
      SearchParamKey.SCOPE
    );
    return scopeFromUrl || activeScope || GLOBAL_SCOPE;
  }, [activeScope]);

  const handleSend = useCallback(async () => {
    if (!canSend) return;
    const currentPrompt = prompt.trim();
    const currentAttachments = [...attachmentUrls];
    const currentScope = resolveCurrentScope();

    // Need at least text or attachments
    if (!currentPrompt && currentAttachments.length === 0) return;

    // Clear immediately for responsiveness
    if (!isControlled) setInternalPrompt("");
    onPromptChange?.("");
    setAttachmentUrls([]);

    try {
      let currentTaskId = taskID;

      if (!currentTaskId) {
        const desc = currentPrompt
          ? currentPrompt.slice(0, 50) +
            (currentPrompt.length > 50 ? "..." : "")
          : `${currentAttachments.length} file(s) attached`;
        const newTask = await createTask({
          description: desc,
          content: currentPrompt || "File attachment",
          projectId: activeProjectId ?? undefined,
          scope: currentScope,
        });
        currentTaskId = newTask.id;
        updateParams({ [SearchParamKey.TASK_ID]: currentTaskId });
      }

      const content: TextContent = {
        type: "text",
        author: "user",
        format: "plain",
        content: currentPrompt || "(attached files)",
        ...(currentAttachments.length > 0 && {
          attachments: currentAttachments,
        }),
      };

      await sendMessage({
        taskId: currentTaskId,
        content,
        scope: currentScope,
      });
    } catch (error) {
      console.error("Failed to send message:", error);
      // Show user-visible error feedback
      const message =
        error instanceof Error ? error.message : "Failed to send message";
      if (typeof window !== "undefined") {
        import("sonner")
          .then(({ toast }) => toast.error(message))
          .catch(() => {});
      }
      if (!isControlled) setInternalPrompt(currentPrompt);
      onPromptChange?.(currentPrompt);
      setAttachmentUrls(currentAttachments);
    }
  }, [
    canSend,
    prompt,
    attachmentUrls,
    taskID,
    createTask,
    updateParams,
    sendMessage,
    resolveCurrentScope,
    isControlled,
    onPromptChange,
    activeProjectId,
  ]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  // ── Interaction state machine ───────────────────────────────────────
  const handleMouseEnter = useCallback(() => {
    if (!disabled && interactionState !== "focus") setInteractionState("hover");
  }, [disabled, interactionState]);

  const handleMouseLeave = useCallback(() => {
    if (interactionState === "hover") setInteractionState("idle");
  }, [interactionState]);

  const handleFocus = useCallback(() => {
    if (!disabled) setInteractionState("focus");
  }, [disabled]);

  const handleBlur = useCallback(() => {
    setInteractionState("idle");
  }, []);

  // ── Global interrupt shortcut ──────────────────────────────────────
  useEffect(() => {
    if (!isSending) return;

    const handleEscapeInterrupt = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      cancelSend();
    };

    window.addEventListener("keydown", handleEscapeInterrupt, true);
    return () => {
      window.removeEventListener("keydown", handleEscapeInterrupt, true);
    };
  }, [isSending, cancelSend]);

  // ── Auto-resize textarea ───────────────────────────────────────────
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
    }
  }, [prompt]);

  return {
    prompt,
    inputRef,
    isLoading,
    isSending,
    canSend,
    currentState,
    handlePromptChange,
    handleSend,
    handleKeyDown,
    handleMouseEnter,
    handleMouseLeave,
    handleFocus,
    handleBlur,
    setAttachmentsForSend,
    cancelSend,
  };
}
