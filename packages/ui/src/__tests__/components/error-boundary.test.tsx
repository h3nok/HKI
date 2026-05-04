import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { ErrorBoundary, ErrorFallback, AgentErrorFallback } from "../../components/error-boundary";

// Component that throws an error
const ThrowError = ({ shouldThrow = true }: { shouldThrow?: boolean }) => {
  if (shouldThrow) {
    throw new Error("Test error message");
  }
  return <div>No error</div>;
};

describe("ErrorBoundary", () => {
  // Suppress console.error for expected errors
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "group").mockImplementation(() => {});
    vi.spyOn(console, "groupEnd").mockImplementation(() => {});
  });

  it("renders children when no error", () => {
    render(
      <ErrorBoundary>
        <div>Child content</div>
      </ErrorBoundary>
    );
    expect(screen.getByText("Child content")).toBeInTheDocument();
  });

  it("renders fallback UI when error occurs", () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
  });

  it("displays error message in fallback", () => {
    render(
      <ErrorBoundary showDetails>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText("Test error message")).toBeInTheDocument();
  });

  it("calls onError callback when error occurs", () => {
    const onError = vi.fn();
    render(
      <ErrorBoundary onError={onError}>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(onError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ componentStack: expect.any(String) })
    );
  });

  it("resets error state when Try Again is clicked", () => {
    const onReset = vi.fn<() => void>();
    let shouldThrow = true;

    render(
      <ErrorBoundary onReset={onReset}>
        <ThrowError shouldThrow={shouldThrow} />
      </ErrorBoundary>
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();

    shouldThrow = false;
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));

    expect(onReset).toHaveBeenCalled();
  });

  it("renders custom fallback when provided", () => {
    render(
      <ErrorBoundary fallback={<div>Custom fallback</div>}>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText("Custom fallback")).toBeInTheDocument();
  });

  it("renders fallbackRender when provided", () => {
    render(
      <ErrorBoundary
        fallbackRender={({ error, resetErrorBoundary }) => (
          <div>
            <span>Error: {error.message}</span>
            <button onClick={resetErrorBoundary}>Reset</button>
          </div>
        )}
      >
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText("Error: Test error message")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset" })).toBeInTheDocument();
  });

  it("displays component name when provided", () => {
    render(
      <ErrorBoundary componentName="TestComponent">
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText(/TestComponent Error/i)).toBeInTheDocument();
  });
});

describe("ErrorFallback", () => {
  const defaultProps = {
    error: new Error("Test error"),
    errorInfo: null,
    resetErrorBoundary: vi.fn(),
  };

  it("renders minimal variant", () => {
    render(<ErrorFallback {...defaultProps} variant="minimal" />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("renders inline variant", () => {
    render(<ErrorFallback {...defaultProps} variant="inline" componentName="Widget" />);

    expect(screen.getByText("Widget failed to load")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("shows expandable details in development", () => {
    render(<ErrorFallback {...defaultProps} showDetails />);

    const showDetailsButton = screen.getByRole("button", { name: /show details/i });
    fireEvent.click(showDetailsButton);

    expect(screen.getByText(/error stack/i)).toBeInTheDocument();
  });

  it("copies error details to clipboard", async () => {
    render(<ErrorFallback {...defaultProps} showDetails />);

    const copyButton = screen.getByRole("button", { name: /copy error/i });
    fireEvent.click(copyButton);

    expect(navigator.clipboard.writeText).toHaveBeenCalled();
  });
});

describe("AgentErrorFallback", () => {
  it("renders with agent name and operation type", () => {
    render(
      <AgentErrorFallback
        error={new Error("Tool failed")}
        agentName="DataAgent"
        operationType="tool_execution"
        onRetry={vi.fn()}
      />
    );

    expect(screen.getByText(/DataAgent — Tool Execution Failed/i)).toBeInTheDocument();
    expect(screen.getByText("Tool failed")).toBeInTheDocument();
  });

  it("calls onRetry when retry button is clicked", () => {
    const onRetry = vi.fn();
    render(<AgentErrorFallback error={new Error("Error")} onRetry={onRetry} />);

    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(onRetry).toHaveBeenCalled();
  });

  it("calls onDismiss when dismiss button is clicked", () => {
    const onDismiss = vi.fn();
    render(<AgentErrorFallback error={new Error("Error")} onDismiss={onDismiss} />);

    fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(onDismiss).toHaveBeenCalled();
  });
});
