/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * HKI ATELIER — Tailwind Utility Presets
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Editorial, hairline-precise productivity surfaces.
 * Token-only: every preset resolves to semantic CSS variables, never raw hex.
 * Pair with the `cn()` helper for conditional class composition.
 *
 * Vocabulary
 * ----------
 *   surface          — single elevated paper surface
 *   surfaceInteractive — same, with hairline-only hover
 *   sectionHeader     — eyebrow + title + actions row
 *   eyebrow / display / heading / subheading / body / caption / mono / metric
 *   divider          — 1px hairline, semantic border
 *
 * No glass, no shadow stacks, no scale-on-hover. Motion is colour/border only.
 */

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// ═══════════════════════════════════════════════════════════════════════════════
// CLASS COMPOSITION
// ═══════════════════════════════════════════════════════════════════════════════

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

// ═══════════════════════════════════════════════════════════════════════════════
// ATELIER PRESETS
// ═══════════════════════════════════════════════════════════════════════════════

export const ui = {
  // ── Surfaces ────────────────────────────────────────────────────────────
  /** Single elevated paper surface — hairline border, no shadow stack. */
  surface: "bg-card border border-border/70 rounded-md",
  /** Interactive surface — colour-only hover, no lift. */
  surfaceInteractive:
    "bg-card border border-border/70 rounded-md transition-colors duration-150 ease-out hover:border-border focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
  /** Recessed ground area (e.g. inset panel inside a surface). */
  surfaceMuted: "bg-muted/40 rounded-md",
  /** Compatibility aliases for legacy callers. */
  card: "bg-card border border-border/70 rounded-md",
  cardInteractive:
    "bg-card border border-border/70 rounded-md transition-colors duration-150 ease-out hover:border-border focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",

  // ── Typography ──────────────────────────────────────────────────────────
  /** Hero numerals / page-title display. */
  display:
    "text-4xl sm:text-5xl font-extrabold tracking-[-0.022em] leading-[1.05] text-foreground",
  /** Page title. */
  title:
    "text-2xl sm:text-3xl font-extrabold tracking-[-0.018em] leading-[1.1] text-foreground",
  /** Section heading. */
  heading:
    "text-lg font-semibold tracking-[-0.01em] leading-[1.2] text-foreground",
  /** Subheading / list-item title. */
  subheading: "text-sm font-semibold tracking-[-0.005em] text-foreground",
  /** Eyebrow label — uppercase tracked, used everywhere as section/stat label. */
  eyebrow:
    "text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-muted-foreground",
  /** Body copy. */
  body: "text-sm leading-[1.6] text-foreground",
  /** Smaller body / supporting copy. */
  bodySm: "text-xs leading-[1.55] text-muted-foreground",
  /** Tertiary copy / fine print. */
  caption: "text-[0.6875rem] leading-[1.5] text-muted-foreground",
  /** IDs, timestamps, slash-commands. */
  mono: "font-mono text-[0.8125rem] tracking-[-0.01em] text-foreground tabular-nums",
  /** Hero metric numeral — tabular, tightly tracked. */
  metric:
    "text-3xl sm:text-4xl font-extrabold tracking-[-0.025em] tabular-nums leading-[1] text-foreground",
  /** Compact metric. */
  metricSm:
    "text-xl font-bold tracking-[-0.02em] tabular-nums leading-[1.1] text-foreground",

  // Legacy heading aliases — point at the new scale so existing pages migrate cleanly.
  h1: "text-2xl sm:text-3xl font-extrabold tracking-[-0.018em] leading-[1.1] text-foreground",
  h2: "text-xl sm:text-2xl font-extrabold tracking-[-0.015em] leading-[1.15] text-foreground",
  h3: "text-lg font-semibold tracking-[-0.01em] text-foreground",
  h4: "text-base font-semibold tracking-[-0.005em] text-foreground",
  h5: "text-sm font-semibold text-foreground",
  h6: "text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground",
  display1:
    "text-4xl sm:text-5xl font-extrabold tracking-[-0.022em] leading-[1.05] text-foreground",
  display2:
    "text-3xl sm:text-4xl font-extrabold tracking-[-0.02em] leading-[1.08] text-foreground",
  textBody: "text-sm leading-[1.6] text-foreground",
  textBodyLg: "text-base leading-[1.6] text-foreground",
  textMuted: "text-sm text-muted-foreground",
  textLabel:
    "text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-muted-foreground",
  textCaption: "text-[0.6875rem] leading-[1.5] text-muted-foreground",
  textHelp: "text-xs text-muted-foreground mt-1",
  textError: "text-xs text-destructive mt-1",

  // ── Section header ──────────────────────────────────────────────────────
  /** Container row for SectionHeader composition. */
  sectionHeader:
    "flex items-end justify-between gap-6 pb-3 border-b border-border/70",
  sectionHeaderTitleStack: "flex flex-col gap-1.5",
  sectionHeaderActions: "flex items-center gap-2",

  // ── Links ───────────────────────────────────────────────────────────────
  link: "text-primary underline-offset-4 hover:underline transition-colors duration-150 ease-out",
  linkSubtle:
    "text-muted-foreground hover:text-foreground transition-colors duration-150 ease-out",
  linkNav:
    "text-muted-foreground hover:text-foreground font-medium transition-colors duration-150 ease-out",

  // ── Buttons ─────────────────────────────────────────────────────────────
  btn: "inline-flex items-center justify-center gap-2 font-medium transition-colors duration-150 ease-out disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
  btnPrimary:
    "inline-flex items-center justify-center gap-2 px-3.5 h-9 rounded-md text-sm font-medium bg-primary text-primary-foreground transition-colors duration-150 ease-out hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  btnSecondary:
    "inline-flex items-center justify-center gap-2 px-3.5 h-9 rounded-md text-sm font-medium border border-border bg-card text-foreground transition-colors duration-150 ease-out hover:border-foreground/40 disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
  btnOutline:
    "inline-flex items-center justify-center gap-2 px-3.5 h-9 rounded-md text-sm font-medium border border-border text-foreground transition-colors duration-150 ease-out hover:bg-muted/40 hover:border-foreground/40 disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
  btnGhost:
    "inline-flex items-center gap-2 px-2.5 h-9 rounded-md text-sm font-medium text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground hover:bg-muted/40 disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
  btnDanger:
    "inline-flex items-center justify-center gap-2 px-3.5 h-9 rounded-md text-sm font-medium bg-destructive text-destructive-foreground transition-colors duration-150 ease-out hover:bg-destructive/90 disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-destructive",
  btnIcon:
    "inline-flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground hover:bg-muted/40 disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
  btnIconSm:
    "inline-flex items-center justify-center w-7 h-7 rounded text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground hover:bg-muted/40",
  btnSm: "h-7 px-2.5 text-xs rounded",
  btnLg: "h-10 px-5 text-sm",

  // ── Inputs ──────────────────────────────────────────────────────────────
  input:
    "w-full h-9 px-3 rounded-md border border-border bg-card text-sm text-foreground transition-colors duration-150 ease-out placeholder:text-muted-foreground focus:outline-none focus:border-primary focus-visible:ring-1 focus-visible:ring-primary",
  inputError:
    "w-full h-9 px-3 rounded-md border border-destructive bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-destructive focus-visible:ring-1 focus-visible:ring-destructive",
  inputSm: "h-7 px-2.5 text-xs rounded",
  inputLg: "h-10 px-3.5 text-sm",
  /** Borderless input — for prompt input or topbar search. */
  inputBare:
    "w-full h-9 px-2 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none border-0",

  // ── Badges (outline first; pair with tone classes) ──────────────────────
  badge:
    "inline-flex items-center gap-1.5 px-2 h-5 rounded text-[0.6875rem] font-medium uppercase tracking-[0.06em] border",
  badgeLg: "h-6 px-2.5 text-xs",
  badgeNeutral: "border-border text-muted-foreground",
  badgeBrand: "border-primary/40 text-primary",
  badgeSuccess: "border-success/40 text-success",
  badgeWarning: "border-warning/40 text-warning",
  badgeError: "border-destructive/40 text-destructive",
  badgeInfo: "border-info/40 text-info",
  // Filled variants
  badgeFilledNeutral: "bg-muted text-foreground border-transparent",
  badgeFilledBrand: "bg-primary text-primary-foreground border-transparent",
  badgeFilledSuccess: "bg-success text-success-foreground border-transparent",
  badgeFilledWarning: "bg-warning text-warning-foreground border-transparent",
  badgeFilledError:
    "bg-destructive text-destructive-foreground border-transparent",
  badgePrimary: "border-primary/40 text-primary",
  badgeSolid: "bg-foreground text-background border-transparent",

  // ── Status dots ─────────────────────────────────────────────────────────
  statusDot: "w-1.5 h-1.5 rounded-full",
  statusDotLg: "w-2 h-2 rounded-full",
  statusDotSuccess: "bg-success",
  statusDotWarning: "bg-warning",
  statusDotError: "bg-destructive",
  statusDotInfo: "bg-info",
  statusDotNeutral: "bg-muted-foreground",
  statusDotPulse: "animate-pulse",

  // ── Icons & avatars ─────────────────────────────────────────────────────
  iconBox: "flex items-center justify-center rounded-md text-muted-foreground",
  iconBoxSm: "w-7 h-7",
  iconBoxMd: "w-9 h-9",
  iconBoxLg: "w-11 h-11",
  iconBoxXl: "w-14 h-14",
  avatar:
    "rounded-full bg-muted flex items-center justify-center font-medium text-foreground",
  avatarXs: "w-6 h-6 text-[0.6875rem]",
  avatarSm: "w-7 h-7 text-xs",
  avatarMd: "w-8 h-8 text-xs",
  avatarLg: "w-10 h-10 text-sm",
  avatarXl: "w-14 h-14 text-base",

  // ── Focus / a11y ────────────────────────────────────────────────────────
  focusRing:
    "focus:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  focusRingOnCard:
    "focus:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card",
  focusRingError:
    "focus:outline-none focus-visible:ring-1 focus-visible:ring-destructive focus-visible:ring-offset-2",
  focusWithin: "focus-within:ring-1 focus-within:ring-primary",
  srOnly: "sr-only",

  // ── Layout ──────────────────────────────────────────────────────────────
  container: "mx-auto max-w-[1320px] px-6 sm:px-8 lg:px-10",
  containerNarrow: "mx-auto max-w-3xl px-6",
  containerWide: "mx-auto max-w-[1440px] px-6 sm:px-8 lg:px-10",
  section: "py-10 sm:py-12",
  sectionSm: "py-6 sm:py-8",
  sectionLg: "py-14 sm:py-16",
  stack: "flex flex-col",
  stackSm: "flex flex-col gap-2",
  stackMd: "flex flex-col gap-4",
  stackLg: "flex flex-col gap-6",
  stackXl: "flex flex-col gap-10",
  row: "flex flex-row items-center",
  rowSm: "flex flex-row items-center gap-2",
  rowMd: "flex flex-row items-center gap-4",
  rowLg: "flex flex-row items-center gap-6",
  /** Atelier signature: 8/4 asymmetric grid. */
  gridAsymmetric: "grid grid-cols-1 lg:grid-cols-12 gap-x-8 gap-y-6",
  gridSpanMain: "lg:col-span-8",
  gridSpanSide: "lg:col-span-4",

  // ── Dividers ────────────────────────────────────────────────────────────
  divider: "border-t border-border/70",
  dividerSubtle: "border-t border-border/40",
  dividerVertical: "border-l border-border/70 h-full",
  /** Inset hairline used inside surfaces — slightly fainter than `divider`. */
  inset: "border-t border-border/40",

  // ── Loading ─────────────────────────────────────────────────────────────
  skeleton: "animate-pulse bg-muted/60 rounded",
  skeletonText: "animate-pulse bg-muted/60 rounded h-3.5",
  skeletonCircle: "animate-pulse bg-muted/60 rounded-full",
  spinner: "animate-spin rounded-full border-2 border-border border-t-primary",
  spinnerSm: "w-3.5 h-3.5",
  spinnerMd: "w-5 h-5",
  spinnerLg: "w-7 h-7",

  // ── Nav / tabs ──────────────────────────────────────────────────────────
  tabBar: "flex items-center gap-4 border-b border-border/70 -mb-px",
  tab: "relative flex items-center gap-2 px-0.5 pb-2.5 text-sm font-medium text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground",
  tabActive:
    "text-foreground after:absolute after:left-0 after:right-0 after:-bottom-px after:h-px after:bg-foreground",
  tabInactive: "",
  /** Sidebar nav item — hairline left accent on active, no filled pill. */
  navItem:
    "relative flex items-center gap-2.5 pl-3 pr-2 h-8 rounded-r text-sm font-medium transition-colors duration-150 ease-out",
  navItemActive:
    "text-foreground bg-muted/50 before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-px before:bg-primary",
  navItemInactive:
    "text-muted-foreground hover:text-foreground hover:bg-muted/30",
  pillSelected: "bg-foreground text-background",
  pillUnselected:
    "bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted/60",
  menuItemActive: "bg-muted/60 text-foreground",
  menuItemHover: "hover:bg-muted/40",

  // ── Overlays ────────────────────────────────────────────────────────────
  overlay: "fixed inset-0 bg-foreground/40",
  overlayLight: "fixed inset-0 bg-background/80",
  backdrop: "bg-foreground/40",

  // ── Scroll ──────────────────────────────────────────────────────────────
  scrollY: "overflow-y-auto",
  scrollX: "overflow-x-auto",
  scrollSmooth: "scroll-smooth",
  scrollbar:
    "scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent",
  noScrollbar: "scrollbar-none",

  // ── Prose ───────────────────────────────────────────────────────────────
  prose:
    "prose max-w-none prose-headings:text-foreground prose-headings:font-semibold prose-headings:tracking-tight prose-p:text-foreground prose-p:leading-[1.65] prose-a:text-primary prose-strong:text-foreground prose-code:font-mono prose-code:text-[0.8125rem]",

  // ── Animations ──────────────────────────────────────────────────────────
  animateFadeIn: "animate-in fade-in duration-200",
  animateSlideIn: "animate-in slide-in-from-bottom-2 duration-200",
  animateScaleIn: "animate-in zoom-in-[0.98] duration-150",
  animateOut: "animate-out fade-out duration-150",

  // ── Transitions ─────────────────────────────────────────────────────────
  transition: "transition-colors duration-150 ease-out",
  transitionFast: "transition-colors duration-100 ease-out",
  transitionSlow: "transition-colors duration-200 ease-out",
  transitionColors: "transition-colors duration-150 ease-out",
  transitionTransform: "transition-transform duration-150 ease-out",
  transitionOpacity: "transition-opacity duration-150 ease-out",

  // ── Number formatting helpers ───────────────────────────────────────────
  tabular: "tabular-nums",
  numerals: "tabular-nums tracking-[-0.01em]",
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/** Apply gradient text styling. */
export function gradientText(gradient: string): string {
  return cn("bg-clip-text text-transparent bg-gradient-to-r", gradient);
}

/** Apply classes when condition is true. */
export function when(condition: boolean, classes: string): string {
  return condition ? classes : "";
}

/** Apply one of two class sets based on condition. */
export function either(
  condition: boolean,
  trueClasses: string,
  falseClasses: string,
): string {
  return condition ? trueClasses : falseClasses;
}

export type UIUtilities = typeof ui;

// ═══════════════════════════════════════════════════════════════════════════════
// HUB LANDING PAGE PRESETS  (token-based; unchanged contract)
// ═══════════════════════════════════════════════════════════════════════════════

const hubPage =
  "min-h-screen flex flex-col bg-background text-foreground font-sans transition-colors";
const hubPageInner = "flex-1 flex flex-col";

const hubCard = "bg-card border border-border/70 rounded-md";
const hubGround = "bg-muted/40";
const hubRaised = "bg-card";
const hubGlass = "bg-card/80 border border-border/60 backdrop-blur";

const hubHeading = "text-foreground";
const hubTextPrimary = "text-foreground";
const hubTextSecondary = "text-muted-foreground";
const hubTextMuted = "text-muted-foreground/70";
const hubTextFaint = "text-muted-foreground/30";

const hubBorder = "border-border";
const hubBorderSubtle = "border-border/60";
const hubDivider = "bg-border";
const hubDividerSubtle = "bg-border/60";

const hubHoverBorder = "hover:border-foreground/40";
const hubHoverBg = "hover:bg-muted/40";
const hubAccent = "text-primary";
const hubAccentHover = "hover:text-primary";
const hubGroupAccent = "group-hover:text-primary";
const hubFocusRing =
  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

const hubPillGround = "bg-muted/40 border border-border/70 rounded-full";
const hubPillButton =
  "bg-card border border-border/70 text-foreground hover:bg-muted/40 hover:border-foreground/40 transition-colors font-medium rounded-full";

const hubIconMuted = "text-muted-foreground/70";
const hubIconDefault = "text-muted-foreground";

const hubFooterBar = "border-t border-border/60 bg-card/40";
const hubFooterLink =
  "text-sm text-muted-foreground hover:text-primary transition-colors font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-md px-1";

const hubCardInteractive = `${hubCard} ${hubHoverBorder} transition-colors duration-150 ease-out`;
const hubSectionHeading = `text-2xl font-extrabold tracking-tight ${hubHeading}`;
const hubBodyText = `${hubTextSecondary} leading-[1.6]`;

export const hub = {
  page: hubPage,
  pageInner: hubPageInner,
  card: hubCard,
  cardInteractive: hubCardInteractive,
  ground: hubGround,
  raised: hubRaised,
  glass: hubGlass,
  heading: hubHeading,
  textPrimary: hubTextPrimary,
  textSecondary: hubTextSecondary,
  textMuted: hubTextMuted,
  textFaint: hubTextFaint,
  sectionHeading: hubSectionHeading,
  bodyText: hubBodyText,
  border: hubBorder,
  borderSubtle: hubBorderSubtle,
  divider: hubDivider,
  dividerSubtle: hubDividerSubtle,
  hoverBorder: hubHoverBorder,
  hoverBg: hubHoverBg,
  accent: hubAccent,
  accentHover: hubAccentHover,
  groupAccent: hubGroupAccent,
  focusRing: hubFocusRing,
  pillGround: hubPillGround,
  pillButton: hubPillButton,
  iconMuted: hubIconMuted,
  iconDefault: hubIconDefault,
  footerBar: hubFooterBar,
  footerLink: hubFooterLink,
} as const;

export type HubPresets = typeof hub;
