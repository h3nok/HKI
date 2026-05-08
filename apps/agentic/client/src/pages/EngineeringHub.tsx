import { useCallback, type ComponentType } from "react";
import { useLocation } from "wouter";
import { usePageMeta } from "@/hooks/usePageMeta";
import {
  ArrowRight,
  ClipboardCheck,
  Cpu,
  ExternalLink,
  Moon,
  Network,
  Shield,
  Sun,
} from "lucide-react";
import { HkiMark, cn } from "@hki/ui";
import { useTheme } from "@/contexts/ThemeContext";
import {
  ENGINEERING_HUB_ROUTE,
  HKI_STANDARD_ROUTE,
} from "@/pages/engineering/constants";

import requestFlowUrl from "../../../../../docs/HKI-package/images/hki/02-request-flow.svg";

// ─── Types ────────────────────────────────────────────────────────────────────

type WorkStatus = "published" | "reference" | "beta" | "draft";

type WorkItem = {
  id: string;
  title: string;
  label: string;
  summary: string;
  icon: ComponentType<{ className?: string }>;
  status: WorkStatus;
  href: string;
  action: string;
  tags: readonly string[];
};

type PostingStep = { id: string; label: string; description: string };

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_COPY: Record<WorkStatus, string> = {
  published: "Published",
  reference: "Reference",
  beta: "Beta",
  draft: "Draft",
};

const STATUS_COLOR: Record<WorkStatus, string> = {
  published: "text-success",
  reference: "text-primary",
  beta: "text-amber-500",
  draft: "text-muted-foreground",
};

const STATUS_DOT: Record<WorkStatus, string> = {
  published: "bg-success",
  reference: "bg-primary",
  beta: "bg-amber-500",
  draft: "bg-muted-foreground/40",
};

const FEATURED_ITEM: WorkItem = {
  id: "hki-standard",
  title: "Hermetic Knowledge Isolation",
  label: "Runtime isolation · v1.0",
  summary:
    "The architecture standard for enterprise agentic systems. One active domain, signed scope envelopes, exact-domain reads, and publication-only sharing — enforced across retrieval, cache, graph, tools, and async jobs.",
  icon: Shield,
  status: "published",
  href: HKI_STANDARD_ROUTE,
  action: "Read Standard",
  tags: ["RAG", "MCP", "Memory", "Cache", "Graph", "Publication"],
};

const WORK_ITEMS: readonly WorkItem[] = [
  {
    id: "reference-runtime",
    title: "Reference Runtime",
    label: "Implementation path",
    summary:
      "Production-shaped app surface across gateway, orchestrator, retrieval, ingestion, analytics, and UI system controls.",
    icon: Cpu,
    status: "reference",
    href: "/chat?scope=hki-reference",
    action: "Run Flow",
    tags: ["Gateway", "FastAPI", "tRPC", "pgvector", "GKE"],
  },
  {
    id: "conformance",
    title: "Conformance Harness",
    label: "Release evidence",
    summary:
      "Audit ratchets and negative tests for missing scope, global fallback, cache bleed, graph traversal, and tool overreach.",
    icon: ClipboardCheck,
    status: "beta",
    href: "/admin",
    action: "View Gates",
    tags: ["CI", "Leak Tests", "Trace Proofs", "Readiness"],
  },
  {
    id: "mcp-tools",
    title: "MCP & Tool Isolation",
    label: "Adapter pattern",
    summary:
      "Tool catalogs, arguments, calls, caches, and audit events inherit the same active domain as retrieval.",
    icon: Network,
    status: "published",
    href: `${HKI_STANDARD_ROUTE}#why-hki-matters-for-agentic-and-mcp-based-systems`,
    action: "Review Pattern",
    tags: ["MCP", "Tools", "Adapters", "Policy", "Audit"],
  },
];

const POSTING_MODEL: readonly PostingStep[] = [
  { id: "writeup", label: "Writeup", description: "Publish the architecture or research narrative." },
  { id: "runtime", label: "Runtime", description: "Link the runnable reference path or demo." },
  { id: "evidence", label: "Evidence", description: "Attach conformance, audit, or readiness proof." },
];

const READING_QUEUE = [
  {
    title: "Reference Architecture",
    description: "Gateway selection, runtime preservation, admin separation.",
    href: `${HKI_STANDARD_ROUTE}#reference-architecture`,
  },
  {
    title: "Implementation Surface",
    description: "Responsibilities by gateway, orchestrator, store, cache, and release.",
    href: `${HKI_STANDARD_ROUTE}#implementation-surface`,
  },
  {
    title: "Conformance Tests",
    description: "Release gates for scope, cache, graph, jobs, and publication.",
    href: `${HKI_STANDARD_ROUTE}#conformance-and-regression-tests`,
  },
] as const;

const HERO_STATS = [
  { count: "2", label: "Published",           color: "text-success"          },
  { count: "1", label: "Beta",                color: "text-amber-500"        },
  { count: "1", label: "Reference",           color: "text-primary"          },
  { count: "9", label: "Conformance gates",   color: "text-foreground"       },
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isExternal(href: string) {
  return href.startsWith("http");
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 pb-5">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
      <p className="shrink-0 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
        {children}
      </p>
      <div className="h-px flex-1 bg-border/50" />
    </div>
  );
}

function StatusDot({ status }: { status: WorkStatus }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[11px] font-semibold", STATUS_COLOR[status])}>
      <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[status])} />
      {STATUS_COPY[status]}
    </span>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function EngineeringHub() {
  usePageMeta("HKI Engineering");
  const [, setLocation] = useLocation();
  const { theme, toggleTheme } = useTheme();

  const navigate = useCallback(
    (path: string) => {
      setLocation(path);
      const hash = path.split("#")[1];
      if (!hash) return;
      window.setTimeout(() => {
        document.getElementById(decodeURIComponent(hash))?.scrollIntoView({ block: "start" });
      }, 0);
    },
    [setLocation]
  );

  return (
    <div className="flex min-h-screen flex-col bg-background">

      {/* ── Navigation ───────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <a
            href={ENGINEERING_HUB_ROUTE}
            onClick={e => { e.preventDefault(); navigate(ENGINEERING_HUB_ROUTE); }}
            className="flex items-center gap-2.5 transition-opacity hover:opacity-75"
          >
            <HkiMark size={22} variant="color" />
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-bold tracking-tight text-foreground">HKI Engineering</span>
              <span className="hidden text-[11px] text-muted-foreground sm:block">AI Work Index</span>
            </div>
          </a>

          <nav className="flex items-center gap-1">
            <a
              href={HKI_STANDARD_ROUTE}
              onClick={e => { e.preventDefault(); navigate(HKI_STANDARD_ROUTE); }}
              className="hidden rounded-md px-3 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground sm:block"
            >
              Standard
            </a>
            <a
              href="/"
              onClick={e => { e.preventDefault(); navigate("/"); }}
              className="hidden rounded-md px-3 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground sm:block"
            >
              Landing
            </a>
            <div className="mx-2 h-4 w-px bg-border/60" />
            <button
              type="button"
              onClick={toggleTheme}
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
              aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
            >
              {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </button>
            <a
              href={HKI_STANDARD_ROUTE}
              onClick={e => { e.preventDefault(); navigate(HKI_STANDARD_ROUTE); }}
              className="ml-1 rounded-md bg-primary px-3.5 py-1.5 text-[13px] font-semibold text-primary-foreground shadow-sm shadow-primary/20 transition-all hover:-translate-y-0.5 hover:shadow-md hover:shadow-primary/30 active:translate-y-0"
            >
              Read Standard
            </a>
          </nav>
        </div>
      </header>

      <main className="flex-1">

        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <section className="border-b border-border/50">
          <div className="mx-auto max-w-5xl px-6 py-20">
            <div className="mx-auto max-w-150 text-center">
              <p className="mb-5 text-[11px] font-bold uppercase tracking-[0.25em] text-muted-foreground">
                Engineering Work Index · HKI Platform
              </p>
              <h1 className="text-[3.25rem] font-extrabold leading-[1.07] tracking-tight text-foreground">
                Architecture and runtime for hermetic agentic systems.
              </h1>
              <p className="mt-5 text-base leading-7 text-muted-foreground">
                The HKI standard, reference implementation, and release evidence
                for building domain-isolated AI at enterprise scale.
              </p>
              <div className="mt-8 flex items-center justify-center gap-5">
                <a
                  href={HKI_STANDARD_ROUTE}
                  onClick={e => { e.preventDefault(); navigate(HKI_STANDARD_ROUTE); }}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-[13px] font-semibold text-primary-foreground shadow-sm shadow-primary/20 transition-all hover:-translate-y-0.5 hover:shadow-md hover:shadow-primary/30 active:translate-y-0"
                >
                  Read HKI Standard
                  <ArrowRight className="h-4 w-4" />
                </a>
                <a
                  href="/"
                  onClick={e => { e.preventDefault(); navigate("/"); }}
                  className="text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  View Architecture
                </a>
              </div>
            </div>

            {/* Stats strip */}
            <div className="mx-auto mt-14 grid max-w-150 grid-cols-4 divide-x divide-border/60 overflow-hidden rounded-xl border border-border/60 bg-muted/20">
              {HERO_STATS.map(s => (
                <div key={s.label} className="py-5 text-center">
                  <p className={cn("text-[1.75rem] font-extrabold leading-none tabular-nums", s.color)}>
                    {s.count}
                  </p>
                  <p className="mt-1.5 text-[10px] font-semibold text-muted-foreground">
                    {s.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Featured publication ──────────────────────────────────────────── */}
        <section className="py-14">
          <div className="mx-auto max-w-5xl px-6">
            <SectionLabel>Featured publication</SectionLabel>

            <a
              href={FEATURED_ITEM.href}
              onClick={e => { e.preventDefault(); navigate(FEATURED_ITEM.href); }}
              className="group relative grid overflow-hidden rounded-2xl border border-primary/20 bg-primary/5 transition-all hover:border-primary/35 hover:shadow-xl lg:grid-cols-[minmax(0,1fr)_460px]"
            >
              {/* Top accent stripe */}
              <div className="absolute inset-x-0 top-0 z-10 h-0.5 bg-linear-to-r from-primary/70 via-primary/40 to-transparent" />

              {/* Content */}
              <div className="flex flex-col justify-between gap-8 p-8 lg:p-10">
                <div>
                  <div className="mb-5 flex items-center gap-3">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
                      <Shield className="h-4 w-4" />
                    </span>
                    <div className="flex items-center gap-2.5">
                      <StatusDot status={FEATURED_ITEM.status} />
                      <span className="text-[11px] text-muted-foreground">·</span>
                      <span className="text-[11px] font-medium text-muted-foreground">{FEATURED_ITEM.label}</span>
                    </div>
                  </div>
                  <h2 className="text-[1.6rem] font-bold leading-tight tracking-tight text-foreground">
                    {FEATURED_ITEM.title}
                  </h2>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">
                    {FEATURED_ITEM.summary}
                  </p>
                  <div className="mt-5 flex flex-wrap gap-1.5">
                    {FEATURED_ITEM.tags.map(tag => (
                      <span
                        key={tag}
                        className="rounded border border-primary/20 bg-primary/8 px-2 py-0.5 text-[11px] font-medium text-primary/80"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
                  {FEATURED_ITEM.action}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              </div>

              {/* Diagram */}
              <div className="hidden items-center justify-center border-l border-primary/15 bg-primary/8 lg:flex">
                <img
                  src={requestFlowUrl}
                  alt="HKI request flow: one active domain propagated through the runtime plane"
                  className="w-full object-contain"
                />
              </div>
            </a>
          </div>
        </section>

        {/* ── Work cards ───────────────────────────────────────────────────── */}
        <section className="border-t border-border/50 py-14">
          <div className="mx-auto max-w-5xl px-6">
            <SectionLabel>Work index</SectionLabel>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {WORK_ITEMS.map(item => {
                const Icon = item.icon;
                const external = isExternal(item.href);
                return (
                  <div
                    key={item.id}
                    className="group flex flex-col rounded-xl border border-border/60 p-6 transition-all hover:-translate-y-0.5 hover:border-border hover:shadow-md"
                  >
                    <div className="mb-4 flex items-start justify-between">
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border/50 bg-muted/30 text-muted-foreground transition-colors group-hover:border-primary/25 group-hover:bg-primary/5 group-hover:text-primary">
                        <Icon className="h-5 w-5" />
                      </span>
                      <StatusDot status={item.status} />
                    </div>

                    <h3 className="text-[15px] font-bold tracking-tight text-foreground">
                      {item.title}
                    </h3>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{item.label}</p>
                    <p className="mt-3 flex-1 text-sm leading-6 text-muted-foreground">
                      {item.summary}
                    </p>

                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {item.tags.map(tag => (
                        <span
                          key={tag}
                          className="rounded border border-border/50 px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground/80"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>

                    <div className="mt-5 border-t border-border/40 pt-4">
                      <a
                        href={item.href}
                        onClick={external ? undefined : e => { e.preventDefault(); navigate(item.href); }}
                        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary transition-colors hover:text-primary/80"
                      >
                        {item.action}
                        {external
                          ? <ExternalLink className="h-3.5 w-3.5" />
                          : <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />}
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── Posting model + Reading queue ────────────────────────────────── */}
        <section className="border-t border-border/50 py-14">
          <div className="mx-auto max-w-5xl px-6">
            <div className="grid gap-14 lg:grid-cols-[minmax(0,1fr)_280px]">

              {/* Posting model */}
              <div>
                <SectionLabel>Posting model</SectionLabel>
                <p className="mb-6 text-sm leading-6 text-muted-foreground">
                  How new AI work ships into this index — writeup, runtime, and evidence in one package.
                </p>
                <div className="grid gap-4 sm:grid-cols-3">
                  {POSTING_MODEL.map((step, i) => (
                    <div
                      key={step.id}
                      className="flex flex-col gap-3 rounded-xl border border-border/50 p-5 transition-colors hover:border-border hover:bg-muted/30"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-full border border-primary/20 bg-primary/8 text-[12px] font-bold tabular-nums text-primary">
                        {i + 1}
                      </div>
                      <p className="text-sm font-semibold text-foreground">{step.label}</p>
                      <p className="text-xs leading-5 text-muted-foreground">{step.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Reading queue */}
              <div>
                <SectionLabel>Reading queue</SectionLabel>
                <div className="divide-y divide-border/40">
                  {READING_QUEUE.map(item => (
                    <a
                      key={item.href}
                      href={item.href}
                      onClick={e => { e.preventDefault(); navigate(item.href); }}
                      className="group flex items-start justify-between gap-2 py-3.5 transition-colors"
                    >
                      <span>
                        <span className="block text-[13px] font-medium text-foreground transition-colors group-hover:text-primary">
                          {item.title}
                        </span>
                        <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                          {item.description}
                        </span>
                      </span>
                      <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/60 transition-all group-hover:translate-x-0.5 group-hover:text-primary" />
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="border-t border-border/50">
        <div className="mx-auto flex h-12 max-w-5xl items-center justify-between px-6 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <HkiMark size={14} variant="color" />
            <span>HKI — Hermetic Knowledge Isolation</span>
          </div>
          <a
            href={
              typeof import.meta !== "undefined"
                ? (import.meta.env?.VITE_IPMS_URL ?? "http://localhost:9002")
                : "http://localhost:9002"
            }
            target="innovation-hub"
            rel="noopener"
            className="inline-flex items-center gap-1.5 font-medium transition-colors hover:text-foreground"
          >
            Strategy &amp; Sensing
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </footer>
    </div>
  );
}
