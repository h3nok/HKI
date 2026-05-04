/**
 * KBErrorBoundary — Knowledge-specific error boundary wrapper.
 *
 * Uses the shared @hki/ui ErrorBoundary class but provides a custom
 * fallback UI that:
 *   • Constrains width (no full-bleed white panel)
 *   • Uses KB theme tokens + dark mode support
 *   • Provides actionable recovery options (copy, reload, go home, report)
 *   • Shows context-aware messages based on which tab crashed
 */

import { useState, useCallback } from "react";
import { ErrorBoundary, type FallbackProps } from "@hki/ui";
import {
  AlertTriangle,
  Copy,
  Check,
  RefreshCw,
  Home,
  ChevronDown,
  ChevronUp,
  Bug,
  ArrowLeft,
} from "lucide-react";
import { k } from "../theme";

// ── Helpers ──────────────────────────────────────────────────────────────────

const TAB_LABELS: Record<string, string> = {
  overview: "Overview",
  ingest: "Ingest",
  library: "Library",
  validate: "Validate",
  govern: "Govern",
  activity: "Activity",
  pipelines: "Processing Status",
};

function buildErrorReport(
  error: Error,
  errorInfo: React.ErrorInfo | null,
  tab?: string
) {
  const lines = [
    `Knowledge Base Error Report`,
    `──────────────────────────`,
    `Timestamp: ${new Date().toISOString()}`,
    `Tab: ${tab ? (TAB_LABELS[tab] ?? tab) : "Unknown"}`,
    `URL: ${window.location.href}`,
    `User Agent: ${navigator.userAgent}`,
    ``,
    `Error: ${error.name}: ${error.message}`,
  ];
  if (error.stack) {
    lines.push(``, `Stack Trace:`, error.stack);
  }
  if (errorInfo?.componentStack) {
    lines.push(``, `Component Stack:`, errorInfo.componentStack);
  }
  return lines.join("\n");
}

// ── Fallback UI ──────────────────────────────────────────────────────────────

interface KBFallbackProps extends FallbackProps {
  tab?: string;
  onNavigateHome?: () => void;
  onGoBack?: () => void;
}

function KBErrorFallback({
  error,
  errorInfo,
  resetErrorBoundary,
  tab,
  onNavigateHome,
  onGoBack,
}: KBFallbackProps) {
  const [copied, setCopied] = useState(false);
  const [showStack, setShowStack] = useState(false);
  const isDev = import.meta.env.DEV;

  const tabLabel = tab ? (TAB_LABELS[tab] ?? tab) : undefined;

  const handleCopy = useCallback(async () => {
    const report = buildErrorReport(error, errorInfo ?? null, tab);
    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback for non-secure contexts
      const ta = document.createElement("textarea");
      ta.value = report;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }, [error, errorInfo, tab]);

  const handleReport = useCallback(() => {
    const report = buildErrorReport(error, errorInfo ?? null, tab);
    const subject = encodeURIComponent(
      `[KB Bug] ${tabLabel ?? "Unknown"} tab crash: ${error.message.slice(0, 60)}`
    );
    const body = encodeURIComponent(report.slice(0, 1800));
    window.open(
      `mailto:innovation-lab@hki.com?subject=${subject}&body=${body}`,
      "_blank"
    );
  }, [error, errorInfo, tab, tabLabel]);

  return (
    <div className="flex items-start justify-center pt-12 pb-16 px-4">
      <div
        className={`${k.card} max-w-xl w-full overflow-hidden`}
        role="alert"
        aria-live="assertive"
      >
        {/* Header stripe */}
        <div className="bg-destructive/10 dark:bg-destructive/15 px-6 py-4 border-b border-destructive/20 dark:border-destructive/25">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-destructive/15 dark:bg-destructive/20 p-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold text-foreground">
                {tabLabel
                  ? `${tabLabel} encountered an error`
                  : "Something went wrong"}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                This section crashed unexpectedly. Your data is safe.
              </p>
            </div>
          </div>
        </div>

        {/* Error message */}
        <div className="px-6 py-4 space-y-4">
          <div className={`${k.inset} px-4 py-3`}>
            <p className="text-xs font-mono text-destructive dark:text-red-400 break-all leading-relaxed">
              {error.message || "An unknown error occurred"}
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={resetErrorBoundary}
              className={`${k.btnPrimary} gap-1.5`}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Try Again
            </button>

            <button
              onClick={handleCopy}
              className={`${k.btnSecondary} gap-1.5`}
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Copy Details
                </>
              )}
            </button>

            {onGoBack && (
              <button onClick={onGoBack} className={`${k.btnGhost} gap-1.5`}>
                <ArrowLeft className="h-3.5 w-3.5" />
                Go Back
              </button>
            )}

            {onNavigateHome && (
              <button
                onClick={onNavigateHome}
                className={`${k.btnGhost} gap-1.5`}
              >
                <Home className="h-3.5 w-3.5" />
                Overview
              </button>
            )}

            <button onClick={handleReport} className={`${k.btnGhost} gap-1.5`}>
              <Bug className="h-3.5 w-3.5" />
              Report
            </button>
          </div>

          {/* Stack trace (dev only) */}
          {isDev && error.stack && (
            <div>
              <button
                onClick={() => setShowStack(s => !s)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                aria-expanded={showStack}
              >
                {showStack ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
                {showStack ? "Hide" : "Show"} Stack Trace
              </button>
              {showStack && (
                <pre className="mt-2 rounded-lg bg-muted dark:bg-muted p-3 text-[11px] font-mono text-muted-foreground overflow-x-auto max-h-48 leading-relaxed border border-black/4 dark:border-white/4">
                  {error.stack}
                  {errorInfo?.componentStack && (
                    <>
                      {"\n\n── Component Stack ──\n"}
                      {errorInfo.componentStack}
                    </>
                  )}
                </pre>
              )}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-6 py-3 border-t border-black/6 dark:border-white/6 bg-muted/50 dark:bg-muted/30">
          <p className="text-[11px] text-muted-foreground/70">
            If this keeps happening, try reloading the page or contact the
            Innovation Lab team.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Wrapper Component ────────────────────────────────────────────────────────

interface KBErrorBoundaryProps {
  children: React.ReactNode;
  /** Current tab key — used for contextual messaging */
  tab?: string;
  /** Navigate to the overview tab on recovery */
  onNavigateHome?: () => void;
  /** Go back to previous view */
  onGoBack?: () => void;
  /** Component name (appears in logs) */
  name?: string;
}

export default function KBErrorBoundary({
  children,
  tab,
  onNavigateHome,
  onGoBack,
  name,
}: KBErrorBoundaryProps) {
  return (
    <ErrorBoundary
      componentName={name ?? (tab ? `KB:${tab}` : "KnowledgeBase")}
      resetKeys={[tab]}
      fallbackRender={props => (
        <KBErrorFallback
          {...props}
          tab={tab}
          onNavigateHome={onNavigateHome}
          onGoBack={onGoBack}
        />
      )}
    >
      {children}
    </ErrorBoundary>
  );
}
