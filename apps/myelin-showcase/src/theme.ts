/**
 * Myelin Showcase — semantic class tokens.
 * Mirrors the k.* object from apps/agentic/pages/knowledge/theme.ts.
 * All values derive from @hki/ui tokens. No hex codes. No inline colors.
 */

export const m = {
  // ── Surfaces ──
  ground: "bg-background plane-publication",
  card: "surface-stamped text-card-foreground",
  inset: "surface-precision text-card-foreground",

  // ── Type scale — matches agentic app (NOT the marketing scale) ──
  /** 18px / semibold / tight — page titles */
  display: "text-lg font-semibold tracking-tight text-foreground",
  /** 14px / semibold — section titles, card headers */
  heading: "text-sm font-semibold text-foreground",
  /** 14px / normal — secondary content */
  subtext: "text-sm text-muted-foreground",
  /** 12px / normal — muted / tertiary */
  muted: "text-xs text-muted-foreground",
  /** 12px / medium — captions */
  caption: "text-xs font-medium text-muted-foreground",
  /** 11px / bold / widest — section labels */
  label:
    "text-[11px] font-bold uppercase tracking-widest text-muted-foreground/70",
  /** 12px / mono / tabular */
  mono: "text-xs font-mono tabular-nums text-muted-foreground",

  // ── Accent ──
  accentText: "text-primary",
  accentBg: "bg-primary/10",
  accentBorder: "border-primary/20",

  // ── Interactive ──
  focusRing:
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",

  // ── Status ──
  statusOk: "text-emerald-400",
  statusWarn: "text-amber-400",
  statusError: "text-destructive",
  statusIdle: "text-muted-foreground/50",
} as const;
