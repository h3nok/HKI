import type { AdminTone } from "./theme";

const compactNumber = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export const DASHBOARD_TARGETS = {
  dailyTokenBudget: 250_000,
  latencySloSeconds: 8,
  healthyToolErrorRate: 0.02,
  targetToolCallsPerConversation: 2,
  targetChunksPerDocument: 8,
  targetEntitiesPerDocument: 3,
} as const;

export interface DashboardTraceSignal {
  confidence?: number | null;
  latency?: number | null;
  tools?: unknown[] | { length: number } | null;
}

export interface DashboardSignalInput {
  confidencePct: number;
  totalConversations: number;
  totalToolCalls: number;
  toolErrorRate: number;
  guardrailBlocks: number;
  streamsCount: number;
  userCount: number;
  services: Array<{ ok: boolean; ms?: number }>;
  traces: DashboardTraceSignal[];
  knowledge: {
    documents: number;
    chunks: number;
    entities: number;
    relationships: number;
    activeJobs: number;
    failedJobs: number;
    completedJobs: number;
  };
  resources: {
    tokensToday: number;
    apiCalls: number;
    knowledgeQueries: number;
    guardrailChecks: number;
  };
  now?: Date;
}

export interface ForwardSignal {
  key: "readiness" | "risk" | "slo" | "runway" | "coverage" | "leverage";
  title: string;
  value: string;
  label: string;
  detail: string;
  progress: number;
  tone: AdminTone;
}

export interface DashboardSignalsSummary {
  readinessScore: number;
  signals: ForwardSignal[];
}

function clamp(value: number, min = 0, max = 100) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function scoreTone(score: number): AdminTone {
  if (score >= 86) return "positive";
  if (score >= 72) return "primary";
  if (score >= 55) return "warning";
  return "critical";
}

function pressureTone(pressure: number): AdminTone {
  if (pressure >= 84) return "critical";
  if (pressure >= 42) return "warning";
  if (pressure >= 18) return "primary";
  return "positive";
}

function percentile(values: number[], percentileValue: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = clamp(
    Math.ceil((percentileValue / 100) * sorted.length) - 1,
    0,
    sorted.length - 1
  );
  return sorted[index] ?? 0;
}

function projectDailyTokens(tokensToday: number, now = new Date()) {
  if (tokensToday <= 0) return 0;
  const elapsedHours =
    now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
  const elapsedDay = clamp(elapsedHours / 24, 1 / 24, 1);
  return Math.round(tokensToday / elapsedDay);
}

function riskLabel(pressure: number) {
  if (pressure >= 84) return "Critical";
  if (pressure >= 64) return "High";
  if (pressure >= 36) return "Watch";
  return "Low";
}

function computeKnowledgeScore(input: DashboardSignalInput["knowledge"]) {
  const totalJobs = input.activeJobs + input.failedJobs + input.completedJobs;
  const documentScore = input.documents > 0 ? 100 : 0;
  const chunkDensity =
    input.documents > 0
      ? clamp(
          (input.chunks /
            input.documents /
            DASHBOARD_TARGETS.targetChunksPerDocument) *
            100
        )
      : 0;
  const entityDensity =
    input.documents > 0
      ? clamp(
          (input.entities /
            input.documents /
            DASHBOARD_TARGETS.targetEntitiesPerDocument) *
            100
        )
      : 0;
  const relationshipDensity =
    input.entities > 0
      ? clamp((input.relationships / input.entities) * 100)
      : 0;
  const jobReliability =
    totalJobs > 0
      ? clamp(
          ((totalJobs - input.failedJobs) / totalJobs) * 100 -
            input.activeJobs * 3
        )
      : input.documents > 0
        ? 86
        : 0;

  return Math.round(
    documentScore * 0.2 +
      chunkDensity * 0.28 +
      entityDensity * 0.24 +
      relationshipDensity * 0.1 +
      jobReliability * 0.18
  );
}

export function buildDashboardSignals(
  input: DashboardSignalInput
): DashboardSignalsSummary {
  const servicesTotal = input.services.length;
  const healthyServices = input.services.filter(service => service.ok).length;
  const serviceScore =
    servicesTotal > 0 ? Math.round((healthyServices / servicesTotal) * 100) : 0;
  const toolReliabilityScore = clamp(100 - input.toolErrorRate * 100);
  const latencies = input.traces
    .map(trace => Number(trace.latency ?? 0))
    .filter(latency => latency > 0);
  const p95Latency = percentile(latencies, 95);
  const latencyScore =
    p95Latency > 0
      ? clamp(100 - (p95Latency / DASHBOARD_TARGETS.latencySloSeconds) * 72)
      : 86;
  const lowConfidenceRate =
    input.traces.length > 0
      ? input.traces.filter(trace => Number(trace.confidence ?? 0) < 0.65)
          .length / input.traces.length
      : 0;
  const guardrailScore = clamp(
    100 - input.guardrailBlocks * 4 - lowConfidenceRate * 40
  );
  const knowledgeScore = computeKnowledgeScore(input.knowledge);
  const readinessScore = Math.round(
    clamp(input.confidencePct) * 0.26 +
      serviceScore * 0.22 +
      toolReliabilityScore * 0.18 +
      knowledgeScore * 0.16 +
      latencyScore * 0.1 +
      guardrailScore * 0.08
  );

  const riskPressure = clamp(
    (100 - readinessScore) * 0.54 +
      lowConfidenceRate * 42 +
      input.toolErrorRate * 58 +
      input.knowledge.failedJobs * 3 +
      Math.min(input.guardrailBlocks, 20) * 1.2
  );
  const projectedTokens = projectDailyTokens(
    input.resources.tokensToday,
    input.now
  );
  const tokenBudgetPressure = clamp(
    (projectedTokens / DASHBOARD_TARGETS.dailyTokenBudget) * 100
  );
  const toolCallsPerConversation =
    input.totalConversations > 0
      ? input.totalToolCalls / input.totalConversations
      : 0;
  const leverageScore = clamp(
    (toolCallsPerConversation /
      DASHBOARD_TARGETS.targetToolCallsPerConversation) *
      100
  );

  return {
    readinessScore,
    signals: [
      {
        key: "readiness",
        title: "Launch Readiness",
        value: `${readinessScore}%`,
        label: `${healthyServices}/${servicesTotal || 0} services · ${input.confidencePct}% trust`,
        detail:
          "Composite of trust, service health, tool reliability, latency, guardrails, and knowledge coverage.",
        progress: readinessScore,
        tone: scoreTone(readinessScore),
      },
      {
        key: "risk",
        title: "Risk Horizon",
        value: riskLabel(riskPressure),
        label: `${Math.round(lowConfidenceRate * 100)}% low-confidence trace rate`,
        detail: `${input.guardrailBlocks} guardrail blocks · ${input.knowledge.failedJobs} failed jobs · ${(input.toolErrorRate * 100).toFixed(1)}% tool error rate`,
        progress: riskPressure,
        tone: pressureTone(riskPressure),
      },
      {
        key: "slo",
        title: "SLO Burn",
        value: latencies.length > 0 ? `${p95Latency.toFixed(1)}s` : "No data",
        label: `p95 trace latency · target ${DASHBOARD_TARGETS.latencySloSeconds}s`,
        detail:
          latencies.length > 0
            ? `${latencies.length} recent traces included in the latency pressure estimate.`
            : "Latency will populate as traces complete with tool execution timing.",
        progress:
          latencies.length > 0
            ? clamp((p95Latency / DASHBOARD_TARGETS.latencySloSeconds) * 100)
            : 0,
        tone:
          latencies.length === 0
            ? "neutral"
            : p95Latency > DASHBOARD_TARGETS.latencySloSeconds
              ? "critical"
              : p95Latency > DASHBOARD_TARGETS.latencySloSeconds * 0.72
                ? "warning"
                : "positive",
      },
      {
        key: "runway",
        title: "Cost Runway",
        value: compactNumber.format(projectedTokens),
        label: "Projected tokens today",
        detail: `${compactNumber.format(input.resources.tokensToday)} used · ${compactNumber.format(DASHBOARD_TARGETS.dailyTokenBudget)} daily planning budget`,
        progress: tokenBudgetPressure,
        tone:
          tokenBudgetPressure >= 100
            ? "critical"
            : tokenBudgetPressure >= 78
              ? "warning"
              : "primary",
      },
      {
        key: "coverage",
        title: "Knowledge Coverage",
        value: `${knowledgeScore}%`,
        label: `${compactNumber.format(input.knowledge.documents)} docs · ${compactNumber.format(input.knowledge.entities)} entities`,
        detail: `${compactNumber.format(input.knowledge.chunks)} chunks · ${compactNumber.format(input.knowledge.relationships)} graph relationships · ${input.knowledge.activeJobs} active jobs`,
        progress: knowledgeScore,
        tone: scoreTone(knowledgeScore),
      },
      {
        key: "leverage",
        title: "Automation Leverage",
        value: `${toolCallsPerConversation.toFixed(1)}x`,
        label: "Tool calls per conversation",
        detail: `${compactNumber.format(input.totalToolCalls)} total tool calls across ${compactNumber.format(input.totalConversations)} conversations and ${input.userCount} operators`,
        progress: leverageScore,
        tone:
          input.toolErrorRate > DASHBOARD_TARGETS.healthyToolErrorRate * 3
            ? "warning"
            : scoreTone(leverageScore),
      },
    ],
  };
}
