import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { GuardrailAlert } from '../components/agentic/guardrails/GuardrailAlert';
import { GuardrailsIndicator } from '../components/agentic/guardrails/GuardrailsIndicator';
import { RiskScoreIndicator } from '../components/agentic/guardrails/RiskScoreIndicator';
import { HallucinationWarning } from '../components/agentic/guardrails/HallucinationWarning';
import { FactCheckIndicator } from '../components/agentic/evidence/FactCheckIndicator';
import type { GuardrailCheck } from '../components/agentic/guardrails/GuardrailAlert';

// ============================================================================
// Sample Data
// ============================================================================

const sampleChecks: GuardrailCheck[] = [
  { name: 'PII Detection', status: 'pass', message: 'No personal identifiable information found.' },
  { name: 'Content Safety', status: 'pass', message: 'Response is within safety guidelines.' },
  { name: 'Hallucination Check', status: 'warn', message: 'Some claims could not be verified against knowledge base.' },
  { name: 'Bias Detection', status: 'pass', message: 'No significant bias patterns detected.' },
  { name: 'Data Sovereignty', status: 'pass', message: 'All data sources are within approved regions.' },
];

const blockedChecks: GuardrailCheck[] = [
  { name: 'PII Detection', status: 'fail', message: 'Social Security numbers detected in output.' },
  { name: 'Content Safety', status: 'fail', message: 'Response contains restricted content.' },
  { name: 'Data Sovereignty', status: 'warn', message: 'External API call may violate data residency policy.' },
];

// ============================================================================
// Meta
// ============================================================================

const meta = {
  title: 'Defensive/Guardrails',
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Safety guardrail components for AI platform: risk scoring, hallucination detection, fact verification, and approval workflows.',
      },
    },
  },
} satisfies Meta;

export default meta;

// ============================================================================
// GuardrailAlert Stories
// ============================================================================

export const AlertSafe: StoryObj = {
  render: () => (
    <div style={{ maxWidth: 480 }}>
      <GuardrailAlert checks={sampleChecks} overallStatus="safe" />
    </div>
  ),
  name: 'GuardrailAlert — Safe',
};

export const AlertWarning: StoryObj = {
  render: () => (
    <div style={{ maxWidth: 480 }}>
      <GuardrailAlert checks={sampleChecks} overallStatus="warning" />
    </div>
  ),
  name: 'GuardrailAlert — Warning',
};

export const AlertBlocked: StoryObj = {
  render: () => (
    <div style={{ maxWidth: 480 }}>
      <GuardrailAlert checks={blockedChecks} overallStatus="blocked" />
    </div>
  ),
  name: 'GuardrailAlert — Blocked',
};

export const AlertCompact: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', gap: 8 }}>
      <GuardrailAlert checks={sampleChecks} overallStatus="safe" compact onClick={fn()} />
      <GuardrailAlert checks={sampleChecks} overallStatus="warning" compact onClick={fn()} />
      <GuardrailAlert checks={blockedChecks} overallStatus="blocked" compact onClick={fn()} />
    </div>
  ),
  name: 'GuardrailAlert — Compact',
};

// ============================================================================
// GuardrailsIndicator Stories
// ============================================================================

export const IndicatorSafe: StoryObj = {
  render: () => (
    <GuardrailsIndicator checks={sampleChecks} overallStatus="safe" />
  ),
  name: 'GuardrailsIndicator — Safe',
};

export const IndicatorBlocked: StoryObj = {
  render: () => (
    <GuardrailsIndicator checks={blockedChecks} overallStatus="blocked" />
  ),
  name: 'GuardrailsIndicator — Blocked',
};

// ============================================================================
// RiskScoreIndicator Stories
// ============================================================================

const riskFactors = [
  { name: 'PII Exposure', score: 12, description: 'Low risk of personally identifiable information leakage' },
  { name: 'Hallucination', score: 45, description: 'Moderate risk — some claims lack source backing' },
  { name: 'Bias', score: 8, description: 'Minimal detected bias in response' },
  { name: 'Data Sovereignty', score: 72, description: 'High risk — external API crosses data boundary' },
];

export const RiskNegligible: StoryObj = {
  render: () => (
    <div style={{ maxWidth: 360 }}>
      <RiskScoreIndicator score={10} factors={riskFactors.slice(0, 2)} />
    </div>
  ),
  name: 'RiskScore — Negligible',
};

export const RiskModerate: StoryObj = {
  render: () => (
    <div style={{ maxWidth: 360 }}>
      <RiskScoreIndicator score={48} factors={riskFactors} />
    </div>
  ),
  name: 'RiskScore — Moderate',
};

export const RiskCritical: StoryObj = {
  render: () => (
    <div style={{ maxWidth: 360 }}>
      <RiskScoreIndicator
        score={88}
        factors={[
          { name: 'Data Exposure', score: 95 },
          { name: 'Policy Violation', score: 82 },
          { name: 'Unauthorized Access', score: 76 },
        ]}
      />
    </div>
  ),
  name: 'RiskScore — Critical',
};

export const RiskSizes: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
      <RiskScoreIndicator score={35} size="sm" showBreakdown={false} />
      <RiskScoreIndicator score={55} size="md" showBreakdown={false} />
      <RiskScoreIndicator score={75} size="lg" showBreakdown={false} />
    </div>
  ),
  name: 'RiskScore — Size Variants',
};

// ============================================================================
// HallucinationWarning Stories
// ============================================================================

export const HallucinationInfo: StoryObj = {
  render: () => (
    <div style={{ maxWidth: 420 }}>
      <HallucinationWarning severity="info" />
    </div>
  ),
  name: 'Hallucination — Info',
};

export const HallucinationWarningStory: StoryObj = {
  render: () => (
    <div style={{ maxWidth: 420 }}>
      <HallucinationWarning
        severity="warning"
        flaggedClaims={[
          'HKI had $250B in revenue in 2024',
          'Warehouse count exceeds 900 locations',
        ]}
        onAction={fn()}
      />
    </div>
  ),
  name: 'Hallucination — Warning with Claims',
};

export const HallucinationCritical: StoryObj = {
  render: () => (
    <div style={{ maxWidth: 420 }}>
      <HallucinationWarning
        severity="critical"
        message="Multiple claims in this response contradict verified data sources."
        flaggedClaims={[
          'The Northwest region saw a 40% revenue decline',
        ]}
        onAction={fn()}
        actionLabel="Review Sources"
      />
    </div>
  ),
  name: 'Hallucination — Critical',
};

export const HallucinationInline: StoryObj = {
  render: () => (
    <p className="text-sm" style={{ color: 'var(--foreground)', maxWidth: 480, lineHeight: 1.8 }}>
      The AI analysis suggests that warehouse throughput increased by 15%{' '}
      <HallucinationWarning severity="caution" variant="inline" />{' '}
      in Q3 compared to the previous quarter, driven primarily by seasonal demand.
    </p>
  ),
  name: 'Hallucination — Inline Badge',
};

export const HallucinationAllSeverities: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 420 }}>
      <HallucinationWarning severity="info" />
      <HallucinationWarning severity="caution" />
      <HallucinationWarning severity="warning" />
      <HallucinationWarning severity="critical" />
    </div>
  ),
  name: 'Hallucination — All Severities',
};

// ============================================================================
// FactCheckIndicator Stories
// ============================================================================

const sampleSources = [
  { title: 'HKI Annual Report 2024', url: '#', reliability: 'high' as const },
  { title: 'Industry Analysis (McKinsey)', url: '#', reliability: 'high' as const },
  { title: 'Internal Analytics Dashboard', reliability: 'medium' as const },
];

export const FactCheckVerified: StoryObj = {
  render: () => (
    <div style={{ maxWidth: 380 }}>
      <FactCheckIndicator
        status="verified"
        claim="HKI operates 861 warehouses globally as of Q4 2024."
        sourceCount={3}
        sourceQuality={92}
        sources={sampleSources}
      />
    </div>
  ),
  name: 'FactCheck — Verified',
};

export const FactCheckPartial: StoryObj = {
  render: () => (
    <div style={{ maxWidth: 380 }}>
      <FactCheckIndicator
        status="partially_verified"
        claim="Revenue grew 12% year-over-year in the Northwest region."
        sourceCount={1}
        sourceQuality={45}
        sources={[sampleSources[2]!]}
      />
    </div>
  ),
  name: 'FactCheck — Partially Verified',
};

export const FactCheckDisputed: StoryObj = {
  render: () => (
    <div style={{ maxWidth: 380 }}>
      <FactCheckIndicator
        status="disputed"
        claim="HKI plans to close 50 locations in 2025."
        sourceCount={0}
        sourceQuality={10}
      />
    </div>
  ),
  name: 'FactCheck — Disputed',
};

export const FactCheckBadges: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <FactCheckIndicator status="verified" variant="badge" sourceCount={3} />
      <FactCheckIndicator status="partially_verified" variant="badge" sourceCount={1} />
      <FactCheckIndicator status="unverified" variant="badge" />
      <FactCheckIndicator status="disputed" variant="badge" sourceCount={0} />
    </div>
  ),
  name: 'FactCheck — Badge Variants',
};
