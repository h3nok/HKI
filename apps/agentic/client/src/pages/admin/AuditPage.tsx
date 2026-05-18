import { useEffect, useMemo, useState } from "react";
import {
  Download,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  FileJson,
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

import { trpc } from "@/lib/trpc";
import {
  GovernanceFrame,
  GovernanceNotice,
  GovernanceRegistry,
} from "./components/GovernanceFrame";
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

export default function AuditPage() {
  const [scope, setScope] = useState("");
  const [eventType, setEventType] = useState("all");
  const [decision, setDecision] = useState("all");
  const [service, setService] = useState("all");

  const streamsQ = trpc.admin.listValueStreams.useQuery(undefined, {
    retry: false,
  });
  const streams = useMemo(
    () => (streamsQ.data ?? []).filter((stream: any) => stream.id !== "global"),
    [streamsQ.data]
  );

  useEffect(() => {
    if (scope && streams.some((stream: any) => stream.id === scope)) return;
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
    timelineQ.refetch();
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
                {streams.map((stream: any) => (
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
