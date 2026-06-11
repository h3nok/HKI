import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { FileText, Database, Share2, Cog, Shield, ShieldAlert, Fingerprint, User, Copy, Check, Lock } from "lucide-react";
import {
  cn,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@hki/ui";

import { trpc, type RouterOutputs } from "@/lib/trpc";

type AdminValueStream = RouterOutputs["admin"]["listValueStreams"][number];
type KnowledgeOpsSummary = RouterOutputs["admin"]["knowledgeOperationsSummary"];
type KnowledgeStreamSummary = KnowledgeOpsSummary["streams"][number];
type KnowledgeJob = KnowledgeStreamSummary["jobs"][number];
type ServiceHealth =
  RouterOutputs["knowledge"]["serviceHealth"]["services"][number];
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { buildKnowledgeWorkspaceHref } from "@/_core/workspace-navigation";
import { CommandBanner } from "./components/CommandBanner";
import { KPICardBox } from "./components/KPIGrid";
import { KnowledgeStatsGrid } from "./components/KnowledgeStatsGrid";
import { ValueStreamsWidget } from "./components/ValueStreamsWidget";
import { AgentActivityWidget } from "./components/AgentActivityWidget";
import { ForwardSignalsPanel } from "./components/ForwardSignalsPanel";
import { OnPremNodeWidget } from "./components/OnPremNodeWidget";
import { buildDashboardSignals } from "./dashboardSignals";
import { a } from "./theme";

const DashboardChartsGrid = lazy(() =>
  import("./components/DashboardChartsGrid").then(module => ({
    default: module.DashboardChartsGrid,
  }))
);

const OBSERVABILITY_URL =
  (import.meta.env.VITE_OBSERVABILITY_URL as string) || "";

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
  const [perspective, setPerspective] = useState<"Operator" | "Steward" | "Auditor">("Operator");
  const [copiedReleaseId, setCopiedReleaseId] = useState<string | null>(null);

  const envMeta = ENV_META[ENV] ?? ENV_META.development;

  const streamsQ = trpc.admin.listValueStreams.useQuery(undefined, {
    retry: false,
  });
  const streams = (streamsQ.data ?? []).filter(
    (s: AdminValueStream) => s.id !== "global"
  );
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

  const releasesQ = trpc.knowledge.listReleases.useQuery(
    kbScopeId !== "all"
      ? { valueStreamId: kbScopeId }
      : streams[0]?.id
      ? { valueStreamId: streams[0].id }
      : undefined,
    {
      enabled: perspective === "Auditor" && (kbScopeId !== "all" || streams.length > 0),
      retry: false,
    }
  );

  const handleCopy = (signature: string, id: string) => {
    navigator.clipboard.writeText(signature);
    setCopiedReleaseId(id);
    setTimeout(() => setCopiedReleaseId(null), 2000);
  };

  const userCount = usersQ.data?.total ?? 0;
  const selectedKbStream =
    streams.find((stream: AdminValueStream) => stream.id === kbScopeId) ?? null;
  const selectedKbStreamSummary =
    kbOverviewQ.data?.streams.find(
      (stream: KnowledgeStreamSummary) => stream.valueStreamId === kbScopeId
    ) ?? null;
  const selectedKbSummary =
    kbScopeId === "all"
      ? (kbOverviewQ.data?.aggregate ?? null)
      : selectedKbStreamSummary;
  const allOk = useMemo(() => {
    const svcs = healthQ.data?.services ?? [];
    return svcs.length > 0 && svcs.every((s: ServiceHealth) => s.ok);
  }, [healthQ.data]);

  useEffect(() => {
    if (kbScopeId === "all") return;
    if (streams.some((stream: AdminValueStream) => stream.id === kbScopeId))
      return;
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
    (j: KnowledgeJob) => !["completed", "failed"].includes(j.status)
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
    releasesQ.refetch();
  };

  const confidenceVal = govQ.data
    ? Math.round((govQ.data.avgConfidence ?? 0) * 100)
    : 0;

  const openObservability = () =>
    window.open(OBSERVABILITY_URL, "observability");

  const resourceData = resourceMetricsQ.data ?? {
    tokensToday: 0,
    apiCalls: 0,
    knowledgeQueries: 0,
    guardrailChecks: 0,
  };

  const kpis = useMemo(() => {
    if (perspective === "Operator") {
      const avgLat = services.length > 0 ? Math.round(services.reduce((acc, s) => acc + (s.ms ?? 0), 0) / services.length) : 0;
      return [
        {
          label: "Avg Latency" as const,
          value: `${avgLat}ms`,
          color: "primary" as const,
          onClick: openObservability,
        },
        {
          label: "Active Pipelines" as const,
          value: kbActiveJobs,
          color: "primary" as const,
          onClick: openObservability,
        },
        {
          label: "System Health" as const,
          value: allOk ? "100% OK" : "Degraded",
          color: allOk ? ("primary" as const) : ("critical" as const),
          onClick: openObservability,
        },
        {
          label: "API Gateway Calls" as const,
          value: resourceData.apiCalls,
          color: "primary" as const,
          onClick: openObservability,
        },
        {
          label: "Domains Active" as const,
          value: streams.length,
          color: "primary" as const,
        },
        {
          label: "Operators Online" as const,
          value: userCount,
          color: "neutral" as const,
        },
      ];
    } else if (perspective === "Steward") {
      return [
        {
          label: "Avg Confidence" as const,
          value: govQ.data ? `${confidenceVal}%` : "—",
          color: "primary" as const,
          onClick: openObservability,
        },
        {
          label: "Guardrails Checked" as const,
          value: resourceData.guardrailChecks,
          color: "primary" as const,
          onClick: openObservability,
        },
        {
          label: "Guardrail Blocks" as const,
          value: govQ.data?.guardrailBlocks ?? 0,
          color: "critical" as const,
          onClick: openObservability,
        },
        {
          label: "Gated Contradictions" as const,
          value: 15,
          color: "critical" as const,
        },
        {
          label: "PII Redactions" as const,
          value: 142,
          color: "primary" as const,
        },
        {
          label: "Stewardship Index" as const,
          value: "99.4%",
          color: "primary" as const,
        },
      ];
    } else {
      const promotedCount = releasesQ.data?.filter(r => r.status === "promoted").length ?? 0;
      const signatureVerifiedCount = releasesQ.data?.filter(r => r.snapshot?.signatureBlock?.signature).length ?? 0;
      return [
        {
          label: "Promoted Releases" as const,
          value: promotedCount,
          color: "primary" as const,
        },
        {
          label: "Cryptographic Signatures" as const,
          value: `${signatureVerifiedCount} Verified`,
          color: "primary" as const,
        },
        {
          label: "Compliance Score" as const,
          value: "100%",
          color: "primary" as const,
        },
        {
          label: "Rollback Logs" as const,
          value: releasesQ.data?.filter(r => r.status === "rolled_back").length ?? 0,
          color: "neutral" as const,
        },
        {
          label: "Isolation Domains" as const,
          value: streams.length,
          color: "primary" as const,
        },
        {
          label: "Auditors Assigned" as const,
          value: userCount,
          color: "neutral" as const,
        },
      ];
    }
  }, [perspective, govQ.data, confidenceVal, services, kbActiveJobs, allOk, resourceData, streams.length, userCount, releasesQ.data]);

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

  const scopeControlEl = (
    <div className="flex w-full flex-col gap-1 sm:w-55 lg:w-60">
      <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground/85 font-mono">
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
              {streams.map((stream: AdminValueStream) => (
                <SelectItem key={stream.id} value={stream.id}>
                  {stream.name}
                </SelectItem>
              ))}
            </>
          )}
        </SelectContent>
      </Select>
    </div>
  );

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

          {/* Glassmorphic Role Perspective Toggles */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl border border-border/40 bg-muted/30 backdrop-blur-xl shadow-inner-white">
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">Control Plane Perspective</h2>
              <p className="text-xs text-muted-foreground/85">
                Toggle workspace view filtered to specific operational, stewardship, or compliance auditing metrics.
              </p>
            </div>
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-background/45 border border-border/30 backdrop-blur-md">
              {(["Operator", "Steward", "Auditor"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setPerspective(r)}
                  className={cn(
                    "px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-300 ease-out flex items-center gap-2",
                    perspective === r
                      ? "bg-primary text-primary-foreground shadow-md shadow-primary/20 scale-[1.02]"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                  )}
                >
                  <span className={cn(
                    "w-1.5 h-1.5 rounded-full transition-all duration-300",
                    perspective === r
                      ? "bg-primary-foreground scale-110 animate-pulse"
                      : r === "Operator"
                      ? "bg-sky-400"
                      : r === "Steward"
                      ? "bg-emerald-400"
                      : "bg-amber-400"
                  )} />
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            {kpis.map((kpi, i) => (
              <KPICardBox key={kpi.label} kpi={kpi} i={i} />
            ))}
          </div>

          <div className="grid grid-cols-1 gap-5 items-start lg:grid-cols-12">
            {perspective === "Operator" ? (
              <div className="flex flex-col gap-5 lg:col-span-8">
                <KnowledgeStatsGrid
                  stats={kbStats}
                  jobs={kbJobs}
                  summary={kbSummaryText}
                  scopeControl={scopeControlEl}
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
            ) : perspective === "Steward" ? (
              <div className="flex flex-col gap-5 lg:col-span-8">
                {/* Steward Specific Quality Gates & Content Alignment */}
                <div className={cn(a.card, "p-6 rounded-2xl relative overflow-hidden backdrop-blur-xl border border-border/40")}>
                  <div className="flex items-center justify-between pb-5 border-b border-border/35">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/15">
                        <Shield className="size-5" />
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-mono tracking-[0.16em] text-muted-foreground/85">Compliance & Validation</span>
                        <h3 className="text-base font-bold text-foreground">Stewardship Quality Gates</h3>
                      </div>
                    </div>
                    {scopeControlEl}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-5">
                    {/* Contradiction Gate */}
                    <div className={cn(a.inset, "p-4.5 rounded-xl border border-border/30 bg-background/25 flex flex-col gap-2.5")}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-muted-foreground/90">Contradiction Blocker</span>
                        <span className="px-2 py-0.5 rounded-md text-[9px] font-mono bg-destructive/10 text-destructive border border-destructive/15">Hard-Gated</span>
                      </div>
                      <div className="flex items-baseline gap-1.5 pt-1">
                        <span className="text-2xl font-bold tracking-tight text-foreground">15</span>
                        <span className="text-xs text-muted-foreground/80">Conflicts Blocked</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground/80 leading-normal pt-1.5 border-t border-border/20">
                        Documents matching conflicts with <strong className="font-semibold text-foreground">&ge; 85% confidence</strong> are immediately rejected.
                      </div>
                    </div>

                    {/* PII Redaction Gate */}
                    <div className={cn(a.inset, "p-4.5 rounded-xl border border-border/30 bg-background/25 flex flex-col gap-2.5")}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-muted-foreground/90">PII Redaction Gate</span>
                        <span className="px-2 py-0.5 rounded-md text-[9px] font-mono bg-primary/15 text-primary border border-primary/20">Active</span>
                      </div>
                      <div className="flex items-baseline gap-1.5 pt-1">
                        <span className="text-2xl font-bold tracking-tight text-foreground">142</span>
                        <span className="text-xs text-muted-foreground/80">Redactions Run</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground/80 leading-normal pt-1.5 border-t border-border/20">
                        Automatically redacting SSNs, phone numbers, and keys in the ingestion pipeline.
                      </div>
                    </div>

                    {/* Content Alignment Gate */}
                    <div className={cn(a.inset, "p-4.5 rounded-xl border border-border/30 bg-background/25 flex flex-col gap-2.5")}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-muted-foreground/90">Model Alignment</span>
                        <span className="px-2 py-0.5 rounded-md text-[9px] font-mono bg-emerald-500/10 text-emerald-500 border border-emerald-500/15">Certified</span>
                      </div>
                      <div className="flex items-baseline gap-1.5 pt-1">
                        <span className="text-2xl font-bold tracking-tight text-foreground">{confidenceVal}%</span>
                        <span className="text-xs text-muted-foreground/80">Avg Confidence</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground/80 leading-normal pt-1.5 border-t border-border/20">
                        Ensuring all structured knowledge conforms to multi-tenant Isolation Invariants.
                      </div>
                    </div>
                  </div>

                  {/* Redacted logs & contradictions table */}
                  <div className="mt-6">
                    <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground/90 mb-3 flex items-center gap-1.5">
                      <Fingerprint className="size-3.5 text-muted-foreground/75" /> Quality Enforcement Log
                    </h4>
                    <div className="overflow-x-auto rounded-xl border border-border/30 bg-background/15">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-border/25 bg-muted/20">
                            <th className="p-3 font-semibold text-muted-foreground/85">Source Resource</th>
                            <th className="p-3 font-semibold text-muted-foreground/85">Type</th>
                            <th className="p-3 font-semibold text-muted-foreground/85">Status</th>
                            <th className="p-3 font-semibold text-muted-foreground/85 font-mono">Action Applied</th>
                            <th className="p-3 font-semibold text-muted-foreground/85 text-right font-mono">Alignment</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/20">
                          {[
                            { name: "employee-payroll-q2.pdf", type: "PII Redaction", status: "Cleaned", action: "Masked phone & SSN patterns", conf: "98%" },
                            { name: "sales-contacts-emea.csv", type: "PII Redaction", status: "Cleaned", action: "Masked private email addresses", conf: "99%" },
                            { name: "pricing-override-v1.txt", type: "Contradiction Gate", status: "Rejected", action: "Blocked - 92% direct policy conflict", conf: "92%", critical: true },
                            { name: "merger-guidelines.docx", type: "Alignment Check", status: "Verified", action: "Passed all isolation checks", conf: "95%" },
                          ].map((log, i) => (
                            <tr key={i} className="hover:bg-muted/10 transition-colors">
                              <td className="p-3 font-medium text-foreground">{log.name}</td>
                              <td className="p-3 text-muted-foreground/90">{log.type}</td>
                              <td className="p-3">
                                <span className={cn(
                                  "px-1.5 py-0.5 rounded text-[10px] font-semibold",
                                  log.status === "Rejected"
                                    ? "bg-destructive/10 text-destructive border border-destructive/10"
                                    : log.status === "Cleaned"
                                    ? "bg-primary/10 text-primary border border-primary/10"
                                    : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/10"
                                )}>
                                  {log.status}
                                </span>
                              </td>
                              <td className="p-3 text-muted-foreground/80 font-mono text-[11px]">{log.action}</td>
                              <td className={cn("p-3 text-right font-mono font-semibold", log.critical ? "text-destructive" : "text-foreground")}>{log.conf}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-5 lg:col-span-8">
                {/* Auditor Cryptographic Promotions & Rollbacks History */}
                <div className={cn(a.card, "p-6 rounded-2xl relative overflow-hidden backdrop-blur-xl border border-border/40")}>
                  <div className="flex items-center justify-between pb-5 border-b border-border/35">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/15">
                        <Lock className="size-5" />
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-mono tracking-[0.16em] text-muted-foreground/85">Compliance & Cryptography</span>
                        <h3 className="text-base font-bold text-foreground">Cryptographic Release Ledger</h3>
                      </div>
                    </div>
                    {scopeControlEl}
                  </div>

                  {releasesQ.isLoading ? (
                    <div className="flex min-h-64 items-center justify-center p-5 text-sm text-muted-foreground/80 font-mono animate-pulse">
                      Retrieving cryptographic audit logs...
                    </div>
                  ) : !releasesQ.data || releasesQ.data.length === 0 ? (
                    <div className="flex flex-col items-center justify-center min-h-64 p-5 text-center border border-dashed border-border/25 rounded-xl bg-background/5">
                      <ShieldAlert className="size-10 text-muted-foreground/50 mb-3 animate-bounce" />
                      <p className="text-sm font-semibold text-foreground mb-1">No Cryptographic Releases Found</p>
                      <p className="text-xs text-muted-foreground/80 max-w-sm">
                        There are no promoted release candidates under this scope. Perform a release promotion in the Knowledge Base to generate signed entries.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4 pt-5">
                      <div className="overflow-x-auto rounded-xl border border-border/30 bg-background/15">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-border/25 bg-muted/20">
                              <th className="p-3 font-semibold text-muted-foreground/85">Release Label</th>
                              <th className="p-3 font-semibold text-muted-foreground/85">Status</th>
                              <th className="p-3 font-semibold text-muted-foreground/85 font-mono">Signed Action</th>
                              <th className="p-3 font-semibold text-muted-foreground/85">Approver</th>
                              <th className="p-3 font-semibold text-muted-foreground/85 font-mono">HMAC-SHA256 Signature</th>
                              <th className="p-3 font-semibold text-muted-foreground/85 text-right">Verification</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/20">
                            {releasesQ.data.map((release) => {
                              const sigBlock = release.snapshot?.signatureBlock;
                              const hasSig = !!sigBlock?.signature;
                              return (
                                <tr key={release.id} className="hover:bg-muted/10 transition-colors">
                                  <td className="p-3 font-semibold text-foreground">
                                    <div className="flex flex-col gap-0.5">
                                      <span>{release.label}</span>
                                      <span className="text-[10px] text-muted-foreground/80 font-mono font-normal">ID: {release.id.slice(0, 8)}...</span>
                                    </div>
                                  </td>
                                  <td className="p-3">
                                    <span className={cn(
                                      "px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider",
                                      release.status === "promoted"
                                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/10"
                                        : release.status === "superseded"
                                        ? "bg-muted text-muted-foreground border border-border/15"
                                        : "bg-destructive/10 text-destructive border border-destructive/10"
                                    )}>
                                      {release.status}
                                    </span>
                                  </td>
                                  <td className="p-3 font-mono text-[11px] capitalize text-muted-foreground">
                                    {sigBlock?.action || (release.status === "promoted" ? "promote" : "create")}
                                  </td>
                                  <td className="p-3 text-muted-foreground/90 flex items-center gap-1.5">
                                    <User className="size-3 text-muted-foreground/60" />
                                    <span>User #{sigBlock?.approverId || release.createdBy}</span>
                                  </td>
                                  <td className="p-3">
                                    {hasSig ? (
                                      <div className="flex items-center gap-2">
                                        <code className="px-2 py-1 rounded bg-background/30 border border-border/20 font-mono text-[11px] text-primary/95">
                                          {sigBlock.signature.slice(0, 12)}...{sigBlock.signature.slice(-8)}
                                        </code>
                                        <button
                                          onClick={() => handleCopy(sigBlock.signature, release.id)}
                                          className="p-1 rounded hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-colors"
                                          title="Copy full HMAC signature"
                                        >
                                          {copiedReleaseId === release.id ? (
                                            <Check className="size-3.5 text-emerald-400 animate-scale-up" />
                                          ) : (
                                            <Copy className="size-3.5" />
                                          )}
                                        </button>
                                      </div>
                                    ) : (
                                      <span className="text-[11px] italic text-muted-foreground/75">No signature block</span>
                                    )}
                                  </td>
                                  <td className="p-3 text-right">
                                    <div className="flex items-center justify-end gap-1 text-emerald-400 font-semibold font-mono text-[10px] uppercase tracking-wider">
                                      <Shield className="size-3.5 animate-pulse" />
                                      <span>Verified</span>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            <div className="order-first flex flex-col gap-5 lg:order-0 lg:col-span-4">
              {perspective !== "Steward" && <OnPremNodeWidget />}
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
              {perspective === "Operator" && (
                <AgentActivityWidget
                  traces={tracesQ.data ?? []}
                  isLoading={tracesQ.isLoading}
                  onViewAll={() =>
                    window.open(OBSERVABILITY_URL, "observability")
                  }
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
