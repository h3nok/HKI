/**
 * AgenticPlatformLanding — Public HKI framework landing page.
 *
 * Hero → Framework → Conformance Path → Roles → CTA
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { usePageMeta } from "@/hooks/usePageMeta";
import { AnimatePresence, motion, useInView } from "framer-motion";
import { ArrowRight, ChevronDown } from "lucide-react";
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
  return `linear-gradient(90deg, transparent, ${color}, transparent)`;
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
      className={`relative z-10 flex flex-col items-center justify-center px-6 md:px-12 py-16 md:py-20 overflow-visible ${className}`}
    >
      {children}
    </section>
  );
}

// ── Section marker — numbered visual break between sections ───────────────────

function SectionMarker({ num, label }: { num: string; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });

  const scrollToNext = useCallback(() => {
    const current = ref.current;
    if (!current) return;
    const next = current.nextElementSibling as HTMLElement;
    if (next) {
      next.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  return (
    <div
      ref={ref}
      className="relative z-10 flex flex-col items-center justify-center py-8 md:py-10"
    >
      <div
        aria-hidden
        className="absolute left-0 right-0 top-1/2 h-px bg-linear-to-r from-transparent via-border/45 to-transparent"
      />
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6, ease: EASE }}
        className="relative flex flex-col items-center"
      >
        <motion.button
          onClick={scrollToNext}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={inView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.55, delay: 0.15, ease: EASE }}
          className="group relative inline-flex items-center gap-3 rounded-full border border-border/55 bg-background/78 px-4 py-2 shadow-sm backdrop-blur-xl transition-all duration-200 hover:border-primary/30 hover:bg-card/92 hover:shadow-md"
          aria-label={`Scroll to ${label}`}
        >
          <span
            className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary/80"
            style={{ fontFamily: HEADING }}
          >
            {num}
          </span>
          <span className="h-1 w-1 rounded-full bg-primary/45" />
          <span
            className="text-[11px] font-bold uppercase tracking-[0.16em] text-foreground/72 transition-colors group-hover:text-foreground"
            style={{ fontFamily: HEADING }}
          >
            {label}
          </span>
          <motion.div
            animate={{ y: [0, 4, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/55 transition-colors group-hover:text-primary" />
          </motion.div>
        </motion.button>
      </motion.div>
    </div>
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
const LIVE_AGENT_BACKGROUND =
  "linear-gradient(135deg, color-mix(in srgb, var(--primary) 86%, #003c3a) 0%, color-mix(in srgb, var(--primary) 58%, #334155) 100%)";
const STATUS_META = {
  live: {
    label: "Live",
    className:
      "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30",
  },
  api: {
    label: "API Only",
    className:
      "bg-blue-500/12 text-blue-600 dark:text-blue-400 border border-blue-500/30",
  },
  planned: {
    label: "Planned",
    className:
      "bg-slate-500/12 text-slate-600 dark:text-slate-300 border border-slate-500/25",
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
          className="relative overflow-hidden rounded-lg border border-border/60 bg-card/82 p-5 shadow-2xl shadow-black/10 backdrop-blur-xl dark:bg-card/88 dark:shadow-black/35 sm:p-6 lg:p-7"
          style={{
            borderColor: colorMix(activeLayer.color, 32, "var(--border)"),
            background: `linear-gradient(135deg, ${colorMix(activeLayer.color, 11, "var(--card)")} 0%, var(--card) 48%, ${colorMix(activeLayer.color, 6, "var(--background)")} 100%)`,
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
              backgroundImage: `linear-gradient(${colorMix(activeLayer.color, 16)} 1px, transparent 1px), linear-gradient(90deg, ${colorMix(activeLayer.color, 14)} 1px, transparent 1px)`,
              backgroundSize: "44px 44px",
            }}
          />

          <div className="relative flex min-h-130 flex-col">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-lg border shadow-lg"
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
                    className="h-6 w-6"
                    style={{ color: activeLayer.color }}
                  />
                </div>
                <div>
                  <p
                    className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.2em] text-muted-foreground/65"
                    style={{ fontFamily: HEADING }}
                  >
                    Surface {String(activeIndex + 1).padStart(2, "0")}
                  </p>
                  <h3
                    className="text-2xl font-extrabold leading-tight text-foreground sm:text-3xl"
                    style={{ fontFamily: HEADING }}
                  >
                    {activeLayer.label}
                  </h3>
                </div>
              </div>
              <SurfaceStatusBadge status={activeLayer.status} />
            </div>

            <div className="mt-8 max-w-xl">
              <p className="text-lg font-semibold leading-relaxed text-foreground/88">
                {activeLayer.subtitle}
              </p>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground/72">
                {activeLayer.description}
              </p>
              <p className="mt-5 text-sm leading-relaxed text-muted-foreground/78">
                <span className="font-semibold text-foreground/85">
                  Best for:
                </span>{" "}
                {activeLayer.useCase}
              </p>
            </div>

            <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {activeLayer.capabilities.slice(0, 6).map((capability, index) => {
                const isLive = selfService.includes(capability);
                return (
                  <div
                    key={capability}
                    className="group relative overflow-hidden rounded-md border border-border/45 bg-background/42 px-3.5 py-3 backdrop-blur-sm transition-colors duration-200 hover:bg-background/66"
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
                      <span className="text-sm font-semibold leading-tight text-foreground/86">
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
                    <Icon
                      className="h-4.5 w-4.5"
                      style={{ color: layer.color }}
                    />
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

// ── Animated count-up for stats ───────────────────────────────────────────────

function CountUp({ to, suffix = "" }: { to: number; suffix?: string }) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });

  useEffect(() => {
    if (!inView) return;
    const start = performance.now();
    const duration = 1200;
    const raf = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      setVal(Math.round(ease * to));
      if (t < 1) requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);
  }, [inView, to]);

  return (
    <span ref={ref}>
      {val}
      {suffix}
    </span>
  );
}

// ── Hero ──────────────────────────────────────────────────────────────────────

const STATS = [
  { value: PLATFORM_LAYER_COUNT, suffix: "", label: "Framework Surfaces" },
  { value: PLATFORM_CAPABILITY_COUNT, suffix: "", label: "Capabilities" },
  { value: 3, suffix: "", label: "Persona Roles" },
  { value: 100, suffix: "%", label: "Vendor Neutral" },
] as const;

function HeroSection({ onNavigate }: { onNavigate: (path: string) => void }) {
  return (
    <section className="relative z-10 flex flex-col items-center justify-center min-h-[calc(100svh-170px)] sm:min-h-[calc(100vh-220px)] px-6 text-center">
      {/* Content block — grid disabled here; outer section whitespace stays interactive */}
      <div data-no-grid className="flex flex-col items-center">
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
          className="text-3xl sm:text-4xl lg:text-[3.25rem] font-extrabold tracking-[-0.03em] leading-[1.1] mb-5 max-w-3xl"
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
          className="text-sm sm:text-[15px] text-muted-foreground/60 max-w-sm mb-10 leading-relaxed"
        >
          An open implementation standard for secure enterprise agentic
          platforms, cloud teams, and AI service providers: signed domains,
          scoped RAG, MCP tools, memory, caches, traces, and explicit knowledge
          publication.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.45, ease: EASE }}
          className="flex flex-col sm:flex-row items-center gap-3 mb-16"
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
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-linear-to-r from-white/0 via-white/35 to-white/0
                         translate-x-[-180%] group-hover:translate-x-[620%] transition-transform duration-700 ease-out"
            />
            <span className={LIVE_AGENT_CONTENT_CLASS}>
              <span className="inline-flex items-center gap-1.5">
                <span className={LIVE_AGENT_DOT_CLASS} />
                Run Reference Flow
              </span>
              <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
            </span>
          </a>
        </motion.div>
      </div>
      {/* end data-no-grid */}
    </section>
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
    <FullSection id="features" className="py-12 md:py-14">
      <div ref={ref} className="w-full max-w-7xl mx-auto flex flex-col px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, ease: EASE }}
          className="mb-9"
        >
          <p
            className="mb-4 text-xs font-bold uppercase tracking-[0.3em] text-primary"
            style={{ fontFamily: HEADING }}
          >
            Architecture
          </p>
          <h2
            className="max-w-4xl text-3xl font-extrabold leading-tight tracking-[-0.025em] text-foreground sm:text-4xl lg:text-[3.25rem]"
            style={{ fontFamily: HEADING }}
          >
            {PLATFORM_LAYER_COUNT} layers in your stack.{" "}
            <span className="text-primary">One isolation rule.</span>
          </h2>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted-foreground/66">
            HKI specifies exactly where domain isolation must hold — from the
            signed scope envelope at the edge to cache keys, graph edges, tool
            calls, and audit traces. Each layer has concrete controls and a
            conformance check.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <CountUp to={LIVE_LAYER_COUNT} /> layers live in the reference
              stack
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-[11px] font-bold text-sky-600 dark:text-sky-400">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
              <CountUp to={API_LAYER_COUNT} /> API-only
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-muted/40 px-3 py-1 text-[11px] font-bold text-muted-foreground/80">
              <CountUp to={PLATFORM_CAPABILITY_COUNT} /> total controls across
              all layers
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
          className="text-center mb-12"
        >
          <p
            className="text-xs font-bold uppercase tracking-[0.3em] text-primary mb-4"
            style={{ fontFamily: HEADING }}
          >
            Conformance Path
          </p>
          <h2
            className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-[-0.025em] text-foreground leading-tight mb-5"
            style={{ fontFamily: HEADING }}
          >
            Make isolation observable.{" "}
            <span className="text-primary">Then enforce it.</span>
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground/60 max-w-2xl mx-auto leading-relaxed">
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
            className="hidden sm:block absolute top-14 left-[10%] right-[10%] h-0.5 origin-left"
            style={{
              background: `linear-gradient(to right, ${COLORS.success}, ${COLORS.iris}, ${COLORS.violet}, ${COLORS.info}, ${COLORS.cyan})`,
            }}
          />

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-8 sm:gap-6">
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
                  className="w-14 h-14 rounded-full flex items-center justify-center
                             text-base font-extrabold text-primary-foreground mb-6 shrink-0 relative z-10
                             ring-[6px] ring-background dark:ring-background shadow-lg"
                  style={{ backgroundColor: step.color, fontFamily: HEADING }}
                >
                  {step.num}
                </div>

                <div className="px-2">
                  <h3
                    className="text-lg font-extrabold text-foreground mb-2 leading-snug"
                    style={{ fontFamily: HEADING }}
                  >
                    {step.title}
                  </h3>
                  <p
                    className="text-sm font-semibold mb-3 leading-relaxed"
                    style={{ color: step.color }}
                  >
                    {step.tagline}
                  </p>
                  <p className="text-sm text-muted-foreground/65 leading-relaxed">
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
          className="text-center mb-10"
        >
          <p
            className="text-xs font-bold uppercase tracking-[0.3em] text-primary mb-4"
            style={{ fontFamily: HEADING }}
          >
            Useful by Role
          </p>
          <h2
            className="text-3xl sm:text-4xl font-extrabold tracking-[-0.025em] text-foreground leading-tight mb-4"
            style={{ fontFamily: HEADING }}
          >
            Builders, stewards, and auditors.{" "}
            <span className="text-primary">Same contract.</span>
          </h2>
          <p className="text-base text-muted-foreground/60 max-w-2xl mx-auto leading-relaxed">
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
                className="group relative flex flex-col h-full p-6 rounded-2xl border-2
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
                  className="absolute top-0 left-6 right-6 h-0.75 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{
                    background: accentGradient(role.color),
                  }}
                />

                {/* Role icon + persona */}
                <div className="flex items-center gap-3 mb-5">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{
                      backgroundColor: colorMix(role.color, 12),
                      border: `1px solid ${colorMix(role.color, 24, "var(--border)")}`,
                    }}
                  >
                    <Icon className="w-5 h-5" style={{ color: role.color }} />
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
                  className="text-base font-bold text-foreground leading-snug mb-5"
                  style={{ fontFamily: HEADING }}
                >
                  {role.title}
                </h3>

                {/* Divider */}
                <div className="h-px bg-border/20 mb-4" />

                {/* Actions */}
                <ul className="space-y-3 mt-auto">
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
          className="h-0.75 w-20 mx-auto mb-10 rounded-full"
          style={{
            background: `linear-gradient(to right, ${COLORS.iris}, ${COLORS.cyan})`,
          }}
        />

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.1, ease: EASE }}
        >
          <HkiMark size={48} variant="color" className="mx-auto mb-10" />

          <h2
            className="text-4xl sm:text-5xl font-extrabold tracking-[-0.03em] text-foreground mb-6 leading-tight"
            style={{ fontFamily: HEADING }}
          >
            Make agentic isolation
            <br />
            <span className="text-primary">auditable by default.</span>
          </h2>

          <p className="text-base text-muted-foreground/60 mb-12 max-w-md mx-auto leading-relaxed">
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
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-linear-to-r from-white/0 via-white/35 to-white/0
                           translate-x-[-180%] group-hover:translate-x-[620%] transition-transform duration-700 ease-out"
              />
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
    <div className="relative min-h-screen text-foreground overflow-x-hidden selection:bg-primary/30">
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
        <CTASection onNavigate={navigate} />
        <Footer />
      </div>
    </div>
  );
}
