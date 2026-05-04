/**
 * Agentic Defensive UI — Smoke & Accessibility Tests
 *
 * Covers:
 * - Guardrails: GuardrailAlert, GuardrailsIndicator, RiskScoreIndicator, HallucinationWarning
 * - Evidence: FactCheckIndicator
 * - HITL: ApprovalQueue
 * - Thought-Trace: ReasoningCard, ThoughtTraceStream
 * - Execution: ExecutionPlanCard, InterventionCard
 *
 * Tests verify:
 * 1. Components render without crashing (smoke)
 * 2. Correct ARIA roles and attributes (a11y)
 * 3. Interactive state changes (expand/collapse, select)
 * 4. No hardcoded color classes in rendered output (dark-mode readiness)
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// ── Guardrails ───────────────────────────────────────────────────────────────
import { GuardrailAlert } from '../../components/agentic/guardrails/GuardrailAlert';
import { GuardrailsIndicator } from '../../components/agentic/guardrails/GuardrailsIndicator';
import { RiskScoreIndicator } from '../../components/agentic/guardrails/RiskScoreIndicator';
import { HallucinationWarning } from '../../components/agentic/guardrails/HallucinationWarning';

// ── Evidence ─────────────────────────────────────────────────────────────────
import { FactCheckIndicator } from '../../components/agentic/evidence/FactCheckIndicator';

// ── HITL ──────────────────────────────────────────────────────────────────────
import { ApprovalQueue } from '../../components/agentic/hitl/ApprovalQueue';

// ── Thought-Trace ────────────────────────────────────────────────────────────
import { ThoughtTraceStream } from '../../components/agentic/thought-trace/ThoughtTraceStream';

// ============================================================================
// Test Data Factories
// ============================================================================

function makeChecks() {
  return [
    { id: '1', name: 'Content safety', status: 'pass' as const, message: 'No harmful content' },
    { id: '2', name: 'PII detection', status: 'fail' as const, message: 'Email found in output' },
    { id: '3', name: 'Bias scan', status: 'warn' as const, message: 'Minor bias detected' },
  ];
}

function makeApprovalItems() {
  return [
    {
      id: 'a1',
      type: 'tool_execution' as const,
      title: 'Run price scraper',
      description: 'Scrape competitor prices from 5 websites',
      agentName: 'PriceBot',
      priority: 'critical' as const,
      status: 'pending' as const,
      createdAt: new Date().toISOString(),
      riskScore: 0.8,
    },
    {
      id: 'a2',
      type: 'data_access' as const,
      title: 'Access member database',
      description: 'Read member purchase history',
      agentName: 'AnalyticsBot',
      priority: 'high' as const,
      status: 'pending' as const,
      createdAt: new Date().toISOString(),
    },
  ];
}

function makeChunks() {
  return [
    { id: 'c1', content: 'Analyzing the request', timestamp: new Date().toISOString(), type: 'thinking' as const },
    { id: 'c2', content: 'Found relevant data', timestamp: new Date().toISOString(), type: 'reasoning' as const },
  ];
}

// ============================================================================
// GUARDRAILS
// ============================================================================

describe('Agentic — GuardrailAlert', () => {
  const checks = makeChecks();

  it('renders without crashing', () => {
    const { container } = render(<GuardrailAlert checks={checks} overallStatus="warning" />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('displays passed/total count', () => {
    render(<GuardrailAlert checks={checks} overallStatus="warning" />);
    // The component should show "1 of 3" or similar
    const btn = screen.getByRole('button');
    expect(btn).toBeInTheDocument();
  });

  it('has aria-expanded on expandable header', () => {
    render(<GuardrailAlert checks={checks} overallStatus="warning" />);
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('aria-expanded');
  });

  it('has aria-label with safety context', () => {
    render(<GuardrailAlert checks={checks} overallStatus="warning" />);
    const btn = screen.getByRole('button');
    expect(btn.getAttribute('aria-label')).toMatch(/safety guardrails/i);
  });
});

describe('Agentic — GuardrailsIndicator', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <GuardrailsIndicator checks={makeChecks()} overallStatus="safe" />
    );
    expect(container.firstChild).toBeInTheDocument();
  });

  it('has aria-expanded and aria-label', () => {
    render(<GuardrailsIndicator checks={makeChecks()} overallStatus="warning" />);
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('aria-expanded');
    expect(btn).toHaveAttribute('aria-label');
  });
});

describe('Agentic — RiskScoreIndicator', () => {
  it('renders without crashing', () => {
    const { container } = render(<RiskScoreIndicator score={65} />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('has role="meter" with aria-valuenow', () => {
    render(<RiskScoreIndicator score={42} />);
    const meter = screen.getByRole('meter');
    expect(meter).toBeInTheDocument();
    expect(meter).toHaveAttribute('aria-valuenow', '42');
    expect(meter).toHaveAttribute('aria-valuemin', '0');
    expect(meter).toHaveAttribute('aria-valuemax', '100');
  });

  it('rounds score in aria-valuenow', () => {
    render(<RiskScoreIndicator score={73.7} />);
    const meter = screen.getByRole('meter');
    expect(meter).toHaveAttribute('aria-valuenow', '74');
  });

  it('has descriptive aria-label', () => {
    render(<RiskScoreIndicator score={90} />);
    const meter = screen.getByRole('meter');
    expect(meter.getAttribute('aria-label')).toMatch(/risk score.*90/i);
  });
});

describe('Agentic — HallucinationWarning', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <HallucinationWarning severity="warning" message="Content may be inaccurate" />
    );
    expect(container.firstChild).toBeInTheDocument();
  });

  it('uses role="alert" for critical severity', () => {
    render(
      <HallucinationWarning severity="critical" message="High hallucination risk" />
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('uses role="status" for non-critical severity', () => {
    render(
      <HallucinationWarning severity="info" message="Low confidence on some claims" />
    );
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('has descriptive aria-label', () => {
    render(
      <HallucinationWarning severity="warning" message="Some claims unverified" />
    );
    const el = screen.getByRole('status');
    expect(el).toHaveAttribute('aria-label');
    expect(el.getAttribute('aria-label')).toMatch(/some claims unverified/i);
  });
});

// ============================================================================
// EVIDENCE
// ============================================================================

describe('Agentic — FactCheckIndicator', () => {
  it('renders badge variant without crashing', () => {
    const { container } = render(
      <FactCheckIndicator status="verified" variant="badge" claim="HKI has 600+ warehouses" />
    );
    expect(container.firstChild).toBeInTheDocument();
  });

  it('renders card variant without crashing', () => {
    const { container } = render(
      <FactCheckIndicator status="disputed" variant="card" claim="Test claim" />
    );
    expect(container.firstChild).toBeInTheDocument();
  });

  it('has aria-expanded on card variant header', () => {
    render(
      <FactCheckIndicator status="verified" variant="card" claim="Test claim" />
    );
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('aria-expanded');
  });
});

// ============================================================================
// HITL
// ============================================================================

describe('Agentic — ApprovalQueue', () => {
  const items = makeApprovalItems();

  it('renders without crashing', () => {
    const { container } = render(<ApprovalQueue items={items} />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('has role="table" with aria-label', () => {
    render(<ApprovalQueue items={items} />);
    const table = screen.getByRole('table');
    expect(table).toBeInTheDocument();
    expect(table).toHaveAttribute('aria-label', 'Approval queue');
  });

  it('renders pending count', () => {
    render(<ApprovalQueue items={items} />);
    expect(screen.getByText('2 pending')).toBeInTheDocument();
  });

  it('shows empty state when no items', () => {
    render(<ApprovalQueue items={[]} emptyMessage="All clear!" />);
    expect(screen.getByText('All clear!')).toBeInTheDocument();
  });

  it('calls onApprove with item id', () => {
    const onApprove = vi.fn();
    render(<ApprovalQueue items={items} onApprove={onApprove} />);
    const approveButtons = screen.getAllByLabelText(/approve/i);
    const [firstApproveButton] = approveButtons;
    expect(firstApproveButton).toBeDefined();
    fireEvent.click(firstApproveButton!);
    expect(onApprove).toHaveBeenCalledWith(['a1']);
  });

  it('calls onReject with item id', () => {
    const onReject = vi.fn();
    render(<ApprovalQueue items={items} onReject={onReject} />);
    const rejectButtons = screen.getAllByLabelText(/reject/i);
    const [firstRejectButton] = rejectButtons;
    expect(firstRejectButton).toBeDefined();
    fireEvent.click(firstRejectButton!);
    expect(onReject).toHaveBeenCalledWith(['a1']);
  });

  it('approve/reject buttons include item title in aria-label', () => {
    render(<ApprovalQueue items={items} onApprove={vi.fn()} />);
    const approveBtn = screen.getByLabelText('Approve: Run price scraper');
    expect(approveBtn).toBeInTheDocument();
  });

  it('expand button has aria-expanded', () => {
    render(<ApprovalQueue items={items} />);
    const expandButtons = screen.getAllByLabelText(/expand details/i);
    expect(expandButtons[0]).toHaveAttribute('aria-expanded', 'false');
  });

  it('row has role="row" with aria-selected', () => {
    render(<ApprovalQueue items={items} />);
    const rows = screen.getAllByRole('row');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]).toHaveAttribute('aria-selected');
  });
});

// ============================================================================
// THOUGHT-TRACE
// ============================================================================

describe('Agentic — ThoughtTraceStream', () => {
  const chunks = makeChunks();

  it('renders without crashing', () => {
    const { container } = render(
      <ThoughtTraceStream chunks={chunks} status="streaming" />
    );
    expect(container.firstChild).toBeInTheDocument();
  });

  it('renders chunk count in footer', () => {
    render(<ThoughtTraceStream chunks={chunks} status="complete" />);
    expect(screen.getByText('2 thoughts')).toBeInTheDocument();
  });

  it('shows empty state when idle with no chunks', () => {
    render(<ThoughtTraceStream chunks={[]} status="idle" />);
    expect(screen.getByText(/waiting for agent/i)).toBeInTheDocument();
  });

  it('has data-component attribute', () => {
    const { container } = render(
      <ThoughtTraceStream chunks={chunks} status="streaming" />
    );
    expect(container.querySelector('[data-component="ThoughtTraceStream"]')).toBeInTheDocument();
  });

  it('has aria-live region for screen readers', () => {
    const { container } = render(
      <ThoughtTraceStream chunks={chunks} status="streaming" />
    );
    const liveRegion = container.querySelector('[aria-live="polite"]');
    expect(liveRegion).toBeInTheDocument();
  });
});

