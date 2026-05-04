/**
 * Engineering Hub — Innovation Engineering portal.
 *
 * Root entry point at "/". Showcases every platform the Engineering
 * team owns. To add a new platform, append one entry to SHOWCASES.
 *
 * Uses @hki/ui primitives throughout: Topbar, HkiCard, Button,
 * COSTCO_BLUE/RED, hub tokens, CSS custom properties.
 */

import { useCallback } from "react";
import { useLocation } from "wouter";
import { usePageMeta } from "@/hooks/usePageMeta";
import { motion } from "framer-motion";
import {
  ArrowRight,
  ExternalLink,
  Cpu,
  Eye,
  Moon,
  Sun,
  type LucideIcon,
} from "lucide-react";
import {
  Topbar,
  HkiCard,
  Button,
  COSTCO_BLUE,
  COSTCO_RED,
  hub,
  cn,
} from "@hki/ui";
import { AgenticIcon } from "@/components/ui/icons/AgenticIcon";
import { DigitalWarehouse } from "@/pages/landing/digital-warehouse";
import { useTheme } from "@/contexts/ThemeContext";

// ─── Showcase config ──────────────────────────────────────────────────────────
//
// ADD A PLATFORM: append one Showcase object here.
// Every other part of this page — grid, stats, nav — derives from this array.

export interface Showcase {
  id: string;
  title: string;
  tagline: string;
  description: string;
  icon: LucideIcon;
  accent: string; // hex — use HKI brand colors where possible
  status: "live" | "beta" | "dev" | "coming-soon";
  launchHref: string;
  launchExternal?: boolean;
  landingHref?: string; // optional deep-dive page
  landingLabel?: string; // CTA label, default "Platform Overview"
  metrics?: { value: string; label: string }[];
  tags: readonly string[];
}

export const SHOWCASES: Showcase[] = [
  {
    id: "agentic-ai",
    title: "Agentic AI",
    tagline: "Enterprise intelligence platform",
    description:
      "Agents, model gateway, knowledge engine, and governance — built for HKI.",
    icon: Cpu,
    accent: COSTCO_BLUE,
    status: "dev",
    launchHref: "/chat?scope=hki-pilot",
    landingHref: "/",
    landingLabel: "Platform Overview",
    metrics: [
      { value: "6", label: "Platform Layers" },
      { value: "30+", label: "Capabilities" },
    ],
    tags: ["RAG", "Agents", "Knowledge", "Governance", "LLM Gateway"],
  },
  {
    id: "hki-vision",
    title: "HKI Vision",
    tagline: "Visual AI at warehouse scale",
    description:
      "Computer vision for inventory, quality assurance, and warehouse operations.",
    icon: Eye,
    accent: COSTCO_RED,
    status: "coming-soon",
    launchHref: "#",
    tags: ["Computer Vision", "Inventory", "Quality Control", "Real-time"],
  },
  // ── Add the next platform below ──────────────────────────────────────────
  // {
  //   id:           "platform-id",
  //   title:        "Platform Name",
  //   tagline:      "One-line value prop",
  //   description:  "...",
  //   icon:         SomeLucideIcon,
  //   accent:       COSTCO_BLUE,   // or COSTCO_RED, or a semantic accent
  //   status:       "coming-soon",
  //   launchHref:   "/path",
  //   tags:         ["Tag 1", "Tag 2"],
  // },
];

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_META: Record<
  Showcase["status"],
  { label: string; color: string; bg: string }
> = {
  live: { label: "Live", color: "#059669", bg: "#05966912" },
  beta: { label: "Beta", color: "#8B5CF6", bg: "#8B5CF612" },
  dev: { label: "In Dev", color: "#059669", bg: "#05966912" },
  "coming-soon": { label: "Coming Soon", color: "#D97706", bg: "#D9770612" },
};

// ─── Background art ───────────────────────────────────────────────────────────

const ART_PTS = [
  { x: 0.73, y: 0.07, r: 5 },
  { x: 0.89, y: 0.16, r: 7.5 },
  { x: 0.97, y: 0.33, r: 5 },
  { x: 0.81, y: 0.44, r: 6 },
  { x: 0.63, y: 0.23, r: 4 },
  { x: 0.93, y: 0.54, r: 4.5 },
  { x: 0.69, y: 0.53, r: 5.5 },
] as const;

const ART_EDGES = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 5],
  [1, 4],
  [4, 6],
  [3, 6],
  [0, 4],
] as const;

function BackgroundArt() {
  const W = 560,
    H = 440;
  const pts = ART_PTS.map(p => ({ ...p, px: p.x * W, py: p.y * H }));

  return (
    <div
      className="absolute inset-0 overflow-hidden pointer-events-none"
      aria-hidden="true"
    >
      <div
        className="absolute top-0 right-0 w-160 h-130"
        style={{
          background: `radial-gradient(ellipse at 80% 15%, ${COSTCO_BLUE}07 0%, transparent 62%)`,
        }}
      />
      <motion.svg
        viewBox={`0 0 ${W} ${H}`}
        className="absolute top-0 right-0 w-140 h-110"
        style={{ opacity: 0.11 }}
        preserveAspectRatio="xMaxYMin meet"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.11 }}
        transition={{ duration: 1.4, delay: 0.2 }}
      >
        {ART_EDGES.map(([a, b], i) => (
          <motion.line
            key={i}
            x1={pts[a].px}
            y1={pts[a].py}
            x2={pts[b].px}
            y2={pts[b].py}
            stroke={COSTCO_BLUE}
            strokeWidth="1"
            strokeOpacity="0.7"
            strokeDasharray="4 7"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 + i * 0.05, duration: 0.5 }}
          />
        ))}
        {pts.map((p, i) => (
          <motion.g
            key={i}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              delay: 0.35 + i * 0.08,
              duration: 0.4,
              type: "spring",
              stiffness: 260,
              damping: 22,
            }}
            style={{ originX: `${p.px}px`, originY: `${p.py}px` }}
          >
            <circle cx={p.px} cy={p.py} r={p.r + 5} fill={`${COSTCO_BLUE}14`} />
            <circle
              cx={p.px}
              cy={p.py}
              r={p.r}
              fill={COSTCO_BLUE}
              fillOpacity="0.55"
            />
            <motion.circle
              cx={p.px}
              cy={p.py}
              r={p.r}
              fill="none"
              stroke={COSTCO_BLUE}
              strokeWidth="1"
              animate={{ r: [p.r, p.r + 9, p.r], opacity: [0.35, 0, 0.35] }}
              transition={{
                duration: 2.8 + i * 0.3,
                delay: i * 0.5,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          </motion.g>
        ))}
      </motion.svg>
    </div>
  );
}

// ─── Showcase Card ────────────────────────────────────────────────────────────

function ShowcaseCard({
  sc,
  index,
  onNavigate,
}: {
  sc: Showcase;
  index: number;
  onNavigate: (path: string) => void;
}) {
  const Icon = sc.icon;
  const status = STATUS_META[sc.status];
  const isLive = sc.status !== "coming-soon";

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: 0.2 + index * 0.1,
        duration: 0.6,
        ease: [0.16, 1, 0.3, 1],
      }}
      className="h-full"
    >
      <HkiCard
        accent={sc.accent}
        className={cn("h-full", isLive && "group")}
      >
        <div className="p-7 lg:p-8 flex flex-col h-full gap-6">
          {/* Icon + status */}
          <div className="flex items-start justify-between">
            <motion.div
              className="w-14 h-14 rounded-2xl flex items-center justify-center relative overflow-hidden"
              style={{ background: `${sc.accent}15`, color: sc.accent }}
              whileHover={isLive ? { scale: 1.06, rotate: -3 } : {}}
              transition={{ type: "spring", stiffness: 360, damping: 20 }}
            >
              <Icon className="w-7 h-7 relative z-10" />
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-25 transition-opacity duration-300 blur-sm"
                style={{ background: sc.accent }}
              />
            </motion.div>
            <span
              className="text-[11px] font-semibold uppercase tracking-widest px-3 py-1 rounded-full"
              style={{ color: status.color, background: status.bg }}
            >
              {status.label}
            </span>
          </div>

          {/* Title + description */}
          <div className="flex-1">
            <h2
              className="text-2xl font-black tracking-tight mb-2.5"
              style={{ color: sc.accent }}
            >
              {sc.title}
            </h2>
            <p className={cn(hub.bodyText, "text-base leading-relaxed")}>
              {sc.description}
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-3">
            {isLive ? (
              <>
                <Button
                  asChild
                  size="default"
                  className="rounded-xl px-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                  style={{
                    background: `linear-gradient(135deg, ${sc.accent}e0, ${sc.accent})`,
                    boxShadow: `0 4px 14px ${sc.accent}28`,
                  }}
                >
                  <a
                    href={sc.launchHref}
                    onClick={
                      sc.launchExternal
                        ? undefined
                        : e => {
                            e.preventDefault();
                            onNavigate(sc.launchHref);
                          }
                    }
                    {...(sc.launchExternal
                      ? { target: "_blank", rel: "noopener noreferrer" }
                      : {})}
                    className="gap-2 text-white font-semibold"
                  >
                    Chat
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                  </a>
                </Button>

                {sc.landingHref && (
                  <Button
                    asChild
                    variant="ghost"
                    size="default"
                    className="rounded-xl px-4 text-muted-foreground hover:text-foreground"
                  >
                    <a
                      href={sc.landingHref}
                      onClick={e => {
                        e.preventDefault();
                        onNavigate(sc.landingHref!);
                      }}
                      className="gap-1.5"
                    >
                      {sc.landingLabel ?? "Overview"}
                    </a>
                  </Button>
                )}
              </>
            ) : (
              <span className="text-sm text-muted-foreground/50 font-medium">
                Coming soon
              </span>
            )}
          </div>
        </div>
      </HkiCard>
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EngineeringHub() {
  usePageMeta("Innovation Engineering — HKI");
  const [, setLocation] = useLocation();
  const navigate = useCallback(
    (path: string) => setLocation(path),
    [setLocation]
  );
  const { theme, toggleTheme } = useTheme();

  // Auto-responsive grid — grows naturally as SHOWCASES expands
  const gridClass =
    SHOWCASES.length <= 2
      ? "grid grid-cols-1 lg:grid-cols-2 gap-5"
      : SHOWCASES.length <= 4
        ? "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-2 gap-5"
        : "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5";

  return (
    <div className={hub.page}>
      <DigitalWarehouse />

      {/* ── Nav ── */}
      <Topbar
        variant="blur"
        showMenuTrigger={false}
        className="sticky top-0 z-50 bg-background/80! dark:bg-background/60! backdrop-blur-xl! backdrop-saturate-150 border-border/40! dark:border-white/6!"
        leftContent={
          <div className="flex items-center gap-3">
            <AgenticIcon size={28} />
            <div className="flex items-baseline gap-1.5">
              <span
                className="text-[13px] font-bold uppercase tracking-widest"
                style={{ color: COSTCO_BLUE }}
              >
                Innovation
              </span>
              <span className="text-[13px] font-bold uppercase tracking-widest text-muted-foreground">
                Engineering
              </span>
            </div>
          </div>
        }
        actions={
          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
            >
              {theme === "light" ? (
                <Moon className="w-4 h-4" />
              ) : (
                <Sun className="w-4 h-4" />
              )}
            </button>
            <Button asChild size="sm" className="rounded-xl">
              <a
                href="/login"
                onClick={e => {
                  e.preventDefault();
                  navigate("/login");
                }}
              >
                Sign In
              </a>
            </Button>
          </div>
        }
      />

      <div className={hub.pageInner}>
        {/* ── Hero ── */}
        <div className="relative max-w-6xl mx-auto w-full px-6 pt-14 pb-10">
          <BackgroundArt />

          <div className="relative z-10 max-w-xl">
            {/* Live indicator pill */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className={cn(
                hub.glass,
                "inline-flex items-center gap-2.5 rounded-full px-4 py-1.5 mb-7"
              )}
            >
              <span className="relative flex h-2 w-2">
                <span
                  className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                  style={{ background: COSTCO_BLUE }}
                />
                <span
                  className="relative inline-flex h-2 w-2 rounded-full"
                  style={{ background: COSTCO_BLUE }}
                />
              </span>
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Innovation Engineering
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: 0.08,
                duration: 0.7,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="text-4xl sm:text-5xl md:text-[3.25rem] font-black tracking-[-0.03em] leading-[1.04] mb-4"
            >
              <span className="text-foreground">We build</span>{" "}
              <span
                className="bg-clip-text text-transparent"
                style={{
                  backgroundImage: `linear-gradient(135deg, ${COSTCO_BLUE} 0%, #3397D7 100%)`,
                }}
              >
                what's next.
              </span>
            </motion.h1>

            {/* Sub */}
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: 0.18,
                duration: 0.5,
                ease: [0.16, 1, 0.3, 1],
              }}
              className={cn(hub.bodyText, "max-w-md")}
            >
              AI and advanced technology platforms, built by HKI's Innovation
              Engineering team.
            </motion.p>
          </div>
        </div>

        {/* ── Platform grid ── */}
        <main className="max-w-6xl mx-auto w-full px-6 pb-14">
          <div className={gridClass}>
            {SHOWCASES.map((sc, i) => (
              <ShowcaseCard
                key={sc.id}
                sc={sc}
                index={i}
                onNavigate={navigate}
              />
            ))}
          </div>

          {/* ── Cross-team link ── */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className="flex justify-end mt-8 pt-6 border-t border-border/30"
          >
            <a
              href={
                typeof import.meta !== "undefined"
                  ? (import.meta.env?.VITE_IPMS_URL ?? "http://localhost:9002")
                  : "http://localhost:9002"
              }
              target="innovation-hub"
              rel="noopener"
              className={cn(
                hub.footerLink,
                "inline-flex items-center gap-1.5 text-xs"
              )}
            >
              <span>Strategy &amp; Sensing</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </motion.div>
        </main>
      </div>

      {/* ── Footer ── */}
      <footer className={cn(hub.footerBar, "mt-auto")}>
        <div className="max-w-6xl mx-auto px-6 h-12 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground/50">
            <AgenticIcon size={16} />
            <span>
              © {new Date().getFullYear()} HKI — Innovation
              Engineering
            </span>
          </div>
          <a
            href="/login"
            onClick={e => {
              e.preventDefault();
              navigate("/login");
            }}
            className={cn(hub.footerLink, "text-xs")}
          >
            Sign In
          </a>
        </div>
      </footer>
    </div>
  );
}
