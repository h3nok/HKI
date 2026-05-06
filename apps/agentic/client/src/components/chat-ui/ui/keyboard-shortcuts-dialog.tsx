/**
 * KeyboardShortcutsDialog — Discoverable shortcut cheat sheet
 *
 * Opens via ⌘? or from the Settings gear menu.
 * Shows all available keyboard shortcuts grouped by category.
 */

import { motion, AnimatePresence } from "framer-motion";
import { X, Keyboard } from "lucide-react";

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onClose: () => void;
  showActivityShortcut?: boolean;
}

const SHORTCUT_GROUPS = [
  {
    title: "Navigation",
    shortcuts: [
      { keys: ["⌘", "K"], description: "New conversation" },
      { keys: ["⌘", "B"], description: "Toggle sidebar" },
      { keys: ["⌘", "J"], description: "Toggle activity panel" },
      { keys: ["⌘", "/"], description: "Focus message input" },
      { keys: ["Esc"], description: "Close panel / dialog" },
    ],
  },
  {
    title: "Messages",
    shortcuts: [
      { keys: ["Enter"], description: "Send message" },
      { keys: ["Shift", "Enter"], description: "New line" },
    ],
  },
];

function Kbd({ children }: { children: string }) {
  return (
    <kbd
      className="inline-flex min-w-6 items-center justify-center h-6 rounded-md px-1.5 text-[11px] font-semibold"
      style={{
        background: "color-mix(in srgb, var(--muted) 80%, transparent)",
        border: "1px solid var(--border)",
        color: "var(--foreground)",
        boxShadow: "0 1px 0 color-mix(in srgb, var(--border) 60%, transparent)",
      }}
    >
      {children}
    </kbd>
  );
}

export function KeyboardShortcutsDialog({
  open,
  onClose,
  showActivityShortcut = true,
}: KeyboardShortcutsDialogProps) {
  const shortcutGroups = showActivityShortcut
    ? SHORTCUT_GROUPS
    : SHORTCUT_GROUPS.map(group => ({
        ...group,
        shortcuts: group.shortcuts.filter(
          shortcut => shortcut.description !== "Toggle activity panel"
        ),
      })).filter(group => group.shortcuts.length > 0);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50"
            style={{
              background: "rgba(0,0,0,0.4)",
              backdropFilter: "blur(4px)",
            }}
            onClick={onClose}
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md rounded-xl overflow-hidden shadow-2xl"
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-5 py-4"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <div className="flex items-center gap-2.5">
                <Keyboard
                  className="w-4.5 h-4.5"
                  style={{ color: "var(--primary)" }}
                />
                <h2
                  className="text-sm font-semibold"
                  style={{ color: "var(--foreground)" }}
                >
                  Keyboard Shortcuts
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/8 transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Shortcut Groups */}
            <div className="px-5 py-4 space-y-5 max-h-[60vh] overflow-y-auto">
              {shortcutGroups.map(group => (
                <div key={group.title}>
                  <h3
                    className="text-[11px] font-semibold uppercase tracking-wider mb-2.5"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {group.title}
                  </h3>
                  <div className="space-y-2">
                    {group.shortcuts.map(shortcut => (
                      <div
                        key={shortcut.description}
                        className="flex items-center justify-between py-1"
                      >
                        <span
                          className="text-[13px]"
                          style={{ color: "var(--foreground)" }}
                        >
                          {shortcut.description}
                        </span>
                        <div className="flex items-center gap-1">
                          {shortcut.keys.map((key, i) => (
                            <span key={i} className="flex items-center gap-1">
                              {i > 0 && (
                                <span
                                  className="text-[10px]"
                                  style={{ color: "var(--muted-foreground)" }}
                                >
                                  +
                                </span>
                              )}
                              <Kbd>{key}</Kbd>
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer hint */}
            <div
              className="px-5 py-3 text-center"
              style={{
                borderTop: "1px solid var(--border)",
                background: "color-mix(in srgb, var(--muted) 30%, transparent)",
              }}
            >
              <span
                className="text-[11px]"
                style={{ color: "var(--muted-foreground)" }}
              >
                Press <Kbd>Esc</Kbd> to close
              </span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
