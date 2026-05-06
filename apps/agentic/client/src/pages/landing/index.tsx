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
      className="relative z-10 flex flex-col items-center justify-center py-12 md:py-16"
    >
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6, ease: EASE }}
        className="flex flex-col items-center gap-6"
      >
        {/* Divider line with label */}
        <div className="flex items-center gap-4">
          <motion.div
            initial={{ scaleX: 0 }}
            animate={inView ? { scaleX: 1 } : {}}
            transition={{ duration: 0.8, delay: 0.2, ease: EASE }}
            className="h-px w-12 md:w-20 bg-linear-to-r from-transparent via-border/50 to-border/50 origin-left"
          />
          <span
            className="text-xs font-bold tracking-[0.25em] uppercase text-muted-foreground/50"
            style={{ fontFamily: HEADING }}
          >
            {num} · {label}
          </span>
          <motion.div
            initial={{ scaleX: 0 }}
            animate={inView ? { scaleX: 1 } : {}}
            transition={{ duration: 0.8, delay: 0.2, ease: EASE }}
            className="h-px w-12 md:w-20 bg-linear-to-l from-transparent via-border/50 to-border/50 origin-right"
          />
        </div>

        {/* Scroll indicator */}
        <motion.button
          onClick={scrollToNext}
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ delay: 0.6 }}
          className="flex flex-col items-center gap-1 text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors cursor-pointer group"
          aria-label="Scroll to next section"
        >
          <motion.div
            animate={{ y: [0, 4, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            <ChevronDown className="w-4 h-4" />
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

function PlatformCards({
  inView,
  onNavigate,
}: {
  inView: boolean;
  onNavigate?: (path: string) => void;
}) {
  return (
    <div data-no-grid className="w-full grid grid-cols-2 md:grid-cols-3 gap-5">
      {VISIBLE_LAYERS.map((layer, i) => {
        const Icon = layer.icon;
        const hasLink = !!layer.link;
        const status = STATUS_META[layer.status];
        return (
          <motion.div
            key={layer.id}
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.45, delay: 0.08 + i * 0.07, ease: EASE }}
            whileHover={{ scale: 1.025, y: -4 }}
            className={cn(
              "group relative flex flex-col gap-4 p-6 rounded-2xl border-2",
              "bg-card dark:bg-card/95 backdrop-blur-sm",
              "border-border/60 dark:border-border/40",
              "shadow-sm hover:shadow-xl transition-all duration-300",
              hasLink ? "cursor-pointer" : "cursor-default"
            )}
            style={{
              boxShadow: HAIRLINE_SHADOW,
            }}
            onMouseEnter={e => {
              const card = e.currentTarget as HTMLElement;
              card.style.backgroundColor = colorMix(
                layer.color,
                6,
                "var(--card)"
              );
              card.style.borderColor = colorMix(
                layer.color,
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
            onClick={() => {
              if (!layer.link) return;
              if (layer.link.startsWith("http")) {
                window.open(layer.link, "_blank", "noopener,noreferrer");
              } else {
                onNavigate?.(layer.link);
              }
            }}
          >
            {/* Accent top bar */}
            <div
              className="absolute top-0 left-6 right-6 h-0.75 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              style={{
                background: accentGradient(layer.color),
              }}
            />

            {/* Icon + label row */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                  style={{
                    backgroundColor: colorMix(layer.color, 12),
                    border: `1px solid ${colorMix(layer.color, 24, "var(--border)")}`,
                  }}
                >
                  <Icon
                    className="w-5.5 h-5.5"
                    style={{ color: layer.color }}
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p
                      className="text-[15px] font-bold leading-tight text-foreground
                                 group-hover:opacity-90 transition-opacity duration-200"
                      style={{ fontFamily: HEADING }}
                    >
                      {layer.label}
                    </p>
                    {!!status && (
                      <span
                        className={cn(
                          "text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md",
                          status.className
                        )}
                      >
                        {status.label}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Subtitle */}
            <p className="text-[13px] leading-relaxed text-muted-foreground dark:text-muted-foreground/85">
              {layer.subtitle}
            </p>
            <p className="text-[11px] leading-relaxed text-muted-foreground/75">
              <span className="font-semibold text-foreground/80">
                Best for:
              </span>{" "}
              {layer.useCase}
            </p>

            {/* Tech Stack */}
            {layer.techStack && layer.techStack.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {layer.techStack.map(tech => (
                  <span
                    key={tech}
                    className="text-[10px] font-medium px-2 py-0.5 rounded-md
                               bg-muted/40 text-muted-foreground/70
                               border border-border/40"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            )}

            {/* Capabilities */}
            <ul className="flex flex-wrap gap-x-3 gap-y-2">
              {layer.capabilities.slice(0, 4).map(cap => {
                const isLive = (
                  layer.selfService as readonly string[] | undefined
                )?.includes(cap);
                return (
                  <li key={cap} className="flex items-center gap-1.5">
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{
                        backgroundColor: isLive
                          ? layer.color
                          : colorMix(layer.color, 32),
                        border: `1px solid ${colorMix(layer.color, isLive ? 28 : 20, "var(--border)")}`,
                      }}
                    />
                    <span
                      className="text-[11px] font-medium leading-tight"
                      style={{
                        color: isLive
                          ? `${layer.color}`
                          : "hsl(var(--muted-foreground))",
                        opacity: isLive ? 0.95 : 0.7,
                      }}
                    >
                      {cap}
                    </span>
                  </li>
                );
              })}
            </ul>
            {hasLink && (
              <div className="mt-auto pt-1">
                <span
                  className="inline-flex items-center gap-1.5 text-[11px] font-semibold opacity-75 group-hover:opacity-100 transition-opacity duration-200"
                  style={{ color: layer.color }}
                >
                  {layer.linkLabel ?? "Explore"}
                  <ArrowRight className="w-3 h-3" />
                </span>
              </div>
            )}
          </motion.div>
        );
      })}
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
  const scrollToFeatures = useCallback(() => {
    document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
  }, []);

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

      {/* Scroll indicator — outside the no-grid zone */}
      <motion.button
        onClick={scrollToFeatures}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 hidden sm:flex flex-col items-center gap-2
             text-muted-foreground/55 dark:text-muted-foreground/45 hover:text-primary/70 transition-colors duration-200 cursor-pointer group"
        aria-label="Scroll to explore platforms"
      >
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] group-hover:text-primary/70 transition-colors">
          Explore Framework
        </span>
        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          className="flex flex-col items-center gap-0.5"
        >
          <ChevronDown className="w-4 h-4" />
          <ChevronDown className="w-3 h-3 opacity-50" />
        </motion.div>
      </motion.button>
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
    <FullSection id="features">
      <div
        ref={ref}
        className="w-full max-w-6xl mx-auto flex flex-col items-center px-4"
      >
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
            Open Runtime Standard
          </p>
          <h2
            className="text-3xl sm:text-4xl font-extrabold tracking-[-0.025em] text-foreground leading-tight mb-4"
            style={{ fontFamily: HEADING }}
          >
            {PLATFORM_LAYER_COUNT} enforcement surfaces.{" "}
            <span className="text-primary">One isolation law.</span>
          </h2>
          <p className="text-base text-muted-foreground/60 max-w-2xl mx-auto leading-relaxed mb-3">
            From signed scope envelopes to publication workflows, HKI makes
            isolation testable across every agentic transformation.
          </p>
          <div className="flex items-center justify-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="text-muted-foreground/70">
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  Live
                </span>{" "}
                = implemented in the reference stack
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-muted-foreground/30"></span>
              <span className="text-muted-foreground/70">
                Status chips indicate implemented, API-only, or planned
              </span>
            </div>
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
      <SectionMarker num="01" label="Framework" />
      {/* Dense sections: grid disabled */}
      <div data-no-grid>
        <CapabilitiesSection onNavigate={navigate} />
        <SectionMarker num="02" label="Engineering" />
        <EngineeringSection />
        <SectionMarker num="03" label="Impact" />
        <RolesSection />
        <SectionMarker num="04" label="Adopt" />
        <CTASection onNavigate={navigate} />
        <Footer />
      </div>
    </div>
  );
}
