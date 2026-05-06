/**
 * Shared page animation presets for Framer Motion.
 * Eliminates duplication across dashboard pages.
 */

/** HKI Blue — matches HKI_IRIS from root */
const BLUE = "#0066B2";
/** HKI Red — matches HKI_PULSE from root */
const RED = "#E31837";

/** Blue → Red duotone gradient */
export const DUOTONE = `linear-gradient(135deg, ${BLUE} 0%, ${RED} 100%)`;

/** Smooth ease curve */
export const EASE = [0.22, 1, 0.36, 1] as const;

/** Fade-up entrance with custom delay */
export const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (d: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: EASE, delay: d },
  }),
};

/** Stagger children container */
export const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

/** Pop-in card entrance */
export const cardPop = {
  hidden: { opacity: 0, y: 12, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.35, ease: EASE },
  },
};

/** Priority badge styles — reused across initiative cards */
export const PRIORITY_STYLES: Record<string, { bg: string; text: string }> = {
  CRITICAL: {
    bg: "bg-[#fef2f2] dark:bg-[#7f1d1d]/20",
    text: "text-[#991b1b] dark:text-[#fca5a5]",
  },
  HIGH: {
    bg: "bg-[#fff7ed] dark:bg-[#78350f]/20",
    text: "text-[#9a3412] dark:text-[#fdba74]",
  },
  MEDIUM: {
    bg: "bg-[#eff6ff] dark:bg-[#1e3a5f]/20",
    text: "text-[#1e40af] dark:text-[#93c5fd]",
  },
  LOW: {
    bg: "bg-[#f3f2ef] dark:bg-[#1e1e1e]",
    text: "text-[#525150] dark:text-[#a3a29f]",
  },
};

/** Stage colors for initiative statuses */
export const STAGE_COLORS: Record<string, string> = {
  INTAKE: "#6366f1",
  TRIAGE: "#8b5cf6",
  EXPLORE: "#0ea5e9",
  PILOT: "#f59e0b",
  SCALE: "#10b981",
  OPERATE: "#22c55e",
  RETIRE: "#6b7280",
};

/** Format a number as compact currency ($1.2M, $500K, $100) */
export function formatCurrency(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v}`;
}
