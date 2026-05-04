"use client";

import * as React from "react";
import { AlertCircle, RefreshCw, ChevronDown, ChevronUp, Copy, Check } from "lucide-react";
import { cn } from "../utils";

function isDevelopmentEnvironment() {
  const runtime = globalThis as typeof globalThis & {
    process?: {
      env?: {
        NODE_ENV?: string;
      };
    };
  };

  return runtime.process?.env?.NODE_ENV === "development";
}

// ============================================================================
// Types
// ============================================================================

export interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Custom fallback UI when error occurs */
  fallback?: React.ReactNode;
  /** Custom fallback render function with error details */
  fallbackRender?: (props: FallbackProps) => React.ReactNode;
  /** Callback when error is caught */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  /** Callback when reset is triggered */
  onReset?: () => void;
  /** Keys that trigger reset when changed */
  resetKeys?: unknown[];
  /** Component name for logging/display */
  componentName?: string;
  /** Show detailed error info (dev mode) */
  showDetails?: boolean;
  /** Custom className for fallback container */
  className?: string;
  /** Variant style */
  variant?: "default" | "inline" | "minimal" | "card";
}

export interface FallbackProps {
  error: Error;
  errorInfo: React.ErrorInfo | null;
  resetErrorBoundary: () => void;
  componentName?: string | undefined;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

// ============================================================================
// Error Fallback Component
// ============================================================================

export interface ErrorFallbackProps extends FallbackProps {
  showDetails?: boolean | undefined;
  className?: string | undefined;
  variant?: "default" | "inline" | "minimal" | "card" | undefined;
}

export const ErrorFallback: React.FC<ErrorFallbackProps> = ({
  error,
  errorInfo,
  resetErrorBoundary,
  componentName,
  showDetails = isDevelopmentEnvironment(),
  className,
  variant = "default",
}) => {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const copyErrorDetails = async () => {
    const details = `Error: ${error.message}\n\nStack: ${error.stack}\n\nComponent Stack: ${errorInfo?.componentStack || "N/A"}`;
    await navigator.clipboard.writeText(details);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (variant === "minimal") {
    return (
      <div
        className={cn(
          "flex items-center gap-2 p-2 text-sm text-red-600",
          className
        )}
        role="alert"
        aria-live="assertive"
      >
        <AlertCircle className="h-4 w-4 shrink-0" />
        <span>Something went wrong</span>
        <button
          onClick={resetErrorBoundary}
          className="ml-2 text-red-700 hover:text-red-800 underline text-xs"
        >
          Retry
        </button>
      </div>
    );
  }

  if (variant === "inline") {
    return (
      <div
        className={cn(
          "flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-3",
          className
        )}
        role="alert"
        aria-live="assertive"
      >
        <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-red-800">
            {componentName ? `${componentName} failed to load` : "Component error"}
          </p>
          <p className="text-xs text-red-600 truncate">{error.message}</p>
        </div>
        <button
          onClick={resetErrorBoundary}
          className="shrink-0 inline-flex items-center gap-1 rounded-md bg-red-100 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-200 transition-colors"
        >
          <RefreshCw className="h-3 w-3" />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl border bg-white shadow-sm overflow-hidden",
        variant === "card" && "border-red-200",
        className
      )}
      role="alert"
      aria-live="assertive"
    >
      {/* Header */}
      <div className={cn(
        "flex items-start gap-4 p-6",
        variant === "card" ? "bg-red-50" : "bg-gray-50"
      )}>
        <div className="rounded-full bg-red-100 p-3">
          <AlertCircle className="h-6 w-6 text-red-600" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900">
            {componentName ? `${componentName} Error` : "Something went wrong"}
          </h3>
          <p className="mt-1 text-sm text-gray-600">
            {error.message || "An unexpected error occurred while rendering this component."}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 border-t border-gray-100 bg-white px-6 py-4">
        <button
          onClick={resetErrorBoundary}
          className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Try Again
        </button>

        {showDetails && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-800"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-4 w-4" />
                Hide Details
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" />
                Show Details
              </>
            )}
          </button>
        )}

        {showDetails && (
          <button
            onClick={copyErrorDetails}
            className="ml-auto inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 text-green-500" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copy Error
              </>
            )}
          </button>
        )}
      </div>

      {/* Error Details (Expandable) */}
      {showDetails && isExpanded && (
        <div className="border-t border-gray-100 bg-gray-50 p-4 space-y-3">
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Error Stack
            </h4>
            <pre className="overflow-x-auto rounded-lg bg-gray-900 p-3 text-xs text-gray-100 font-mono">
              {error.stack}
            </pre>
          </div>
          {errorInfo?.componentStack && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                Component Stack
              </h4>
              <pre className="overflow-x-auto rounded-lg bg-gray-900 p-3 text-xs text-gray-100 font-mono">
                {errorInfo.componentStack}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

ErrorFallback.displayName = "ErrorFallback";

// ============================================================================
// ErrorBoundary Class Component
// ============================================================================

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  static displayName = "ErrorBoundary";

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    this.setState({ errorInfo });
    this.props.onError?.(error, errorInfo);

    // Log to console in development
    if (isDevelopmentEnvironment()) {
      console.group("🚨 ErrorBoundary caught an error");
      console.error("Error:", error);
      console.error("Component Stack:", errorInfo.componentStack);
      console.groupEnd();
    }
  }

  override componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    const { resetKeys } = this.props;
    const { hasError } = this.state;

    if (hasError && prevProps.resetKeys !== resetKeys) {
      if (
        resetKeys &&
        prevProps.resetKeys &&
        !this.arraysEqual(resetKeys, prevProps.resetKeys)
      ) {
        this.resetErrorBoundary();
      }
    }
  }

  private arraysEqual(a: unknown[], b: unknown[]): boolean {
    if (a.length !== b.length) return false;
    return a.every((val, i) => val === b[i]);
  }

  resetErrorBoundary = (): void => {
    this.props.onReset?.();
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  override render(): React.ReactNode {
    const { hasError, error, errorInfo } = this.state;
    const {
      children,
      fallback,
      fallbackRender,
      componentName,
      showDetails,
      className,
      variant,
    } = this.props;

    if (hasError && error) {
      const fallbackProps: FallbackProps = {
        error,
        errorInfo,
        resetErrorBoundary: this.resetErrorBoundary,
        componentName,
      };

      if (fallbackRender) {
        return fallbackRender(fallbackProps);
      }

      if (fallback) {
        return fallback;
      }

      return (
        <ErrorFallback
          {...fallbackProps}
          showDetails={showDetails}
          className={className}
          variant={variant}
        />
      );
    }

    return children;
  }
}

// ============================================================================
// Functional Wrapper with Hook Support
// ============================================================================

export interface UseErrorBoundaryReturn {
  showBoundary: (error: Error) => void;
}

const ErrorBoundaryContext = React.createContext<UseErrorBoundaryReturn | null>(
  null
);

export function useErrorBoundary(): UseErrorBoundaryReturn {
  const context = React.useContext(ErrorBoundaryContext);
  if (!context) {
    throw new Error("useErrorBoundary must be used within an ErrorBoundary");
  }
  return context;
}

// ============================================================================
// Agentic-Specific Error Boundaries
// ============================================================================

export interface AgentErrorFallbackProps {
  error: Error;
  agentName?: string;
  operationType?: "tool_execution" | "reasoning" | "approval" | "unknown";
  onRetry?: () => void;
  onDismiss?: () => void;
}

export const AgentErrorFallback: React.FC<AgentErrorFallbackProps> = ({
  error,
  agentName = "Agent",
  operationType = "unknown",
  onRetry,
  onDismiss,
}) => {
  const operationLabels: Record<string, string> = {
    tool_execution: "Tool Execution",
    reasoning: "Reasoning",
    approval: "Approval Flow",
    unknown: "Operation",
  };

  return (
    <div
      className="rounded-lg border border-red-200 bg-red-50 p-4"
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-red-800">
            {agentName} — {operationLabels[operationType]} Failed
          </h4>
          <p className="mt-1 text-sm text-red-700">{error.message}</p>
          <div className="mt-3 flex items-center gap-2">
            {onRetry && (
              <button
                onClick={onRetry}
                className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 transition-colors"
              >
                <RefreshCw className="h-3 w-3" />
                Retry
              </button>
            )}
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="inline-flex items-center rounded-md bg-red-100 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-200 transition-colors"
              >
                Dismiss
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

AgentErrorFallback.displayName = "AgentErrorFallback";

export default ErrorBoundary;
