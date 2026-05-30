/**
 * DomainIsolationDialog — High-fidelity security warning on active scope transition
 *
 * Fully reinforces the "Fail-Closed" concept of HKI when switching domains.
 * Explains cryptographic boundary resets and isolated context.
 */

import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  ShieldAlert,
  ArrowRight,
  Lock,
  KeyRound,
  ServerCrash,
} from "lucide-react";
import { HkiMark } from "@hki/ui";
import { MOTION, RADIUS, GLASS, GLOW } from "@/design-system/tokens";

interface DomainIsolationDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  currentScopeName: string;
  targetScopeName: string;
  isTransactionActive: boolean;
}

export function DomainIsolationDialog({
  open,
  onClose,
  onConfirm,
  currentScopeName,
  targetScopeName,
  isTransactionActive,
}: DomainIsolationDialogProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[100] overflow-y-auto p-4 md:p-6 flex items-center justify-center cursor-pointer"
          style={{
            background: "rgba(3, 4, 7, 0.65)",
            backdropFilter: "blur(8px)",
          }}
          onClick={onClose}
        >
          {/* Dialog Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 15 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-[500px] rounded-3xl overflow-hidden shadow-2xl cursor-default my-auto"
            style={{
              background: "var(--card)",
              border:
                "1px solid color-mix(in srgb, var(--border) 60%, transparent)",
              boxShadow:
                "0 24px 60px -15px rgba(0, 0, 0, 0.7), 0 0 1px 1px color-mix(in srgb, white 4%, transparent) inset",
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="dialog-title"
            onClick={e => e.stopPropagation()}
          >
            {/* Top Security Line Indicator */}
            <div
              className="h-1 w-full"
              style={{
                background: isTransactionActive
                  ? "linear-gradient(90deg, #F43F5E 0%, #D946EF 100%)"
                  : "linear-gradient(90deg, var(--primary) 0%, #a855f7 100%)",
              }}
            />

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-[color-mix(in srgb,var(--border)_30%,transparent)]">
              <div className="flex items-center gap-3">
                <div
                  className="p-2 rounded-xl"
                  style={{
                    background: isTransactionActive
                      ? "rgba(244, 63, 94, 0.08)"
                      : "rgba(14, 124, 123, 0.08)",
                    border: `1px solid ${isTransactionActive ? "rgba(244, 63, 94, 0.2)" : "rgba(14, 124, 123, 0.2)"}`,
                  }}
                >
                  <ShieldAlert
                    className="w-5 h-5"
                    style={{
                      color: isTransactionActive ? "#F43F5E" : "var(--primary)",
                    }}
                  />
                </div>
                <div>
                  <h2
                    id="dialog-title"
                    className="text-base font-semibold text-foreground tracking-wide"
                  >
                    Scope Isolation Alert
                  </h2>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider mt-0.5">
                    HKI Invariant Enforcement
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-[color-mix(in srgb,var(--foreground)_5%,transparent)] transition-all duration-200"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content Body */}
            <div className="px-6 py-5 space-y-6">
              {/* Domain Transfer Visual Grid */}
              <div
                className="p-4 rounded-2xl flex items-center justify-between gap-3 border"
                style={{
                  background:
                    "color-mix(in srgb, var(--muted) 20%, transparent)",
                  borderColor:
                    "color-mix(in srgb, var(--border) 40%, transparent)",
                }}
              >
                <div className="flex-1 text-center min-w-0">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block mb-1">
                    Current Scope
                  </span>
                  <span className="text-sm font-semibold text-foreground block break-words whitespace-normal">
                    {currentScopeName}
                  </span>
                </div>

                <div className="flex flex-col items-center justify-center px-2 shrink-0">
                  <motion.div
                    animate={{ x: [-4, 4, -4] }}
                    transition={{
                      duration: 2.2,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  >
                    <ArrowRight className="w-5 h-5 text-muted-foreground opacity-60" />
                  </motion.div>
                </div>

                <div className="flex-1 text-center min-w-0">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-primary block mb-1">
                    Target Scope
                  </span>
                  <span className="text-sm font-semibold text-foreground block break-words whitespace-normal">
                    {targetScopeName}
                  </span>
                </div>
              </div>

              {/* Informative Security Callout */}
              <div className="space-y-3.5">
                <p className="text-[13px] leading-relaxed text-muted-foreground">
                  Hermetic Knowledge Isolation enforces **exact-match single
                  domain visibility**. Switching active domains triggers a
                  dynamic session audit and teardown.
                </p>

                {/* Checklist of Invariant actions */}
                <div className="space-y-2.5">
                  <div className="flex items-start gap-2.5">
                    <Lock className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-semibold text-foreground">
                        Envelope Signature Seal
                      </p>
                      <p className="text-[11px] text-muted-foreground leading-normal mt-0.5 break-words">
                        A new restricted cryptographic envelope will be minted
                        on behalf of your session, signing the active scope{" "}
                        {targetScopeName}.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <KeyRound className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-semibold text-foreground">
                        Fail-Closed Isolation
                      </p>
                      <p className="text-[11px] text-muted-foreground leading-normal mt-0.5 break-words">
                        Any current context memory, downstream RAG query paths,
                        or tools connected to {currentScopeName} are permanently
                        decoupled and locked.
                      </p>
                    </div>
                  </div>

                  {isTransactionActive && (
                    <div className="flex items-start gap-2.5">
                      <ServerCrash className="w-4 h-4 mt-0.5 text-[#F43F5E] shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-semibold text-[#F43F5E]">
                          Terminating Active Chat Session
                        </p>
                        <p className="text-[11px] text-muted-foreground leading-normal mt-0.5 break-words">
                          You have an active chat running under{" "}
                          {currentScopeName}. Switching domains will terminate
                          this thread and start a fresh context.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div
              className="px-6 py-4 flex items-center justify-end gap-3 border-t border-[color-mix(in srgb,var(--border)_30%,transparent)]"
              style={{
                background: "color-mix(in srgb, var(--muted) 25%, transparent)",
              }}
            >
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-[color-mix(in srgb,var(--foreground)_5%,transparent)] transition-all duration-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white shadow-md active:scale-[0.98] transition-all duration-200 flex items-center gap-1.5"
                style={{
                  background: isTransactionActive
                    ? "linear-gradient(135deg, #F43F5E 0%, #D946EF 100%)"
                    : "linear-gradient(135deg, var(--primary) 0%, #0c6564 100%)",
                  boxShadow: isTransactionActive
                    ? "0 10px 15px -3px rgba(244, 63, 94, 0.3)"
                    : "0 10px 15px -3px rgba(14, 124, 123, 0.3)",
                }}
              >
                <HkiMark size={11} variant="white" className="h-3 w-3" />
                Confirm & Isolate Context
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
