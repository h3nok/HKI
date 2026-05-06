export interface MaturityInput {
  docCount: number;
  chunkCount: number;
  entityCount: number;
  cmos: number;
  avgChunksPerSearch: number;
  avgTopScore: number; // 0–1
  totalIngestJobs: number;
  ingestSuccessRate: number; // 0–1
  avgIngestDurationMs: number;
  totalEvents: number;
  uniqueUsers: number;
  journeyDone: number;
  journeyTotal: number;
  servicesUp: number;
  servicesTotal: number;
}

export interface MaturityResult {
  overall: number;
  content: number;
  search: number;
  pipeline: number;
  journey: number;
  ops: number;
  adoption: number;
  hasEvidence: boolean;
  level: MaturityLevel;
}

export type MaturityLevel = "seed" | "sprout" | "growing" | "mature" | "elite";

export const MATURITY_LEVELS: Record<
  MaturityLevel,
  { label: string; color: string; textCls: string; ring: string }
> = {
  seed: {
    label: "Seed",
    color: "color-mix(in srgb, var(--muted-foreground) 70%, var(--background))",
    textCls: "text-muted-foreground",
    ring: "color-mix(in srgb, var(--muted-foreground) 70%, var(--background))",
  },
  sprout: {
    label: "Sprout",
    color: "color-mix(in srgb, var(--primary) 46%, var(--muted-foreground))",
    textCls: "text-primary",
    ring: "color-mix(in srgb, var(--primary) 46%, var(--muted-foreground))",
  },
  growing: {
    label: "Growing",
    color: "var(--primary)",
    textCls: "text-primary",
    ring: "var(--primary)",
  },
  mature: {
    label: "Mature",
    color: "color-mix(in srgb, var(--primary) 88%, white)",
    textCls: "text-primary",
    ring: "color-mix(in srgb, var(--primary) 88%, white)",
  },
  elite: {
    label: "Agentic",
    color: "var(--primary)",
    textCls: "text-primary",
    ring: "var(--primary)",
  },
};

export function healthColor(score: number) {
  if (score >= 88) return MATURITY_LEVELS.elite;
  if (score >= 70) return MATURITY_LEVELS.mature;
  if (score >= 50) return MATURITY_LEVELS.growing;
  if (score >= 25) return MATURITY_LEVELS.sprout;
  return MATURITY_LEVELS.seed;
}

export function computeMaturity(input: MaturityInput): MaturityResult {
  const {
    docCount,
    chunkCount,
    entityCount,
    cmos,
    avgChunksPerSearch,
    avgTopScore,
    totalIngestJobs,
    ingestSuccessRate,
    avgIngestDurationMs,
    totalEvents,
    uniqueUsers,
    journeyDone,
    journeyTotal,
    servicesUp,
    servicesTotal,
  } = input;

  const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
  const clamp100 = (v: number) => Math.max(0, Math.min(100, Math.round(v)));
  const hasEvidence =
    docCount > 0 ||
    chunkCount > 0 ||
    entityCount > 0 ||
    cmos > 0 ||
    avgChunksPerSearch > 0 ||
    avgTopScore > 0 ||
    totalIngestJobs > 0 ||
    totalEvents > 0 ||
    uniqueUsers > 0;

  const scoreSaturating = (value: number, target: number) => {
    if (value <= 0) return 0;
    return clamp100((Math.log1p(value) / Math.log1p(target)) * 100);
  };

  const scoreLowerBetter = (value: number, best: number, worst: number) => {
    if (value <= 0) return 0;
    if (value <= best) return 100;
    if (value >= worst) return 10;
    const t = (value - best) / (worst - best);
    return clamp100(100 - t * 90);
  };

  const scoreChunksPerSearch = (v: number) => {
    if (v <= 0) return 0;
    if (v <= 3) return clamp100(70 + (v / 3) * 30);
    if (v <= 8) return clamp100(100 - (v - 3) * 8);
    if (v <= 14) return clamp100(60 - (v - 8) * 8);
    return 8;
  };

  const docScore = scoreSaturating(docCount, 20);
  const chunkScore = scoreSaturating(chunkCount, 800);
  const entityScore = scoreSaturating(entityCount, 120);
  const content = clamp100(
    docScore * 0.4 + chunkScore * 0.35 + entityScore * 0.25
  );

  const relevanceScore =
    avgTopScore > 0 ? clamp100(clamp01(avgTopScore) * 100) : 0;
  const chunkEfficiency = scoreChunksPerSearch(avgChunksPerSearch);
  const cmosEfficiency = scoreLowerBetter(cmos, 1_600, 7_000);
  const search = clamp100(
    relevanceScore * 0.65 + chunkEfficiency * 0.2 + cmosEfficiency * 0.15
  );

  const stability =
    ingestSuccessRate > 0 ? clamp100(clamp01(ingestSuccessRate) * 100) : 0;
  const durationScore = scoreLowerBetter(avgIngestDurationMs, 6_000, 90_000);
  const volumeConfidence = Math.min(1, totalIngestJobs / 25);
  const pipelineRaw = clamp100(stability * 0.75 + durationScore * 0.25);
  const pipeline =
    totalIngestJobs > 0
      ? clamp100(pipelineRaw * (0.6 + 0.4 * volumeConfidence))
      : 0;

  const journey =
    journeyTotal > 0 ? Math.round((journeyDone / journeyTotal) * 100) : 0;

  const ops =
    servicesTotal > 0 ? Math.round((servicesUp / servicesTotal) * 100) : 0;

  const userScore = scoreSaturating(uniqueUsers, 30);
  const eventScore = scoreSaturating(totalEvents, 2_500);
  const adoption = clamp100(userScore * 0.55 + eventScore * 0.45);

  if (!hasEvidence) {
    return {
      overall: 0,
      content: 0,
      search: 0,
      pipeline: 0,
      journey: 0,
      ops: 0,
      adoption: 0,
      hasEvidence: false,
      level: "seed",
    };
  }

  const overall = Math.round(
    content * 0.22 +
      search * 0.24 +
      pipeline * 0.18 +
      journey * 0.14 +
      ops * 0.12 +
      adoption * 0.1
  );

  let level: MaturityLevel = "seed";
  if (overall >= 88) level = "elite";
  else if (overall >= 70) level = "mature";
  else if (overall >= 50) level = "growing";
  else if (overall >= 25) level = "sprout";

  return {
    overall,
    content,
    search,
    pipeline,
    journey,
    ops,
    adoption,
    hasEvidence: true,
    level,
  };
}
