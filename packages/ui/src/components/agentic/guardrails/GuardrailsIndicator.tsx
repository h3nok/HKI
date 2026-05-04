/**
 * GuardrailsIndicator Component
 *
 * Category: guardrails
 * Priority: P0 (Core)
 * Complexity: Medium
 *
 * Production-quality safety guardrail status indicator with popover details.
 * Uses CSS variable theming for light/dark mode support.
 * Canonical shared implementation for Agentic guardrail status UI.
 */

import { useState } from "react";
import {
  Shield,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  Lock,
} from "lucide-react";
import { cn } from "../../../utils";
import type { GuardrailCheck, GuardrailOverallStatus } from "./GuardrailAlert";

// ============================================================================
// Types
// ============================================================================

export interface GuardrailsIndicatorProps {
  checks: GuardrailCheck[];
  overallStatus: GuardrailOverallStatus;
  className?: string;
}

// ============================================================================
// Config
// ============================================================================

const statusConfig = {
  safe: {
    icon: CheckCircle2,
    color: "var(--success, #16a34a)",
    bgColor: "color-mix(in srgb, var(--success, #16a34a) 12%, transparent)",
    borderColor:
      "color-mix(in srgb, var(--success, #16a34a) 25%, var(--border))",
    label: "Safe",
  },
  warning: {
    icon: AlertTriangle,
    color: "var(--warning, #d97706)",
    bgColor: "color-mix(in srgb, var(--warning, #d97706) 12%, transparent)",
    borderColor:
      "color-mix(in srgb, var(--warning, #d97706) 25%, var(--border))",
    label: "Warning",
  },
  blocked: {
    icon: XCircle,
    color: "var(--destructive)",
    bgColor: "color-mix(in srgb, var(--destructive) 12%, transparent)",
    borderColor: "color-mix(in srgb, var(--destructive) 25%, var(--border))",
    label: "Blocked",
  },
};

const checkStatusConfig = {
  pass: { icon: CheckCircle2, color: "var(--success, #16a34a)" },
  warn: { icon: AlertTriangle, color: "var(--warning, #d97706)" },
  fail: { icon: XCircle, color: "var(--destructive)" },
};

// ============================================================================
// Component
// ============================================================================

export function GuardrailsIndicator({
  checks,
  overallStatus,
  className,
}: GuardrailsIndicatorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const config = statusConfig[overallStatus];

  const passedChecks = checks.filter((c) => c.status === "pass").length;
  const totalChecks = checks.length;

  return (
    <div
      className={cn("relative inline-block", className)}
      data-component="GuardrailsIndicator"
    >
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-all duration-200 hover:opacity-90"
        style={{
          background: config.bgColor,
          color: config.color,
          border: `1px solid ${config.borderColor}`,
        }}
        aria-expanded={isOpen}
        aria-label={`Safety status: ${config.label}. ${passedChecks} of ${totalChecks} checks passed.`}
      >
        <Shield className="h-3 w-3" />
        <span>{config.label}</span>
      </button>

      {/* Popover */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Content */}
          <div
            className="absolute right-0 top-full mt-2 z-50 w-80 rounded-xl shadow-xl overflow-hidden"
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
            }}
          >
            {/* Header */}
            <div
              className="p-4 border-b"
              style={{
                background: "color-mix(in srgb, var(--muted) 30%, transparent)",
                borderColor: "var(--border)",
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="p-2 rounded-xl"
                  style={{
                    background: config.bgColor,
                    border: `1px solid ${config.borderColor}`,
                  }}
                >
                  <Lock className="h-4 w-4" style={{ color: config.color }} />
                </div>
                <div>
                  <h4
                    className="font-semibold text-sm"
                    style={{ color: "var(--foreground)" }}
                  >
                    Safety Guardrails
                  </h4>
                  <p
                    className="text-xs"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {passedChecks} of {totalChecks} checks passed
                  </p>
                </div>
              </div>
            </div>

            {/* Checks List */}
            <div className="p-2 space-y-1">
              {checks.map((check, index) => {
                const checkConfig = checkStatusConfig[check.status];
                const CheckIcon = checkConfig.icon;

                return (
                  <div
                    key={`${check.name}-${index}`}
                    className="flex items-start gap-3 rounded-lg p-2 transition-colors"
                  >
                    <CheckIcon
                      className="h-4 w-4 shrink-0 mt-0.5"
                      style={{ color: checkConfig.color }}
                    />
                    <div className="flex-1 space-y-0.5">
                      <p
                        className="text-xs font-medium"
                        style={{ color: "var(--foreground)" }}
                      >
                        {check.name}
                      </p>
                      {check.message && (
                        <p
                          className="text-xs"
                          style={{ color: "var(--muted-foreground)" }}
                        >
                          {check.message}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Info Footer */}
            <div
              className="p-3 border-t"
              style={{
                background:
                  "color-mix(in srgb, var(--primary) 5%, transparent)",
                borderColor:
                  "color-mix(in srgb, var(--primary) 15%, var(--border))",
              }}
            >
              <div className="flex gap-2">
                <Info
                  className="h-4 w-4 shrink-0 mt-0.5"
                  style={{ color: "var(--primary)" }}
                />
                <p
                  className="text-xs leading-relaxed"
                  style={{
                    color:
                      "color-mix(in srgb, var(--primary) 80%, var(--foreground))",
                  }}
                >
                  Guardrails protect against harmful content, PII leakage, and
                  hallucinations.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

GuardrailsIndicator.displayName = "GuardrailsIndicator";

export default GuardrailsIndicator;
