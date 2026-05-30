import { useMemo } from "react";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Cloud,
  Copy,
  Database,
  ExternalLink,
  Fingerprint,
  KeyRound,
  Link2,
  Network,
  RefreshCw,
  Server,
  ShieldCheck,
  Terminal,
  Workflow,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@hki/ui";

import { trpc, type RouterOutputs } from "@/lib/trpc";
import {
  GovernanceFrame,
  GovernanceNotice,
  GovernanceRegistry,
} from "./components/GovernanceFrame";
import { a, type AdminTone } from "./theme";

type GeapOverview = RouterOutputs["admin"]["geapOverview"];
type ReadinessItem = GeapOverview["readiness"][number];
type RuntimeAdapter = GeapOverview["runtimeAdapters"][number];
type DomainAgent = GeapOverview["domainAgents"][number];
type EvidenceContract = GeapOverview["evidenceContract"][number];
type GeapStatus =
  | ReadinessItem["status"]
  | RuntimeAdapter["status"]
  | DomainAgent["status"]
  | EvidenceContract["status"];

const READINESS_ICONS: Record<string, LucideIcon> = {
  "agent-runtime": Server,
  "gemini-enterprise-app": Cloud,
  "registration-mode": Link2,
  "hki-signing": KeyRound,
  "identity-mapping": Fingerprint,
  "provider-evidence": ShieldCheck,
};

const ADAPTER_ICONS: Record<string, LucideIcon> = {
  runtime: Bot,
  knowledge: Database,
  ingestion: Workflow,
  identity: Fingerprint,
  tools: Network,
  observability: ShieldCheck,
};

function statusTone(status: GeapStatus): AdminTone {
  switch (status) {
    case "ready":
    case "publishable":
      return "positive";
    case "warning":
      return "warning";
    case "missing":
    case "blocked":
      return "critical";
    default:
      return "neutral";
  }
}

function statusClass(status: GeapStatus) {
  const tone = statusTone(status);
  if (tone === "positive") return a.pillPositive;
  if (tone === "warning") return a.pillWarning;
  if (tone === "critical") return a.pillCritical;
  return a.pillNeutral;
}

function statusIcon(status: GeapStatus) {
  if (status === "ready" || status === "publishable") return CheckCircle2;
  if (status === "warning") return AlertTriangle;
  if (status === "missing" || status === "blocked") return XCircle;
  return ShieldCheck;
}

function compactResource(value: string | null | undefined) {
  if (!value) return "not set";
  if (value.length <= 48) return value;
  const parts = value.split("/");
  if (parts.length >= 2) {
    const tail = parts.slice(-2).join("/");
    return `${parts[0]}/.../${tail}`;
  }
  return `${value.slice(0, 22)}...${value.slice(-18)}`;
}

function commandName(command: string) {
  const firstLine = command.split("\n")[0]?.trim();
  return firstLine || "agents-cli publish gemini-enterprise";
}

async function copyText(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  } catch {
    toast.error(`Could not copy ${label.toLowerCase()}`);
  }
}

function StatusPill({ status }: { status: GeapStatus }) {
  const Icon = statusIcon(status);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium",
        statusClass(status)
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {status}
    </span>
  );
}

export default function GeapPage() {
  const overviewQ = trpc.admin.geapOverview.useQuery(undefined, {
    retry: false,
    refetchInterval: 60_000,
    refetchOnWindowFocus: false,
  });
  const overview = overviewQ.data;

  const readinessSummary = useMemo(() => {
    const items = overview?.readiness ?? [];
    const ready = items.filter(item => item.status === "ready").length;
    const blocked = items.filter(
      item => item.status === "blocked" || item.status === "missing"
    ).length;
    return { ready, blocked, total: items.length };
  }, [overview?.readiness]);

  const publishableDomains =
    overview?.domainAgents.filter(agent => agent.status === "publishable")
      .length ?? 0;
  const blockedDomains =
    overview?.domainAgents.filter(agent => agent.status === "blocked").length ??
    0;
  const runtimeStatus =
    overview?.readiness.find(item => item.id === "agent-runtime")?.status ??
    "missing";
  const appStatus =
    overview?.readiness.find(item => item.id === "gemini-enterprise-app")
      ?.status ?? "missing";

  const refresh = () => overviewQ.refetch();

  return (
    <GovernanceFrame
      icon={Bot}
      title="Gemini Enterprise Agent Platform"
      eyebrow="GEAP Head"
      description="Operational surface for publishing HKI-governed domain agents into Gemini Enterprise while preserving runtime envelope controls."
      action={
        <button
          type="button"
          onClick={refresh}
          className={cn(a.toolbarButton, "h-9 gap-2 px-3")}
          title="Refresh GEAP status"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      }
      metrics={[
        {
          label: "Runtime",
          value: runtimeStatus,
          tone: statusTone(runtimeStatus),
        },
        {
          label: "GE App",
          value: appStatus,
          tone: statusTone(appStatus),
        },
        {
          label: "Ready Gates",
          value: `${readinessSummary.ready}/${readinessSummary.total || 0}`,
          tone: readinessSummary.blocked > 0 ? "critical" : "positive",
        },
        {
          label: "Domains",
          value: String(overview?.domainAgents.length ?? 0),
          tone: blockedDomains > 0 ? "warning" : "neutral",
        },
        {
          label: "Publishable",
          value: String(publishableDomains),
          tone: publishableDomains > 0 ? "positive" : "neutral",
        },
      ]}
    >
      {overviewQ.isLoading && !overview ? (
        <GovernanceNotice className="text-sm text-muted-foreground">
          Loading GEAP control state...
        </GovernanceNotice>
      ) : overviewQ.error ? (
        <GovernanceNotice className="flex items-center gap-3">
          <XCircle className="h-4 w-4 text-destructive" />
          <span className="text-sm text-muted-foreground">
            {overviewQ.error.message}
          </span>
        </GovernanceNotice>
      ) : overview ? (
        <div className="space-y-5">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
            <RuntimeReadiness items={overview.readiness} />
            <PublishCommand overview={overview} />
          </div>

          <EnvironmentPanel overview={overview} />
          <AdapterMatrix adapters={overview.runtimeAdapters} />
          <DomainAgents agents={overview.domainAgents} />
          <EvidenceContractPanel items={overview.evidenceContract} />
        </div>
      ) : null}
    </GovernanceFrame>
  );
}

function RuntimeReadiness({ items }: { items: ReadinessItem[] }) {
  return (
    <GovernanceRegistry
      title="Runtime Readiness"
      description="GEAP registration prerequisites and HKI runtime guard status."
      countLabel={`${items.filter(item => item.status === "ready").length}/${items.length} ready`}
    >
      <div className="grid gap-3 md:grid-cols-2">
        {items.map(item => {
          const Icon = READINESS_ICONS[item.id] ?? ShieldCheck;
          return (
            <div key={item.id} className={cn(a.inset, "rounded-xl p-4")}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <div
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border",
                      statusTone(item.status) === "positive"
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
                        : statusTone(item.status) === "warning"
                          ? "border-amber-500/30 bg-amber-500/10 text-amber-600"
                          : "border-destructive/30 bg-destructive/10 text-destructive"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-foreground">
                      {item.label}
                    </div>
                    <div className="mt-1 break-words text-xs text-muted-foreground">
                      {compactResource(item.detail)}
                    </div>
                  </div>
                </div>
                <StatusPill status={item.status} />
              </div>
              <div className="mt-3 text-xs font-medium text-muted-foreground">
                {item.action}
              </div>
            </div>
          );
        })}
      </div>
    </GovernanceRegistry>
  );
}

function PublishCommand({ overview }: { overview: GeapOverview }) {
  return (
    <GovernanceRegistry
      title="Publish Command"
      description="Current registration command shape for the HKI head agent."
      countLabel={overview.environment.registrationType}
      tools={
        <button
          type="button"
          onClick={() => copyText(overview.commandPreview, "Publish command")}
          className={cn(a.toolbarIconButton, "h-9 w-9")}
          title="Copy publish command"
        >
          <Copy className="h-4 w-4" />
        </button>
      }
    >
      <div className={cn(a.inset, "rounded-xl p-4")}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-foreground">
              {commandName(overview.commandPreview)}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Checked {new Date(overview.checkedAt).toLocaleString()}
            </div>
          </div>
          <Terminal className="h-4 w-4 shrink-0 text-muted-foreground" />
        </div>
        <pre className="max-h-72 overflow-auto rounded-lg border border-border/70 bg-background/70 p-3 text-xs text-muted-foreground">
          <code>{overview.commandPreview}</code>
        </pre>
      </div>
    </GovernanceRegistry>
  );
}

function EnvironmentPanel({ overview }: { overview: GeapOverview }) {
  const rows = [
    ["Project", overview.environment.projectId ?? "not set"],
    ["Location", overview.environment.location ?? "not set"],
    ["Gemini app", compactResource(overview.environment.geminiEnterpriseAppId)],
    ["Runtime", compactResource(overview.environment.agentRuntimeId)],
    ["Agent card", compactResource(overview.environment.agentCardUrl)],
    ["Orchestrator", overview.environment.orchestratorUrl],
    ["Knowledge API", overview.environment.knowledgeApiUrl],
    ["Pipeline", overview.environment.pipelineUrl],
  ];

  return (
    <GovernanceRegistry
      title="Environment"
      description="Resolved control-plane configuration visible to the agentic BFF."
      countLabel={
        overview.environment.agentEngineEnabled
          ? "runtime adapter enabled"
          : "runtime adapter disabled"
      }
    >
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {rows.map(([label, value]) => (
          <div key={label} className={cn(a.inset, "rounded-lg p-3")}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {label}
            </div>
            <div className="mt-1 break-words font-mono text-xs text-foreground">
              {value}
            </div>
          </div>
        ))}
      </div>
    </GovernanceRegistry>
  );
}

function AdapterMatrix({ adapters }: { adapters: RuntimeAdapter[] }) {
  return (
    <GovernanceRegistry
      title="Runtime Adapter Matrix"
      description="Services that must preserve HKI context when Gemini Enterprise calls the head agent."
      countLabel={`${adapters.length} adapters`}
    >
      <div className="overflow-x-auto">
        <table className="admin-governance-table w-full text-sm">
          <thead>
            <tr>
              <th>Service</th>
              <th>Adapter</th>
              <th>Target</th>
              <th>HKI Contract</th>
              <th>Evidence</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {adapters.map(adapter => {
              const Icon = ADAPTER_ICONS[adapter.id] ?? Server;
              return (
                <tr key={adapter.id}>
                  <td>
                    <div className="flex items-center gap-2 font-medium text-foreground">
                      <Icon className="h-4 w-4 text-primary" />
                      {adapter.service}
                    </div>
                  </td>
                  <td>{adapter.adapter}</td>
                  <td className="max-w-72 break-words font-mono text-xs text-muted-foreground">
                    {compactResource(adapter.target)}
                  </td>
                  <td className="max-w-80 text-muted-foreground">
                    {adapter.hkiContract}
                  </td>
                  <td className="max-w-72 text-muted-foreground">
                    {adapter.evidence}
                  </td>
                  <td>
                    <StatusPill status={adapter.status} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </GovernanceRegistry>
  );
}

function DomainAgents({ agents }: { agents: DomainAgent[] }) {
  return (
    <GovernanceRegistry
      title="Domain Agents"
      description="One publishable Gemini Enterprise entry per active HKI domain."
      countLabel={`${agents.length} domains`}
    >
      {agents.length === 0 ? (
        <GovernanceNotice className="flex items-center gap-3">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <span className="text-sm text-muted-foreground">
            No active HKI domains are available for GEAP registration.
          </span>
        </GovernanceNotice>
      ) : (
        <div className="overflow-x-auto">
          <table className="admin-governance-table w-full text-sm">
            <thead>
              <tr>
                <th>Domain</th>
                <th>GEAP Display</th>
                <th>Active Domain</th>
                <th>Registration</th>
                <th>Blockers</th>
                <th>Status</th>
                <th>Command</th>
              </tr>
            </thead>
            <tbody>
              {agents.map(agent => (
                <tr key={agent.domainId}>
                  <td>
                    <div className="font-medium text-foreground">
                      {agent.domainName}
                    </div>
                    <div className="font-mono text-xs text-muted-foreground">
                      {agent.domainId}
                    </div>
                  </td>
                  <td>
                    <div className="font-medium text-foreground">
                      {agent.displayName}
                    </div>
                    <div className="max-w-80 truncate text-xs text-muted-foreground">
                      {agent.description ?? "domain-scoped HKI agent"}
                    </div>
                  </td>
                  <td className="font-mono text-xs text-muted-foreground">
                    {agent.activeDomain}
                  </td>
                  <td>{agent.registrationType}</td>
                  <td>
                    {agent.blockers.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {agent.blockers.map(blocker => (
                          <span
                            key={blocker}
                            className={cn(
                              "inline-flex rounded-full px-2 py-1 text-xs font-medium",
                              a.pillWarning
                            )}
                          >
                            {blocker}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        none
                      </span>
                    )}
                  </td>
                  <td>
                    <StatusPill status={agent.status} />
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() =>
                        copyText(agent.command, `${agent.domainName} command`)
                      }
                      className={cn(a.toolbarIconButton, "h-8 w-8")}
                      title={`Copy ${agent.domainName} publish command`}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </GovernanceRegistry>
  );
}

function EvidenceContractPanel({ items }: { items: EvidenceContract[] }) {
  return (
    <GovernanceRegistry
      title="Evidence Contract"
      description="Runtime evidence expected from the GEAP head path."
      countLabel={`${items.filter(item => item.status === "ready").length}/${items.length} ready`}
      tools={
        <a
          className={cn(a.toolbarButton, "h-9 gap-2 px-3")}
          href="/admin/audit"
        >
          <ExternalLink className="h-4 w-4" />
          Audit
        </a>
      }
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {items.map(item => (
          <div key={item.id} className={cn(a.inset, "rounded-xl p-4")}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <StatusPill status={item.status} />
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="font-medium text-foreground">{item.label}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {item.source}
            </div>
            <div className="mt-3 text-xs text-muted-foreground">
              {item.detail}
            </div>
          </div>
        ))}
      </div>
    </GovernanceRegistry>
  );
}
