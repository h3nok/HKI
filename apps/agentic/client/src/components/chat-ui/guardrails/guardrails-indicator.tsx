/**
 * GuardrailsIndicator - World-Class Safety Status Component
 *
 * Features:
 * - CSS variable theming for light/dark modes
 * - Animated status indicators
 * - Detailed check breakdown in popover
 * - Semantic safety colors
 */

import { motion } from "framer-motion";
import {
  Shield,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  Lock,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// ============================================================================
// TYPES
// ============================================================================

export interface GuardrailCheck {
  name: string;
  status: "pass" | "warn" | "fail";
  message?: string;
}

export interface GuardrailsIndicatorProps {
  checks: GuardrailCheck[];
  overallStatus: "safe" | "warning" | "blocked";
}

// ============================================================================
// DESIGN CONFIG
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
    color: "var(--primary)",
    bgColor: "color-mix(in srgb, var(--primary) 12%, transparent)",
    borderColor: "color-mix(in srgb, var(--primary) 25%, var(--border))",
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
  pass: {
    icon: CheckCircle2,
    color: "var(--success, #16a34a)",
  },
  warn: {
    icon: AlertTriangle,
    color: "var(--primary)",
  },
  fail: {
    icon: XCircle,
    color: "var(--destructive)",
  },
};

// ============================================================================
// COMPONENT
// ============================================================================

export function GuardrailsIndicator({
  checks,
  overallStatus,
}: GuardrailsIndicatorProps) {
  const config = statusConfig[overallStatus];
  const StatusIcon = config.icon;

  const passedChecks = checks.filter(c => c.status === "pass").length;
  const totalChecks = checks.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-all duration-200"
          style={{
            background: config.bgColor,
            color: config.color,
            border: `1px solid ${config.borderColor}`,
          }}
        >
          <Shield className="h-3 w-3" />
          <span>{config.label}</span>
        </motion.button>
      </PopoverTrigger>

      <PopoverContent
        className="w-80 p-0 overflow-hidden rounded-xl shadow-xl"
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
        }}
        align="end"
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
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-start gap-3 rounded-lg p-2 transition-colors"
                style={{
                  background: "transparent",
                }}
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
              </motion.div>
            );
          })}
        </div>

        {/* Info Footer */}
        <div
          className="p-3 border-t"
          style={{
            background: "color-mix(in srgb, var(--primary) 5%, transparent)",
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
      </PopoverContent>
    </Popover>
  );
}
