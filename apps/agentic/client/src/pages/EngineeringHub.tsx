/**
 * Engineering Hub — public index for HKI standards, runtime work, and AI platform notes.
 */

import { useCallback, type ComponentType } from "react";
import { useLocation } from "wouter";
import { usePageMeta } from "@/hooks/usePageMeta";
import {
  ArrowRight,
  BookOpen,
  BrainCircuit,
  CheckCircle2,
  ClipboardCheck,
  Cpu,
  ExternalLink,
  FileText,
  Moon,
  Network,
  Shield,
  Sun,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  HkiMark,
  Topbar,
  cn,
  hub,
} from "@hki/ui";
import { AgenticGrid } from "@/pages/landing/agentic-grid";
import { useTheme } from "@/contexts/ThemeContext";
import {
  ENGINEERING_HUB_ROUTE,
  HKI_STANDARD_ROUTE,
} from "@/pages/engineering/constants";

import requestFlowUrl from "../../../../../docs/HKI-package/images/hki/02-request-flow.svg";

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
  secondaryHref?: string;
  secondaryAction?: string;
  tags: readonly string[];
};

const STATUS_COPY: Record<WorkStatus, string> = {
  published: "Published",
  reference: "Reference",
  beta: "Beta",
  draft: "Draft",
};

const STATUS_CLASS: Record<WorkStatus, string> = {
  published: "border-success/35 text-success bg-success/8",
  reference: "border-primary/35 text-primary bg-primary/8",
  beta: "border-info/35 text-info bg-info/8",
  draft: "border-warning/35 text-warning bg-warning/8",
};

const WORK_ITEMS: readonly WorkItem[] = [
  {
    id: "hki-standard",
    title: "HKI Standard",
    label: "Runtime isolation",
    summary:
      "The architecture writeup for one active domain, signed scope envelopes, exact-domain reads, and publication-only sharing.",
    icon: Shield,
    status: "published",
    href: HKI_STANDARD_ROUTE,
    action: "Read Standard",
    secondaryHref: "/",
    secondaryAction: "Landing Page",
    tags: ["RAG", "MCP", "Memory", "Cache", "Publication"],
  },
  {
    id: "reference-runtime",
    title: "Reference Runtime",
    label: "Implementation path",
    summary:
      "A production-shaped app surface across gateway, orchestrator, retrieval, ingestion, analytics, and UI system controls.",
    icon: Cpu,
    status: "reference",
    href: "/chat?scope=hki-reference",
    action: "Run Flow",
    secondaryHref: "/welcome",
    secondaryAction: "Knowledge Lab",
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

const METRICS = [
  { value: "1", label: "Active domain" },
  { value: "0", label: "Global fallback" },
  { value: "4", label: "Work tracks" },
  { value: "6", label: "Reader sections" },
] as const;

const READING_QUEUE = [
  {
    title: "Reference Architecture",
    description: "Gateway selection, runtime preservation, admin separation.",
    href: `${HKI_STANDARD_ROUTE}#reference-architecture`,
  },
  {
    title: "Implementation Surface",
    description:
      "Responsibilities by gateway, orchestrator, store, cache, and release.",
    href: `${HKI_STANDARD_ROUTE}#implementation-surface`,
  },
  {
    title: "Conformance Tests",
    description:
      "Release gates for scope, cache, graph, jobs, and publication.",
    href: `${HKI_STANDARD_ROUTE}#conformance-and-regression-tests`,
  },
] as const;

function isExternalHref(href: string) {
  return href.startsWith("http");
}

function BrandLink({ onNavigate }: { onNavigate: (path: string) => void }) {
  return (
    <a
      href={ENGINEERING_HUB_ROUTE}
      onClick={event => {
        event.preventDefault();
        onNavigate(ENGINEERING_HUB_ROUTE);
      }}
      className="flex items-center gap-3 transition-colors hover:text-primary"
    >
      <HkiMark size={28} variant="color" />
      <div className="flex flex-col leading-none">
        <span className="text-[13px] font-extrabold uppercase tracking-normal text-foreground">
          HKI Engineering
        </span>
        <span className="mt-1 text-[11px] font-medium uppercase tracking-normal text-muted-foreground">
          AI Work Index
        </span>
      </div>
    </a>
  );
}

function MetricTile({ value, label }: { value: string; label: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-2xl font-extrabold leading-none tracking-normal text-foreground">
          {value}
        </div>
        <div className="mt-2 text-xs font-medium uppercase tracking-normal text-muted-foreground">
          {label}
        </div>
      </CardContent>
    </Card>
  );
}

function WorkCard({
  item,
  onNavigate,
}: {
  item: WorkItem;
  onNavigate: (path: string) => void;
}) {
  const Icon = item.icon;
  const external = isExternalHref(item.href);

  return (
    <Card className="group h-full">
      <CardHeader className="p-5 pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border/70 bg-muted/35 text-primary">
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <CardTitle className="tracking-normal">{item.title}</CardTitle>
              <CardDescription className="mt-1 text-xs font-medium uppercase tracking-normal">
                {item.label}
              </CardDescription>
            </div>
          </div>
          <Badge
            variant="outline"
            className={cn(
              "h-6 rounded-md px-2 text-[11px] font-semibold tracking-normal",
              STATUS_CLASS[item.status]
            )}
          >
            {STATUS_COPY[item.status]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex h-[calc(100%-92px)] flex-col gap-4 p-5 pt-0">
        <p className="text-sm leading-6 text-muted-foreground">
          {item.summary}
        </p>

        <div className="flex flex-wrap gap-1.5">
          {item.tags.map(tag => (
            <span
              key={tag}
              className="rounded-md border border-border/60 bg-muted/30 px-2 py-1 text-[11px] font-medium text-muted-foreground"
            >
              {tag}
            </span>
          ))}
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-border/50 pt-4">
          <Button asChild size="sm" className="rounded-md">
            <a
              href={item.href}
              onClick={
                external
                  ? undefined
                  : event => {
                      event.preventDefault();
                      onNavigate(item.href);
                    }
              }
              {...(external
                ? { target: "_blank", rel: "noopener noreferrer" }
                : {})}
            >
              {item.action}
              {external ? (
                <ExternalLink className="h-3.5 w-3.5" />
              ) : (
                <ArrowRight className="h-3.5 w-3.5" />
              )}
            </a>
          </Button>
          {item.secondaryHref ? (
            <Button asChild size="sm" variant="ghost" className="rounded-md">
              <a
                href={item.secondaryHref}
                onClick={event => {
                  event.preventDefault();
                  onNavigate(item.secondaryHref!);
                }}
              >
                {item.secondaryAction ?? "Open"}
              </a>
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

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
        document
          .getElementById(decodeURIComponent(hash))
          ?.scrollIntoView({ block: "start" });
      }, 0);
    },
    [setLocation]
  );

  return (
    <div className={hub.page}>
      <AgenticGrid />

      <Topbar
        variant="blur"
        showMenuTrigger={false}
        className="border-border/60! bg-background/88! backdrop-blur"
        leftContent={<BrandLink onNavigate={navigate} />}
        actions={
          <div className="flex items-center gap-2">
            <Button
              asChild
              size="sm"
              variant="ghost"
              className="hidden rounded-md sm:inline-flex"
            >
              <a
                href={HKI_STANDARD_ROUTE}
                onClick={event => {
                  event.preventDefault();
                  navigate(HKI_STANDARD_ROUTE);
                }}
              >
                <BookOpen className="h-4 w-4" />
                Standard
              </a>
            </Button>
            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
              aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
            >
              {theme === "light" ? (
                <Moon className="h-4 w-4" />
              ) : (
                <Sun className="h-4 w-4" />
              )}
            </button>
            <Button asChild size="sm" className="rounded-md">
              <a
                href="/login"
                onClick={event => {
                  event.preventDefault();
                  navigate("/login");
                }}
              >
                Sign In
              </a>
            </Button>
          </div>
        }
      />

      <main className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 px-5 py-8 sm:px-6 lg:px-8">
        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-stretch">
          <div className="flex min-w-0 flex-col justify-between gap-8">
            <div>
              <Badge
                variant="outline"
                className="mb-4 rounded-md border-primary/35 bg-primary/8 text-primary tracking-normal"
              >
                Public Engineering Surface
              </Badge>
              <h1 className="max-w-3xl text-4xl font-extrabold leading-tight tracking-normal text-foreground sm:text-5xl">
                Standards, runtime notes, and AI platform work.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
                A structured index for HKI architecture, reference runtime work,
                conformance evidence, and future AI writeups.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {METRICS.map(metric => (
                <MetricTile
                  key={metric.label}
                  value={metric.value}
                  label={metric.label}
                />
              ))}
            </div>
          </div>

          <Card className="overflow-hidden">
            <CardHeader className="border-b border-border/60 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base tracking-normal">
                    Active-Domain Request Flow
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Gateway, orchestrator, knowledge service, and scoped store.
                  </CardDescription>
                </div>
                <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
              </div>
            </CardHeader>
            <CardContent className="bg-white p-3 dark:bg-white">
              <img
                src={requestFlowUrl}
                alt="HKI request flow showing one active domain propagated through the runtime plane"
                className="h-auto w-full"
              />
            </CardContent>
          </Card>
        </section>

        <section className="space-y-4">
          <div className="flex flex-col gap-2 border-b border-border/70 pb-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground">
                Work Tracks
              </p>
              <h2 className="mt-1 text-xl font-bold tracking-normal text-foreground">
                Publish new AI work into the same pattern.
              </h2>
            </div>
            <Button asChild variant="outline" size="sm" className="rounded-md">
              <a
                href={HKI_STANDARD_ROUTE}
                onClick={event => {
                  event.preventDefault();
                  navigate(HKI_STANDARD_ROUTE);
                }}
              >
                <FileText className="h-4 w-4" />
                Open Reader
              </a>
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {WORK_ITEMS.map(item => (
              <WorkCard key={item.id} item={item} onNavigate={navigate} />
            ))}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Card>
            <CardHeader className="p-5 pb-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-md border border-border/70 bg-muted/35 text-primary">
                  <BrainCircuit className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="tracking-normal">
                    Posting Model
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Future AI work should ship as a surfaced work item plus a
                    readable artifact.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 p-5 pt-2 sm:grid-cols-3">
              {["Writeup", "Runtime", "Evidence"].map((step, index) => (
                <div
                  key={step}
                  className="rounded-md border border-border/60 bg-muted/25 p-4"
                >
                  <div className="text-xs font-medium uppercase tracking-normal text-muted-foreground">
                    0{index + 1}
                  </div>
                  <div className="mt-2 font-semibold tracking-normal text-foreground">
                    {step}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {index === 0
                      ? "Publish the architecture or research narrative."
                      : index === 1
                        ? "Link the runnable reference path or demo."
                        : "Attach conformance, audit, or readiness proof."}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-5 pb-2">
              <CardTitle className="tracking-normal">Reading Queue</CardTitle>
              <CardDescription>
                Fast entry points into the standard reader.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col divide-y divide-border/55 p-0">
              {READING_QUEUE.map(item => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={event => {
                    event.preventDefault();
                    navigate(item.href);
                  }}
                  className="group flex items-start justify-between gap-3 px-5 py-4 transition-colors hover:bg-muted/35"
                >
                  <span>
                    <span className="block text-sm font-semibold tracking-normal text-foreground">
                      {item.title}
                    </span>
                    <span className="mt-1 block text-sm leading-5 text-muted-foreground">
                      {item.description}
                    </span>
                  </span>
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
                </a>
              ))}
            </CardContent>
          </Card>
        </section>
      </main>

      <footer className={cn(hub.footerBar, "relative z-10 mt-auto")}>
        <div className="mx-auto flex h-12 max-w-7xl items-center justify-between px-5 text-xs text-muted-foreground sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <HkiMark size={16} variant="color" />
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
            className="inline-flex items-center gap-1.5 font-medium transition-colors hover:text-primary"
          >
            Strategy &amp; Sensing
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </footer>
    </div>
  );
}
