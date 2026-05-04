/**
 * AgenticPlatformLanding — Full-screen sectioned landing page.
 *
 * Hero → Stats → Platform → Engineering Pipeline → Roles → CTA
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { usePageMeta } from "@/hooks/usePageMeta";
import { AnimatePresence, motion, useInView } from "framer-motion";
import { ArrowRight, ChevronDown } from "lucide-react";
import { cn, COSTCO_BLUE, COSTCO_RED } from "@hki/ui";

import { Nav } from "./nav";
import { Footer } from "./cta";
import { AgenticGrid } from "./agentic-grid";
import { STACK_LAYERS, ROLES, EASE } from "./constants";
import { AgenticIcon } from "@/components/ui/icons/AgenticIcon";

const HEADING = "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif";

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

// ── Platform Cards ────────────────────────────────────────────────────────────

const VISIBLE_LAYERS = STACK_LAYERS.filter(l => l.id !== "model");
const PLATFORM_LAYER_COUNT = VISIBLE_LAYERS.length;
const PLATFORM_CAPABILITY_COUNT = VISIBLE_LAYERS.reduce(
  (total, layer) => total + layer.capabilities.length,
  0
);
const LIVE_AGENT_STARTER =
  "What can this agent do for my team today? Show me an example workflow.";
const LIVE_AGENT_ROUTE = `/chat?scope=global&starter=${encodeURIComponent(LIVE_AGENT_STARTER)}`;
const LIVE_AGENT_CONTENT_CLASS =
  "relative z-10 inline-flex items-center gap-2.5 tracking-[0.01em] text-primary-foreground";
const LIVE_AGENT_DOT_CLASS =
  "w-1.5 h-1.5 rounded-full animate-pulse bg-primary-foreground/80";
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
      "bg-amber-500/12 text-amber-600 dark:text-amber-400 border border-amber-500/30",
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
              boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
            }}
            onMouseEnter={e => {
              const card = e.currentTarget as HTMLElement;
              card.style.backgroundColor = `${layer.color}0f`;
              card.style.borderColor = `${layer.color}88`;
              card.style.boxShadow = `0 12px 40px -8px ${layer.color}35, 0 4px 12px ${layer.color}20`;
            }}
            onMouseLeave={e => {
              const card = e.currentTarget as HTMLElement;
              card.style.backgroundColor = "";
              card.style.borderColor = "";
              card.style.boxShadow = "0 1px 2px rgba(0,0,0,0.05)";
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
                background: `linear-gradient(90deg, ${layer.color}00, ${layer.color}, ${layer.color}00)`,
              }}
            />

            {/* Icon + label row */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                  style={{
                    backgroundColor: `${layer.color}20`,
                    border: `1px solid ${layer.color}30`,
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
                          : `${layer.color}50`,
                        border: `1px solid ${isLive ? `${layer.color}40` : `${layer.color}30`}`,
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
  { value: PLATFORM_LAYER_COUNT, suffix: "", label: "Platform Layers" },
  { value: PLATFORM_CAPABILITY_COUNT, suffix: "", label: "Capabilities" },
  { value: 3, suffix: "", label: "Persona Roles" },
  { value: 100, suffix: "%", label: "GCP Native" },
] as const;

function HeroSection({ onNavigate }: { onNavigate: (path: string) => void }) {
  const scrollToFeatures = useCallback(() => {
    document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
  }, []);

  return (
    <section className="relative z-10 flex flex-col items-center justify-center min-h-[calc(100vh-64px)] px-6 text-center">
      {/* Content block — grid disabled here; outer section whitespace stays interactive */}
      <div data-no-grid className="flex flex-col items-center">
        {/* Icon */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: EASE }}
          className="mb-8"
        >
          <AgenticIcon size={44} />
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15, ease: EASE }}
          className="text-3xl sm:text-4xl lg:text-[3.25rem] font-extrabold tracking-[-0.03em] leading-[1.1] mb-5 max-w-3xl"
          style={{ fontFamily: HEADING }}
        >
          <span className="text-primary">HKI</span>{" "}
          <span className="text-secondary">Agentic</span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3, ease: EASE }}
          className="text-sm sm:text-[15px] text-muted-foreground/60 max-w-sm mb-10 leading-relaxed"
        >
          Enterprise AI for the world's largest membership retailer. One
          platform — every department.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.45, ease: EASE }}
          className="flex flex-col sm:flex-row items-center gap-3 mb-16"
        >
          <a
            href="/admin"
            onClick={e => {
              e.preventDefault();
              onNavigate("/admin");
            }}
            className="group inline-flex items-center gap-2.5 px-7 py-3.5 rounded-xl
                     border border-border/60 bg-card/70 backdrop-blur-sm
                     text-foreground text-sm font-semibold
                     hover:border-primary/35 hover:bg-card
                     hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300"
          >
            Get Started
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
                     shadow-[0_8px_24px_-8px_rgba(0,102,178,0.55),0_4px_12px_rgba(227,24,55,0.28)]
                     hover:shadow-[0_12px_30px_-8px_rgba(0,102,178,0.62),0_6px_18px_rgba(227,24,55,0.36)]
                     hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300"
            style={{
              background:
                "linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)",
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
                Try Live Agent
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
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2
                   text-muted-foreground/40 hover:text-primary/70 transition-colors duration-200 cursor-pointer group"
        aria-label="Scroll to explore platforms"
      >
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] group-hover:text-primary/70 transition-colors">
          Explore Platforms
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

// ── Platform Capabilities ─────────────────────────────────────────────────────

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
            Platform Architecture · GCP Native
          </p>
          <h2
            className="text-3xl sm:text-4xl font-extrabold tracking-[-0.025em] text-foreground leading-tight mb-4"
            style={{ fontFamily: HEADING }}
          >
            {PLATFORM_LAYER_COUNT} layers.{" "}
            <span className="text-primary">One platform.</span>
          </h2>
          <p className="text-base text-muted-foreground/60 max-w-2xl mx-auto leading-relaxed mb-3">
            From raw documents to grounded answers — governed, observable,
            secure.
          </p>
          <div className="flex items-center justify-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="text-muted-foreground/70">
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  Live
                </span>{" "}
                = Self-service UI available
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-muted-foreground/30"></span>
              <span className="text-muted-foreground/70">
                Status chips indicate Live, API Only, or Planned
              </span>
            </div>
          </div>
        </motion.div>

        <PlatformCards inView={inView} onNavigate={onNavigate} />
      </div>
    </FullSection>
  );
}

// ── Value Stream Journey — actual agent creation workflow ────────────────────

const JOURNEY_STEPS = [
  {
    num: "01",
    title: "Join Stream",
    color: "#10B981",
    tagline: "5 minutes to access.",
    desc: "Admin sends invite code via email. Accept it, get assigned to your value stream's knowledge base.",
  },
  {
    num: "02",
    title: "Gap Analysis",
    color: COSTCO_BLUE,
    tagline: "AI scans your domain.",
    desc: "AI analyzes your business area and suggests exactly what knowledge your agent needs to be useful.",
  },
  {
    num: "03",
    title: "Ingest Content",
    color: "#8B5CF6",
    tagline: "Drag & drop. No IT ticket.",
    desc: "Upload PDFs, paste SOPs, connect URLs. Auto-chunked, entity-extracted, graph-linked in seconds.",
  },
  {
    num: "04",
    title: "Verify & Test",
    color: "#F59E0B",
    tagline: "See what the agent sees.",
    desc: "Inspect chunks, browse knowledge graph, ask test questions. Validate citations before users do.",
  },
  {
    num: "05",
    title: "Iterate Daily",
    color: "#E31837",
    tagline: "Continuous improvement loop.",
    desc: "Add docs as policies change. Re-run analysis. Track freshness. Your agent gets smarter every week.",
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
            From Idea to Agent
          </p>
          <h2
            className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-[-0.025em] text-foreground leading-tight mb-5"
            style={{ fontFamily: HEADING }}
          >
            Your team builds it.{" "}
            <span className="text-secondary">Self-service.</span>
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground/60 max-w-2xl mx-auto leading-relaxed">
            How value streams create domain agents — from invite code to
            production in days, not months.
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
              background:
                "linear-gradient(to right, #10B981, var(--primary), #8B5CF6, #F59E0B, var(--destructive))",
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
                             text-base font-extrabold text-white mb-6 shrink-0 relative z-10
                             ring-[6px] ring-background dark:ring-[#080a0f] shadow-lg"
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
            className="text-xs font-bold uppercase tracking-[0.3em] text-secondary mb-4"
            style={{ fontFamily: HEADING }}
          >
            Impact by Role
          </p>
          <h2
            className="text-3xl sm:text-4xl font-extrabold tracking-[-0.025em] text-foreground leading-tight mb-4"
            style={{ fontFamily: HEADING }}
          >
            Every team. <span className="text-secondary">Faster.</span>
          </h2>
          <p className="text-base text-muted-foreground/60 max-w-2xl mx-auto leading-relaxed">
            Ask questions, curate knowledge, or manage the platform.
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
                  boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                }}
                onMouseEnter={e => {
                  const card = e.currentTarget as HTMLElement;
                  card.style.backgroundColor = `${role.color}0f`;
                  card.style.borderColor = `${role.color}88`;
                  card.style.boxShadow = `0 12px 40px -8px ${role.color}35, 0 4px 12px ${role.color}20`;
                }}
                onMouseLeave={e => {
                  const card = e.currentTarget as HTMLElement;
                  card.style.backgroundColor = "";
                  card.style.borderColor = "";
                  card.style.boxShadow = "0 1px 2px rgba(0,0,0,0.05)";
                }}
              >
                {/* Accent top bar */}
                <div
                  className="absolute top-0 left-6 right-6 h-0.75 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{
                    background: `linear-gradient(90deg, ${role.color}00, ${role.color}, ${role.color}00)`,
                  }}
                />

                {/* Role icon + persona */}
                <div className="flex items-center gap-3 mb-5">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{
                      backgroundColor: `${role.color}20`,
                      border: `1px solid ${role.color}30`,
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
                            backgroundColor: `${role.color}15`,
                            border: `1px solid ${role.color}30`,
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
            background: `linear-gradient(to right, ${COSTCO_BLUE}, ${COSTCO_RED})`,
          }}
        />

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.1, ease: EASE }}
        >
          <AgenticIcon size={48} className="mx-auto mb-10" />

          <h2
            className="text-4xl sm:text-5xl font-extrabold tracking-[-0.03em] text-foreground mb-6 leading-tight"
            style={{ fontFamily: HEADING }}
          >
            Built for HKI scale.
            <br />
            <span className="text-primary">Ready for yours.</span>
          </h2>

          <p className="text-base text-muted-foreground/60 mb-12 max-w-md mx-auto leading-relaxed">
            Deploy AI that stays in production, gets smarter over time, and
            earns your team's trust.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href="/admin"
              onClick={e => {
                e.preventDefault();
                onNavigate("/admin");
              }}
              className="group inline-flex items-center gap-2.5 px-8 py-4 rounded-xl
                         border border-border/60 bg-card/70 backdrop-blur-sm
                         text-foreground text-sm font-semibold
                         hover:border-primary/35 hover:bg-card
                         hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300"
            >
              Get Started
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
                         shadow-[0_8px_24px_-8px_rgba(0,102,178,0.55),0_4px_12px_rgba(227,24,55,0.28)]
                         hover:shadow-[0_12px_30px_-8px_rgba(0,102,178,0.62),0_6px_18px_rgba(227,24,55,0.36)]
                         hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300"
              style={{
                background:
                  "linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)",
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
                  Try Live Agent
                </span>
                <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
              </span>
            </a>
          </div>

          {/* Trust line */}
          <p className="mt-10 text-[10px] text-muted-foreground/25 tracking-[0.15em] font-medium uppercase">
            GCP-native · Enterprise-grade · Production-ready
          </p>
        </motion.div>
      </div>
    </FullSection>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────

export default function AgenticPlatformLanding() {
  usePageMeta("HKI Agentic — Enterprise AI Platform");
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
      <SectionMarker num="01" label="Platform" />
      {/* Dense sections: grid disabled */}
      <div data-no-grid>
        <CapabilitiesSection onNavigate={navigate} />
        <SectionMarker num="02" label="Engineering" />
        <EngineeringSection />
        <SectionMarker num="03" label="Impact" />
        <RolesSection />
        <SectionMarker num="04" label="Get Started" />
        <CTASection onNavigate={navigate} />
        <Footer />
      </div>
    </div>
  );
}
