/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * SIGNATURE DESIGN SYSTEM — Tailwind Utility Classes
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Pre-composed Tailwind class strings for consistent UI patterns.
 * Use these with the `cn()` utility for conditional class composition.
 *
 * Usage:
 *   import { ui, cn } from '@signature/ui';
 *   <div className={cn(ui.card, isActive && ui.cardActive)} />
 */

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// ═══════════════════════════════════════════════════════════════════════════════
// CLASS COMPOSITION UTILITY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Merge Tailwind classes with conflict resolution
 * Combines clsx for conditionals + tailwind-merge for deduplication
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

// ═══════════════════════════════════════════════════════════════════════════════
// SURFACE UTILITIES — Glass & Card Patterns
// ═══════════════════════════════════════════════════════════════════════════════

export const ui = {
  // ─────────────────────────────────────────────────────────────────────────────
  // GLASS MORPHISM — warm-tinted frosted surfaces
  // ─────────────────────────────────────────────────────────────────────────────
  glass:
    "bg-white/70 dark:bg-[#1e1e1e]/70 backdrop-blur-xl border border-[#e0dfdc]/40 dark:border-[#333333]/40",
  glassStrong:
    "bg-white/85 dark:bg-[#1e1e1e]/85 backdrop-blur-xl border border-[#e0dfdc]/60 dark:border-[#333333]/60",
  glassMuted:
    "bg-[#faf9f7]/60 dark:bg-[#161616]/60 backdrop-blur-lg border border-[#eae9e6]/30 dark:border-[#2a2a2a]/30",
  glassDark: "bg-[#111111]/70 backdrop-blur-xl border border-[#333333]/40",

  // ─────────────────────────────────────────────────────────────────────────────
  // CARDS — warm neutrals, quiet borders, soft depth
  //   Surface hierarchy: page → ground → card → raised → overlay
  // ─────────────────────────────────────────────────────────────────────────────
  card: "bg-white dark:bg-[#1e1e1e] rounded-xl border border-[#e0dfdc] dark:border-[#333333] shadow-[0_1px_3px_0_rgba(0,0,0,0.06),0_1px_2px_-1px_rgba(0,0,0,0.04)] dark:shadow-[0_1px_3px_0_rgba(0,0,0,0.3)]",
  cardGlass:
    "bg-white/80 dark:bg-[#1e1e1e]/80 backdrop-blur-xl rounded-2xl border border-[#e0dfdc]/50 dark:border-[#333333]/50 shadow-sm",
  cardInteractive:
    "bg-card rounded-xl border border-border shadow-sm hover:shadow-md hover:border-border/80 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
  cardGlassInteractive:
    "bg-white/80 dark:bg-[#1e1e1e]/80 backdrop-blur-xl rounded-2xl border border-[#e0dfdc]/50 dark:border-[#333333]/50 shadow-sm hover:shadow-lg hover:border-[#d1d0cd]/60 dark:hover:border-[#444444]/60 transition-all cursor-pointer",
  cardElevated:
    "bg-white dark:bg-[#242424] rounded-xl border border-[#e0dfdc] dark:border-[#333333] shadow-md dark:shadow-[0_4px_6px_-2px_rgba(0,0,0,0.35)]",
  cardFlat:
    "bg-[#f3f2ef] dark:bg-[#1a1a1a] rounded-xl border border-[#eae9e6] dark:border-[#2a2a2a]",

  // ─────────────────────────────────────────────────────────────────────────────
  // TYPOGRAPHY — Headings (warm black, not cold gray-900)
  // ─────────────────────────────────────────────────────────────────────────────
  h1: "text-3xl sm:text-4xl font-bold tracking-tight text-[#1a1a19] dark:text-[#f5f4f1]",
  h2: "text-2xl sm:text-3xl font-bold tracking-tight text-[#1a1a19] dark:text-[#f5f4f1]",
  h3: "text-xl font-semibold text-[#1a1a19] dark:text-[#f5f4f1]",
  h4: "text-lg font-semibold text-[#1a1a19] dark:text-[#f5f4f1]",
  h5: "text-base font-semibold text-[#1a1a19] dark:text-[#f5f4f1]",
  h6: "text-sm font-semibold text-[#1a1a19] dark:text-[#f5f4f1]",

  // Page titles (larger scale for hero/landing)
  display1:
    "text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-[#1a1a19] dark:text-[#f5f4f1]",
  display2:
    "text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#1a1a19] dark:text-[#f5f4f1]",

  // ─────────────────────────────────────────────────────────────────────────────
  // TYPOGRAPHY — Text Styles (warm secondary, never cold gray)
  // ─────────────────────────────────────────────────────────────────────────────
  textBody: "text-[#525150] dark:text-[#a3a29f] leading-relaxed",
  textBodyLg: "text-lg text-[#525150] dark:text-[#a3a29f] leading-relaxed",
  textMuted: "text-sm text-[#8a8986] dark:text-[#6f6e6b]",
  textLabel: "text-sm font-medium text-[#6f6e6b] dark:text-[#a3a29f] uppercase tracking-wider",
  textCaption: "text-xs text-[#8a8986] dark:text-[#6f6e6b]",
  textHelp: "text-sm text-[#6f6e6b] dark:text-[#a3a29f] mt-1",
  textError: "text-sm text-destructive mt-1",

  // ─────────────────────────────────────────────────────────────────────────────
  // LINKS — HKI Blue duotone accent
  // ─────────────────────────────────────────────────────────────────────────────
  link: "text-primary hover:text-primary/80 underline-offset-4 hover:underline transition-colors",
  linkSubtle: "text-muted-foreground hover:text-foreground transition-colors",
  linkNav: "text-muted-foreground hover:text-foreground font-medium transition-colors",

  // ─────────────────────────────────────────────────────────────────────────────
  // BUTTONS — HKI Duotone: Blue primary, Red danger/emphasis
  // ─────────────────────────────────────────────────────────────────────────────
  btn: "inline-flex items-center justify-center gap-2 font-semibold transition-all disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
  btnPrimary:
    "inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold bg-primary text-primary-foreground shadow-sm hover:bg-primary/85 hover:shadow-md transition-all disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
  btnSecondary:
    "inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold bg-muted hover:bg-muted/80 text-foreground border border-border transition-all disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
  btnOutline:
    "inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold border-2 border-border hover:border-border/80 hover:bg-muted text-foreground transition-all disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
  btnGhost:
    "inline-flex items-center gap-2 px-4 py-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted font-medium transition-all disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
  btnDanger:
    "inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/85 hover:shadow-md transition-all disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2",
  btnIcon:
    "p-2.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
  btnIconSm:
    "p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors disabled:opacity-50 disabled:pointer-events-none",

  // Button sizes (combine with btn* classes)
  btnSm: "px-4 py-2 text-sm rounded-lg",
  btnLg: "px-8 py-4 text-lg rounded-2xl",

  // ─────────────────────────────────────────────────────────────────────────────
  // INPUTS — warm surfaces, HKI Blue focus
  // ─────────────────────────────────────────────────────────────────────────────
  input:
    "w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus:border-primary transition-all placeholder:text-muted-foreground",
  inputGlass:
    "w-full px-4 py-3 rounded-xl border border-border/60 bg-background/80 backdrop-blur-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-all placeholder:text-muted-foreground",
  inputError:
    "w-full px-4 py-3 rounded-xl border border-destructive/40 bg-background text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-destructive focus:border-transparent transition-all placeholder:text-muted-foreground",
  inputSm: "px-3 py-2 text-sm rounded-lg",
  inputLg: "px-5 py-4 text-lg rounded-2xl",

  // ─────────────────────────────────────────────────────────────────────────────
  // BADGES & PILLS — WCAG AA text-on-bg in both modes
  // ─────────────────────────────────────────────────────────────────────────────
  badge: "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border",
  badgeSolid: "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold",
  badgeLg: "px-3 py-1.5 text-sm",

  // Badge variants — explicit dark mode, no wash
  badgeSuccess:
    "bg-[#ecfdf5] dark:bg-[#064e3b]/20 text-[#065f46] dark:text-[#6ee7b7] border-[#a7f3d0] dark:border-[#065f46]",
  badgeWarning:
    "bg-[#fffbeb] dark:bg-[#78350f]/20 text-[#92400e] dark:text-[#fcd34d] border-[#fde68a] dark:border-[#78350f]",
  badgeError:
    "bg-[#fef2f2] dark:bg-[#7f1d1d]/20 text-[#991b1b] dark:text-[#fca5a5] border-[#fecaca] dark:border-[#7f1d1d]",
  badgeInfo:
    "bg-[#eff6ff] dark:bg-[#1e3a5f]/20 text-[#1e40af] dark:text-[#93c5fd] border-[#bfdbfe] dark:border-[#1e3a5f]",
  badgeNeutral:
    "bg-[#f3f2ef] dark:bg-[#242424] text-[#525150] dark:text-[#a3a29f] border-[#e0dfdc] dark:border-[#333333]",
  badgePrimary: "bg-primary/10 text-primary border-primary/30",

  // ─────────────────────────────────────────────────────────────────────────────
  // STATUS INDICATORS
  // ─────────────────────────────────────────────────────────────────────────────
  statusDot: "w-2 h-2 rounded-full",
  statusDotLg: "w-3 h-3 rounded-full",
  statusDotSuccess: "bg-[#16a34a] dark:bg-[#4ade80]",
  statusDotWarning: "bg-[#d97706] dark:bg-[#fbbf24]",
  statusDotError: "bg-[#dc2626] dark:bg-[#f87171]",
  statusDotInfo: "bg-primary",
  statusDotNeutral: "bg-[#a3a29f] dark:bg-[#6f6e6b]",
  statusDotPulse: "animate-pulse",

  // ─────────────────────────────────────────────────────────────────────────────
  // ICONS & AVATARS — warm neutrals
  // ─────────────────────────────────────────────────────────────────────────────
  iconBox: "flex items-center justify-center rounded-xl",
  iconBoxSm: "w-8 h-8",
  iconBoxMd: "w-10 h-10",
  iconBoxLg: "w-12 h-12",
  iconBoxXl: "w-16 h-16",

  avatar:
    "rounded-full bg-[#eae9e6] dark:bg-[#242424] flex items-center justify-center font-medium text-[#525150] dark:text-[#a3a29f]",
  avatarXs: "w-6 h-6 text-xs",
  avatarSm: "w-8 h-8 text-sm",
  avatarMd: "w-10 h-10 text-base",
  avatarLg: "w-12 h-12 text-lg",
  avatarXl: "w-16 h-16 text-xl",

  // ─────────────────────────────────────────────────────────────────────────────
  // FOCUS & ACCESSIBILITY — HKI Blue ring, WCAG 2.4.7
  // ─────────────────────────────────────────────────────────────────────────────
  focusRing:
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  focusRingOnCard:
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card",
  focusRingError:
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2",
  focusWithin: "focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2",
  srOnly: "sr-only",

  // ─────────────────────────────────────────────────────────────────────────────
  // LAYOUT UTILITIES
  // ─────────────────────────────────────────────────────────────────────────────
  container: "mx-auto max-w-7xl px-4 sm:px-6 lg:px-8",
  containerNarrow: "mx-auto max-w-3xl px-4 sm:px-6",
  containerWide: "mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8",

  section: "py-12 sm:py-16 lg:py-20",
  sectionSm: "py-8 sm:py-10",
  sectionLg: "py-16 sm:py-20 lg:py-24",

  stack: "flex flex-col",
  stackSm: "flex flex-col gap-2",
  stackMd: "flex flex-col gap-4",
  stackLg: "flex flex-col gap-6",

  row: "flex flex-row items-center",
  rowSm: "flex flex-row items-center gap-2",
  rowMd: "flex flex-row items-center gap-4",
  rowLg: "flex flex-row items-center gap-6",

  // ─────────────────────────────────────────────────────────────────────────────
  // DIVIDERS — warm neutral borders
  // ─────────────────────────────────────────────────────────────────────────────
  divider: "border-t border-[#e0dfdc] dark:border-[#333333]",
  dividerSubtle: "border-t border-[#eae9e6] dark:border-[#2a2a2a]",
  dividerVertical: "border-l border-[#e0dfdc] dark:border-[#333333] h-full",

  // ─────────────────────────────────────────────────────────────────────────────
  // LOADING STATES — warm skeleton tones
  // ─────────────────────────────────────────────────────────────────────────────
  skeleton: "animate-pulse bg-[#eae9e6] dark:bg-[#242424] rounded",
  skeletonText: "animate-pulse bg-[#eae9e6] dark:bg-[#242424] rounded h-4",
  skeletonCircle: "animate-pulse bg-[#eae9e6] dark:bg-[#242424] rounded-full",
  spinner: "animate-spin rounded-full border-2 border-border border-t-primary",
  spinnerSm: "w-4 h-4",
  spinnerMd: "w-6 h-6",
  spinnerLg: "w-8 h-8",

  // ─────────────────────────────────────────────────────────────────────────────
  // MENU / TAB / NAV — HKI Blue active states
  //   Platform-wide selected-state primitive. Use for tab bars, segmented
  //   controls, sidebar nav items, pill filters, and any selectable menu.
  // ─────────────────────────────────────────────────────────────────────────────

  // Tab / segmented control container
  tabBar: "flex items-center gap-1 p-1 rounded-lg bg-muted",

  // Active tab — solid HKI Blue
  tabActive: "bg-primary text-primary-foreground shadow-sm",
  // Inactive tab
  tabInactive: "text-muted-foreground hover:text-foreground hover:bg-muted-foreground/10",
  // Base tab button (combine with tabActive or tabInactive)
  tab: "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",

  // Sidebar / vertical nav item — subtle HKI Blue tint when active
  navItem: "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all",
  navItemActive: "bg-primary/10 text-primary font-semibold",
  navItemInactive: "text-muted-foreground hover:text-foreground hover:bg-muted",

  // Pill / chip — small selectable items (filters, tags)
  pillSelected: "bg-primary text-primary-foreground",
  pillUnselected: "bg-muted text-muted-foreground hover:bg-muted-foreground/10",

  // Dropdown menu item — highlight row
  menuItemActive: "bg-primary/10 text-primary",
  menuItemHover: "hover:bg-primary/5",

  // ─────────────────────────────────────────────────────────────────────────────
  // OVERLAYS & BACKDROPS
  // ─────────────────────────────────────────────────────────────────────────────
  overlay: "fixed inset-0 bg-black/50 backdrop-blur-sm",
  overlayLight: "fixed inset-0 bg-[#faf9f7]/80 dark:bg-[#111111]/80 backdrop-blur-sm",
  backdrop: "bg-black/50 dark:bg-black/70 backdrop-blur-sm",

  // ─────────────────────────────────────────────────────────────────────────────
  // SCROLLING
  // ─────────────────────────────────────────────────────────────────────────────
  scrollY: "overflow-y-auto",
  scrollX: "overflow-x-auto",
  scrollSmooth: "scroll-smooth",
  scrollbar:
    "scrollbar-thin scrollbar-thumb-[#d1d0cd] dark:scrollbar-thumb-[#444444] scrollbar-track-transparent",
  noScrollbar: "scrollbar-none",

  // ─────────────────────────────────────────────────────────────────────────────
  // PROSE (Rich Text) — warm palette
  // ─────────────────────────────────────────────────────────────────────────────
  prose:
    "prose max-w-none prose-headings:text-foreground prose-p:text-muted-foreground prose-a:text-primary prose-strong:text-foreground",

  // ─────────────────────────────────────────────────────────────────────────────
  // ANIMATIONS
  // ─────────────────────────────────────────────────────────────────────────────
  animateFadeIn: "animate-in fade-in duration-300",
  animateSlideIn: "animate-in slide-in-from-bottom-4 duration-300",
  animateScaleIn: "animate-in zoom-in-95 duration-200",
  animateOut: "animate-out fade-out duration-200",

  // ─────────────────────────────────────────────────────────────────────────────
  // TRANSITIONS
  // ─────────────────────────────────────────────────────────────────────────────
  transition: "transition-all duration-200 ease-out",
  transitionFast: "transition-all duration-150 ease-out",
  transitionSlow: "transition-all duration-300 ease-out",
  transitionColors: "transition-colors duration-200 ease-out",
  transitionTransform: "transition-transform duration-200 ease-out",
  transitionOpacity: "transition-opacity duration-200 ease-out",
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// GRADIENT TEXT HELPER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Apply gradient text styling
 * @param gradient - Tailwind gradient classes (e.g., "from-blue-500 to-red-500")
 */
export function gradientText(gradient: string): string {
  return cn("bg-clip-text text-transparent bg-gradient-to-r", gradient);
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONDITIONAL STYLE HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Apply styles based on a boolean condition
 */
export function when(condition: boolean, classes: string): string {
  return condition ? classes : "";
}

/**
 * Apply one of two class sets based on condition
 */
export function either(condition: boolean, trueClasses: string, falseClasses: string): string {
  return condition ? trueClasses : falseClasses;
}

// Type for the ui object
export type UIUtilities = typeof ui;

// ═══════════════════════════════════════════════════════════════════════════════
// HUB LANDING PAGE PRESETS
// ═══════════════════════════════════════════════════════════════════════════════
//
// Reusable Tailwind class-string tokens for the HKI Innovations Hub pages.
// Cool neutral palette, Retina/P3-safe shadows, WCAG AA compliant text.
//
// Usage:
//   import { hub } from '@hki/ui';
//   <div className={hub.page}> <div className={hub.card}> ... </div> </div>

// ─── Page backgrounds ────────────────────────────────────────────────
const hubPage =
  "min-h-screen flex flex-col bg-background text-foreground font-sans transition-colors";
const hubPageInner = "flex-1 flex flex-col";

// ─── Surfaces (token-based — respects per-app theme) ─────────────────
const hubCard =
  "bg-card border border-border rounded-2xl [box-shadow:0_1px_3px_rgba(15,23,42,0.08),0_10px_24px_-14px_rgba(15,23,42,0.14),0_20px_44px_-26px_rgba(0,102,178,0.14),inset_0_1px_0_rgba(255,255,255,0.82)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.5),0_4px_12px_rgba(0,0,0,0.35),0_8px_24px_-4px_rgba(0,0,0,0.25)]";
const hubGround = "bg-muted";
const hubRaised = "bg-card";
const hubGlass =
  "bg-card/70 backdrop-blur-xl border border-border/40 shadow-lg shadow-black/[0.04] dark:shadow-black/[0.25]";

// ─── Text hierarchy (token-based) ────────────────────────────────────
const hubHeading = "text-foreground";
const hubTextPrimary = "text-foreground";
const hubTextSecondary = "text-muted-foreground";
const hubTextMuted = "text-muted-foreground/70";
const hubTextFaint = "text-muted-foreground/30";

// ─── Borders (token-based) ───────────────────────────────────────────
const hubBorder = "border-border";
const hubBorderSubtle = "border-border/60";
const hubDivider = "bg-border";
const hubDividerSubtle = "bg-border/60";

// ─── Interactive states ──────────────────────────────────────────────
const hubHoverBorder = "hover:border-primary/30";
const hubHoverBg = "hover:bg-muted";
const hubAccent = "text-primary";
const hubAccentHover = "hover:text-primary";
const hubGroupAccent = "group-hover:text-primary";
const hubFocusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

// ─── Pill / badge surfaces (token-based) ────────────────────────────
const hubPillGround = "bg-muted border border-border rounded-full";
const hubPillButton =
  "bg-card border border-border text-foreground hover:bg-muted hover:border-border/80 transition-all font-medium rounded-full";

// ─── Icon tints (token-based) ────────────────────────────────────────
const hubIconMuted = "text-muted-foreground/70";
const hubIconDefault = "text-muted-foreground";

// ─── Footer (token-based) ────────────────────────────────────────────
const hubFooterBar = "border-t border-border/50 bg-card/40 backdrop-blur-2xl";
const hubFooterLink =
  "text-sm text-muted-foreground hover:text-primary transition-colors font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md px-1";

// ─── Compound helpers ────────────────────────────────────────────────
const hubCardInteractive = `${hubCard} ${hubHoverBorder} hover:[box-shadow:0_1px_3px_rgba(15,23,42,0.08),0_14px_32px_-16px_rgba(15,23,42,0.16),0_24px_52px_-28px_rgba(0,102,178,0.18),inset_0_1px_0_rgba(255,255,255,0.86)] transition-all duration-300`;
const hubSectionHeading = `text-2xl font-bold ${hubHeading}`;
const hubBodyText = `${hubTextSecondary} leading-relaxed`;

/** Hub landing page presets — barrel export */
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
