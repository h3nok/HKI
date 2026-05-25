import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { FileText, Database, Share2, Cog } from "lucide-react";
import {
  cn,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@hki/ui";

import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { buildKnowledgeWorkspaceHref } from "@/_core/workspace-navigation";
import { CommandBanner } from "./components/CommandBanner";
import { KPICardBox } from "./components/KPIGrid";
import { KnowledgeStatsGrid } from "./components/KnowledgeStatsGrid";
import { ValueStreamsWidget } from "./components/ValueStreamsWidget";
import { AgentActivityWidget } from "./components/AgentActivityWidget";
import { ForwardSignalsPanel } from "./components/ForwardSignalsPanel";
import { buildDashboardSignals } from "./dashboardSignals";
import { a } from "./theme";

const DashboardChartsGrid = lazy(() =>
  import("./components/DashboardChartsGrid").then(module => ({
    default: module.DashboardChartsGrid,
  }))
);

const OBSERVABILITY_URL =
  (import.meta.env.VITE_OBSERVABILITY_URL as string) ||
  "";

const ENV =
  (import.meta.env.VITE_ENV as string) ||
  (window.location.hostname === "localhost" ? "development" : "production");
const ENV_META: Record<string, { label: string; dot: string }> = {
  development: { label: "DEV", dot: "bg-primary" },
  staging: { label: "STG", dot: "bg-primary/70" },
  production: { label: "PROD", dot: "bg-destructive" },
};

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function DashboardPage() {
  useAuth();
  const [, setLocation] = useLocation();
  const [kbScopeId, setKbScopeId] = useState("all");

  const envMeta = ENV_META[ENV] ?? ENV_META.development;

  const streamsQ = trpc.admin.listValueStreams.useQuery(undefined, {
    retry: false,
  });
  const streams = (streamsQ.data ?? []).filter((s: any) => s.id !== "global");
  const usersQ = trpc.admin.listUsers.useQuery(
    { search: undefined },
    { retry: false }
  );
  const govQ = trpc.governance.stats.useQuery(undefined, {
    retry: false,
    refetchInterval: 30_000,
  });
  const tracesQ = trpc.governance.recentTraces.useQuery(
    { limit: 20 },
    { retry: false, refetchInterval: 30_000 }
  );
  const toolStatsQ = trpc.governance.toolStats.useQuery(undefined, {
    retry: false,
    refetchInterval: 60_000,
  });
  const resourceMetricsQ = trpc.governance.resourceMetrics.useQuery(undefined, {
    retry: false,
    refetchInterval: 60_000,
  });
  const healthQ = trpc.knowledge.serviceHealth.useQuery(undefined, {
    retry: false,
    refetchInterval: 30_000,
  });
  const kbOverviewQ = trpc.admin.knowledgeOperationsSummary.useQuery(
    undefined,
    {
      retry: false,
      refetchInterval: 60_000,
      refetchOnWindowFocus: false,
    }
  );

  const userCount = usersQ.data?.total ?? 0;
  const selectedKbStream =
    streams.find((stream: any) => stream.id === kbScopeId) ?? null;
  const selectedKbStreamSummary =
    kbOverviewQ.data?.streams.find(
      (stream: any) => stream.valueStreamId === kbScopeId
    ) ?? null;
  const selectedKbSummary =
    kbScopeId === "all"
      ? (kbOverviewQ.data?.aggregate ?? null)
      : selectedKbStreamSummary;
  const allOk = useMemo(() => {
    const svcs = healthQ.data?.services ?? [];
    return svcs.length > 0 && svcs.every((s: any) => s.ok);
  }, [healthQ.data]);

  useEffect(() => {
    if (kbScopeId === "all") return;
    if (streams.some((stream: any) => stream.id === kbScopeId)) return;
    setKbScopeId("all");
  }, [kbScopeId, streams]);

  const services = useMemo(() => {
    const m: Record<string, { ok: boolean; latencyMs: number }> = {};
    for (const s of healthQ.data?.services ?? [])
      m[s.name] = { ok: s.ok, latencyMs: s.latencyMs };
    return [
      {
        label: "Knowledge API",
        ok: m["knowledge-api"]?.ok ?? false,
        ms: m["knowledge-api"]?.latencyMs,
      },
      {
        label: "Orchestrator",
        ok: m["orchestrator"]?.ok ?? false,
        ms: m["orchestrator"]?.latencyMs,
      },
      {
        label: "LLM Gateway",
        ok: m["llm-gateway"]?.ok ?? false,
        ms: m["llm-gateway"]?.latencyMs,
      },
      {
        label: "Pipeline",
        ok: m["pipeline"]?.ok ?? false,
        ms: m["pipeline"]?.latencyMs,
      },
    ];
  }, [healthQ.data]);

  const kbDocs = selectedKbSummary?.documents ?? 0;
  const kbChunks = selectedKbSummary?.chunks ?? 0;
  const kbEntities = selectedKbSummary?.entities ?? 0;
  const kbRelationships = selectedKbSummary?.relationships ?? 0;
  const kbJobs =
    kbScopeId === "all"
      ? (kbOverviewQ.data?.recentActiveJobs ?? [])
      : (selectedKbStreamSummary?.jobs ?? []);
  const kbSummaryText =
    kbScopeId === "all"
      ? "Aggregate knowledge metrics across all active domains."
      : selectedKbStream
        ? `Inspecting ${selectedKbStream.name} knowledge operations.`
        : "Select a domain to inspect domain-level knowledge operations.";
  const kbActiveJobs = kbJobs.filter(
    (j: any) => !["completed", "failed"].includes(j.status)
  ).length;
  const kbFailedJobs = selectedKbSummary?.failedJobs ?? 0;
  const kbCompletedJobs = selectedKbSummary?.completedJobs ?? 0;

  const refreshAll = () => {
    streamsQ.refetch();
    usersQ.refetch();
    govQ.refetch();
    tracesQ.refetch();
    toolStatsQ.refetch();
    resourceMetricsQ.refetch();
    healthQ.refetch();
    kbOverviewQ.refetch();
  };

  const confidenceVal = govQ.data
    ? Math.round((govQ.data.avgConfidence ?? 0) * 100)
    : 0;

  const openObservability = () =>
    window.open(OBSERVABILITY_URL, "observability");

  const kpis = [
    {
      label: "Avg Confidence" as const,
      value: govQ.data ? `${confidenceVal}%` : "—",
      color: "primary",
      onClick: openObservability,
    },
    {
      label: "Conversations" as const,
      value: govQ.data?.totalConversations ?? 0,
      color: "primary",
      onClick: openObservability,
    },
    {
      label: "Tool Calls" as const,
      value: govQ.data?.totalToolCalls ?? 0,
      color: "primary",
      onClick: openObservability,
    },
    {
      label: "Guardrails" as const,
      value: govQ.data?.guardrailBlocks ?? 0,
      color: "critical",
      onClick: openObservability,
    },
    {
      label: "Domains" as const,
      value: streams.length,
      color: "primary",
    },
    {
      label: "Operators" as const,
      value: userCount,
      color: "neutral",
    },
  ];

  const kbStats = [
    {
      label: "Documents",
      rawValue: kbDocs,
      sub: "indexed",
      icon: FileText,
    },
    {
      label: "Chunks",
      rawValue: kbChunks,
      sub: "embeddings",
      icon: Database,
    },
    {
      label: "Entities",
      rawValue: kbEntities,
      sub: "graph nodes",
      icon: Share2,
    },
    {
      label: "Pipeline",
      rawValue: kbActiveJobs > 0 ? kbActiveJobs : kbCompletedJobs,
      displayValue:
        kbActiveJobs > 0 ? `${kbActiveJobs} active` : `${kbCompletedJobs} done`,
      sub: kbFailedJobs > 0 ? `${kbFailedJobs} failed` : "ingestion jobs",
      icon: Cog,
    },
  ];
  const resourceData = resourceMetricsQ.data ?? {
    tokensToday: 0,
    apiCalls: 0,
    knowledgeQueries: 0,
    guardrailChecks: 0,
  };
  const forwardSignals = buildDashboardSignals({
    confidencePct: confidenceVal,
    totalConversations: govQ.data?.totalConversations ?? 0,
    totalToolCalls: govQ.data?.totalToolCalls ?? 0,
    toolErrorRate: govQ.data?.toolErrorRate ?? 0,
    guardrailBlocks: govQ.data?.guardrailBlocks ?? 0,
    streamsCount: streams.length,
    userCount,
    services,
    traces: tracesQ.data ?? [],
    knowledge: {
      documents: kbDocs,
      chunks: kbChunks,
      entities: kbEntities,
      relationships: kbRelationships,
      activeJobs: kbActiveJobs,
      failedJobs: kbFailedJobs,
      completedJobs: kbCompletedJobs,
    },
    resources: resourceData,
  });

  return (
    <div className="flex flex-col w-full flex-1 relative overflow-hidden">
      <div className="flex-1 w-full max-w-none px-4 sm:px-6 xl:px-8 2xl:px-10 py-6 relative z-10 overflow-y-auto">
        <div className="flex flex-col gap-5">
          <CommandBanner
            greeting={greeting()}
            envMeta={envMeta}
            allOk={allOk}
            services={services}
            onRefresh={refreshAll}
          />

          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            {kpis.map((kpi, i) => (
              <KPICardBox key={kpi.label} kpi={kpi} i={i} />
            ))}
          </div>

          <div className="grid grid-cols-1 gap-5 items-start lg:grid-cols-12">
            <div className="flex flex-col gap-5 lg:col-span-8">
              <KnowledgeStatsGrid
                stats={kbStats}
                jobs={kbJobs}
                summary={kbSummaryText}
                scopeControl={
                  <div className="flex w-full flex-col gap-1 sm:w-55 lg:w-60">
                    <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground/70">
                      Scope
                    </span>
                    <Select
                      value={kbScopeId}
                      onValueChange={setKbScopeId}
                      disabled={streams.length === 0 && !kbOverviewQ.isLoading}
                    >
                      <SelectTrigger
                        className={cn(
                          a.field,
                          "h-9 w-full justify-between rounded-xl text-sm"
                        )}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent
                        className="admin-select-content"
                        sideOffset={6}
                      >
                        {streams.length === 0 ? (
                          <SelectItem value="all" disabled>
                            No domains available
                          </SelectItem>
                        ) : (
                          <>
                            <SelectItem value="all">All domains</SelectItem>
                            {streams.map((stream: any) => (
                              <SelectItem key={stream.id} value={stream.id}>
                                {stream.name}
                              </SelectItem>
                            ))}
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                }
                isLoading={streamsQ.isLoading || kbOverviewQ.isLoading}
                actionLabel={kbScopeId !== "all" ? "Open KB" : "Manage"}
                onExplore={() =>
                  setLocation(
                    kbScopeId !== "all"
                      ? buildKnowledgeWorkspaceHref(kbScopeId)
                      : "/admin/streams"
                  )
                }
              />
              <Suspense
                fallback={
                  <div
                    className={cn(
                      a.card,
                      "flex min-h-96 items-center justify-center rounded-2xl p-5 text-sm text-muted-foreground"
                    )}
                  >
                    Loading analytics plots
                  </div>
                }
              >
                <DashboardChartsGrid
                  traces={tracesQ.data ?? []}
                  toolStats={toolStatsQ.data ?? []}
                  ingestionData={kbJobs}
                  resourceData={resourceData}
                />
              </Suspense>
            </div>
            <div className="order-first flex flex-col gap-5 lg:order-0 lg:col-span-4">
              <ForwardSignalsPanel summary={forwardSignals} />
              <ValueStreamsWidget
                streams={streams}
                isLoading={streamsQ.isLoading}
                onManage={() => setLocation("/admin/streams")}
                onAddStream={() => setLocation("/admin/streams")}
                onClickStream={id =>
                  setLocation(buildKnowledgeWorkspaceHref(id))
                }
              />
              <AgentActivityWidget
                traces={tracesQ.data ?? []}
                isLoading={tracesQ.isLoading}
                onViewAll={() =>
                  window.open(OBSERVABILITY_URL, "observability")
                }
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
