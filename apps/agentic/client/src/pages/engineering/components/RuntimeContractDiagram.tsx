import { useState, type ComponentType } from "react";
import {
  ShieldCheck,
  Wand2,
  Search,
  Database,
  GitBranch,
  Wrench,
  Clock,
  MessageSquare,
} from "lucide-react";
import { cn } from "@hki/ui";

type Stage = {
  id: string;
  label: string;
  short: string;
  icon: ComponentType<{ className?: string }>;
  /** What happens at this stage (request lifecycle). */
  happens: string;
  /** What HKI enforces here. One sentence, plain English. */
  enforces: string;
  /** Code surface — short identifier readers can grep for. */
  surface: string;
  /** Whether this is the first cross-domain bridge ("publication"). */
  bridge?: boolean;
};

const STAGES: readonly Stage[] = [
  {
    id: "gateway",
    label: "Gateway",
    short: "Sign envelope",
    icon: ShieldCheck,
    happens:
      "The request enters the system. The gateway selects exactly one active domain and signs an envelope with org, domain, operation, and context version.",
    enforces:
      "Active domain is decided here, once, and signed. Nothing downstream can broaden it.",
    surface: "verify_request_jwt() · RequestIdentity",
  },
  {
    id: "rewrite",
    label: "Rewrite",
    short: "Bound expansion",
    icon: Wand2,
    happens:
      "The agent rewrites the user question for recall. Synonyms, expansions, decomposition.",
    enforces:
      "Rewrite operates only over text. The active-domain claim from the envelope flows untouched into the next step.",
    surface: "rewrite_query(envelope, …)",
  },
  {
    id: "retrieval",
    label: "Retrieval",
    short: "Exact-domain read",
    icon: Search,
    happens:
      "Vector and keyword search run against the document store. Candidates are scored.",
    enforces:
      "Reads filter on equality with the envelope's active domain. No partial-match or fallback to a global index.",
    surface: "alloydb_store.search(domain=…, strict=True)",
  },
  {
    id: "cache",
    label: "Cache",
    short: "Domain-bound key",
    icon: Database,
    happens:
      "Semantic cache is consulted before expensive retrieval or LLM calls.",
    enforces:
      "Cache keys include {org, active_domain, operation, model, ctx_version}. Cross-domain hits are physically impossible.",
    surface: "cache_key(env)",
  },
  {
    id: "graph",
    label: "Graph",
    short: "Label-checked edges",
    icon: GitBranch,
    happens:
      "Knowledge graph traversal walks neighbors of retrieved entities for context expansion.",
    enforces:
      "Every node and edge carries a domain label. Unlabeled or different-domain hops fail closed.",
    surface: "neo4j_graph.traverse(…, require_label=domain)",
  },
  {
    id: "tools",
    label: "Tools",
    short: "Envelope scope",
    icon: Wrench,
    happens:
      "The agent calls tools — read, write, summarize, trigger workflow.",
    enforces:
      "Tool scope is inherited from the signed envelope. Model-supplied scope arguments are ignored or rejected.",
    surface: "@scoped_tool(envelope)",
  },
  {
    id: "jobs",
    label: "Jobs & Memory",
    short: "Labels persist",
    icon: Clock,
    happens:
      "Async work — ingestion, evaluation, summarization — and conversation memory are persisted.",
    enforces:
      "Jobs, traces, and memory rows all carry the originating domain. A job started in A cannot resume into B.",
    surface: "job_store.create(envelope, …)",
  },
  {
    id: "response",
    label: "Response",
    short: "Scoped citations",
    icon: MessageSquare,
    happens:
      "The agent composes the final answer with citations and returns to the caller.",
    enforces:
      "Citations and tool-call records reference only artifacts from the active domain. Audit trail matches the envelope.",
    surface: "response_envelope(…)",
  },
];

export function RuntimeContractDiagram({ className }: { className?: string }) {
  const [selectedId, setSelectedId] = useState<string>(STAGES[0].id);
  const selected = STAGES.find(s => s.id === selectedId) ?? STAGES[0];

  return (
    <div
      className={cn("rounded-lg border border-border/60 bg-card/40", className)}
    >
      {/* Stage rail */}
      <div className="border-b border-border/60 p-4 sm:p-5">
        <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
          Request lifecycle · click a stage
        </p>
        <ol
          className="grid gap-2"
          style={{
            gridTemplateColumns: `repeat(${STAGES.length}, minmax(0, 1fr))`,
          }}
        >
          {STAGES.map((s, i) => {
            const Icon = s.icon;
            const active = s.id === selectedId;
            return (
              <li key={s.id} className="relative">
                <button
                  type="button"
                  onClick={() => setSelectedId(s.id)}
                  aria-pressed={active}
                  className={cn(
                    "group flex w-full flex-col items-center gap-1.5 rounded-md border p-2 text-center transition-all",
                    active
                      ? "border-primary bg-primary/12 text-foreground shadow-[0_0_0_1px_hsl(var(--primary)/0.2)]"
                      : "border-border/50 bg-card text-muted-foreground hover:border-border hover:bg-muted/40 hover:text-foreground"
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex h-7 w-7 items-center justify-center rounded-full border text-[11px] font-bold tabular-nums transition-all",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border/60 bg-background text-muted-foreground"
                    )}
                  >
                    {i + 1}
                  </span>
                  <Icon
                    className={cn(
                      "h-4 w-4",
                      active ? "text-primary" : "text-muted-foreground/80"
                    )}
                  />
                  <span className="text-[11px] font-semibold leading-tight">
                    {s.label}
                  </span>
                  <span className="hidden text-[10px] leading-tight text-muted-foreground sm:block">
                    {s.short}
                  </span>
                </button>
                {i < STAGES.length - 1 && (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute -right-1.5 top-1/2 z-10 hidden h-px w-3 -translate-y-1/2 bg-border/60 sm:block"
                  />
                )}
              </li>
            );
          })}
        </ol>
      </div>

      {/* Detail panel */}
      <div className="grid gap-4 p-4 sm:p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="rounded-md border border-border/50 bg-muted/20 p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            What happens
          </p>
          <p className="mt-2 text-sm leading-6 text-foreground/85">
            {selected.happens}
          </p>
        </div>
        <div className="rounded-md border border-primary/25 bg-primary/5 p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
            HKI enforcement
          </p>
          <p className="mt-2 text-sm leading-6 text-foreground/90">
            {selected.enforces}
          </p>
          <p className="mt-3 rounded bg-background/60 px-2 py-1 font-mono text-[11px] text-muted-foreground">
            <span className="text-muted-foreground/50">⌥ </span>
            {selected.surface}
          </p>
        </div>
      </div>
    </div>
  );
}
