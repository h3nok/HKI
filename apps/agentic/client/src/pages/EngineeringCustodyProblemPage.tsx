import { useCallback, type ComponentType } from "react";
import { useLocation } from "wouter";
import {
  ArrowRight,
  BookOpen,
  Bot,
  BrainCircuit,
  CheckCircle2,
  ClipboardCheck,
  Database,
  FileText,
  GitBranch,
  LockKeyhole,
  Network,
  Search,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { HkiMark, cn } from "@hki/ui";

import { usePageMeta } from "@/hooks/usePageMeta";
import {
  ENGINEERING_HUB_ROUTE,
  HKI_ARCHITECTURE_ROUTE,
  HKI_STANDARD_ROUTE,
} from "@/pages/engineering/constants";
import { EngineeringHeader } from "@/pages/engineering/components/EngineeringHeader";

type PanelTone = "primary" | "success" | "warning" | "neutral";

type InfoCard = {
  label: string;
  title: string;
  body: string;
  icon: ComponentType<{ className?: string }>;
  tone?: PanelTone;
};

const AGENTIC_PARTS: readonly InfoCard[] = [
  {
    label: "01",
    title: "Retrieval",
    body: "The system pulls documents, tickets, records, code, or knowledge base entries into the task.",
    icon: Search,
    tone: "primary",
  },
  {
    label: "02",
    title: "Memory",
    body: "The system may reuse previous preferences, conversations, summaries, or operational habits.",
    icon: Database,
    tone: "success",
  },
  {
    label: "03",
    title: "Tools",
    body: "The system calls APIs, changes records, sends messages, creates jobs, or triggers workflows.",
    icon: Wrench,
    tone: "warning",
  },
  {
    label: "04",
    title: "Policy",
    body: "The system applies routing rules, filters, evaluators, model choices, and output constraints.",
    icon: LockKeyhole,
    tone: "neutral",
  },
];

const PROBLEMS: readonly InfoCard[] = [
  {
    label: "Scope ambiguity",
    title: "User access is broader than the task.",
    body: "A person may be allowed to see legal, finance, HR, and strategy documents. That does not mean one support question should reason across all of them.",
    icon: ShieldCheck,
  },
  {
    label: "Context bleed",
    title: "Adjacent knowledge can influence an answer invisibly.",
    body: "A leaked artifact does not need to be quoted to cause harm. It can shape the recommendation, ranking, escalation, or action the agent chooses next.",
    icon: Network,
  },
  {
    label: "Runtime accumulation",
    title: "Memory and telemetry become operational intelligence.",
    body: "Prompts, tool calls, retries, preferences, and failure paths teach the runtime how work is done, even when no model training occurs.",
    icon: BrainCircuit,
  },
  {
    label: "Unprovable assurance",
    title: "Promises are not enough for release gates.",
    body: "The enterprise needs evidence that retrieval, cache, graph, tool, job, and memory boundaries held for this request and this domain.",
    icon: ClipboardCheck,
  },
];

const CONTRACT_STEPS = [
  {
    title: "One active domain",
    body: "Every request starts inside exactly one named domain before retrieval, tools, cache, memory, or model calls begin.",
  },
  {
    title: "Labels persist",
    body: "Artifacts, memories, graph edges, jobs, tool calls, and outputs carry provenance instead of losing scope downstream.",
  },
  {
    title: "Publication is explicit",
    body: "Cross-domain knowledge moves through reviewed publication, never silent fallback, inherited visibility, or global reads.",
  },
  {
    title: "Proof is automated",
    body: "Conformance cases, probes, and audits make the boundary falsifiable before release.",
  },
] as const;

function toneClass(tone: PanelTone = "primary") {
  return {
    primary: "border-primary/25 bg-primary/8 text-primary",
    success: "border-success/25 bg-success/8 text-success",
    warning: "border-warning/25 bg-warning/8 text-warning",
    neutral: "border-border/60 bg-muted/30 text-foreground",
  }[tone];
}

function InfoPanel({ card }: { card: InfoCard }) {
  const Icon = card.icon;
  return (
    <article className="rounded-lg border border-border/60 bg-card/35 p-5">
      <div className="flex items-start justify-between gap-4">
        <span
          className={cn(
            "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border",
            toneClass(card.tone)
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
          {card.label}
        </span>
      </div>
      <h3 className="mt-4 text-lg font-extrabold tracking-tight text-foreground">
        {card.title}
      </h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        {card.body}
      </p>
    </article>
  );
}

export default function EngineeringCustodyProblemPage() {
  usePageMeta("HKI Custody Problem");
  const [, setLocation] = useLocation();

  const navigate = useCallback(
    (path: string) => {
      setLocation(path);
    },
    [setLocation]
  );

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <EngineeringHeader />

      <main className="flex-1 py-8 sm:py-10">
        <div className="mx-auto w-full max-w-340 px-5 sm:px-8">
          <section className="border-b border-border/60 pb-8">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 rounded-md border border-primary/20 bg-primary/8 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
                  <FileText className="h-3.5 w-3.5" />
                  Read first
                </div>
                <h1 className="mt-5 max-w-4xl text-4xl font-extrabold leading-tight tracking-tight text-foreground sm:text-[44px]">
                  The Custody Problem
                </h1>
                <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground">
                  Provider privacy promises matter, but agentic systems
                  introduce a second boundary: who controls the context, memory,
                  tools, retrieval, and domain rules that shape the agent's
                  reasoning at runtime.
                </p>
              </div>

              <aside className="rounded-lg border border-border/60 bg-card/35 p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
                  Why this comes first
                </p>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  If agentic systems are new to a reader, the standard will feel
                  abstract. This primer explains the risk before introducing the
                  HKI contract.
                </p>
                <div className="mt-4 rounded-md border border-border/60 bg-background/45 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                    Boundary shift
                  </p>
                  <p className="mt-2 text-sm font-bold leading-5 text-foreground">
                    From model-training privacy to runtime context custody.
                  </p>
                </div>
              </aside>
            </div>
          </section>

          <section className="border-b border-border/60 py-8">
            <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)_260px] lg:items-stretch">
              <div className="rounded-lg border border-border/60 bg-card/35 p-5">
                <BookOpen className="h-5 w-5 text-primary" />
                <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                  Old assurance
                </p>
                <h2 className="mt-2 text-lg font-extrabold tracking-tight text-foreground">
                  Will the provider train on our data?
                </h2>
              </div>
              <div className="rounded-lg border border-primary/25 bg-primary/5 p-5">
                <Bot className="h-5 w-5 text-primary" />
                <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
                  Agentic runtime
                </p>
                <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-foreground">
                  The system assembles context, remembers, calls tools, and
                  acts.
                </h2>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  That may be authorized and useful. The question is whether the
                  enterprise can prove which knowledge was allowed to enter this
                  specific task.
                </p>
              </div>
              <div className="rounded-lg border border-border/60 bg-card/35 p-5">
                <ShieldCheck className="h-5 w-5 text-success" />
                <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                  New assurance
                </p>
                <h2 className="mt-2 text-lg font-extrabold tracking-tight text-foreground">
                  What context can enter this task right now?
                </h2>
              </div>
            </div>
          </section>

          <section className="border-b border-border/60 py-8">
            <div className="mb-5 max-w-3xl">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
                Agentic systems, simply
              </p>
              <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
                The model is only one part of the system.
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                The surrounding runtime decides what the model sees and what the
                agent can do. That runtime is where enterprise custody must
                live.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {AGENTIC_PARTS.map(card => (
                <InfoPanel key={card.title} card={card} />
              ))}
            </div>
          </section>

          <section className="border-b border-border/60 py-8">
            <div className="mb-5 max-w-3xl">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
                The problem we solve
              </p>
              <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
                Enterprise context can cross boundaries without looking like a
                data leak.
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                The dangerous path is often invisible: a document, memory, graph
                edge, cache result, or tool permission from one domain shapes
                work in another domain.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {PROBLEMS.map(card => (
                <InfoPanel key={card.label} card={card} />
              ))}
            </div>
          </section>

          <section className="py-8">
            <div className="rounded-lg border border-primary/25 bg-primary/5 p-5 sm:p-6">
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
                    HKI answer
                  </p>
                  <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
                    Turn runtime custody into a contract the system can enforce.
                  </h2>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
                    HKI makes the runtime carry one active domain through
                    retrieval, tools, graph, cache, memory, jobs, and response.
                    Cross-domain sharing becomes explicit publication, not a
                    side effect of broad access.
                  </p>
                </div>
                <div className="rounded-md border border-border/60 bg-background/45 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                    Read next
                  </p>
                  <div className="mt-3 grid gap-2">
                    <a
                      href={HKI_STANDARD_ROUTE}
                      onClick={event => {
                        event.preventDefault();
                        navigate(HKI_STANDARD_ROUTE);
                      }}
                      className="group flex items-center justify-between gap-3 rounded-md border border-border/60 bg-card/40 px-3 py-2 text-sm font-bold text-foreground transition-colors hover:bg-muted/40"
                    >
                      HKI Standard
                      <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                    </a>
                    <a
                      href={HKI_ARCHITECTURE_ROUTE}
                      onClick={event => {
                        event.preventDefault();
                        navigate(HKI_ARCHITECTURE_ROUTE);
                      }}
                      className="group flex items-center justify-between gap-3 rounded-md border border-border/60 bg-card/40 px-3 py-2 text-sm font-bold text-foreground transition-colors hover:bg-muted/40"
                    >
                      Reference Architecture
                      <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                    </a>
                  </div>
                </div>
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-4">
                {CONTRACT_STEPS.map(step => (
                  <div
                    key={step.title}
                    className="rounded-md border border-border/60 bg-background/45 p-4"
                  >
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    <h3 className="mt-3 text-sm font-extrabold text-foreground">
                      {step.title}
                    </h3>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      {step.body}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </main>

      <footer className="border-t border-border/60">
        <div className="mx-auto flex min-h-12 w-full max-w-340 flex-wrap items-center justify-between gap-3 px-5 py-3 text-xs text-muted-foreground sm:px-8">
          <div className="flex items-center gap-2">
            <HkiMark size={14} variant="color" />
            <span>HKI Custody Problem · Engineering Hub</span>
          </div>
          <a
            href={ENGINEERING_HUB_ROUTE}
            onClick={event => {
              event.preventDefault();
              navigate(ENGINEERING_HUB_ROUTE);
            }}
            className="inline-flex items-center gap-1.5 font-medium outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Back to hub
            <ArrowRight className="h-3 w-3" />
          </a>
        </div>
      </footer>
    </div>
  );
}
