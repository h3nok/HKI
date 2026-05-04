/**
 * UIShowcase — HKI AI Platform Design System
 * Professional living reference for all custom components, tokens, and patterns.
 */

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
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
  Loader2,
  Moon,
  Sun,
  Fingerprint,
  Sparkles,
  Copy,
  Check,
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
  FONT_FAMILY,
} from "@hki/ui";
import {
  ThinkingAnimation,
  ThinkingInline,
  ThinkingCard,
} from "@/components/chat-ui";
import { useTheme } from "@/contexts/ThemeContext";
import { usePageMeta } from "@/hooks/usePageMeta";

// ── Brand ──────────────────────────────────────────────────────────────────────

const BLUE = "#0066B2";
const RED = "#E31837";
const INDIGO = "#6366F1";
const SHOWCASE_HEADING_FONT =
  (FONT_FAMILY as typeof FONT_FAMILY & { heading?: string }).heading ??
  '"Plus Jakarta Sans", Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif';
const SHOWCASE_BODY_FONT =
  (FONT_FAMILY as typeof FONT_FAMILY & { body?: string }).body ??
  FONT_FAMILY.sans;

// ── Nav ────────────────────────────────────────────────────────────────────────

const NAV = [
  { id: "overview", num: "01", label: "Overview", icon: Sparkles },
  { id: "brand", num: "02", label: "Brand", icon: Palette },
  { id: "type", num: "03", label: "Typography", icon: Type },
  { id: "components", num: "04", label: "Components", icon: Layers },
  { id: "icons", num: "05", label: "Icons", icon: ChevronRight },
  { id: "patterns", num: "06", label: "Patterns", icon: Fingerprint },
  { id: "agentic", num: "07", label: "Agentic", icon: BrainCircuit },
  { id: "states", num: "08", label: "States", icon: ShieldCheck },
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
              style={{ color: BLUE }}
            >
              {num}
            </span>
            <div
              className="h-px flex-1"
              style={{
                background: `linear-gradient(90deg, ${BLUE}50, transparent)`,
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
          { value: "30+", label: "Components", color: BLUE },
          { value: "14", label: "Stream Icons", color: RED },
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
                style={{ background: `${BLUE}0c`, borderColor: `${BLUE}30` }}
              >
                <Icon className="w-4 h-4" style={{ color: BLUE }} />
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
            { t: "Plus Jakarta Sans", c: BLUE },
            { t: "Lucide Icons", c: "#F97316" },
            { t: "HKI Brand Tokens", c: RED },
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
              color: BLUE,
              label: "HKI Blue",
              hex: "#0066B2",
              usage: "Primary — structure, CTAs, links",
            },
            {
              color: RED,
              label: "HKI Red",
              hex: "#E31837",
              usage: "Accent — alerts, highlights, errors",
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
                  grad: `linear-gradient(135deg, ${BLUE}, ${RED})`,
                },
                {
                  label: "AI / Agentic",
                  grad: `linear-gradient(135deg, ${BLUE}, ${INDIGO})`,
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
                  grad: `linear-gradient(135deg, ${BLUE}14, ${RED}14)`,
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
                  <Logo height={32} />
                </div>
                <p className="text-[10px] text-muted-foreground">Logo</p>
              </div>
              <div className="text-center space-y-1.5">
                <div
                  className="p-4 rounded-xl inline-flex items-center justify-center"
                  style={{
                    background: `linear-gradient(135deg, ${BLUE}14, ${RED}14)`,
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
      subtitle="Plus Jakarta Sans for headings, Inter for body, JetBrains Mono for code — exported as FONT_FAMILY tokens."
    >
      <div className="grid sm:grid-cols-3 gap-4">
        {[
          {
            role: "Heading",
            display: "Plus Jakarta Sans",
            weight: "800 · Extra Bold",
            family: SHOWCASE_HEADING_FONT,
            token: "FONT_FAMILY.heading",
          },
          {
            role: "Body",
            display: "Inter / System",
            weight: "400 · Regular",
            family: SHOWCASE_BODY_FONT,
            token: "FONT_FAMILY.body",
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
                sample: "Value Stream Icons",
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
            <Button style={{ background: BLUE, color: "white" }}>
              HKI Blue
            </Button>
            <Button style={{ background: RED, color: "white" }}>
              HKI Red
            </Button>
            <Button
              style={{
                background: `linear-gradient(135deg, ${BLUE}, ${INDIGO})`,
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
          <Badge className="text-white" style={{ background: BLUE }}>
            HKI Blue
          </Badge>
          <Badge className="text-white" style={{ background: RED }}>
            HKI Red
          </Badge>
          <Badge
            className="text-white text-[10px] font-bold"
            style={{ background: `linear-gradient(90deg, ${BLUE}, ${INDIGO})` }}
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
              style={{ borderColor: `${BLUE}40`, background: `${BLUE}06` }}
            >
              <CardHeader>
                <CardTitle className="text-sm" style={{ color: BLUE }}>
                  Branded Card
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Elevated variant with HKI Blue tint — for featured content.
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
      title="Value Stream Icons"
      subtitle="14 HKI-domain SVG icons. Blue for structure, Red for the defining accent. IDs are varchar(8) for direct database storage."
    >
      <Demo title="Full Set">
        <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 gap-2">
          {STREAM_ICON_OPTIONS.map(({ id, label, Icon }) => (
            <motion.div
              key={id}
              whileHover={{ scale: 1.08, y: -3 }}
              onHoverStart={() => setHovered(id)}
              onHoverEnd={() => setHovered(null)}
              className="flex flex-col items-center gap-2 p-3 rounded-xl cursor-default"
              style={{
                background:
                  hovered === id
                    ? `linear-gradient(135deg, ${BLUE}0d, ${RED}0d)`
                    : "transparent",
                border: `1px solid ${hovered === id ? `${BLUE}40` : "transparent"}`,
                transition: "background 0.2s, border-color 0.2s",
              }}
            >
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
      color: BLUE,
    },
    {
      id: "b",
      label: "Gradient Accent Bar",
      desc: "Top-edge gradient animates from transparent to layer color on hover",
      color: RED,
    },
    {
      id: "c",
      label: "Dual-Layer Shadow",
      desc: "Solid base shadow plus colored ambient glow for perceived depth",
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
              style={{ background: BLUE, color: "white" }}
            >
              HKI Button
            </Button>
            <div
              className="relative p-4 rounded-xl border-2 cursor-default"
              style={{
                borderColor: `${BLUE}65`,
                background: `${BLUE}0b`,
                boxShadow: `0 4px 16px ${BLUE}20`,
              }}
            >
              <div
                className="absolute top-0 left-0 right-0 h-0.5 rounded-t-xl"
                style={{
                  background: `linear-gradient(90deg, transparent, ${BLUE}, transparent)`,
                }}
              />
              <p className="text-sm font-semibold mb-0.5">HKI Custom Card</p>
              <p className="text-xs text-muted-foreground">
                Branded tint · gradient accent · ambient shadow
              </p>
            </div>
          </div>
        </Demo>
      </div>
    </Section>
  );
}

// ── Section 07 · Agentic ───────────────────────────────────────────────────────

function AgenticSection() {
  const [variant, setVariant] = useState<"minimal" | "standard" | "expanded">(
    "standard"
  );

  return (
    <Section
      id="agentic"
      num="07"
      title="Agentic Components"
      subtitle="Purpose-built for AI chat, agent reasoning displays, and streaming response surfaces. No analogues in generic component libraries."
    >
      <Demo title="ThinkingAnimation · Interactive">
        <div className="flex gap-2 mb-6">
          {(["minimal", "standard", "expanded"] as const).map(v => (
            <button
              key={v}
              onClick={() => setVariant(v)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all"
              style={{
                background: variant === v ? BLUE : "var(--muted)",
                color: variant === v ? "#fff" : "var(--muted-foreground)",
                boxShadow: variant === v ? `0 2px 10px ${BLUE}45` : "none",
              }}
            >
              {v}
            </button>
          ))}
        </div>

        <div
          className="flex items-center justify-center rounded-xl py-14"
          style={{ background: `${BLUE}06` }}
        >
          <ThinkingAnimation variant={variant} />
        </div>

        <div className="grid grid-cols-3 gap-4 mt-5">
          {(["minimal", "standard", "expanded"] as const).map(v => (
            <div
              key={v}
              className="flex flex-col items-center gap-3 p-4 rounded-xl bg-muted/30 border border-border/50"
            >
              <ThinkingAnimation variant={v} showLabel={false} />
              <p className="text-[10px] text-muted-foreground capitalize font-semibold">
                {v}
              </p>
            </div>
          ))}
        </div>
      </Demo>

      <Demo title="ThinkingInline + ThinkingCard">
        <div className="space-y-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
              Inline — used in chat bubbles
            </p>
            <div className="inline-flex items-center gap-3 px-4 py-3 rounded-xl bg-muted/40 border border-border/60">
              <ThinkingInline />
              <span className="text-sm text-muted-foreground">
                Agent is reasoning…
              </span>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
              Card — for step-by-step traces
            </p>
            <div className="max-w-sm space-y-2.5">
              <ThinkingCard
                title="Analyzing your request"
                description="Understanding context and planning approach…"
              />
              <ThinkingCard
                title="Searching knowledge base"
                description="Finding relevant docs across 14,000 vectors"
              />
            </div>
          </div>
        </div>
      </Demo>
    </Section>
  );
}

// ── Section 08 · States ────────────────────────────────────────────────────────

type BannerType = "success" | "info" | "loading" | "warning" | "error";

const BANNER_CONFIG: Record<
  BannerType,
  { icon: React.ElementType; color: string; bg: string }
> = {
  success: { icon: CheckCircle2, color: "#10B981", bg: "#10B98110" },
  info: { icon: Info, color: BLUE, bg: `${BLUE}10` },
  loading: { icon: Loader2, color: BLUE, bg: `${BLUE}10` },
  warning: { icon: AlertTriangle, color: "#F59E0B", bg: "#F59E0B10" },
  error: { icon: XCircle, color: RED, bg: `${RED}10` },
};

function StatesSection() {
  const banners: { type: BannerType; title: string; msg: string }[] = [
    {
      type: "success",
      title: "Knowledge base synced",
      msg: "127 documents indexed · 3 updated · Last run: 2 min ago",
    },
    {
      type: "info",
      title: "Retrieval in progress",
      msg: "Semantic search running against 14,000 vectors…",
    },
    {
      type: "loading",
      title: "Agent is thinking",
      msg: "Reasoning step 2 of 4 — planning tool calls",
    },
    {
      type: "warning",
      title: "Rate limit approaching",
      msg: "85% of daily token budget consumed. Consider optimizing prompts.",
    },
    {
      type: "error",
      title: "Knowledge ingestion failed",
      msg: "File 'Q4_SOP.pdf' could not be parsed — unsupported encoding.",
    },
  ];

  return (
    <Section
      id="states"
      num="08"
      title="States & Feedback"
      subtitle="Defensive UI patterns for every edge case — empty, loading, error, success, and inline validation."
    >
      <Demo title="Status Banners">
        <div className="space-y-2.5">
          {banners.map(({ type, title, msg }) => {
            const { icon: Icon, color, bg } = BANNER_CONFIG[type];
            return (
              <div
                key={type}
                className="flex items-start gap-3 p-4 rounded-xl border"
                style={{ background: bg, borderColor: `${color}25` }}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 mt-0.5 ${type === "loading" ? "animate-spin" : ""}`}
                  style={{ color }}
                />
                <div>
                  <p className="text-sm font-semibold" style={{ color }}>
                    {title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    {msg}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </Demo>

      <div className="grid sm:grid-cols-3 gap-4">
        <Demo title="Empty State">
          <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{
                background: `${BLUE}0d`,
                border: `1.5px dashed ${BLUE}45`,
              }}
            >
              <StreamIcon id="pkg" size={24} />
            </div>
            <div>
              <p className="text-sm font-semibold">No value streams yet</p>
              <p className="text-xs text-muted-foreground mt-0.5 max-w-40 leading-snug">
                Create a stream to scope the agent to a business domain.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              style={{ borderColor: `${BLUE}40`, color: BLUE }}
            >
              Create Stream
            </Button>
          </div>
        </Demo>

        <Demo title="Skeleton Loading">
          <div className="space-y-3.5">
            {[80, 65, 72].map((w, i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="w-10 h-10 rounded-xl bg-muted shrink-0" />
                <div className="flex-1 space-y-2">
                  <div
                    className="h-3 bg-muted rounded"
                    style={{ width: `${w}%` }}
                  />
                  <div
                    className="h-2.5 bg-muted/60 rounded"
                    style={{ width: `${w - 22}%` }}
                  />
                </div>
                <div className="h-5 w-12 bg-muted rounded-full shrink-0" />
              </div>
            ))}
          </div>
        </Demo>

        <Demo title="Inline Validation">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                Valid
              </p>
              <Input
                defaultValue="pharmacy"
                className="border-emerald-500/60 focus-visible:ring-emerald-500/30"
              />
              <p className="text-[11px] text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> ID is available
              </p>
            </div>
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                Error
              </p>
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
              color: on ? BLUE : "var(--muted-foreground)",
              background: on ? `${BLUE}0e` : "transparent",
              fontWeight: on ? 600 : 400,
            }}
          >
            {on && (
              <div
                className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full"
                style={{ background: BLUE }}
              />
            )}
            <span
              className="text-[9px] font-mono tabular-nums shrink-0"
              style={{
                color: on ? BLUE : "var(--muted-foreground)",
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
                background: `linear-gradient(135deg, ${BLUE}, ${INDIGO})`,
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
                background: `linear-gradient(90deg, ${BLUE}, ${INDIGO})`,
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
                background: `linear-gradient(90deg, ${BLUE}, transparent)`,
              }}
            />
            <span
              className="text-[10px] font-black uppercase tracking-[0.25em]"
              style={{ color: BLUE }}
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
                background: `linear-gradient(135deg, ${BLUE} 10%, ${INDIGO} 55%, ${RED} 100%)`,
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
            <AgenticSection />
            <StatesSection />
          </div>
        </div>
      </div>
    </div>
  );
}
