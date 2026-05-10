"use client";

import * as React from "react";
import { cn } from "../utils";

/* ── Types ────────────────────────────────────────────────────────── */

export interface WizardStep {
  /** Unique key for the step */
  id: string;
  /** Short label shown in the step indicator */
  label: string;
  /** Optional description shown below the label */
  description?: string;
  /** Return false to prevent advancing past this step */
  validate?: () => boolean;
}

export interface WizardProps {
  /** Ordered list of steps */
  steps: WizardStep[];
  /** Currently active step index (controlled) */
  activeStep: number;
  /** Called when the active step changes */
  onStepChange: (index: number) => void;
  /** Called when the user clicks "Finish" on the last step */
  onFinish?: () => void;
  /** Called when the user clicks "Cancel" */
  onCancel?: () => void;
  /** Content for the current step — render conditionally based on activeStep */
  children: React.ReactNode;
  /** Label for the finish button (defaults to "Save") */
  finishLabel?: string;
  /** Whether the finish button is disabled */
  finishDisabled?: boolean;
  /** Optional className for the root container */
  className?: string;
  /** Optional footer-left slot (e.g. delete button) */
  footerLeft?: React.ReactNode;
  /** Accent color for the progress indicator (CSS value) */
  accentColor?: string;
  /** Secondary accent for gradient (CSS value) */
  accentColorEnd?: string;
}

/* ── Constants ────────────────────────────────────────────────────── */

const BLUE = "#0E7C7B";
const RED = BLUE;
/* ── Wizard ───────────────────────────────────────────────────────── */

/**
 * Multi-step wizard with duotone progress indicator, animated transitions,
 * and built-in navigation (Back / Next / Finish).
 *
 * Fully controlled — caller owns `activeStep` and `onStepChange`.
 *
 * @example
 * ```tsx
 * <Wizard
 *   steps={[
 *     { id: "basics", label: "Basics" },
 *     { id: "details", label: "Details" },
 *     { id: "review", label: "Review" },
 *   ]}
 *   activeStep={step}
 *   onStepChange={setStep}
 *   onFinish={handleSave}
 *   onCancel={handleClose}
 * >
 *   {step === 0 && <BasicsStep />}
 *   {step === 1 && <DetailsStep />}
 *   {step === 2 && <ReviewStep />}
 * </Wizard>
 * ```
 */
export function Wizard({
  steps,
  activeStep,
  onStepChange,
  onFinish,
  onCancel,
  children,
  finishLabel = "Save",
  finishDisabled = false,
  className,
  footerLeft,
  accentColor = BLUE,
  accentColorEnd = RED,
}: WizardProps) {
  const isFirst = activeStep === 0;
  const isLast = activeStep === steps.length - 1;
  const gradient = accentColorEnd === accentColor ? accentColor : accentColor;

  const handleNext = () => {
    const current = steps[activeStep];
    if (current?.validate && !current.validate()) return;
    if (isLast) {
      onFinish?.();
    } else {
      onStepChange(activeStep + 1);
    }
  };

  const handleBack = () => {
    if (!isFirst) onStepChange(activeStep - 1);
  };

  const progressPct = ((activeStep + 1) / steps.length) * 100;

  return (
    <div className={cn("flex flex-col", className)}>
      {/* ── Step indicator ───────────────────────────────────────── */}
      <div className="px-6 pt-6 pb-4">
        {/* Step dots + labels */}
        <nav className="flex items-start justify-between gap-2" aria-label="Wizard steps">
          {steps.map((step, i) => {
            const isActive = i === activeStep;
            const isCompleted = i < activeStep;
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => {
                  if (i < activeStep) onStepChange(i);
                }}
                disabled={i > activeStep}
                className={cn(
                  "flex flex-col items-center gap-1.5 flex-1 min-w-0 group transition-all",
                  i > activeStep && "opacity-40 cursor-not-allowed",
                  i < activeStep && "cursor-pointer",
                )}
                aria-current={isActive ? "step" : undefined}
              >
                {/* Dot */}
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all border-2",
                    isCompleted && "text-white border-transparent",
                    isActive && "border-transparent text-white shadow-md",
                    !isActive && !isCompleted && "border-[#e0dfdc] dark:border-[#333333] text-[#8a8986] dark:text-[#6f6e6b] bg-transparent",
                  )}
                  style={
                    isActive
                      ? { background: gradient, boxShadow: `0 2px 8px ${accentColor}40` }
                      : isCompleted
                        ? { background: accentColor }
                        : undefined
                  }
                >
                  {isCompleted ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </div>
                {/* Label */}
                <span
                  className={cn(
                    "text-xs font-semibold truncate max-w-full transition-colors",
                    isActive ? "text-[#1a1a19] dark:text-[#f5f4f1]" : "text-[#8a8986] dark:text-[#6f6e6b]",
                  )}
                >
                  {step.label}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Progress bar */}
        <div className="mt-4 h-1 w-full rounded-full bg-[#e0dfdc] dark:bg-[#333333] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progressPct}%`, background: gradient }}
          />
        </div>
      </div>

      {/* ── Step content ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {children}
      </div>

      {/* ── Footer navigation ────────────────────────────────────── */}
      <div className="px-6 py-4 border-t border-[#eae9e6] dark:border-[#2a2a2a] bg-[#f5f4f1] dark:bg-[#161616] flex items-center justify-between gap-3 rounded-b-2xl">
        <div className="flex items-center gap-3">
          {footerLeft}
        </div>
        <div className="flex items-center gap-3">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-5 py-2 rounded-lg text-[#6f6e6b] dark:text-[#a3a29f] hover:text-[#1a1a19] dark:hover:text-[#f5f4f1] hover:bg-[#eae9e6] dark:hover:bg-[#242424] transition-colors text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E7C7B]"
            >
              Cancel
            </button>
          )}
          {!isFirst && (
            <button
              type="button"
              onClick={handleBack}
              className="px-5 py-2 rounded-lg text-[#6f6e6b] dark:text-[#a3a29f] hover:text-[#1a1a19] dark:hover:text-[#f5f4f1] hover:bg-[#eae9e6] dark:hover:bg-[#242424] border border-[#e0dfdc] dark:border-[#333333] transition-colors text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E7C7B]"
            >
              Back
            </button>
          )}
          <button
            type="button"
            onClick={handleNext}
            disabled={isLast && finishDisabled}
            className={cn(
              "px-6 py-2 rounded-lg font-bold text-sm uppercase tracking-wide text-white shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
              isLast && finishDisabled && "opacity-50 cursor-not-allowed",
            )}
            style={{
              background: isLast ? gradient : accentColor,
              boxShadow: `0 2px 8px ${accentColor}30`,
            }}
          >
            {isLast ? finishLabel : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── useWizard hook ───────────────────────────────────────────────── */

/**
 * Convenience hook for managing wizard state.
 *
 * @example
 * ```tsx
 * const wizard = useWizard(3);
 * <Wizard activeStep={wizard.step} onStepChange={wizard.goTo} ... />
 * ```
 */
export function useWizard(totalSteps: number) {
  const [step, setStep] = React.useState(0);

  return {
    step,
    goTo: setStep,
    next: () => setStep((s) => Math.min(s + 1, totalSteps - 1)),
    back: () => setStep((s) => Math.max(s - 1, 0)),
    reset: () => setStep(0),
    isFirst: step === 0,
    isLast: step === totalSteps - 1,
  };
}
