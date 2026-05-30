import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Download,
  GitBranch,
  RefreshCw,
  Server,
  ShieldCheck,
  ShieldAlert,
  FileJson,
  Terminal,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import {
  cn,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@hki/ui";
import { toast } from "sonner";

import { trpc, type RouterOutputs } from "@/lib/trpc";

type AdminValueStream = RouterOutputs["admin"]["listValueStreams"][number];
type ReleaseEvidence = RouterOutputs["admin"]["releaseEvidence"];
import {
  GovernanceFrame,
  GovernanceNotice,
  GovernanceRegistry,
} from "./components/GovernanceFrame";
import { EnvelopeSandbox } from "./components/EnvelopeSandbox";
import { LiveSignalTerminal } from "./components/LiveSignalTerminal";
import { a } from "./theme";

const EVENT_FILTERS = [
  { value: "all", label: "All events" },
  { value: "agent.chat", label: "Agent chat" },
  { value: "retrieval.search", label: "Retrieval search" },
  { value: "tool.call", label: "Tool calls" },
] as const;

const DECISION_FILTERS = [
  { value: "all", label: "All decisions" },
  { value: "allow", label: "Allowed" },
  { value: "deny", label: "Denied" },
  { value: "escalate", label: "Escalated" },
  { value: "error", label: "Errors" },
] as const;

const SERVICE_FILTERS = [
  { value: "all", label: "All services" },
  { value: "orchestrator-service", label: "Orchestrator" },
  { value: "knowledge-api", label: "Knowledge API" },
  { value: "agentic", label: "Agentic BFF" },
] as const;

function formatTime(value: string) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return "Pending";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function decisionTone(decision: string) {
  switch (decision) {
    case "allow":
      return a.pillPositive;
    case "deny":
    case "error":
      return a.pillCritical;
    case "escalate":
      return a.pillWarning;
    default:
      return a.pillNeutral;
  }
}

function compactId(value: string) {
  return value.length > 18 ? `${value.slice(0, 10)}…${value.slice(-6)}` : value;
}

function compactCommit(value: string | null | undefined) {
  if (!value) return "unknown";
  return value.length > 12 ? value.slice(0, 12) : value;
}

function evidenceTone(status: string | null | undefined) {
  switch (status) {
    case "ready":
    case "pass":
    case "baseline-present":
    case "inventory-complete":
      return a.pillPositive;
    case "blocked":
    case "fail":
    case "missing":
      return a.pillCritical;
    case "sample":
    case "present":
      return a.pillWarning;
    default:
      return a.pillNeutral;
  }
}

export default function AuditPage() {
  const [scope, setScope] = useState("");
  const [eventType, setEventType] = useState("all");
  const [decision, setDecision] = useState("all");
  const [service, setService] = useState("all");

  const streamsQ = trpc.admin.listValueStreams.useQuery(undefined, {
    retry: false,
  });
  const releaseQ = trpc.admin.releaseEvidence.useQuery(undefined, {
    retry: false,
    refetchInterval: 60_000,
  });
  const streams = useMemo(
    () =>
      (streamsQ.data ?? []).filter(
        (stream: AdminValueStream) => stream.id !== "global"
      ),
    [streamsQ.data]
  );

  useEffect(() => {
    if (
      scope &&
      streams.some((stream: AdminValueStream) => stream.id === scope)
    )
      return;
    setScope(streams[0]?.id ?? "");
  }, [scope, streams]);

  const timelineQ = trpc.governance.auditTimeline.useQuery(
    {
      scope,
      limit: 50,
      eventType: eventType === "all" ? undefined : eventType,
      decision:
        decision === "all"
          ? undefined
          : (decision as "allow" | "deny" | "escalate" | "error"),
      service: service === "all" ? undefined : service,
    },
    {
      enabled: Boolean(scope),
      retry: false,
      refetchInterval: 30_000,
    }
  );

  const tracesQ = trpc.governance.recentTraces.useQuery(
    { limit: 20 },
    { retry: false, refetchInterval: 30_000 }
  );

  const events = timelineQ.data?.events ?? [];
  const denied = timelineQ.data?.summary.byDecision.deny ?? 0;
  const allowed = timelineQ.data?.summary.byDecision.allow ?? 0;
  const serviceCount = Object.keys(
    timelineQ.data?.summary.byService ?? {}
  ).length;
  const bundleEvents = events
    .map(event => event.rawEvent)
    .filter((event): event is Record<string, unknown> => Boolean(event));

  const refresh = () => {
    streamsQ.refetch();
    releaseQ.refetch();
    timelineQ.refetch();
    tracesQ.refetch();
  };

  const downloadEvents = () => {
    if (bundleEvents.length === 0) {
      toast.error("No evidence-grade events to export");
      return;
    }

    const content = JSON.stringify(
      {
        events: bundleEvents,
        export: {
          generatedAt: new Date().toISOString(),
          scope,
          command: `pnpm evidence:hki-bundle -- --events audit-events-${scope}.json --domain ${scope} --require-events`,
        },
      },
      null,
      2
    );
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `audit-events-${scope}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Audit event export prepared");
  };

  return (
    <GovernanceFrame
      icon={ShieldCheck}
      title="Audit Evidence"
      eyebrow="HKI Evidence Appliance"
      description="Domain-scoped timeline for validated runtime decisions, denied attempts, and export-ready evidence."
      action={
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={refresh}
            className={cn(a.toolbarIconButton, "h-9 w-9")}
            title="Refresh audit evidence"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={downloadEvents}
            className={cn(a.toolbarButton, "h-9 gap-2 px-3")}
            disabled={bundleEvents.length === 0}
          >
            <Download className="h-4 w-4" />
            Export JSON
          </button>
        </div>
      }
      metrics={[
        {
          label: "Release",
          value: releaseQ.data?.releaseReadiness.status ?? "Pending",
          tone: releaseQ.data?.releaseReadiness.strictReleaseEligible
            ? "positive"
            : "warning",
        },
        { label: "Events", value: String(events.length), tone: "primary" },
        { label: "Allowed", value: String(allowed), tone: "positive" },
        {
          label: "Denied",
          value: String(denied),
          tone: denied > 0 ? "critical" : "neutral",
        },
        { label: "Services", value: String(serviceCount), tone: "neutral" },
      ]}
    >
      <ReleaseReadinessPanel
        evidence={releaseQ.data}
        isLoading={releaseQ.isLoading}
      />

      <EnvelopeSandbox domains={streams} />

      <LiveSignalTerminal
        traces={tracesQ.data ?? []}
        isLoading={tracesQ.isLoading}
        className="mt-6"
      />

      <GovernanceRegistry
        title="Evidence Timeline"
        description="Validated native HKI audit events from reference producers."
        countLabel={`${events.length} shown`}
        tools={
          <div className="admin-governance-toolbar">
            <Select
              value={scope}
              onValueChange={setScope}
              disabled={!streams.length}
            >
              <SelectTrigger className={cn(a.field, "h-9 w-45")}>
                <SelectValue placeholder="Domain" />
              </SelectTrigger>
              <SelectContent>
                {streams.map((stream: AdminValueStream) => (
                  <SelectItem key={stream.id} value={stream.id}>
                    {stream.name || stream.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={eventType} onValueChange={setEventType}>
              <SelectTrigger className={cn(a.field, "h-9 w-42.5")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EVENT_FILTERS.map(item => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={decision} onValueChange={setDecision}>
              <SelectTrigger className={cn(a.field, "h-9 w-38.75")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DECISION_FILTERS.map(item => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={service} onValueChange={setService}>
              <SelectTrigger className={cn(a.field, "h-9 w-41.25")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SERVICE_FILTERS.map(item => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      >
        {timelineQ.data?.unavailable ? (
          <GovernanceNotice className="mb-4 flex items-center gap-3">
            <ShieldAlert className="h-4 w-4 text-destructive" />
            <span className="text-sm text-muted-foreground">
              Analytics service is unavailable. Existing audit evidence remains
              in the service store.
            </span>
          </GovernanceNotice>
        ) : null}

        {timelineQ.isLoading || streamsQ.isLoading ? (
          <GovernanceNotice className="text-sm text-muted-foreground">
            Loading audit evidence…
          </GovernanceNotice>
        ) : events.length === 0 ? (
          <GovernanceNotice className="flex items-center gap-3">
            <FileJson className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              No evidence-grade events match the current filters.
            </span>
          </GovernanceNotice>
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-governance-table w-full text-sm">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Decision</th>
                  <th>Operation</th>
                  <th>Service</th>
                  <th>Actor</th>
                  <th>Evidence</th>
                </tr>
              </thead>
              <tbody>
                {events.map(event => (
                  <tr key={event.id}>
                    <td className="whitespace-nowrap text-muted-foreground">
                      {formatTime(event.occurredAt)}
                    </td>
                    <td>
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-1 text-xs font-medium",
                          decisionTone(event.decision)
                        )}
                      >
                        {event.decision || "unknown"}
                      </span>
                    </td>
                    <td>
                      <div className="font-medium text-foreground">
                        {event.operationName || event.eventType}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {event.eventType} · {event.targetDomain || event.scope}
                      </div>
                    </td>
                    <td>{event.service || "unknown"}</td>
                    <td>{event.userId || "system"}</td>
                    <td>
                      <div className="font-mono text-xs text-muted-foreground">
                        {compactId(event.payloadHash || event.id)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {event.metadataOnly
                          ? "metadata-only"
                          : event.evidenceProfile || "evidence"}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GovernanceRegistry>
    </GovernanceFrame>
  );
}

function ReleaseReadinessPanel({
  evidence,
  isLoading,
}: {
  evidence?: ReleaseEvidence;
  isLoading: boolean;
}) {
  const isReady = Boolean(evidence?.releaseReadiness.strictReleaseEligible);
  const status = evidence?.releaseReadiness.status ?? "unknown";
  const blockers = evidence?.releaseReadiness.blockers ?? [];
  const warnings = evidence?.releaseReadiness.warnings ?? [];
  const commands = evidence?.commandManifest ?? [];

  return (
    <GovernanceRegistry
      title="Release Readiness"
      description="Conformance registry, HTTP probe evidence, audit gates, and strict-release blockers."
      countLabel={evidence?.level ?? "not generated"}
      className="mb-4"
    >
      {isLoading ? (
        <GovernanceNotice className="text-sm text-muted-foreground">
          Loading release evidence…
        </GovernanceNotice>
      ) : !evidence?.available ? (
        <GovernanceNotice className="flex items-center gap-3">
          <FileJson className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            conformance.json has not been generated for this deployment.
          </span>
        </GovernanceNotice>
      ) : (
        <div className="space-y-4">
          <div
            className={cn(
              a.inset,
              "flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between"
            )}
          >
            <div className="flex min-w-0 items-center gap-3">
              <div
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border",
                  isReady
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
                    : "border-amber-500/30 bg-amber-500/10 text-amber-600"
                )}
              >
                {isReady ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  <AlertTriangle className="h-5 w-5" />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-base font-semibold text-foreground">
                    Strict release {isReady ? "ready" : status}
                  </span>
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2 py-1 text-xs font-medium",
                      isReady ? a.pillPositive : a.pillWarning
                    )}
                  >
                    {evidence.evidenceProfile ?? "evidence"}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <GitBranch className="h-3.5 w-3.5" />
                    {evidence.implementation.branch ?? "branch"} ·{" "}
                    {compactCommit(evidence.implementation.commit)}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Clock3 className="h-3.5 w-3.5" />
                    {evidence.generatedAt
                      ? formatTime(evidence.generatedAt)
                      : "not generated"}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-right md:min-w-55">
              <StatusCount label="Blockers" value={blockers.length} />
              <StatusCount label="Warnings" value={warnings.length} />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <EvidenceStat
              icon={ShieldCheck}
              label="Adapter Conformance"
              value={`${evidence.conformance.passed ?? 0}/${evidence.conformance.total ?? 0}`}
              detail={
                evidence.conformance.overallPassed ? "passed" : "not passed"
              }
              tone={
                evidence.conformance.overallPassed ? "positive" : "critical"
              }
            />
            <EvidenceStat
              icon={Server}
              label="HTTP Probe"
              value={`${evidence.httpProbe.passed ?? 0}/${evidence.httpProbe.total ?? 0}`}
              detail={evidence.httpProbe.target ?? "no target"}
              tone={
                (evidence.httpProbe.failed ?? 1) === 0 ? "positive" : "critical"
              }
            />
            <EvidenceStat
              icon={ShieldAlert}
              label="AST Audit"
              value={`${(evidence.audit.astBlocking ?? 0) + (evidence.audit.astTsBlocking ?? 0)} blocking`}
              detail={`${(evidence.audit.astAdvisory ?? 0) + (evidence.audit.astTsAdvisory ?? 0)} advisory`}
              tone={
                (evidence.audit.astBlocking ?? 0) +
                  (evidence.audit.astTsBlocking ?? 0) ===
                0
                  ? "positive"
                  : "critical"
              }
            />
            <EvidenceStat
              icon={FileJson}
              label="Managed Evidence"
              value={evidence.managedEvidence.profile ?? "none"}
              detail={`${evidence.managedEvidence.missingCapabilities.length} missing`}
              tone={
                evidence.managedEvidence.profile === "none"
                  ? "warning"
                  : (evidence.managedEvidence.servicesFailed ?? 0) > 0
                    ? "critical"
                    : "positive"
              }
            />
          </div>

          {(blockers.length > 0 || warnings.length > 0) && (
            <div className="grid gap-3 lg:grid-cols-2">
              <EvidenceMessageList
                title="Blockers"
                icon={XCircle}
                items={blockers}
                empty="No strict-release blockers"
                tone="critical"
              />
              <EvidenceMessageList
                title="Warnings"
                icon={AlertTriangle}
                items={warnings}
                empty="No release warnings"
                tone="warning"
              />
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="admin-governance-table w-full text-sm">
              <thead>
                <tr>
                  <th>Gate</th>
                  <th>Status</th>
                  <th>Command</th>
                </tr>
              </thead>
              <tbody>
                {commands.map(command => (
                  <tr key={command.id}>
                    <td className="font-medium text-foreground">
                      {command.id}
                    </td>
                    <td>
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-1 text-xs font-medium",
                          evidenceTone(command.status)
                        )}
                      >
                        {command.status}
                      </span>
                    </td>
                    <td className="font-mono text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-2">
                        <Terminal className="h-3.5 w-3.5" />
                        {command.command}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </GovernanceRegistry>
  );
}

function StatusCount({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border/70 bg-background/40 px-3 py-2">
      <div className="font-mono text-lg font-semibold tabular-nums text-foreground">
        {value}
      </div>
      <div className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function EvidenceStat({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  tone: "positive" | "warning" | "critical" | "neutral";
}) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-600"
      : tone === "warning"
        ? "text-amber-600"
        : tone === "critical"
          ? "text-destructive"
          : "text-muted-foreground";

  return (
    <div className={cn(a.inset, "p-4")}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </div>
        <Icon className={cn("h-4 w-4", toneClass)} />
      </div>
      <div className="mt-3 text-xl font-semibold text-foreground">{value}</div>
      <div className="mt-1 truncate text-xs text-muted-foreground">
        {detail}
      </div>
    </div>
  );
}

function EvidenceMessageList({
  title,
  icon: Icon,
  items,
  empty,
  tone,
}: {
  title: string;
  icon: LucideIcon;
  items: ReleaseEvidence["releaseReadiness"]["blockers"];
  empty: string;
  tone: "critical" | "warning";
}) {
  return (
    <div className={cn(a.inset, "p-4")}>
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
        <Icon
          className={cn(
            "h-4 w-4",
            tone === "critical" ? "text-destructive" : "text-amber-600"
          )}
        />
        {title}
      </div>
      {items.length === 0 ? (
        <div className="text-sm text-muted-foreground">{empty}</div>
      ) : (
        <div className="space-y-2">
          {items.map(item => (
            <div key={item.id} className="text-sm">
              <div className="font-medium text-foreground">{item.id}</div>
              <div className="mt-0.5 text-muted-foreground">{item.message}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
