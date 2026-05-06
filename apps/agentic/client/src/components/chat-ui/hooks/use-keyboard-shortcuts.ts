/**
 * useKeyboardShortcuts — Global keyboard shortcuts for the chat UI
 *
 * Shortcuts:
 *   ⌘K / Ctrl+K  → New conversation
 *   ⌘B / Ctrl+B  → Toggle left sidebar
 *   ⌘J / Ctrl+J  → Toggle activity panel
 *   ⌘/ / Ctrl+/  → Focus input
 *   ⌘? / Ctrl+?  → Show keyboard shortcuts
 *   Escape        → Close open sidebar / modal
 *
 * All shortcuts are suppressed when the user is typing in an input/textarea
 * (except Escape, which always works).
 */

import { useEffect, useCallback } from "react";

interface KeyboardShortcutActions {
  onNewChat: () => void;
  onToggleSidebar: () => void;
  onToggleActivity: () => void;
  canToggleActivity?: boolean;
  onFocusInput: () => void;
  onShowShortcuts: () => void;
  onEscape: () => void;
}

export function useKeyboardShortcuts(actions: KeyboardShortcutActions) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      const tag = (e.target as HTMLElement)?.tagName;
      const isTyping =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        (e.target as HTMLElement)?.isContentEditable;

      // Escape always works — close sidebars / modals
      if (e.key === "Escape") {
        actions.onEscape();
        return;
      }

      // All other shortcuts are suppressed while typing
      if (isTyping) return;

      // ⌘K → New conversation
      if (meta && e.key === "k") {
        e.preventDefault();
        actions.onNewChat();
        return;
      }

      // ⌘B → Toggle sidebar
      if (meta && e.key === "b") {
        e.preventDefault();
        actions.onToggleSidebar();
        return;
      }

      // ⌘J → Toggle activity panel
      if (meta && e.key === "j") {
        if (actions.canToggleActivity === false) {
          return;
        }
        e.preventDefault();
        actions.onToggleActivity();
        return;
      }

      // ⌘/ → Focus input (also works while typing for discoverability)
      if (meta && e.key === "/") {
        e.preventDefault();
        actions.onFocusInput();
        return;
      }

      // ⌘? → Show keyboard shortcuts
      if (meta && e.key === "?") {
        e.preventDefault();
        actions.onShowShortcuts();
        return;
      }
    },
    [actions]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
