/**
 * ToolExecutionCard Component
 *
 * Category: tool-use
 * Priority: P0 (Core)
 * Complexity: High
 *
 * Production-quality tool execution display with status indicators,
 * expandable input/output, copy-to-clipboard, and CSS variable theming.
 * Canonical shared implementation for Agentic tool execution UI.
 */

import { useState } from "react";
import {
  Wrench,
  ChevronDown,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  Code,
  Copy,
  Check,
} from "lucide-react";
import { cn } from "../../../utils";

// ============================================================================
// Types
// ============================================================================

export interface ToolExecutionCardProps {
  toolName: string;
  description?: string;
  status: "pending" | "running" | "success" | "error";
  input?: Record<string, unknown>;
  output?: Record<string, unknown> | string | number | boolean | null;
  error?: string;
  duration?: number;
  timestamp: string;
  children?: React.ReactNode;
  className?: string;
}

// ============================================================================
// Config
// ============================================================================

const statusConfig = {
  pending: {
    icon: Clock,
    color: "var(--muted-foreground)",
    bgColor: "var(--muted)",
    borderColor: "var(--border)",
    label: "Queued",
  },
  running: {
    icon: Loader2,
    color: "var(--primary)",
    bgColor: "color-mix(in srgb, var(--primary) 10%, transparent)",
    borderColor: "color-mix(in srgb, var(--primary) 30%, var(--border))",
    label: "Executing",
  },
  success: {
    icon: CheckCircle2,
    color: "var(--success, #16a34a)",
    bgColor: "color-mix(in srgb, var(--success, #16a34a) 10%, transparent)",
    borderColor:
      "color-mix(in srgb, var(--success, #16a34a) 30%, var(--border))",
    label: "Complete",
  },
  error: {
    icon: XCircle,
    color: "var(--destructive)",
    bgColor: "color-mix(in srgb, var(--destructive) 10%, transparent)",
    borderColor: "color-mix(in srgb, var(--destructive) 30%, var(--border))",
    label: "Failed",
  },
};

// ============================================================================
// Component
// ============================================================================

export function ToolExecutionCard({
  toolName,
  description,
  status,
  input,
  output,
  error,
  duration,
  timestamp,
  children,
  className,
}: ToolExecutionCardProps) {
  const [isExpanded, setIsExpanded] = useState(status === "error");
  const [showInput, setShowInput] = useState(false);
  const [showOutput, setShowOutput] = useState(true);
  const [copiedInput, setCopiedInput] = useState(false);
  const [copiedOutput, setCopiedOutput] = useState(false);

  const config = statusConfig[status];

  const handleCopy = async (text: string, isInput: boolean) => {
    try {
      await navigator.clipboard.writeText(text);
      if (isInput) {
        setCopiedInput(true);
        setTimeout(() => setCopiedInput(false), 2000);
      } else {
        setCopiedOutput(true);
        setTimeout(() => setCopiedOutput(false), 2000);
      }
    } catch {
      console.warn("[Clipboard] writeText failed");
    }
  };

  return (
    <div
      className={cn("rounded-xl border overflow-hidden relative", className)}
      style={{
        background: "var(--card)",
        borderColor: config.borderColor,
        boxShadow:
          status === "running"
            ? "0 0 0 1px color-mix(in srgb, var(--primary) 20%, transparent), 0 4px 16px -4px color-mix(in srgb, var(--primary) 15%, transparent)"
            : "0 2px 8px -4px color-mix(in srgb, var(--neutral-900, #171716) 8%, transparent)",
        transition: "all 0.2s ease",
      }}
      data-component="ToolExecutionCard"
    >
      {/* Running State - Animated Gradient */}
      {status === "running" && (
        <>
          <div
            className="absolute inset-0 pointer-events-none animate-pulse"
            style={{
              background:
                "linear-gradient(135deg, color-mix(in srgb, var(--primary) 8%, transparent) 0%, color-mix(in srgb, var(--secondary, var(--primary)) 5%, transparent) 100%)",
            }}
          />
          <div
            className="absolute top-0 left-0 right-0 h-[2px]"
            style={{
              background:
                "linear-gradient(90deg, transparent 0%, var(--primary) 50%, transparent 100%)",
              animation: "tool-progress 1.5s ease-in-out infinite",
            }}
          />
        </>
      )}

      {/* Header */}
      <div
        className="flex cursor-pointer items-center gap-3 p-3.5 relative z-10"
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        aria-label="Toggle tool execution details"
        onClick={() => setIsExpanded(!isExpanded)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsExpanded(!isExpanded);
          }
        }}
      >
        {/* Tool Icon with Status */}
        <div
          className="relative rounded-xl p-2.5 transition-all duration-200"
          style={{ background: config.bgColor }}
        >
          <Wrench className="h-4 w-4" style={{ color: config.color }} />
          {status === "running" && (
            <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
              <span
                className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                style={{ background: "var(--primary)" }}
              />
              <span
                className="relative inline-flex rounded-full h-2.5 w-2.5"
                style={{ background: "var(--primary)" }}
              />
            </span>
          )}
          {status === "success" && (
            <span
              className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5 rounded-full"
              style={{ background: "var(--success, #16a34a)" }}
            />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h4
              className="font-semibold text-sm"
              style={{ color: "var(--foreground)" }}
            >
              {toolName}
            </h4>
            <span
              className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: config.bgColor, color: config.color }}
            >
              {status === "running" && (
                <Loader2 className="h-3 w-3 animate-spin" />
              )}
              {status === "success" && <CheckCircle2 className="h-3 w-3" />}
              {status === "error" && <XCircle className="h-3 w-3" />}
              {config.label}
            </span>
          </div>
          <div
            className="flex items-center gap-2 text-xs"
            style={{ color: "var(--muted-foreground)" }}
          >
            {description && (
              <span className="truncate max-w-[200px]">{description}</span>
            )}
            {description && <span style={{ opacity: 0.4 }}>•</span>}
            <time>
              {new Date(timestamp).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </time>
            {duration !== undefined && (
              <>
                <span style={{ opacity: 0.4 }}>•</span>
                <span>{duration}ms</span>
              </>
            )}
          </div>
        </div>

        {/* Expand/Collapse */}
        <button
          type="button"
          className="h-8 w-8 p-0 flex items-center justify-center rounded-md transition-colors hover:bg-black/5 dark:hover:bg-white/10"
          style={{ color: "var(--muted-foreground)" }}
        >
          <ChevronDown
            className={cn(
              "h-4 w-4 transition-transform duration-200",
              isExpanded && "rotate-180",
            )}
          />
        </button>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div
          className="px-3.5 pb-3.5 pt-0 space-y-3 border-t mt-2"
          style={{ borderColor: "var(--border)" }}
        >
          {/* Input */}
          {input && (
            <div className="space-y-2 pt-3">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  className="h-6 px-2 -ml-2 font-medium text-xs flex items-center gap-1.5 rounded transition-colors hover:bg-black/5 dark:hover:bg-white/10"
                  style={{ color: "var(--muted-foreground)" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowInput(!showInput);
                  }}
                >
                  <Code className="h-3 w-3" />
                  Input Parameters
                  <ChevronDown
                    className={cn(
                      "h-3 w-3 opacity-50 transition-transform",
                      showInput && "rotate-180",
                    )}
                  />
                </button>
                {showInput && (
                  <button
                    type="button"
                    className="h-6 w-6 p-0 flex items-center justify-center rounded transition-colors hover:bg-black/5 dark:hover:bg-white/10"
                    onClick={() =>
                      handleCopy(JSON.stringify(input, null, 2), true)
                    }
                    aria-label="Copy input"
                  >
                    {copiedInput ? (
                      <Check className="h-3 w-3 text-green-500" />
                    ) : (
                      <Copy
                        className="h-3 w-3"
                        style={{ color: "var(--muted-foreground)" }}
                      />
                    )}
                  </button>
                )}
              </div>
              {showInput && (
                <pre
                  className="overflow-x-auto rounded-lg border p-3 text-xs font-mono max-h-[200px]"
                  style={{
                    background: "var(--background)",
                    borderColor: "var(--border)",
                    color: "var(--foreground)",
                  }}
                >
                  {JSON.stringify(input, null, 2)}
                </pre>
              )}
            </div>
          )}

          {/* Output */}
          {output && status === "success" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  className="h-6 px-2 -ml-2 font-medium text-xs flex items-center gap-1.5 rounded transition-colors hover:bg-black/5 dark:hover:bg-white/10"
                  style={{ color: "var(--muted-foreground)" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowOutput(!showOutput);
                  }}
                >
                  <Code className="h-3 w-3" />
                  Result Output
                  <ChevronDown
                    className={cn(
                      "h-3 w-3 opacity-50 transition-transform",
                      showOutput && "rotate-180",
                    )}
                  />
                </button>
                {showOutput && (
                  <button
                    type="button"
                    className="h-6 w-6 p-0 flex items-center justify-center rounded transition-colors hover:bg-black/5 dark:hover:bg-white/10"
                    onClick={() =>
                      handleCopy(JSON.stringify(output, null, 2), false)
                    }
                    aria-label="Copy output"
                  >
                    {copiedOutput ? (
                      <Check className="h-3 w-3 text-green-500" />
                    ) : (
                      <Copy
                        className="h-3 w-3"
                        style={{ color: "var(--muted-foreground)" }}
                      />
                    )}
                  </button>
                )}
              </div>
              {showOutput && (
                <pre
                  className="overflow-x-auto rounded-lg border p-3 text-xs font-mono max-h-[300px]"
                  style={{
                    background: "var(--background)",
                    borderColor: "var(--border)",
                    color: "var(--foreground)",
                  }}
                >
                  {JSON.stringify(output, null, 2)}
                </pre>
              )}
            </div>
          )}

          {/* Error */}
          {error && status === "error" && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-900 dark:border-red-900/30 dark:bg-red-900/10 dark:text-red-300">
              <div className="flex items-center gap-2 mb-1 font-medium text-red-700 dark:text-red-400">
                <XCircle className="h-3.5 w-3.5" />
                Error — Execution Failed
              </div>
              <p className="pl-5 opacity-90">{error}</p>
            </div>
          )}

          {/* Custom Content */}
          {children && <div className="pt-2">{children}</div>}
        </div>
      )}
    </div>
  );
}

ToolExecutionCard.displayName = "ToolExecutionCard";

export default ToolExecutionCard;
