import { useCallback, type ComponentType } from "react";
import { useLocation } from "wouter";
import { usePageMeta } from "@/hooks/usePageMeta";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Cpu,
  ExternalLink,
  FileText,
  GitBranch,
  Network,
  Package,
  Radar,
  ShieldCheck,
} from "lucide-react";
import { HkiMark, cn } from "@hki/ui";
import {
  HKI_ARCHITECTURE_ROUTE,
  HKI_CUSTODY_PROBLEM_ROUTE,
  HKI_STANDARD_ROUTE,
} from "@/pages/engineering/constants";

import { EngineeringHeader } from "@/pages/engineering/components/EngineeringHeader";
import { HeroArt } from "@/pages/engineering/components/HeroArt";
import conformanceRegistry from "../../../../../conformance.json";

type ConformanceRegistry = {
  generatedAt?: string;
  implementation?: { branch?: string; commit?: string };
  packages?: Record<string, string>;
  conformance?: { passed?: number; total?: number; overallPassed?: boolean };
};

type HubCard = {
  eyebrow: string;
  title: string;
  detail: string;
  action: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  meta?: string;
  featured?: boolean;
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

const PROOF_POINTS = [
  {
    label: "One domain",
    detail: "Scope is signed once at the edge.",
  },
  {
    label: "No fallback",
    detail: "Missing scope fails closed.",
  },
  {
    label: "Auditable path",
    detail: "Every step carries the envelope.",
  },
] as const;

const HUB_CARDS: readonly HubCard[] = [
  {
    eyebrow: "Read first",
    title: "The Custody Problem",
    detail:
      "Why agent security needs runtime custody, not just access control.",
    action: "Read note",
    href: HKI_CUSTODY_PROBLEM_ROUTE,
    icon: FileText,
    meta: "Primer",
    featured: true,
  },
  {
    eyebrow: "Contract",
    title: "HKI Standard",
    detail: "The six invariants and the conformance surface.",
    action: "Read standard",
    href: HKI_STANDARD_ROUTE,
    icon: ShieldCheck,
    meta: "v1.0",
  },
  {
    eyebrow: "Inspect",
    title: "Reference Architecture",
    detail: "Runtime, publication, and admin planes in one workspace.",
    action: "Open diagram",
    href: HKI_ARCHITECTURE_ROUTE,
    icon: Network,
    meta: "Interactive",
  },
  {
    eyebrow: "Prove",
    title: "Conformance Evidence",
    detail: "Adapter cases, probes, and release evidence.",
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

function isClientRoute(href: string) {
  return href.startsWith("/") && !href.startsWith("http");
}

function HeroEvidencePanel() {
  return (
    <aside className="engineering-panel relative overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(135deg, color-mix(in srgb, var(--primary) 12%, transparent), transparent 48%)",
        }}
      />
      <div className="relative min-h-82 p-4 sm:p-6 lg:min-h-112">
        <HeroArt className="h-full min-h-74 w-full lg:min-h-100" />
      </div>
      <div className="relative grid grid-cols-2 border-t border-border bg-background/55 md:grid-cols-4">
        {QUICK_STATS.map(stat => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="border-r border-border px-4 py-3 last:border-r-0"
            >
              <div className="flex items-center gap-2 text-muted-foreground">
                <Icon className="h-3.5 w-3.5" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em]">
                  {stat.label}
                </span>
              </div>
              <p className="mt-1.5 truncate text-lg font-bold tabular-nums text-foreground">
                {stat.value}
              </p>
            </div>
          );
        })}
      </div>
    </aside>
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

  return (
    <a
      href={card.href}
      onClick={handleClick}
      className={cn(
        "engineering-panel engineering-panel-interactive group flex flex-col p-5 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        card.featured && "border-primary/30 bg-primary/7"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="engineering-icon-tile h-9 w-9">
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
    <div className="engineering-canvas flex min-h-screen flex-col">
      <EngineeringHeader />

      <main className="flex-1 py-8 sm:py-10">
        <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
          <section className="grid gap-9 lg:min-h-138 lg:grid-cols-[minmax(0,0.92fr)_minmax(420px,0.9fr)] lg:items-center">
            <div className="min-w-0 lg:pr-2">
              <div className="engineering-chip px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em]">
                <Cpu className="h-3 w-3" />
                Hermetic Knowledge Isolation
              </div>
              <h1 className="mt-5 max-w-3xl text-4xl font-bold leading-[1.02] tracking-tight text-foreground sm:text-5xl xl:text-[64px]">
                Keep every agent in bounds.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-8 text-muted-foreground sm:text-lg">
                One signed domain follows the request through retrieval, tools,
                memory, jobs, and audit.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href={HKI_STANDARD_ROUTE}
                  onClick={event => {
                    event.preventDefault();
                    navigate(HKI_STANDARD_ROUTE);
                  }}
                  className="engineering-primary-action outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  Read the standard
                  <ArrowRight className="h-4 w-4" />
                </a>
                <a
                  href={HKI_ARCHITECTURE_ROUTE}
                  onClick={event => {
                    event.preventDefault();
                    navigate(HKI_ARCHITECTURE_ROUTE);
                  }}
                  className="engineering-secondary-action outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  View architecture
                  <Network className="h-4 w-4" />
                </a>
              </div>

              <div className="mt-8 grid max-w-2xl gap-2 sm:grid-cols-3">
                {PROOF_POINTS.map(point => (
                  <div key={point.label} className="engineering-inset p-3">
                    <p className="text-xs font-bold text-foreground">
                      {point.label}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {point.detail}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <HeroEvidencePanel />
          </section>

          <section className="mt-10 border-t border-border/80 pt-8">
            <div className="mb-5 flex flex-col gap-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
                Start here
              </p>
              <h2 className="text-2xl font-bold tracking-tight text-foreground">
                Learn the boundary, then inspect the system.
              </h2>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {HUB_CARDS.map(card => (
                <HubCardLink
                  key={card.title}
                  card={card}
                  onNavigate={navigate}
                />
              ))}
            </div>
          </section>
        </div>
      </main>

      <footer className="engineering-footer">
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
