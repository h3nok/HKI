/**
 * AgenticPlatformLanding — Public HKI framework landing page.
 *
 * Hero → Framework → Conformance Path → Roles → CTA
 */

import { useCallback, useRef, useState } from "react";
import { useLocation } from "wouter";
import { usePageMeta } from "@/hooks/usePageMeta";
import { motion, useInView } from "framer-motion";
import {
  Archive,
  ArrowRight,
  FileSearch,
  KeyRound,
  ShieldAlert,
} from "lucide-react";
import { cn, HkiMark } from "@hki/ui";

import { Nav } from "./nav";
import { Footer } from "./cta";
import { AgenticGrid } from "./agentic-grid";
import { STACK_LAYERS, ROLES, EASE, COLORS } from "./constants";
import { HKI_STANDARD_ROUTE } from "@/pages/engineering/constants";

const HEADING = "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif";
const HAIRLINE_SHADOW = "var(--shadow-xs)";
const RAISED_SHADOW = "var(--shadow-lg)";

function colorMix(color: string, amount: number, base = "transparent") {
  return `color-mix(in srgb, ${color} ${amount}%, ${base})`;
}

function accentGradient(color: string) {
  return color;
}

// ── Full-screen section wrapper ───────────────────────────────────────────────

function FullSection({
  id,
  children,
  className = "",
}: {
  id?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={`relative z-10 flex min-h-[calc(100svh-57px)] snap-start scroll-mt-16 flex-col items-center justify-center border-t border-border/20 px-6 py-14 md:px-12 md:py-16 ${className}`}
    >
      {children}
    </section>
  );
}

// ── Framework Cards ───────────────────────────────────────────────────────────

const VISIBLE_LAYERS = STACK_LAYERS.filter(l => l.id !== "model");
const PLATFORM_LAYER_COUNT = VISIBLE_LAYERS.length;
const PLATFORM_CAPABILITY_COUNT = VISIBLE_LAYERS.reduce(
  (total, layer) => total + layer.capabilities.length,
  0
);
const LIVE_LAYER_COUNT = VISIBLE_LAYERS.filter(
  layer => layer.status === "live"
).length;
const API_LAYER_COUNT = VISIBLE_LAYERS.filter(
  layer => layer.status === "api"
).length;
const LIVE_AGENT_STARTER =
  "Show me the HKI conformance path for one active domain across retrieval, memory, cache, and tools.";
const LIVE_AGENT_ROUTE = `/chat?scope=hki-reference&starter=${encodeURIComponent(LIVE_AGENT_STARTER)}`;
const LIVE_AGENT_CONTENT_CLASS =
  "relative z-10 inline-flex items-center gap-2.5 tracking-[0.01em] text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.45)]";
const LIVE_AGENT_DOT_CLASS =
  "w-1.5 h-1.5 rounded-full animate-pulse bg-white/95 shadow-[0_0_0_3px_rgba(255,255,255,0.18)]";
const LIVE_AGENT_BACKGROUND = "var(--primary)";
const STATUS_META = {
  live: {
    label: "Live",
    className: "bg-primary/12 text-primary border border-primary/25",
  },
  api: {
    label: "API Only",
    className: "bg-primary/8 text-primary border border-primary/20",
  },
  planned: {
    label: "Planned",
    className: "border border-border/50 bg-muted/45 text-muted-foreground/80",
  },
} as const;

function SurfaceStatusBadge({
  status,
  className = "",
}: {
  status: keyof typeof STATUS_META;
  className?: string;
}) {
  const meta = STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em]",
        meta.className,
        className
      )}
    >
      {meta.label}
    </span>
  );
}

function PlatformCards({
  inView,
  onNavigate,
}: {
  inView: boolean;
  onNavigate?: (path: string) => void;
}) {
  const [activeLayerId, setActiveLayerId] = useState(
    VISIBLE_LAYERS[0]?.id ?? ""
  );
  const activeLayer =
    VISIBLE_LAYERS.find(layer => layer.id === activeLayerId) ??
    VISIBLE_LAYERS[0];

  if (!activeLayer) return null;

  const activeIndex = VISIBLE_LAYERS.findIndex(
    layer => layer.id === activeLayer.id
  );
  const ActiveIcon = activeLayer.icon;
  const selfService = activeLayer.selfService ?? [];
  const openActiveLayer = () => {
    if (!activeLayer.link) return;
    if (activeLayer.link.startsWith("http")) {
      window.open(activeLayer.link, "_blank", "noopener,noreferrer");
    } else {
      onNavigate?.(activeLayer.link);
    }
  };

  return (
    <div data-no-grid className="w-full">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-6">
        <motion.div
          initial={{ opacity: 0, y: 22 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.55, delay: 0.08, ease: EASE }}
          className="relative overflow-hidden rounded-lg border border-border/60 bg-card/82 p-5 shadow-lg shadow-black/5 backdrop-blur-xl dark:bg-card/88 dark:shadow-black/25 sm:p-6"
          style={{
            borderColor: colorMix(activeLayer.color, 32, "var(--border)"),
            background: "var(--card)",
          }}
        >
          <div
            aria-hidden
            className="absolute inset-x-0 top-0 h-1"
            style={{ background: accentGradient(activeLayer.color) }}
          />
          <div
            aria-hidden
            className="absolute inset-0 opacity-[0.08]"
            style={{
              backgroundImage: "none",
              backgroundSize: "44px 44px",
            }}
          />

          <div className="relative flex min-h-130 flex-col">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-lg border shadow-sm"
                  style={{
                    backgroundColor: colorMix(activeLayer.color, 16),
                    borderColor: colorMix(
                      activeLayer.color,
                      34,
                      "var(--border)"
                    ),
                    boxShadow: `0 18px 45px -28px ${activeLayer.color}`,
                  }}
                >
                  <ActiveIcon
                    className="h-5 w-5"
                    style={{ color: activeLayer.color }}
                  />
                </div>
                <div>
                  <p
                    className="mb-1.5 text-[9px] font-extrabold uppercase tracking-[0.18em] text-muted-foreground/65"
                    style={{ fontFamily: HEADING }}
                  >
                    Surface {String(activeIndex + 1).padStart(2, "0")}
                  </p>
                  <h3
                    className="text-xl font-extrabold leading-tight text-foreground sm:text-2xl"
                    style={{ fontFamily: HEADING }}
                  >
                    {activeLayer.label}
                  </h3>
                </div>
              </div>
              <SurfaceStatusBadge status={activeLayer.status} />
            </div>

            <div className="mt-6 max-w-xl">
              <p className="text-base font-semibold leading-relaxed text-foreground/88">
                {activeLayer.subtitle}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground/72">
                {activeLayer.description}
              </p>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground/78">
                <span className="font-semibold text-foreground/85">
                  Best for:
                </span>{" "}
                {activeLayer.useCase}
              </p>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {activeLayer.capabilities.slice(0, 6).map((capability, index) => {
                const isLive = selfService.includes(capability);
                return (
                  <div
                    key={capability}
                    className="group relative overflow-hidden rounded-md border border-border/45 bg-background/42 px-3.5 py-2.5 backdrop-blur-sm transition-colors duration-200 hover:bg-background/66"
                  >
                    <div
                      aria-hidden
                      className="absolute inset-y-3 left-0 w-0.75 rounded-r-full"
                      style={{
                        backgroundColor: isLive
                          ? activeLayer.color
                          : colorMix(activeLayer.color, 34),
                      }}
                    />
                    <div className="flex items-center justify-between gap-3 pl-1.5">
                      <span className="text-[13px] font-semibold leading-tight text-foreground/86">
                        {capability}
                      </span>
                      <span
                        className="text-[10px] font-bold tabular-nums text-muted-foreground/42"
                        style={{ fontFamily: HEADING }}
                      >
                        {String(index + 1).padStart(2, "0")}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-auto flex flex-wrap items-end justify-between gap-4 pt-8">
              {activeLayer.techStack && activeLayer.techStack.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {activeLayer.techStack.map(tech => (
                    <span
                      key={tech}
                      className="rounded-md border border-border/45 bg-background/48 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground/78"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              )}

              {activeLayer.link && (
                <button
                  type="button"
                  onClick={openActiveLayer}
                  className="group inline-flex items-center gap-2 rounded-lg border border-border/55 bg-foreground px-4 py-2.5 text-sm font-bold text-background shadow-lg shadow-black/10 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl dark:shadow-black/30"
                >
                  {activeLayer.linkLabel ?? "Explore"}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </button>
              )}
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <div className="mb-1 hidden items-center justify-between lg:flex">
            <span
              className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/45"
              style={{ fontFamily: HEADING }}
            >
              Explore each layer
            </span>
            <ArrowRight className="h-3 w-3 text-muted-foreground/35" />
          </div>
          {VISIBLE_LAYERS.map((layer, index) => {
            const Icon = layer.icon;
            const selected = layer.id === activeLayer.id;

            return (
              <motion.button
                key={layer.id}
                type="button"
                initial={{ opacity: 0, x: 18 }}
                animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{
                  duration: 0.42,
                  delay: 0.12 + index * 0.055,
                  ease: EASE,
                }}
                onMouseEnter={() => setActiveLayerId(layer.id)}
                onFocus={() => setActiveLayerId(layer.id)}
                onClick={() => setActiveLayerId(layer.id)}
                aria-pressed={selected}
                className={cn(
                  "group relative min-h-29 w-full overflow-hidden rounded-lg border px-4 py-3 text-left transition-all duration-200 lg:min-h-20 lg:px-3 lg:py-2.5",
                  selected
                    ? "border-border/70 bg-card/88 shadow-xl shadow-black/10 dark:shadow-black/30"
                    : "border-border/38 bg-background/34 hover:border-border/65 hover:bg-card/70"
                )}
                style={{
                  borderColor: selected
                    ? colorMix(layer.color, 42, "var(--border)")
                    : undefined,
                  boxShadow: selected
                    ? `0 18px 55px -40px ${layer.color}`
                    : undefined,
                }}
              >
                <span
                  aria-hidden
                  className="absolute inset-y-3 left-0 w-1 rounded-r-full transition-opacity duration-200"
                  style={{
                    backgroundColor: layer.color,
                    opacity: selected ? 1 : 0.38,
                  }}
                />
                <div className="flex items-start gap-3 pl-1.5">
                  <span
                    className="mt-1 text-[10px] font-extrabold tabular-nums text-muted-foreground/45"
                    style={{ fontFamily: HEADING }}
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border"
                    style={{
                      backgroundColor: colorMix(layer.color, selected ? 16 : 9),
                      borderColor: colorMix(layer.color, 24, "var(--border)"),
                    }}
                  >
                    <Icon className="h-4 w-4" style={{ color: layer.color }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="text-sm font-extrabold leading-tight text-foreground"
                        style={{ fontFamily: HEADING }}
                      >
                        {layer.label}
                      </span>
                      <SurfaceStatusBadge
                        status={layer.status}
                        className="px-1.5 py-0.5 text-[8px]"
                      />
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground/68 lg:line-clamp-1">
                      {layer.subtitle}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1.5 lg:hidden 2xl:flex">
                      {layer.capabilities.slice(0, 3).map(capability => (
                        <span
                          key={capability}
                          className="rounded-md border border-border/35 bg-muted/30 px-2 py-0.5 text-[10px] font-medium text-muted-foreground/70"
                        >
                          {capability}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Hero ──────────────────────────────────────────────────────────────────────

const STATS = [
  { value: PLATFORM_LAYER_COUNT, suffix: "", label: "Control Surfaces" },
  { value: PLATFORM_CAPABILITY_COUNT, suffix: "", label: "Scoped Controls" },
  { value: LIVE_LAYER_COUNT, suffix: "", label: "Live Layers" },
  { value: 100, suffix: "%", label: "Vendor Neutral" },
] as const;

function HeroProofStrip() {
  return (
    <div className="grid w-full max-w-xl grid-cols-2 overflow-hidden rounded-lg border border-border/45 bg-border/35 text-left shadow-sm sm:grid-cols-4">
      {STATS.map(stat => (
        <div
          key={stat.label}
          className="bg-background/76 px-3.5 py-2.5 backdrop-blur-sm"
        >
          <p
            className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground/54"
            style={{ fontFamily: HEADING }}
          >
            {stat.label}
          </p>
          <p
            className="mt-1 text-xl font-extrabold tabular-nums text-foreground"
            style={{ fontFamily: HEADING }}
          >
            {stat.value}
            {stat.suffix}
          </p>
        </div>
      ))}
    </div>
  );
}

function HeroSection({ onNavigate }: { onNavigate: (path: string) => void }) {
  return (
    <section className="relative z-10 flex min-h-[calc(100svh-57px)] snap-start scroll-mt-16 flex-col items-center justify-center px-6 py-14 text-center md:py-16">
      <div className="flex flex-col items-center">
        {/* Icon */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: EASE }}
          className="mb-8"
        >
          <HkiMark size={48} variant="color" />
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15, ease: EASE }}
          className="mb-5 max-w-3xl text-3xl font-extrabold leading-[1.1] tracking-[-0.03em] sm:text-4xl lg:text-5xl"
          style={{ fontFamily: HEADING }}
        >
          <span className="text-primary">Hermetic</span>{" "}
          <span className="text-foreground">Knowledge Isolation</span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3, ease: EASE }}
          className="max-w-xl mb-8 text-base sm:text-lg font-medium leading-[1.38] text-foreground/72"
          style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
        >
          Every agentic execution needs an isolated domain. Without that
          boundary, enterprises are{" "}
          <span className="font-semibold" style={{ color: "var(--secondary)" }}>
            already at risk:
          </span>{" "}
          context leaks, tools overreach, and memory persists beyond intent.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.45, ease: EASE }}
          className="flex flex-col sm:flex-row items-center gap-3 mb-8"
        >
          <a
            href={HKI_STANDARD_ROUTE}
            onClick={e => {
              e.preventDefault();
              onNavigate(HKI_STANDARD_ROUTE);
            }}
            className="group inline-flex items-center gap-2.5 px-7 py-3.5 rounded-xl
                     border border-border/60 bg-card/70 backdrop-blur-sm
                     text-foreground text-sm font-semibold
                     hover:border-primary/35 hover:bg-card
                     hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300"
          >
            Read the Standard
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </a>
          <a
            href={LIVE_AGENT_ROUTE}
            onClick={e => {
              e.preventDefault();
              onNavigate(LIVE_AGENT_ROUTE);
            }}
            className="group inline-flex items-center gap-2.5 px-7 py-3.5 rounded-xl
                     relative overflow-hidden isolate text-sm font-semibold
                     ring-1 ring-black/10 dark:ring-white/10 shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/25
                     hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300"
            style={{
              background: LIVE_AGENT_BACKGROUND,
            }}
          >
            <span aria-hidden className="hidden" />
            <span className={LIVE_AGENT_CONTENT_CLASS}>
              <span className="inline-flex items-center gap-1.5">
                <span className={LIVE_AGENT_DOT_CLASS} />
                Run Reference Flow
              </span>
              <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
            </span>
          </a>
        </motion.div>

        <HeroProofStrip />
      </div>
    </section>
  );
}

// ── Risk Thesis ───────────────────────────────────────────────────────────────

const RISK_SIGNALS = [
  {
    title: "Scope collapse",
    desc: "Retrieval, rewritten prompts, and tool plans blend domains unless scope is a runtime invariant.",
    icon: ShieldAlert,
  },
  {
    title: "Tool overreach",
    desc: "MCP tools inherit too much context when catalogs, arguments, and calls are not domain-bound.",
    icon: KeyRound,
  },
  {
    title: "Memory bleed",
    desc: "Caches and long-lived memory preserve sensitive context beyond the request that created it.",
    icon: Archive,
  },
  {
    title: "Audit gaps",
    desc: "Traces prove little when the active domain is missing, mutable, or detached from downstream work.",
    icon: FileSearch,
  },
] as const;

function RiskSection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.15 });

  return (
    <FullSection id="risk">
      <div
        ref={ref}
        className="grid w-full max-w-6xl items-center gap-10 px-4 lg:grid-cols-[0.9fr_1.35fr] lg:gap-12"
      >
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, ease: EASE }}
          className="max-w-xl text-center lg:text-left"
        >
          <p
            className="mb-3 text-[10px] font-bold uppercase tracking-[0.22em] text-primary"
            style={{ fontFamily: HEADING }}
          >
            Why HKI Now
          </p>
          <h2
            className="text-xl font-extrabold leading-snug tracking-[-0.015em] text-foreground sm:text-2xl"
            style={{ fontFamily: HEADING }}
          >
            Autonomy changed the risk model.{" "}
            <span style={{ color: "var(--secondary)" }}>
              Enterprise controls have to change with it.
            </span>
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground/70 lg:mx-0">
            HKI makes isolation a runtime invariant for every agent execution:
            context, memory, tools, caches, traces, and publication paths stay
            inside the domain that authorized them.
          </p>
          <div className="mt-6 hidden h-px w-24 bg-primary/45 lg:block" />
        </motion.div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {RISK_SIGNALS.map((signal, index) => {
            const Icon = signal.icon;
            return (
              <motion.div
                key={signal.title}
                initial={{ opacity: 0, y: 18 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{
                  duration: 0.42,
                  delay: 0.08 + index * 0.06,
                  ease: EASE,
                }}
                className="group relative overflow-hidden rounded-lg border border-border/55 bg-card/70 p-4 shadow-sm backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-card"
              >
                <div
                  aria-hidden
                  className="absolute inset-x-0 top-0 h-1 bg-primary"
                />
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md border border-primary/20 bg-primary/10">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <span
                    className="text-[10px] font-extrabold tabular-nums text-muted-foreground/38"
                    style={{ fontFamily: HEADING }}
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3
                  className="text-sm font-extrabold text-foreground"
                  style={{ fontFamily: HEADING }}
                >
                  {signal.title}
                </h3>
                <p className="mt-2.5 text-[13px] leading-relaxed text-muted-foreground/68">
                  {signal.desc}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </FullSection>
  );
}

// ── Framework Capabilities ────────────────────────────────────────────────────

function CapabilitiesSection({
  onNavigate,
}: {
  onNavigate: (path: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0 });

  return (
    <FullSection id="features" className="py-10 md:py-12">
      <div ref={ref} className="w-full max-w-7xl mx-auto flex flex-col px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, ease: EASE }}
          className="mb-7"
        >
          <p
            className="mb-3 text-[10px] font-bold uppercase tracking-[0.22em] text-primary"
            style={{ fontFamily: HEADING }}
          >
            Architecture
          </p>
          <h2
            className="max-w-3xl text-xl font-extrabold leading-snug tracking-[-0.015em] text-foreground sm:text-2xl lg:text-3xl"
            style={{ fontFamily: HEADING }}
          >
            {PLATFORM_LAYER_COUNT} layers in your stack.{" "}
            <span className="text-primary">One isolation rule.</span>
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground/66">
            HKI specifies exactly where domain isolation must hold — from the
            signed scope envelope at the edge to cache keys, graph edges, tool
            calls, and audit traces. Each layer has concrete controls and a
            conformance check.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[11px] font-bold text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              {LIVE_LAYER_COUNT} layers live in the reference stack
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/8 px-3 py-1 text-[11px] font-bold text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              {API_LAYER_COUNT} API-only
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-muted/40 px-3 py-1 text-[11px] font-bold text-muted-foreground/80">
              {PLATFORM_CAPABILITY_COUNT} total controls across all layers
            </span>
          </div>
        </motion.div>

        <PlatformCards inView={inView} onNavigate={onNavigate} />
      </div>
    </FullSection>
  );
}

// ── Conformance Journey — from advisory scope to enforced HKI ────────────────

const JOURNEY_STEPS = [
  {
    num: "01",
    title: "Inventory",
    color: COLORS.success,
    tagline: "Find every scoped artifact.",
    desc: "Map documents, chunks, jobs, caches, traces, graph edges, tools, releases, and admin routes.",
  },
  {
    num: "02",
    title: "Envelope",
    color: COLORS.iris,
    tagline: "Choose one active domain.",
    desc: "Resolve the active domain at the edge, sign it, and treat the envelope as immutable downstream.",
  },
  {
    num: "03",
    title: "Propagate",
    color: COLORS.violet,
    tagline: "Preserve the label.",
    desc: "Bind retrieval, memory, tools, graph traversal, cache keys, jobs, review, and telemetry to the active domain.",
  },
  {
    num: "04",
    title: "Fail Closed",
    color: COLORS.info,
    tagline: "Reject ambiguity.",
    desc: "Block missing scope, forged scope, global fallback, body overrides, unlabeled graph edges, and cache bleed.",
  },
  {
    num: "05",
    title: "Publish",
    color: COLORS.cyan,
    tagline: "Share by materialization.",
    desc: "Move shared knowledge through explicit publication into domain-local copies with provenance.",
  },
] as const;

function EngineeringSection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.1 });

  return (
    <FullSection id="readiness">
      <div ref={ref} className="w-full max-w-7xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, ease: EASE }}
          className="text-center mb-9"
        >
          <p
            className="mb-3 text-[10px] font-bold uppercase tracking-[0.22em] text-primary"
            style={{ fontFamily: HEADING }}
          >
            Conformance Path
          </p>
          <h2
            className="mb-3 text-xl font-extrabold leading-snug tracking-[-0.015em] text-foreground sm:text-2xl"
            style={{ fontFamily: HEADING }}
          >
            Make isolation observable.{" "}
            <span className="text-primary">Then enforce it.</span>
          </h2>
          <p className="mx-auto max-w-xl text-sm leading-relaxed text-muted-foreground/66">
            The migration path from domain-aware RAG to HKI-conformant agentic
            runtime.
          </p>
        </motion.div>

        {/* Pipeline — horizontal on desktop, vertical on mobile */}
        <div className="relative">
          {/* Connecting line — desktop */}
          <motion.div
            initial={{ scaleX: 0 }}
            animate={inView ? { scaleX: 1 } : {}}
            transition={{ duration: 1.2, delay: 0.3, ease: EASE }}
            className="absolute left-[10%] right-[10%] top-10 hidden h-px origin-left sm:block"
            style={{
              background: "var(--primary)",
            }}
          />

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-5 sm:gap-5">
            {JOURNEY_STEPS.map((step, i) => (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, y: 24 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{
                  duration: 0.45,
                  delay: 0.15 + i * 0.1,
                  ease: EASE,
                }}
                className="flex flex-col items-center sm:items-start text-center sm:text-left"
              >
                {/* Step circle — sits on the connecting line */}
                <div
                  className="relative z-10 mb-5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full
                             text-sm font-extrabold text-primary-foreground
                             ring-[5px] ring-background dark:ring-background shadow-sm"
                  style={{ backgroundColor: step.color, fontFamily: HEADING }}
                >
                  {step.num}
                </div>

                <div className="px-2">
                  <h3
                    className="mb-2 text-base font-extrabold leading-snug text-foreground"
                    style={{ fontFamily: HEADING }}
                  >
                    {step.title}
                  </h3>
                  <p
                    className="mb-2.5 text-sm font-semibold leading-relaxed"
                    style={{ color: step.color }}
                  >
                    {step.tagline}
                  </p>
                  <p className="text-[13px] leading-relaxed text-muted-foreground/65">
                    {step.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </FullSection>
  );
}

// ── Role Outcomes ─────────────────────────────────────────────────────────────

function RolesSection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.1 });

  return (
    <FullSection id="roles">
      <div ref={ref} className="w-full max-w-6xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, ease: EASE }}
          className="text-center mb-8"
        >
          <p
            className="mb-3 text-[10px] font-bold uppercase tracking-[0.22em] text-primary"
            style={{ fontFamily: HEADING }}
          >
            Useful by Role
          </p>
          <h2
            className="mb-3 text-xl font-extrabold leading-snug tracking-[-0.015em] text-foreground sm:text-2xl"
            style={{ fontFamily: HEADING }}
          >
            Builders, stewards, and auditors.{" "}
            <span className="text-primary">Same contract.</span>
          </h2>
          <p className="mx-auto max-w-xl text-sm leading-relaxed text-muted-foreground/66">
            HKI is useful when it gives every operator a concrete control
            surface, not just an architecture diagram.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {ROLES.map((role, i) => {
            const Icon = role.icon;
            return (
              <motion.div
                key={role.persona}
                initial={{ opacity: 0, y: 20, scale: 0.97 }}
                animate={inView ? { opacity: 1, y: 0, scale: 1 } : {}}
                transition={{
                  duration: 0.4,
                  delay: 0.08 + i * 0.1,
                  ease: EASE,
                }}
                whileHover={{ scale: 1.02, y: -4 }}
                className="group relative flex h-full flex-col rounded-lg border p-5
                           bg-card dark:bg-card/95 backdrop-blur-sm
                           border-border/60 dark:border-border/40
                           shadow-sm hover:shadow-xl
                           transition-all duration-300"
                style={{
                  boxShadow: HAIRLINE_SHADOW,
                }}
                onMouseEnter={e => {
                  const card = e.currentTarget as HTMLElement;
                  card.style.backgroundColor = colorMix(
                    role.color,
                    6,
                    "var(--card)"
                  );
                  card.style.borderColor = colorMix(
                    role.color,
                    46,
                    "var(--border)"
                  );
                  card.style.boxShadow = RAISED_SHADOW;
                }}
                onMouseLeave={e => {
                  const card = e.currentTarget as HTMLElement;
                  card.style.backgroundColor = "";
                  card.style.borderColor = "";
                  card.style.boxShadow = HAIRLINE_SHADOW;
                }}
              >
                {/* Accent top bar */}
                <div
                  className="absolute left-5 right-5 top-0 h-px rounded-full opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  style={{
                    background: accentGradient(role.color),
                  }}
                />

                {/* Role icon + persona */}
                <div className="mb-4 flex items-center gap-3">
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                    style={{
                      backgroundColor: colorMix(role.color, 12),
                      border: `1px solid ${colorMix(role.color, 24, "var(--border)")}`,
                    }}
                  >
                    <Icon className="h-4 w-4" style={{ color: role.color }} />
                  </div>
                  <span
                    className="text-xs font-extrabold uppercase tracking-[0.18em]"
                    style={{ color: role.color, fontFamily: HEADING }}
                  >
                    {role.persona}
                  </span>
                </div>

                {/* Role headline */}
                <h3
                  className="mb-4 text-base font-bold leading-snug text-foreground"
                  style={{ fontFamily: HEADING }}
                >
                  {role.title}
                </h3>

                {/* Divider */}
                <div className="mb-4 h-px bg-border/20" />

                {/* Actions */}
                <ul className="mt-auto space-y-2.5">
                  {role.actions.map(action => {
                    const ActionIcon = action.icon;
                    return (
                      <li
                        key={action.text}
                        className="flex items-start gap-2.5"
                      >
                        <div
                          className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5"
                          style={{
                            backgroundColor: colorMix(role.color, 10),
                            border: `1px solid ${colorMix(role.color, 24, "var(--border)")}`,
                          }}
                        >
                          <ActionIcon
                            className="w-3 h-3"
                            style={{ color: role.color }}
                          />
                        </div>
                        <span className="text-sm text-muted-foreground dark:text-muted-foreground/85 leading-relaxed">
                          {action.text}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </motion.div>
            );
          })}
        </div>
      </div>
    </FullSection>
  );
}

// ── CTA — finale, brand-weight ────────────────────────────────────────────────

function CTASection({ onNavigate }: { onNavigate: (path: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });

  return (
    <FullSection>
      <div ref={ref} className="w-full max-w-4xl mx-auto text-center px-4">
        {/* Brand bar */}
        <motion.div
          initial={{ opacity: 0, scaleX: 0.3 }}
          animate={inView ? { opacity: 1, scaleX: 1 } : {}}
          transition={{ duration: 0.7, ease: EASE }}
          className="mx-auto mb-8 h-px w-16 rounded-full"
          style={{
            background: "var(--primary)",
          }}
        />

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.1, ease: EASE }}
        >
          <HkiMark size={42} variant="color" className="mx-auto mb-8" />

          <h2
            className="mb-5 text-2xl font-extrabold leading-snug tracking-[-0.02em] text-foreground sm:text-3xl"
            style={{ fontFamily: HEADING }}
          >
            Make agentic isolation
            <br />
            <span className="text-primary">auditable by default.</span>
          </h2>

          <p className="mx-auto mb-9 max-w-md text-sm leading-relaxed text-muted-foreground/66">
            HKI turns "domain-aware" from a claim into a release gate: one
            active domain, exact-domain visibility, publication-only sharing.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href={HKI_STANDARD_ROUTE}
              onClick={e => {
                e.preventDefault();
                onNavigate(HKI_STANDARD_ROUTE);
              }}
              className="group inline-flex items-center gap-2.5 px-8 py-4 rounded-xl
                         border border-border/60 bg-card/70 backdrop-blur-sm
                         text-foreground text-sm font-semibold
                         hover:border-primary/35 hover:bg-card
                         hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300"
            >
              Read the Standard
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </a>
            <a
              href={LIVE_AGENT_ROUTE}
              onClick={e => {
                e.preventDefault();
                onNavigate(LIVE_AGENT_ROUTE);
              }}
              className="group inline-flex items-center gap-2.5 px-8 py-4 rounded-xl
                         relative overflow-hidden isolate text-sm font-semibold
                         ring-1 ring-black/10 dark:ring-white/10 shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/25
                         hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300"
              style={{
                background: LIVE_AGENT_BACKGROUND,
              }}
            >
              <span aria-hidden className="hidden" />
              <span className={LIVE_AGENT_CONTENT_CLASS}>
                <span className="inline-flex items-center gap-1.5">
                  <span className={LIVE_AGENT_DOT_CLASS} />
                  Run Reference Flow
                </span>
                <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
              </span>
            </a>
          </div>

          {/* Trust line */}
          <p className="mt-10 text-[10px] text-muted-foreground/25 tracking-[0.15em] font-medium uppercase">
            Open standard · Reference implementation · Conformance tests
          </p>
        </motion.div>
      </div>
    </FullSection>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────

export default function AgenticPlatformLanding() {
  usePageMeta("HKI — Hermetic Knowledge Isolation");
  const [, setLocation] = useLocation();
  const navigate = useCallback(
    (path: string) => setLocation(path),
    [setLocation]
  );

  return (
    <div className="relative h-screen snap-y snap-proximity overflow-x-hidden overflow-y-auto scroll-smooth text-foreground selection:bg-primary/30">
      {/* z-0 — fixed canvas grid background */}
      <AgenticGrid />
      {/* z-50 — sticky nav; grid disabled here */}
      <div data-no-grid>
        <Nav onNavigate={navigate} />
      </div>
      {/* Hero: grid interaction active */}
      <HeroSection onNavigate={navigate} />
      {/* Dense sections: grid disabled */}
      <div data-no-grid>
        <RiskSection />
        <CapabilitiesSection onNavigate={navigate} />
        <EngineeringSection />
        <RolesSection />
        <CTASection onNavigate={navigate} />
        <Footer />
      </div>
    </div>
  );
}
