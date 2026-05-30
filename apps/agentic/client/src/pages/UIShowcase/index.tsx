/**
 * UIShowcase — HKI AI Platform Design System
 * Professional living reference for all custom components, tokens, and patterns.
 */

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Palette,
  Type,
  Layers,
  ShieldCheck,
  BrainCircuit,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  Moon,
  Sun,
  Fingerprint,
  Sparkles,
  Copy,
  Check,
  // New icons for rich agentic & defensive UI
  Lock,
  Shield,
  ShieldOff,
  AlertOctagon,
  Hash,
  ExternalLink,
  ArrowRightLeft,
  Play,
  Pause,
  RotateCcw,
  UserCheck,
  Activity,
  Wrench,
  Zap,
} from "lucide-react";
import {
  Button,
  Badge,
  Input,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Separator,
  Logo,
  STREAM_ICON_OPTIONS,
  StreamIcon,
  // Defensive
  ScopeBadge,
  DomainStripe,
  EnvelopeTtl,
  FailClosedState,
  DomainFootprint,
  CrossDomainGuard,
  AuditPill,
  // Guardrails
  GuardrailAlert,
  GuardrailsIndicator,
  HallucinationWarning,
  RiskScoreIndicator,
  // Thought Trace / Tool Use
  ThoughtTraceStream,
  ThoughtTraceTimeline,
  StreamingIndicator,
  ReasoningCard,
  ToolExecutionCard,
  // Core / HITL / Execution
  ConfidenceIndicator,
  ApprovalQueue,
  ExecutionPlanCard,
  InterventionCard,
} from "@hki/ui";
import { FONT_FAMILY } from "@/design-system/tokens";
import {
  ThinkingAnimation,
  ThinkingInline,
  ThinkingCard,
} from "@/components/chat-ui";
import { useTheme } from "@/contexts/ThemeContext";
import { usePageMeta } from "@/hooks/usePageMeta";

// ── Brand ──────────────────────────────────────────────────────────────────────

const IRIS = "#0E7C7B";
const PULSE = IRIS;
const PRIMARY = "var(--primary)";
const DOMAIN_STRUCTURE =
  "var(--stream-icon-structure, var(--color-brand-iris-500, #0E7C7B))";
const DOMAIN_ACCENT =
  "var(--stream-icon-accent, var(--color-brand-iris-500, #0E7C7B))";
const INDIGO = IRIS;
const SHOWCASE_HEADING_FONT = FONT_FAMILY.display;
const SHOWCASE_BODY_FONT = FONT_FAMILY.body;

// ── Nav ────────────────────────────────────────────────────────────────────────

const NAV = [
  { id: "overview", num: "01", label: "Overview", icon: Sparkles },
  { id: "brand", num: "02", label: "Brand", icon: Palette },
  { id: "type", num: "03", label: "Typography", icon: Type },
  { id: "components", num: "04", label: "Components", icon: Layers },
  { id: "icons", num: "05", label: "Icons", icon: ChevronRight },
  { id: "patterns", num: "06", label: "Patterns", icon: Fingerprint },
  { id: "defensive", num: "07", label: "Defensive", icon: ShieldCheck },
  { id: "guardrails", num: "08", label: "Guardrails", icon: Shield },
  {
    id: "agentic-trace",
    num: "09",
    label: "Agentic Trace",
    icon: BrainCircuit,
  },
  { id: "hitl", num: "10", label: "HITL & Plan", icon: UserCheck },
] as const;

type SectionId = (typeof NAV)[number]["id"];

// ── Shared components ──────────────────────────────────────────────────────────

/**
 * Section wrapper — the <section> element is PLAIN (no motion, no transform)
 * so it never creates a competing stacking context with the sticky header.
 * Animation is applied to the inner div only.
 */
function Section({
  id,
  num,
  title,
  subtitle,
  children,
}: {
  id: SectionId;
  num: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20">
      <motion.div
        className="space-y-7"
        initial={{ y: 14 }}
        whileInView={{ y: 0 }}
        viewport={{ once: true, amount: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="space-y-2 pb-7 border-b border-border/50">
          <div className="flex items-center gap-3">
            <span
              className="text-[10px] font-black tracking-[0.25em] uppercase"
              style={{ color: IRIS }}
            >
              {num}
            </span>
            <div
              className="h-px flex-1"
              style={{
                background: `linear-gradient(90deg, ${IRIS}50, transparent)`,
              }}
            />
          </div>
          <h2
            className="text-[1.7rem] font-bold tracking-tight text-foreground"
            style={{ fontFamily: SHOWCASE_HEADING_FONT }}
          >
            {title}
          </h2>
          <p className="text-sm text-muted-foreground max-w-xl leading-relaxed">
            {subtitle}
          </p>
        </div>
        {children}
      </motion.div>
    </section>
  );
}

/** Demo card — no overflow-hidden so hover animations aren't clipped */
function Demo({
  title,
  className = "",
  children,
}: {
  title?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-2xl border border-border/60 shadow-sm ${className}`}
      style={{ backgroundColor: "var(--card)" }}
    >
      {title && (
        <div
          className="px-5 py-3 border-b border-border/50 rounded-t-2xl"
          style={{
            backgroundColor:
              "color-mix(in srgb, var(--muted) 30%, transparent)",
          }}
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            {title}
          </p>
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}

/** Syntax-highlighted code block */
function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="rounded-xl border border-zinc-800 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-1.5">
          {["#EF4444", "#F59E0B", "#10B981"].map(c => (
            <div
              key={c}
              className="w-2.5 h-2.5 rounded-full"
              style={{ background: c }}
            />
          ))}
        </div>
        <button
          onClick={copy}
          className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-zinc-300 transition-colors"
        >
          {copied ? (
            <Check className="w-3 h-3 text-emerald-400" />
          ) : (
            <Copy className="w-3 h-3" />
          )}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="px-5 py-4 bg-zinc-950 text-[11px] font-mono text-zinc-300 leading-relaxed overflow-x-auto">
        {code}
      </pre>
    </div>
  );
}

// ── Section 01 · Overview ──────────────────────────────────────────────────────

function OverviewSection() {
  return (
    <Section
      id="overview"
      num="01"
      title="Design System Overview"
      subtitle="A custom-built, enterprise-grade UI library for HKI's AI Platform. Every component and token designed from scratch for agentic workflows."
    >
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { value: "30+", label: "Components", color: IRIS },
          {
            value: String(STREAM_ICON_OPTIONS.length),
            label: "Stream Icons",
            color: DOMAIN_ACCENT,
          },
          { value: "8", label: "Sections", color: INDIGO },
          { value: "2", label: "Themes", color: "#10B981" },
        ].map(({ value, label, color }) => (
          <div
            key={label}
            className="relative rounded-2xl p-6 overflow-hidden border"
            style={{ borderColor: `${color}28`, background: `${color}08` }}
          >
            <div
              className="absolute -top-5 -right-5 w-16 h-16 rounded-full opacity-[0.07]"
              style={{ background: color }}
            />
            <p
              className="text-4xl font-black mb-1"
              style={{ color, fontFamily: SHOWCASE_HEADING_FONT }}
            >
              {value}
            </p>
            <p className="text-xs text-muted-foreground font-semibold tracking-wide">
              {label}
            </p>
          </div>
        ))}
      </div>

      <Demo title="Foundation">
        <div className="grid sm:grid-cols-3 gap-6">
          {[
            {
              icon: Layers,
              label: "@hki/ui Package",
              body: "Custom React library on Radix primitives. Shared across all AI Platform surfaces with brand-native styling.",
            },
            {
              icon: Fingerprint,
              label: "Proprietary Patterns",
              body: "Color-tinted hovers, gradient accent bars, dual-layer shadows — developed exclusively for AI operations UI.",
            },
            {
              icon: Sparkles,
              label: "Motion-First Design",
              body: "Framer Motion throughout. Animations that reveal hierarchy and guide attention — functional, not decorative.",
            },
          ].map(({ icon: Icon, label, body }) => (
            <div key={label}>
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center mb-3 border"
                style={{ background: `${IRIS}0c`, borderColor: `${IRIS}30` }}
              >
                <Icon className="w-4 h-4" style={{ color: IRIS }} />
              </div>
              <p className="text-sm font-semibold text-foreground mb-1.5">
                {label}
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {body}
              </p>
            </div>
          ))}
        </div>
      </Demo>

      <Demo title="Tech Stack">
        <div className="flex flex-wrap gap-2">
          {[
            { t: "React 18", c: "#61DAFB" },
            { t: "TypeScript", c: "#3178C6" },
            { t: "Radix UI", c: "#8B5CF6" },
            { t: "Tailwind CSS", c: "#06B6D4" },
            { t: "Framer Motion", c: "#FF0055" },
            { t: "Plus Jakarta Sans", c: IRIS },
            { t: "Lucide Icons", c: "#F97316" },
            { t: "HKI Brand Tokens", c: PULSE },
          ].map(({ t, c }) => (
            <span
              key={t}
              className="px-3 py-1 rounded-lg text-[11px] font-semibold border"
              style={{ borderColor: `${c}40`, color: c, background: `${c}0c` }}
            >
              {t}
            </span>
          ))}
        </div>
      </Demo>
    </Section>
  );
}

// ── Section 02 · Brand ─────────────────────────────────────────────────────────

function BrandSection() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (hex: string) => {
    navigator.clipboard.writeText(hex).catch(() => {});
    setCopied(hex);
    setTimeout(() => setCopied(null), 1600);
  };

  return (
    <Section
      id="brand"
      num="02"
      title="Brand & Color Tokens"
      subtitle="HKI brand colors and semantic design tokens. All surfaces adapt correctly in both light and dark mode."
    >
      <Demo title="Core Palette · Click to copy hex">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            {
              color: IRIS,
              label: "HKI Iris",
              hex: "#0E7C7B",
              usage: "Primary — structure, CTAs, links",
            },
            {
              color: PULSE,
              label: "HKI Iris",
              hex: "#0E7C7B",
              usage: "Accent — signals, highlights, active marks",
            },
            {
              color: INDIGO,
              label: "Indigo",
              hex: "#6366F1",
              usage: "Extended — AI & agentic surfaces",
            },
            {
              color: "#10B981",
              label: "Emerald",
              hex: "#10B981",
              usage: "Success — confirmations, health",
            },
            {
              color: "#F59E0B",
              label: "Amber",
              hex: "#F59E0B",
              usage: "Warning — rate limits, caution",
            },
          ].map(({ color, label, hex, usage }) => (
            <button
              key={hex}
              onClick={() => copy(hex)}
              className="group text-left rounded-xl border border-border/60 hover:border-border hover:shadow-md transition-all overflow-hidden"
            >
              <div className="h-20 w-full" style={{ background: color }} />
              <div className="p-3 space-y-0.5">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold text-foreground">
                    {label}
                  </p>
                  {copied === hex ? (
                    <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                  ) : (
                    <Copy className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  )}
                </div>
                <code className="text-[10px] text-muted-foreground font-mono">
                  {hex}
                </code>
                <p className="text-[10px] text-muted-foreground/60 leading-tight">
                  {usage}
                </p>
              </div>
            </button>
          ))}
        </div>
      </Demo>

      <div className="grid sm:grid-cols-2 gap-4">
        <Demo title="Semantic Tokens">
          <div className="space-y-2.5">
            {[
              ["--background", "Page background"],
              ["--foreground", "Primary text"],
              ["--card", "Card surface"],
              ["--border", "Dividers/outlines"],
              ["--primary", "Brand primary"],
              ["--muted", "Subdued surface"],
              ["--muted-foreground", "Secondary text"],
              ["--destructive", "Errors"],
            ].map(([tok, desc]) => (
              <div key={tok} className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-lg border border-black/10 dark:border-white/10 shrink-0"
                  style={{ background: `var(${tok})` }}
                />
                <div>
                  <code className="text-[10px] font-mono text-foreground">
                    {tok}
                  </code>
                  <p className="text-[10px] text-muted-foreground">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Demo>

        <div className="space-y-4">
          <Demo title="Gradient Language">
            <div className="space-y-3">
              {[
                {
                  label: "Brand",
                  grad: `linear-gradient(135deg, ${IRIS}, ${PULSE})`,
                },
                {
                  label: "AI / Agentic",
                  grad: `linear-gradient(135deg, ${IRIS}, ${INDIGO})`,
                },
                {
                  label: "Success",
                  grad: "linear-gradient(135deg, #10B981, #059669)",
                },
                {
                  label: "Warning",
                  grad: "linear-gradient(135deg, #F59E0B, #D97706)",
                },
                {
                  label: "Subtle Tint",
                  grad: `linear-gradient(135deg, ${IRIS}14, ${PULSE}14)`,
                },
              ].map(({ label, grad }) => (
                <div key={label} className="flex items-center gap-3">
                  <div
                    className="h-8 w-20 rounded-lg border border-black/10 dark:border-white/10 shrink-0"
                    style={{ background: grad }}
                  />
                  <span className="text-xs text-muted-foreground">{label}</span>
                </div>
              ))}
            </div>
          </Demo>

          <Demo title="Assets">
            <div className="flex items-center gap-6 flex-wrap">
              <div className="text-center space-y-1.5">
                <div className="px-5 py-3 bg-muted rounded-xl inline-block">
                  <Logo size={32} />
                </div>
                <p className="text-[10px] text-muted-foreground">Logo</p>
              </div>
              <div className="text-center space-y-1.5">
                <div
                  className="p-4 rounded-xl inline-flex items-center justify-center"
                  style={{
                    background: `linear-gradient(135deg, ${IRIS}14, ${PULSE}14)`,
                  }}
                >
                  <StreamIcon id="global" size={32} />
                </div>
                <p className="text-[10px] text-muted-foreground">StreamIcon</p>
              </div>
            </div>
          </Demo>
        </div>
      </div>
    </Section>
  );
}

// ── Section 03 · Typography ────────────────────────────────────────────────────

function TypographySection() {
  return (
    <Section
      id="type"
      num="03"
      title="Typography"
      subtitle="Plus Jakarta Sans for display, Inter for UI, Source Serif 4 for reading, JetBrains Mono for code — exported as FONT_FAMILY tokens."
    >
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            role: "Display",
            display: "Plus Jakarta Sans",
            weight: "800 · Extra Bold",
            family: SHOWCASE_HEADING_FONT,
            token: "FONT_FAMILY.display",
          },
          {
            role: "UI",
            display: "Inter / System",
            weight: "400 · Regular",
            family: SHOWCASE_BODY_FONT,
            token: "FONT_FAMILY.body",
          },
          {
            role: "Reading",
            display: "Source Serif 4",
            weight: "400 · Regular",
            family: FONT_FAMILY.reading,
            token: "FONT_FAMILY.reading",
          },
          {
            role: "Mono",
            display: "JetBrains Mono",
            weight: "400 · Regular",
            family: FONT_FAMILY.mono,
            token: "FONT_FAMILY.mono",
          },
        ].map(({ role, display, weight, family, token }) => (
          <Demo key={role}>
            <p className="text-[9px] font-black uppercase tracking-[0.22em] text-muted-foreground mb-2">
              {role}
            </p>
            <p
              className="text-xl font-bold mb-1 truncate"
              style={{ fontFamily: family }}
            >
              {display}
            </p>
            <p className="text-xs text-muted-foreground mb-3">{weight}</p>
            <code className="text-[10px] bg-muted px-2 py-1 rounded-md font-mono text-muted-foreground">
              {token}
            </code>
          </Demo>
        ))}
      </div>

      <Demo title="Type Scale">
        <div className="divide-y divide-border/40">
          {(
            [
              {
                role: "Display",
                cls: "text-5xl font-extrabold tracking-tight",
                sample: "HKI AI",
              },
              {
                role: "H1",
                cls: "text-4xl font-bold",
                sample: "Platform Architecture",
              },
              {
                role: "H2",
                cls: "text-3xl font-semibold",
                sample: "Design System",
              },
              {
                role: "H3",
                cls: "text-2xl font-semibold",
                sample: "Component Library",
              },
              {
                role: "H4",
                cls: "text-xl font-medium",
                sample: "Domain Icons",
              },
              {
                role: "Body",
                cls: "text-base leading-relaxed",
                sample:
                  "The platform ships consistent, accessible UI across every surface.",
              },
              {
                role: "Small",
                cls: "text-sm text-muted-foreground",
                sample: "Secondary content and supporting metadata.",
              },
              {
                role: "Caption",
                cls: "text-xs text-muted-foreground tracking-wide",
                sample: "Labels · Captions · Fine print",
              },
            ] as const
          ).map(({ role, cls, sample }) => (
            <div
              key={role}
              className="flex items-baseline gap-6 py-4 first:pt-0 last:pb-0"
            >
              <span className="text-[9px] font-mono text-muted-foreground/40 w-14 shrink-0 uppercase tracking-wide">
                {role}
              </span>
              <p className={cls} style={{ fontFamily: SHOWCASE_HEADING_FONT }}>
                {sample}
              </p>
            </div>
          ))}
        </div>
      </Demo>
    </Section>
  );
}

// ── Section 04 · Components ────────────────────────────────────────────────────

function ComponentsSection() {
  return (
    <Section
      id="components"
      num="04"
      title="Core Components"
      subtitle="Production-ready primitives from @hki/ui. Full keyboard navigation and ARIA support via Radix UI."
    >
      <Demo title="Button">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 items-center">
            {(
              [
                "default",
                "outline",
                "ghost",
                "secondary",
                "destructive",
                "link",
              ] as const
            ).map(v => (
              <Button key={v} variant={v} className="capitalize">
                {v}
              </Button>
            ))}
            <Button disabled>Disabled</Button>
          </div>
          <div className="flex flex-wrap gap-3 items-center">
            <Button size="sm">Small</Button>
            <Button>Default</Button>
            <Button size="lg">Large</Button>
            <Button style={{ background: IRIS, color: "white" }}>
              HKI Iris
            </Button>
            <Button style={{ background: PULSE, color: "white" }}>
              HKI Pulse
            </Button>
            <Button
              style={{
                background: `linear-gradient(135deg, ${IRIS}, ${INDIGO})`,
                color: "white",
              }}
            >
              Gradient
            </Button>
          </div>
        </div>
      </Demo>

      <Demo title="Badge">
        <div className="flex flex-wrap gap-2 items-center">
          {(["default", "secondary", "outline", "destructive"] as const).map(
            v => (
              <Badge key={v} variant={v} className="capitalize">
                {v}
              </Badge>
            )
          )}
          <Badge className="text-white" style={{ background: IRIS }}>
            HKI Iris
          </Badge>
          <Badge className="text-white" style={{ background: PULSE }}>
            HKI Pulse
          </Badge>
          <Badge
            className="text-white text-[10px] font-bold"
            style={{ background: `linear-gradient(90deg, ${IRIS}, ${INDIGO})` }}
          >
            @hki/ui
          </Badge>
        </div>
      </Demo>

      <div className="grid sm:grid-cols-2 gap-4">
        <Demo title="Input">
          <div className="space-y-3">
            <Input placeholder="Default input" />
            <Input placeholder="Disabled" disabled />
            <Input defaultValue="hki@example.com" />
            <Input type="password" placeholder="Password" />
            <div className="space-y-1">
              <Input
                defaultValue="pharmacy"
                className="border-emerald-500/60 focus-visible:ring-emerald-500/30"
              />
              <p className="text-[11px] text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> ID is available
              </p>
            </div>
            <div className="space-y-1">
              <Input
                defaultValue="global"
                className="border-destructive/60 focus-visible:ring-destructive/30"
              />
              <p className="text-[11px] text-destructive flex items-center gap-1">
                <XCircle className="w-3 h-3" /> ID already in use
              </p>
            </div>
          </div>
        </Demo>

        <Demo title="Card">
          <div className="space-y-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Standard Card</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Base card surface for content grouping across every admin
                  view.
                </p>
              </CardContent>
            </Card>
            <Card
              className="border-2"
              style={{ borderColor: `${IRIS}40`, background: `${IRIS}06` }}
            >
              <CardHeader>
                <CardTitle className="text-sm" style={{ color: IRIS }}>
                  Branded Card
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Elevated variant with HKI Iris tint — for featured content.
                </p>
              </CardContent>
            </Card>
          </div>
        </Demo>
      </div>

      <Demo title="Separator">
        <div className="space-y-4">
          <Separator />
          <div className="flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground px-2">
              or continue with
            </span>
            <Separator className="flex-1" />
          </div>
        </div>
      </Demo>
    </Section>
  );
}

// ── Section 05 · Icons ─────────────────────────────────────────────────────────

function IconsSection() {
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <Section
      id="icons"
      num="05"
      title="Domain Icons"
      subtitle={`${STREAM_ICON_OPTIONS.length} HKI-domain SVG icons. Iris defines boundary structure; Pulse marks the active domain accent. IDs fit varchar(8) for direct database storage.`}
    >
      <Demo title="Full Set">
        <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 gap-2">
          {STREAM_ICON_OPTIONS.map(({ id, label, Icon }) => (
            <motion.div
              key={id}
              whileHover={{ scale: 1.08, y: -3 }}
              onHoverStart={() => setHovered(id)}
              onHoverEnd={() => setHovered(null)}
              className="relative flex flex-col items-center gap-2 overflow-hidden rounded-lg p-3 cursor-default"
              style={{
                background:
                  hovered === id
                    ? `linear-gradient(135deg, color-mix(in srgb, ${DOMAIN_STRUCTURE} 10%, transparent), color-mix(in srgb, ${DOMAIN_ACCENT} 12%, transparent))`
                    : "transparent",
                border: `1px solid ${
                  hovered === id
                    ? `color-mix(in srgb, ${DOMAIN_STRUCTURE} 40%, var(--border))`
                    : "transparent"
                }`,
                boxShadow:
                  hovered === id
                    ? `0 12px 32px color-mix(in srgb, ${DOMAIN_STRUCTURE} 16%, transparent)`
                    : "none",
                transition:
                  "background 0.2s, border-color 0.2s, box-shadow 0.2s",
              }}
            >
              <span
                aria-hidden
                className="absolute inset-x-3 top-0 h-0.5 rounded-full opacity-0 transition-opacity duration-200"
                style={{
                  opacity: hovered === id ? 1 : 0,
                  background: `linear-gradient(90deg, transparent, ${DOMAIN_STRUCTURE}, ${DOMAIN_ACCENT}, transparent)`,
                }}
              />
              <Icon size={28} />
              <span className="text-[10px] text-muted-foreground text-center leading-snug">
                {label}
              </span>
              <code className="text-[9px] text-muted-foreground/50 bg-muted px-1 py-0.5 rounded font-mono">
                {id}
              </code>
            </motion.div>
          ))}
        </div>
      </Demo>

      <div className="grid sm:grid-cols-2 gap-4">
        <Demo title="Size Scale">
          <div className="flex items-end gap-5 flex-wrap">
            {[12, 16, 20, 24, 32, 40, 48].map(size => (
              <div key={size} className="flex flex-col items-center gap-2">
                <StreamIcon id="pharma" size={size} />
                <span className="text-[9px] text-muted-foreground font-mono">
                  {size}
                </span>
              </div>
            ))}
          </div>
        </Demo>

        <Demo title="Stream Selector (in context)">
          <div className="flex flex-wrap gap-2">
            {STREAM_ICON_OPTIONS.slice(0, 7).map(({ id, label }) => (
              <div
                key={id}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border/60 bg-muted/40 hover:bg-muted transition-colors cursor-default"
              >
                <StreamIcon id={id} size={14} />
                <span className="text-xs font-medium">{label}</span>
              </div>
            ))}
          </div>
        </Demo>
      </div>
    </Section>
  );
}

// ── Section 06 · Patterns ──────────────────────────────────────────────────────

function PatternsSection() {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const cards = [
    {
      id: "a",
      label: "Color-Tinted Hover",
      desc: "Border and background tinted to the brand color on hover",
      color: IRIS,
    },
    {
      id: "b",
      label: "Gradient Accent Bar",
      desc: "Top-edge gradient animates from transparent to layer color on hover",
      color: PULSE,
    },
    {
      id: "c",
      label: "Dual-Layer Shadow",
      desc: "Solid base shadow plus controlled token depth",
      color: INDIGO,
    },
  ];

  return (
    <Section
      id="patterns"
      num="06"
      title="Custom Interaction Patterns"
      subtitle="Proprietary visual and interaction patterns not found in any generic library — purpose-built for enterprise AI operations."
    >
      <Demo title="Color-Tinted Hover · Hover to preview">
        <div className="grid sm:grid-cols-3 gap-4 mb-5">
          {cards.map(({ id, label, desc, color }) => (
            <motion.div
              key={id}
              onHoverStart={() => setHoveredId(id)}
              onHoverEnd={() => setHoveredId(null)}
              whileHover={{ y: -4 }}
              className="relative rounded-xl border-2 p-5 cursor-default"
              style={{
                borderColor: hoveredId === id ? `${color}65` : "var(--border)",
                background: hoveredId === id ? `${color}0b` : "var(--card)",
                boxShadow:
                  hoveredId === id
                    ? `0 8px 30px rgba(0,0,0,0.08), 0 2px 18px ${color}25`
                    : "0 1px 4px rgba(0,0,0,0.04)",
                transition:
                  "border-color 0.25s, background 0.25s, box-shadow 0.25s",
              }}
            >
              <div
                className="absolute top-0 left-0 right-0 h-0.5 rounded-t-xl"
                style={{
                  background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
                  opacity: hoveredId === id ? 1 : 0,
                  transition: "opacity 0.25s",
                }}
              />
              <div
                className="w-2 h-2 rounded-full mb-4"
                style={{ background: color }}
              />
              <p className="text-sm font-semibold mb-1.5">{label}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {desc}
              </p>
            </motion.div>
          ))}
        </div>

        <CodeBlock
          code={`// Color-tinted hover — reusable across all branded cards
style={{
  borderColor: hovered ? \`\${color}65\` : "var(--border)",
  background:  hovered ? \`\${color}0b\` : "var(--card)",
  boxShadow:   hovered
    ? \`0 8px 30px rgba(0,0,0,0.08), 0 2px 18px \${color}25\`
    : "0 1px 4px rgba(0,0,0,0.04)",
}}`}
        />
      </Demo>

      <div className="grid sm:grid-cols-2 gap-4">
        <Demo title="Before · Unbranded">
          <div className="space-y-3">
            <button className="w-full px-4 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm hover:bg-gray-50 transition-colors text-left">
              Generic Button
            </button>
            <div className="p-4 rounded-lg border border-gray-200 bg-white">
              <p className="text-sm text-gray-900 font-medium mb-0.5">
                Generic Card
              </p>
              <p className="text-xs text-gray-400">
                Default styling — functional but unbranded
              </p>
            </div>
          </div>
        </Demo>

        <Demo title="After · HKI Custom">
          <div className="space-y-3">
            <Button
              className="w-full font-semibold"
              style={{ background: IRIS, color: "white" }}
            >
              HKI Button
            </Button>
            <div
              className="relative p-4 rounded-xl border-2 cursor-default"
              style={{
                borderColor: `${IRIS}65`,
                background: `${IRIS}0b`,
                boxShadow: `0 4px 16px ${IRIS}20`,
              }}
            >
              <div
                className="absolute top-0 left-0 right-0 h-0.5 rounded-t-xl"
                style={{
                  background: `linear-gradient(90deg, transparent, ${IRIS}, transparent)`,
                }}
              />
              <p className="text-sm font-semibold mb-0.5">HKI Custom Card</p>
              <p className="text-xs text-muted-foreground">
                Branded tint · defined edge · controlled depth
              </p>
            </div>
          </div>
        </Demo>
      </div>
    </Section>
  );
}

// ── Section 07 · Defensive ─────────────────────────────────────────────────────

function DefensiveSection() {
  const [domain, setDomain] = useState<string>("pharmacy");
  const [plane, setPlane] = useState<"runtime" | "publication" | "admin" | any>(
    "runtime"
  );
  const [locked, setLocked] = useState(false);
  const [pending, setPending] = useState(false);
  const [expiresAt, setExpiresAt] = useState(
    () => Math.floor(Date.now() / 1000) + 300
  );
  const [failKind, setFailKind] = useState<FailClosedKind>("scope-override");
  const [confirmMsg, setConfirmMsg] = useState<string | null>(null);

  const resetTtl = () => {
    setExpiresAt(Math.floor(Date.now() / 1000) + 300);
  };

  return (
    <Section
      id="defensive"
      num="07"
      title="Defensive UI Primitives"
      subtitle="Visual contracts that make HKI isolation guarantees legible in real time. These components ensure that missing tokens, unauthorized domains, and scope expirations are instantly visible."
    >
      <div className="relative overflow-hidden rounded-2xl border border-border/40 p-1 mb-6 bg-muted/5">
        <DomainStripe plane={plane} />
        <div className="p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80">
              Active Environment Banner
            </p>
            <p className="text-xs text-muted-foreground">
              Represents the sticky context of the active user session.
            </p>
          </div>
          <div className="flex-1 max-w-md w-full border border-border/40 rounded-xl overflow-hidden shadow-sm">
            <ScopeBadge
              domain={pending ? undefined : domain}
              plane={plane}
              locked={locked}
              pending={pending}
              variant="banner"
              secondary={
                <div className="flex items-center gap-2">
                  <EnvelopeTtl
                    expiresAt={expiresAt}
                    warnSeconds={60}
                    onExpired={() => {}}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-1.5"
                    onClick={resetTtl}
                    title="Refresh token"
                  >
                    <RotateCcw className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                  </Button>
                </div>
              }
            />
          </div>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-6">
        <Demo title="Active Scope Playground">
          <div className="space-y-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Active Domain
              </label>
              <div className="flex flex-wrap gap-1.5">
                {["pharmacy", "payments", "logistics", "global", "*"].map(d => (
                  <button
                    key={d}
                    onClick={() => {
                      setDomain(d);
                      if (d === "global" || d === "*") {
                        setPlane("admin");
                      }
                    }}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all border ${
                      domain === d
                        ? "bg-primary text-white border-primary shadow-sm"
                        : "bg-muted/40 text-muted-foreground border-border hover:bg-muted/70"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Security Plane
              </label>
              <div className="flex flex-wrap gap-1.5">
                {(["runtime", "publication", "admin"] as const).map(p => (
                  <button
                    key={p}
                    onClick={() => setPlane(p)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-mono capitalize transition-all border ${
                      plane === p
                        ? "bg-primary text-white border-primary shadow-sm"
                        : "bg-muted/40 text-muted-foreground border-border hover:bg-muted/70"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-4 items-center pt-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold select-none">
                <input
                  type="checkbox"
                  checked={locked}
                  onChange={e => setLocked(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5"
                />
                Locked Scope
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold select-none">
                <input
                  type="checkbox"
                  checked={pending}
                  onChange={e => setPending(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5"
                />
                Resolving State
              </label>
            </div>

            <Separator className="my-2" />

            <div className="flex items-center justify-between p-3.5 bg-muted/10 rounded-xl border border-border/40">
              <span className="text-xs font-semibold text-muted-foreground">
                Chip Badge rendering:
              </span>
              <ScopeBadge
                domain={pending ? undefined : domain}
                plane={plane}
                locked={locked}
                pending={pending}
              />
            </div>
          </div>
        </Demo>

        <Demo title="Fail-Closed Guardrails">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Enforced Deny Reason
              </span>
              <select
                value={failKind}
                onChange={e => setFailKind(e.target.value as FailClosedKind)}
                className="text-[11px] font-bold uppercase tracking-wider rounded-lg px-2.5 py-1 bg-muted/60 border border-border/60 text-foreground"
              >
                <option value="missing-envelope">Missing Envelope</option>
                <option value="unauthorized-domain">Unauthorized Domain</option>
                <option value="scope-override">Scope Override</option>
                <option value="expired-envelope">Expired Envelope</option>
                <option value="artifact-out-of-scope">
                  Artifact Out of Scope
                </option>
                <option value="cross-domain-blocked">
                  Cross Domain Blocked
                </option>
                <option value="tool-blocked">Tool Blocked</option>
              </select>
            </div>

            <FailClosedState
              kind={failKind}
              code={
                failKind === "scope-override"
                  ? "ERR_HKI_SCOPE_OVERRIDE"
                  : failKind === "unauthorized-domain"
                    ? "ERR_HKI_UNAUTHORIZED_DOMAIN"
                    : failKind === "expired-envelope"
                      ? "ERR_HKI_ENVELOPE_EXPIRED"
                      : failKind === "tool-blocked"
                        ? "ERR_HKI_TOOL_BLOCKED"
                        : "ERR_HKI_SECURITY_DENIAL"
              }
              reason={
                failKind === "scope-override"
                  ? "Gateway blocked raw body override of 'active_domain' to 'global' in payments endpoint."
                  : failKind === "tool-blocked"
                    ? "evaluateGatewayTarget rejected call to tool 'mcp__payments__bulk_charge' with risk score 0.94."
                    : `HKI control loop closed request on plane '${plane}' because domain isolation validation failed.`
              }
              domain={domain}
              traceId="tr_99a80e11894b"
              size="sm"
            />
          </div>
        </Demo>
      </div>

      <div className="grid sm:grid-cols-2 gap-6 mt-6">
        <Demo title="Cross-Domain Interactive Confirm">
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground leading-relaxed">
              When an action crosses security boundaries, HKI requires the
              developer to present an explicit confirmation.
            </p>
            <CrossDomainGuard
              fromDomain="pharmacy"
              toDomain="logistics"
              intent="Transfer clinical trial storage shipment metadata into delivery stream database"
              confirmLabel="Confirm Cross-Domain Data Access"
              cancelLabel="Abort Transfer"
              onConfirm={() => {
                setConfirmMsg("Operation approved and published!");
                setTimeout(() => setConfirmMsg(null), 3000);
              }}
              onCancel={() => {
                setConfirmMsg("Operation cancelled by operator.");
                setTimeout(() => setConfirmMsg(null), 3000);
              }}
            />
            <AnimatePresence>
              {confirmMsg && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={`p-3 rounded-lg text-xs font-semibold text-center border ${
                    confirmMsg.includes("approved")
                      ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                      : "bg-destructive/10 text-destructive border-destructive/20"
                  }`}
                >
                  {confirmMsg}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </Demo>

        <Demo title="Domain Footprint in Messages">
          <div className="space-y-4 flex flex-col justify-between h-full">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Every single message generated by the agent is stamped with the
              domain, policy pack, and deep audit trace.
            </p>
            <div className="p-4 bg-muted/15 border border-border/40 rounded-xl space-y-3">
              <div className="flex gap-2">
                <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <Logo size={12} />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-foreground/90">
                    HKI Copilot
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Based on payments records, transfer status for batch{" "}
                    <code className="font-mono bg-muted px-1 rounded">
                      BT_09A
                    </code>{" "}
                    is settled.
                  </p>
                </div>
              </div>
              <DomainFootprint
                domain="payments"
                plane="runtime"
                policyPackId="p_pack_v12_default"
                traceId="tr_56c22bc891001a"
                auditHref="#overview"
              />
            </div>
          </div>
        </Demo>
      </div>
    </Section>
  );
}

// ── Section 08 · Guardrails ───────────────────────────────────────────────────

function GuardrailsSection() {
  const [overallStatus, setOverallStatus] =
    useState<GuardrailOverallStatus>("warning");
  const [riskScore, setRiskScore] = useState<number>(0.64);
  const [confidence, setConfidence] = useState<number>(0.85);

  const checks: GuardrailCheck[] = [
    {
      name: "Prompt Injection Detector",
      status: riskScore > 0.8 ? "fail" : riskScore > 0.4 ? "warn" : "pass",
      message:
        riskScore > 0.8
          ? "High risk prompt payload blocked"
          : riskScore > 0.4
            ? "Indirect vector signature match"
            : "Clean input",
    },
    {
      name: "PII Extractor Guard",
      status: "pass",
      message: "No SSN, credit cards, or passwords leaked",
    },
    {
      name: "Hallucination Self-Check",
      status: confidence < 0.6 ? "fail" : confidence < 0.8 ? "warn" : "pass",
      message: `Grounding confidence ${Math.round(confidence * 100)}%`,
    },
    {
      name: "Toxicity and Abuse filter",
      status: "pass",
    },
  ];

  return (
    <Section
      id="guardrails"
      num="08"
      title="Guardrails & AI Safety"
      subtitle="Defensive alignment screens that monitor agent input and output streams. Ensures hallucination warnings, risk coefficients, and prompt checks are displayed transparently."
    >
      <div className="grid sm:grid-cols-2 gap-6">
        <Demo title="Real-time Guardrail Auditor">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Overall Status:
              </span>
              <div className="flex gap-1.5">
                {(["safe", "warning", "blocked"] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setOverallStatus(s)}
                    className={`px-2 py-1 rounded text-[11px] font-bold uppercase tracking-wider capitalize ${
                      overallStatus === s
                        ? s === "safe"
                          ? "bg-emerald-500/20 text-emerald-600 border border-emerald-500/30"
                          : s === "warning"
                            ? "bg-amber-500/20 text-amber-600 border border-amber-500/30"
                            : "bg-destructive/20 text-destructive border border-destructive/30"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <GuardrailAlert checks={checks} overallStatus={overallStatus} />
          </div>
        </Demo>

        <div className="space-y-4">
          <Demo title="Safety Signals & Gauges">
            <div className="space-y-5">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-muted-foreground">
                    Agent Risk Coefficient
                  </span>
                  <span
                    className={
                      riskScore > 0.7 ? "text-destructive" : "text-foreground"
                    }
                  >
                    {Math.round(riskScore * 100)}%
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={riskScore}
                    onChange={e => {
                      const v = parseFloat(e.target.value);
                      setRiskScore(v);
                      if (v > 0.8) setOverallStatus("blocked");
                      else if (v > 0.4) setOverallStatus("warning");
                      else setOverallStatus("safe");
                    }}
                    className="w-full h-1.5 rounded-full bg-muted accent-primary cursor-pointer"
                  />
                </div>
                <div className="flex justify-center pt-2">
                  <RiskScoreIndicator
                    score={riskScore}
                    showLabel
                    label="Audit Risk Coefficient"
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-muted-foreground">
                    Self-Check Grounding Confidence
                  </span>
                  <span>{Math.round(confidence * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1"
                  step="0.01"
                  value={confidence}
                  onChange={e => setConfidence(parseFloat(e.target.value))}
                  className="w-full h-1.5 rounded-full bg-muted accent-primary cursor-pointer"
                />
                <AnimatePresence mode="popLayout">
                  {confidence < 0.75 && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="pt-2"
                    >
                      <HallucinationWarning
                        confidenceScore={confidence}
                        alertMessage="Fact Check Indicator shows high variation across referenced corpus database records."
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </Demo>

          <Demo title="Guardrails Summary Pill">
            <div className="flex items-center justify-between p-2.5 bg-muted/10 rounded-xl border border-border/40">
              <span className="text-xs font-semibold text-muted-foreground">
                Active Policy Check:
              </span>
              <GuardrailsIndicator
                status={overallStatus}
                totalChecks={checks.length}
              />
            </div>
          </Demo>
        </div>
      </div>
    </Section>
  );
}

// ── Section 09 · Agentic Trace ─────────────────────────────────────────────────

function AgenticTraceSection() {
  const [streamStatus, setStreamStatus] = useState<StreamStatus>("complete");
  const [chunks, setChunks] = useState<ThoughtChunk[]>([
    {
      id: "1",
      type: "thinking",
      content:
        "Minting runtime environment envelope targeting 'pharmacy' domain...",
      timestamp: new Date(Date.now() - 4000).toISOString(),
    },
    {
      id: "2",
      type: "reasoning",
      content:
        "Domain exact-match check succeeded (payments !== pharmacy). Enforcing fail-closed boundaries.",
      timestamp: new Date(Date.now() - 3000).toISOString(),
    },
    {
      id: "3",
      type: "action",
      content:
        "Calling tool 'get_pharmacy_inventory' with args { storeId: 'ST_0981' }",
      timestamp: new Date(Date.now() - 2000).toISOString(),
    },
    {
      id: "4",
      type: "conclusion",
      content:
        "Formulating optimal shipment relocation strategy for trial batches.",
      timestamp: new Date(Date.now() - 1000).toISOString(),
    },
  ]);

  const [toolStatus, setToolStatus] = useState<
    "success" | "running" | "failed"
  >("success");

  // Streaming player logic
  const intervalRef = useRef<number | any>(null);
  const playStream = () => {
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    setChunks([]);
    setStreamStatus("streaming");

    const flow: Omit<ThoughtChunk, "id" | "timestamp">[] = [
      {
        type: "thinking",
        content: "Evaluating incoming gateway request envelope...",
      },
      {
        type: "reasoning",
        content:
          "Authenticating token signature. Token valid. Active Domain matched to 'pharmacy'.",
      },
      {
        type: "action",
        content: "Triggering vector search for chemical trial batch files...",
      },
      {
        type: "thinking",
        content: "Traversing index of 14,000 document vectors...",
      },
      {
        type: "conclusion",
        content: "Found 3 verified files. Formulating summary response.",
      },
    ];

    let i = 0;
    intervalRef.current = window.setInterval(() => {
      if (i < flow.length) {
        setChunks(prev => [
          ...prev,
          {
            id: String(i + 1),
            ...flow[i],
            timestamp: new Date().toISOString(),
          },
        ]);
        i++;
      } else {
        setStreamStatus("complete");
        if (intervalRef.current) {
          window.clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    }, 1500);
  };

  useEffect(() => {
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, []);

  return (
    <Section
      id="agentic-trace"
      num="09"
      title="Agentic Reasoning & Traces"
      subtitle="Comprehensive tools for rendering thoughts, step-by-step logic stream flow, and granular tool execution outputs."
    >
      <div className="grid sm:grid-cols-12 gap-6">
        <div className="sm:col-span-7 space-y-4">
          <Demo title="Reasoning & Chain of Thought Stream">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Thinking Trace Simulator
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={playStream}
                    disabled={streamStatus === "streaming"}
                    className="gap-1.5"
                  >
                    <Play className="w-3.5 h-3.5 text-primary" /> Run Simulation
                  </Button>
                  {streamStatus === "streaming" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setStreamStatus("complete");
                        if (intervalRef.current) {
                          window.clearInterval(intervalRef.current);
                          intervalRef.current = null;
                        }
                      }}
                    >
                      Stop
                    </Button>
                  )}
                </div>
              </div>

              <ThoughtTraceStream
                title="Reasoning Engine trace"
                chunks={chunks}
                status={streamStatus}
                maxHeight={260}
                onClear={() => setChunks([])}
              />
            </div>
          </Demo>
        </div>

        <div className="sm:col-span-5 space-y-4">
          <Demo title="Granular Tool Execution Card">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Tool Status:
                </span>
                <div className="flex gap-1">
                  {(["success", "running", "failed"] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => setToolStatus(s)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        toolStatus === s
                          ? s === "success"
                            ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-500"
                            : s === "running"
                              ? "bg-amber-500/20 text-amber-500"
                              : "bg-destructive/20 text-destructive"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <ToolExecutionCard
                toolName="vector_search_products"
                durationMs={380}
                status={toolStatus}
                input={JSON.stringify(
                  { query: "trial active components", limit: 3 },
                  null,
                  2
                )}
                output={
                  toolStatus === "success"
                    ? JSON.stringify(
                        { matches: ["active_v1", "active_v3"], score: 0.98 },
                        null,
                        2
                      )
                    : toolStatus === "failed"
                      ? "Error: Access denied. activeDomain 'logistics' does not match target 'payments'."
                      : "Executing read target..."
                }
              />
            </div>
          </Demo>

          <Demo title="Real-time Inline Loading & Sorters">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">
                  Streaming State:
                </span>
                <StreamingIndicator
                  status={
                    streamStatus === "streaming" ? "streaming" : "completed"
                  }
                />
              </div>
              <Separator />
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Agent Confidence
                </span>
                <ConfidenceIndicator
                  confidence={0.92}
                  label="Result Accuracy Score"
                  size="sm"
                />
              </div>
            </div>
          </Demo>
        </div>
      </div>
    </Section>
  );
}

// ── Section 10 · HITL & Plan Execution ───────────────────────────────────────────

function HitlSection() {
  const [items, setItems] = useState<ApprovalItem[]>([
    {
      id: "app_01",
      type: "tool_execution",
      title: "Run 'mcp__pharmacy__bulk_distribute'",
      description:
        "Approve bulk distribution of 14,000 vaccine units into local cold-chains. This action writes back to the supply database records.",
      agentName: "Pharmacy Relocator Agent",
      priority: "critical",
      status: "pending",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 600000).toISOString(),
      riskScore: 0.91,
      metadata: {
        items: 14000,
        target_depot: "EU_DEP_09",
        source_batch: "LOT_v9",
      },
    },
    {
      id: "app_02",
      type: "sensitive_action",
      title: "Relocate experimental batch LOT_77",
      description:
        "Transfer possession records of chemical compounds from active trial domain to inactive archival cold stores.",
      agentName: "Clinical Auditor Copilot",
      priority: "high",
      status: "pending",
      createdAt: new Date(Date.now() - 120000).toISOString(),
      riskScore: 0.58,
      metadata: { compound: "C_77_A", authorization_policy: "P_ARCHIVE_L3" },
    },
    {
      id: "app_03",
      type: "data_access",
      title: "Query payments ledgers for 'trial_invoice_9901'",
      description:
        "Read invoice records of active participants in logistics trial to process relocation bonuses.",
      agentName: "Logistics Accounting Bot",
      priority: "medium",
      status: "pending",
      createdAt: new Date(Date.now() - 360000).toISOString(),
      riskScore: 0.35,
      metadata: { invoice: "INV_9901", target_ledger: "payments_ledger_2026" },
    },
  ]);

  const handleApprove = (ids: string[]) => {
    setItems(prev =>
      prev.map(item =>
        ids.includes(item.id) ? { ...item, status: "approved" as any } : item
      )
    );
  };

  const handleReject = (ids: string[], reason?: string) => {
    setItems(prev =>
      prev.map(item =>
        ids.includes(item.id) ? { ...item, status: "rejected" as any } : item
      )
    );
  };

  const planData = {
    title: "Multi-Step Trial Supply Chain Strategy",
    status: "running" as PlanStatus,
    steps: [
      {
        id: "st_1",
        title: "Verify trial storage location bounds",
        description:
          "Verifies the current HKI envelope activeDomain fits targeted store.",
        status: "success" as StepStatus,
        durationMs: 120,
      },
      {
        id: "st_2",
        title: "Pull compound records for batch LOT_77",
        description: "Read action against vector DB within trial bounds.",
        status: "success" as StepStatus,
        durationMs: 440,
      },
      {
        id: "st_3",
        title: "Execute relocator distribute tool",
        description: "Writes distribution entries. Awaiting HITL Approval.",
        status: "running" as StepStatus,
      },
      {
        id: "st_4",
        title: "Stamp audit ledger",
        description: "Mints audit trace & publishes to immutable ledger.",
        status: "pending" as StepStatus,
      },
    ],
  };

  return (
    <Section
      id="hitl"
      num="10"
      title="HITL Approval & Plan Execution"
      subtitle="Ensuring high-risk actions are queued for manual verification. Visualizes execution pipelines and agent self-correction parameters."
    >
      <div className="grid sm:grid-cols-12 gap-6">
        <div className="sm:col-span-8 space-y-4">
          <Demo title="Interactive Human-In-the-Loop Queue">
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Approve or reject high-risk agent tool calls directly from this
                dashboard queue. Try expanding rows to see details.
              </p>
              <ApprovalQueue
                items={items}
                onApprove={handleApprove}
                onReject={handleReject}
              />
            </div>
          </Demo>
        </div>

        <div className="sm:col-span-4 space-y-6">
          <Demo title="Plan Execution Timeline">
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Execution steps tracking live progress:
              </p>
              <ExecutionPlanCard
                title={planData.title}
                steps={planData.steps}
                status={planData.status}
              />
            </div>
          </Demo>

          <Demo title="Inline Intervention Request">
            <InterventionCard
              title="Operator Intervention"
              description="Relocator distributing tool requires clarification on backup store ID. The target 'cold_store_09' is reporting low nitrogen volume."
              status="active"
              suggestedActions={[
                { id: "act_1", label: "Use alternative store 'cold_store_12'" },
                { id: "act_2", label: "Override volume warnings" },
              ]}
              onAction={actId => {
                alert(`Intervened with action: ${actId}`);
              }}
            />
          </Demo>
        </div>
      </div>
    </Section>
  );
}

// ── Sidebar nav ────────────────────────────────────────────────────────────────

function SideNav({ active }: { active: string }) {
  return (
    <nav className="hidden lg:flex flex-col gap-0.5 sticky top-20">
      <p className="text-[9px] font-black uppercase tracking-[0.22em] text-muted-foreground/40 px-3 mb-3">
        Contents
      </p>
      {NAV.map(({ id, num, label, icon: Icon }) => {
        const on = active === id;
        return (
          <a
            key={id}
            href={`#${id}`}
            className="group relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-all duration-150"
            style={{
              color: on ? IRIS : "var(--muted-foreground)",
              background: on ? `${IRIS}0e` : "transparent",
              fontWeight: on ? 600 : 400,
            }}
          >
            {on && (
              <div
                className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full"
                style={{ background: IRIS }}
              />
            )}
            <span
              className="text-[9px] font-mono tabular-nums shrink-0"
              style={{
                color: on ? IRIS : "var(--muted-foreground)",
                opacity: on ? 1 : 0.45,
              }}
            >
              {num}
            </span>
            <Icon className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{label}</span>
          </a>
        );
      })}
    </nav>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function UIShowcase() {
  usePageMeta("Design System · HKI AI Platform");
  const { theme, toggleTheme } = useTheme();
  const [active, setActive] = useState<string>("overview");

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(e => {
          if (e.isIntersecting) setActive(e.target.id);
        });
      },
      { rootMargin: "-15% 0px -75% 0px" }
    );
    NAV.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className="relative z-10 min-h-screen text-foreground"
      style={{ backgroundColor: "var(--background)" }}
    >
      {/* ─── Sticky header — lives outside all animated containers ─── */}
      <header
        className="sticky top-0 border-b border-border/50 backdrop-blur-xl"
        style={{ zIndex: 100, backgroundColor: "var(--background)" }}
      >
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{
                background: `linear-gradient(135deg, ${IRIS}, ${INDIGO})`,
              }}
            >
              <Palette className="w-3.5 h-3.5 text-white" />
            </div>
            <span
              className="text-sm font-bold text-foreground"
              style={{ fontFamily: SHOWCASE_HEADING_FONT }}
            >
              Design System
            </span>
            <span className="hidden sm:block text-[10px] text-muted-foreground font-medium uppercase tracking-widest">
              HKI AI Platform
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Badge
              className="text-white text-[10px] font-bold tracking-wide hidden sm:inline-flex"
              style={{
                background: `linear-gradient(90deg, ${IRIS}, ${INDIGO})`,
              }}
            >
              @hki/ui
            </Badge>
            <button
              onClick={toggleTheme}
              className="w-8 h-8 rounded-lg flex items-center justify-center bg-muted/60 hover:bg-muted transition-colors"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* ─── All scrollable content below the header ─── */}
      <div className="max-w-7xl mx-auto px-6">
        {/* Hero — plain div, no transforms */}
        <div className="pt-16 pb-14 border-b border-border/50">
          <div className="flex items-center gap-2 mb-5">
            <div
              className="h-px w-10"
              style={{
                background: `linear-gradient(90deg, ${IRIS}, transparent)`,
              }}
            />
            <span
              className="text-[10px] font-black uppercase tracking-[0.25em]"
              style={{ color: IRIS }}
            >
              Custom-Built
            </span>
          </div>

          <h1
            className="text-5xl sm:text-6xl font-extrabold tracking-tight leading-[1.05] mb-5"
            style={{ fontFamily: SHOWCASE_HEADING_FONT }}
          >
            <span className="text-foreground">HKI </span>
            <span
              style={{
                background: `linear-gradient(135deg, ${IRIS} 10%, ${INDIGO} 55%, ${PULSE} 100%)`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Design System
            </span>
          </h1>

          <p className="text-muted-foreground text-base leading-relaxed max-w-xl mb-8">
            Not off-the-shelf. Every component, pattern, and token crafted
            specifically for HKI's enterprise AI Platform — built on Radix,
            styled with brand tokens, optimized for agentic workflows.
          </p>

          <div className="flex flex-wrap gap-2">
            {[
              "Radix UI",
              "Tailwind CSS",
              "Framer Motion",
              "TypeScript",
              "Lucide Icons",
            ].map(t => (
              <Badge
                key={t}
                variant="outline"
                className="text-[11px] font-medium"
              >
                {t}
              </Badge>
            ))}
          </div>
        </div>

        {/* Main layout */}
        <div className="flex gap-14 py-14">
          <div className="w-44 shrink-0">
            <SideNav active={active} />
          </div>

          <div className="flex-1 min-w-0 space-y-24 pb-24">
            <OverviewSection />
            <BrandSection />
            <TypographySection />
            <ComponentsSection />
            <IconsSection />
            <PatternsSection />
            <DefensiveSection />
            <GuardrailsSection />
            <AgenticTraceSection />
            <HitlSection />
          </div>
        </div>
      </div>
    </div>
  );
}
