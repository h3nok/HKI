import { useCallback, type ComponentType } from "react";
import { useLocation } from "wouter";
import { usePageMeta } from "@/hooks/usePageMeta";
import {
  ArrowRight,
  BookOpen,
  Bot,
  CheckCircle2,
  ClipboardCheck,
  Cpu,
  Database,
  ExternalLink,
  FileText,
  GitBranch,
  LockKeyhole,
  MessageSquare,
  Network,
  Package,
  Radar,
  Search,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { HkiMark, cn } from "@hki/ui";
import {
  HKI_ARCHITECTURE_ROUTE,
  HKI_CUSTODY_PROBLEM_ROUTE,
  HKI_STANDARD_ROUTE,
} from "@/pages/engineering/constants";

import { EngineeringHeader } from "@/pages/engineering/components/EngineeringHeader";
import conformanceRegistry from "../../../../../conformance.json";

type Tone = "primary" | "success" | "neutral";

type ConformanceRegistry = {
  generatedAt?: string;
  implementation?: { branch?: string; commit?: string };
  packages?: Record<string, string>;
  conformance?: { passed?: number; total?: number; overallPassed?: boolean };
};

type StoryFrame = {
  label: string;
  title: string;
  detail: string;
  icon: ComponentType<{ className?: string }>;
  tone: Tone;
};

type HubCard = {
  eyebrow: string;
  title: string;
  detail: string;
  action: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  meta?: string;
  primary?: boolean;
};

const REGISTRY = conformanceRegistry as ConformanceRegistry;
const EVIDENCE = {
  passed: REGISTRY.conformance?.passed ?? 0,
  total: REGISTRY.conformance?.total ?? 0,
  packages: Object.keys(REGISTRY.packages ?? {}).length,
  branch: REGISTRY.implementation?.branch ?? "unknown",
  commit: (REGISTRY.implementation?.commit ?? "").slice(0, 7),
  generatedAt: REGISTRY.generatedAt
    ? new Date(REGISTRY.generatedAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "Local",
};

const STORY_FRAMES: readonly StoryFrame[] = [
  {
    label: "1 · Familiar promise",
    title: "No training on your data",
    detail: "Necessary, but it only covers one security layer.",
    icon: BookOpen,
    tone: "neutral",
  },
  {
    label: "2 · Agentic shift",
    title: "Runtime assembles context",
    detail: "Retrieval, memory, tools, and policy shape the answer.",
    icon: Bot,
    tone: "primary",
  },
  {
    label: "3 · HKI boundary",
    title: "One signed domain scope",
    detail: "Every runtime operation carries the same custody envelope.",
    icon: ShieldCheck,
    tone: "success",
  },
] as const;

const RUNTIME_PARTS = [
  { label: "Prompt", icon: MessageSquare },
  { label: "Retrieval", icon: Search },
  { label: "Memory", icon: Database },
  { label: "Tools", icon: Wrench },
  { label: "Policy", icon: LockKeyhole },
] as const;

const HUB_CARDS: readonly HubCard[] = [
  {
    eyebrow: "Read first",
    title: "The Custody Problem",
    detail:
      "A plain-language story for why agentic systems need runtime context custody.",
    action: "Start here",
    href: HKI_CUSTODY_PROBLEM_ROUTE,
    icon: FileText,
    meta: "Primer",
    primary: true,
  },
  {
    eyebrow: "Contract",
    title: "HKI Standard",
    detail:
      "The rules: one active domain, signed envelopes, exact visibility, explicit publication.",
    action: "Read standard",
    href: HKI_STANDARD_ROUTE,
    icon: ShieldCheck,
    meta: "v1.0",
  },
  {
    eyebrow: "Inspect",
    title: "Reference Architecture",
    detail:
      "A workspace for runtime, publication, admin, and MCP enforcement paths.",
    action: "Open diagram",
    href: HKI_ARCHITECTURE_ROUTE,
    icon: Network,
    meta: "Interactive",
  },
  {
    eyebrow: "Prove",
    title: "Conformance Evidence",
    detail:
      "Adapter cases, probes, and release evidence for falsifiable boundary checks.",
    action: "Inspect gates",
    href: "/admin",
    icon: ClipboardCheck,
    meta: `${EVIDENCE.passed}/${EVIDENCE.total}`,
  },
] as const;

const QUICK_STATS = [
  {
    label: "Cases",
    value: `${EVIDENCE.passed}/${EVIDENCE.total}`,
    icon: CheckCircle2,
  },
  { label: "Packages", value: String(EVIDENCE.packages), icon: Package },
  { label: "Branch", value: EVIDENCE.branch, icon: GitBranch },
  { label: "Evidence", value: EVIDENCE.generatedAt, icon: Radar },
] as const;

function toneClass(tone: Tone) {
  return {
    primary: "border-primary/25 bg-primary/9 text-primary",
    success: "border-success/30 bg-success/10 text-success",
    neutral: "border-border bg-muted/50 text-muted-foreground",
  }[tone];
}

function toneBarClass(tone: Tone) {
  return {
    primary: "bg-linear-to-r from-primary/60 via-primary/30 to-transparent",
    success: "bg-linear-to-r from-success/60 via-success/30 to-transparent",
    neutral: "bg-linear-to-r from-border to-transparent",
  }[tone];
}

function isClientRoute(href: string) {
  return href.startsWith("/") && !href.startsWith("http");
}

function StoryFrameCard({ frame }: { frame: StoryFrame }) {
  const Icon = frame.icon;
  return (
    <article className="relative overflow-hidden rounded-xl border border-border bg-card shadow-surface p-5">
      <div
        className={cn(
          "absolute inset-x-0 top-0 h-0.5",
          toneBarClass(frame.tone)
        )}
      />
      <div className="flex items-center justify-between gap-3 pt-1">
        <span
          className={cn(
            "inline-flex h-9 w-9 items-center justify-center rounded-lg border",
            toneClass(frame.tone)
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <span className="font-mono text-[10px] font-semibold tracking-[0.14em] text-muted-foreground">
          {frame.label}
        </span>
      </div>
      <h3 className="mt-5 text-base font-bold tracking-tight text-foreground">
        {frame.title}
      </h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        {frame.detail}
      </p>
    </article>
  );
}

function RuntimeMap() {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-surface">
      <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
            Context custody
          </p>
          <h2 className="mt-1 text-base font-bold tracking-tight text-foreground">
            The model is not the boundary. The runtime is.
          </h2>
        </div>
        <span className="shrink-0 rounded-full border border-primary/20 bg-muted/50 px-3 py-1 font-mono text-[10px] font-semibold text-primary">
          HkiEnvelope
        </span>
      </div>

      <div className="p-5">
        <div className="flex items-stretch gap-3">
          <div className="flex shrink-0 flex-col items-center justify-center gap-2 rounded-xl border border-border bg-muted/40 px-4 py-4">
            <MessageSquare className="h-5 w-5 text-muted-foreground" />
            <p className="text-[11px] font-semibold text-foreground">Request</p>
          </div>

          <div className="flex flex-1 items-center justify-center">
            <ArrowRight className="h-4 w-4 shrink-0 text-primary/40" />
          </div>

          <div className="flex flex-1 flex-col gap-3 rounded-xl border border-primary/20 bg-primary/7 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
                Agent runtime
              </span>
              <span className="font-mono text-[9px] text-muted-foreground">
                active_domain locked
              </span>
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {RUNTIME_PARTS.map(part => {
                const Icon = part.icon;
                return (
                  <div
                    key={part.label}
                    className="flex flex-col items-center gap-1.5 rounded-lg border border-border bg-card py-2.5"
                  >
                    <Icon className="h-3.5 w-3.5 text-primary/70" />
                    <p className="text-[10px] font-medium text-foreground">
                      {part.label}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-1 items-center justify-center">
            <ArrowRight className="h-4 w-4 shrink-0 text-primary/40" />
          </div>

          <div className="flex shrink-0 flex-col items-center justify-center gap-2 rounded-xl border border-success/30 bg-success/9 px-4 py-4">
            <ShieldCheck className="h-5 w-5 text-success" />
            <p className="text-[11px] font-semibold text-foreground">Scoped</p>
            <p className="text-[10px] text-muted-foreground">answer</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function HubCardLink({
  card,
  onNavigate,
}: {
  card: HubCard;
  onNavigate: (path: string) => void;
}) {
  const Icon = card.icon;
  const clientRoute = isClientRoute(card.href);
  const handleClick = clientRoute
    ? (event: React.MouseEvent) => {
        event.preventDefault();
        onNavigate(card.href);
      }
    : undefined;

  if (card.primary) {
    return (
      <a
        href={card.href}
        onClick={handleClick}
        className="group flex items-center gap-6 rounded-xl border border-primary/30 bg-linear-to-br from-primary/13 to-primary/7 p-6 shadow-surface outline-none transition-all hover:-translate-y-0.5 hover:shadow-surface-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-card text-primary shadow-sm">
          <Icon className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
            {card.eyebrow}
          </p>
          <h3 className="mt-1 text-xl font-bold tracking-tight text-foreground">
            {card.title}
          </h3>
          <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
            {card.detail}
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-primary">
          {card.action}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </span>
      </a>
    );
  }

  return (
    <a
      href={card.href}
      onClick={handleClick}
      className="group flex flex-col rounded-xl border border-border bg-card shadow-surface p-5 outline-none transition-all hover:-translate-y-0.5 hover:border-border hover:shadow-surface-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-muted/50 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        {card.meta && (
          <span className="rounded-full border border-border bg-muted/40 px-2 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground">
            {card.meta}
          </span>
        )}
      </div>
      <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
        {card.eyebrow}
      </p>
      <h3 className="mt-1.5 text-lg font-bold tracking-tight text-foreground">
        {card.title}
      </h3>
      <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">
        {card.detail}
      </p>
      <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
        {card.action}
        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </span>
    </a>
  );
}

export default function EngineeringHub() {
  usePageMeta("HKI Engineering Hub");
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
        <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
          <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/12 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
                <Cpu className="h-3 w-3" />
                Engineering work index
              </div>
              <h1 className="mt-5 max-w-4xl text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-[46px]">
                Understand the runtime before you trust the agent.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
                HKI is a boundary system for agentic AI: it keeps retrieval,
                memory, tools, cache, jobs, and responses inside one signed
                domain scope.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href={HKI_CUSTODY_PROBLEM_ROUTE}
                  onClick={event => {
                    event.preventDefault();
                    navigate(HKI_CUSTODY_PROBLEM_ROUTE);
                  }}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm shadow-primary/25 outline-none transition-all hover:-translate-y-px hover:shadow-md hover:shadow-primary/30 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  Start with the problem
                  <ArrowRight className="h-4 w-4" />
                </a>
                <a
                  href={HKI_ARCHITECTURE_ROUTE}
                  onClick={event => {
                    event.preventDefault();
                    navigate(HKI_ARCHITECTURE_ROUTE);
                  }}
                  className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground outline-none transition-all hover:-translate-y-px hover:shadow-surface focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  View architecture
                  <Network className="h-4 w-4" />
                </a>
              </div>
            </div>

            <aside className="rounded-xl border border-border bg-card shadow-surface p-5">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-success shadow-sm shadow-success/50" />
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  Release signal
                </p>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {QUICK_STATS.map(stat => {
                  const Icon = stat.icon;
                  return (
                    <div
                      key={stat.label}
                      className="rounded-lg border border-border bg-muted/40 p-3"
                    >
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      <p className="mt-2 text-lg font-bold tabular-nums text-foreground">
                        {stat.value}
                      </p>
                      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        {stat.label}
                      </p>
                    </div>
                  );
                })}
              </div>
              {EVIDENCE.commit && (
                <p className="mt-4 border-t border-border pt-3 font-mono text-[11px] text-muted-foreground">
                  build @{EVIDENCE.commit}
                </p>
              )}
            </aside>
          </section>

          <div className="mt-10">
            <RuntimeMap />
          </div>

          <section className="mt-8 grid gap-3 lg:grid-cols-3">
            {STORY_FRAMES.map(frame => (
              <StoryFrameCard key={frame.label} frame={frame} />
            ))}
          </section>

          <section className="mt-10 border-t border-border pt-8">
            <div className="mb-5 flex flex-col gap-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
                Choose your next step
              </p>
              <h2 className="text-2xl font-bold tracking-tight text-foreground">
                Four doors. One learning path.
              </h2>
            </div>
            <div className="space-y-3">
              {HUB_CARDS.filter(c => c.primary).map(card => (
                <HubCardLink
                  key={card.title}
                  card={card}
                  onNavigate={navigate}
                />
              ))}
              <div className="grid gap-3 md:grid-cols-3">
                {HUB_CARDS.filter(c => !c.primary).map(card => (
                  <HubCardLink
                    key={card.title}
                    card={card}
                    onNavigate={navigate}
                  />
                ))}
              </div>
            </div>
          </section>
        </div>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex min-h-12 w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-3 text-xs text-muted-foreground sm:px-8">
          <div className="flex items-center gap-2">
            <HkiMark size={14} variant="color" />
            <span>HKI Engineering Hub · Hermetic Knowledge Isolation</span>
          </div>
          <a
            href={
              typeof import.meta !== "undefined"
                ? (import.meta.env?.VITE_INNOVATION_HUB_URL ??
                  "http://localhost:9002")
                : "http://localhost:9002"
            }
            target="innovation-hub"
            rel="noopener"
            className="inline-flex items-center gap-1.5 font-medium outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Strategy &amp; Sensing
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </footer>
    </div>
  );
}
