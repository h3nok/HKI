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
    neutral: "border-border bg-muted/40 text-foreground",
  }[tone];
}

function InfoPanel({ card }: { card: InfoCard }) {
  const Icon = card.icon;
  return (
    <article className="rounded-lg border border-border bg-card shadow-surface p-5">
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

      <main className="flex-1 py-10 sm:py-14">
        <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
          <section className="border-b border-border pb-12">
            <div className="inline-flex items-center gap-2 rounded-md border border-primary/20 bg-primary/8 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
              <FileText className="h-3.5 w-3.5" />
              Read first
            </div>
            <h1 className="mt-5 max-w-[22ch] text-4xl font-extrabold leading-tight tracking-tight text-foreground sm:text-[44px]">
              The Custody Problem
            </h1>
            <p className="mt-4 max-w-[60ch] text-base leading-7 text-muted-foreground">
              Provider privacy promises matter, but agentic systems introduce a
              second boundary: who controls the context, memory, tools,
              retrieval, and domain rules that shape the agent's reasoning at
              runtime.
            </p>
            <div className="mt-7 inline-block rounded-md border border-border bg-muted/40 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                Boundary shift
              </p>
              <p className="mt-1 text-sm font-bold text-foreground">
                From model-training privacy to runtime context custody.
              </p>
            </div>
          </section>

          <section className="border-b border-border py-12">
            <div className="grid gap-4 md:grid-cols-3 md:items-stretch">
              <div className="rounded-lg border border-border bg-card shadow-surface p-5">
                <BookOpen className="h-5 w-5 text-primary" />
                <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                  Old assurance
                </p>
                <h2 className="mt-2 text-lg font-extrabold tracking-tight text-foreground">
                  Will the provider train on our data?
                </h2>
              </div>
              <div className="rounded-lg border border-primary/25 bg-primary/8 p-5">
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
              <div className="rounded-lg border border-border bg-card shadow-surface p-5">
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

          <section className="border-b border-border py-12">
            <div className="mb-6 max-w-[60ch]">
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
            <div className="grid gap-4 sm:grid-cols-2">
              {AGENTIC_PARTS.map(card => (
                <InfoPanel key={card.title} card={card} />
              ))}
            </div>
          </section>

          <section className="border-b border-border py-12">
            <div className="mb-6 max-w-[60ch]">
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

          <section className="py-12">
            <div className="rounded-lg border border-primary/25 bg-primary/8 p-6 sm:p-8">
              <div className="max-w-[60ch]">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
                  HKI answer
                </p>
                <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
                  Turn runtime custody into a contract the system can enforce.
                </h2>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  HKI makes the runtime carry one active domain through
                  retrieval, tools, graph, cache, memory, jobs, and response.
                  Cross-domain sharing becomes explicit publication, not a side
                  effect of broad access.
                </p>
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {CONTRACT_STEPS.map(step => (
                  <div
                    key={step.title}
                    className="rounded-md border border-border bg-muted/40 p-4"
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

              <div className="mt-8 border-t border-primary/20 pt-6">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary">
                  Read next
                </p>
                <div className="mt-3 flex flex-wrap gap-3">
                  <a
                    href={HKI_STANDARD_ROUTE}
                    onClick={event => {
                      event.preventDefault();
                      navigate(HKI_STANDARD_ROUTE);
                    }}
                    className="group inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground shadow-surface transition-all hover:-translate-y-px hover:shadow-surface-md"
                  >
                    HKI Standard
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </a>
                  <a
                    href={HKI_ARCHITECTURE_ROUTE}
                    onClick={event => {
                      event.preventDefault();
                      navigate(HKI_ARCHITECTURE_ROUTE);
                    }}
                    className="group inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground shadow-surface transition-all hover:-translate-y-px hover:shadow-surface-md"
                  >
                    Reference Architecture
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </a>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex min-h-12 w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-3 text-xs text-muted-foreground sm:px-8">
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
