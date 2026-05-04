import React, { useId, useSyncExternalStore } from "react";

// ── Brand Palette ──────────────────────────────────────────────────────────────
const BLUE = "#005DAA";
const BLUE_MID = "#0074CC";
const BLUE_DEEP = "#003B75";
const RED = "#E31837";
const RED_BRIGHT = "#FF2D4D";
const RED_DEEP = "#A81230";

// ── Dark-mode detector ─────────────────────────────────────────────────────────
function subscribeDark(cb: () => void) {
  const obs = new MutationObserver(cb);
  obs.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => obs.disconnect();
}
function getIsDark() {
  return document.documentElement.classList.contains("dark");
}
function useDarkMode() {
  return useSyncExternalStore(subscribeDark, getIsDark, () => false);
}

// ── Types ──────────────────────────────────────────────────────────────────────
interface KnowledgeIconProps extends React.SVGProps<SVGSVGElement> {
  /** Pixel size (square) */
  size?: number;
}

/**
 * Knowledge Base — Brand Icon
 *
 * An open book rendered in HKI brand colours.
 * Light mode: Blue cover / Red bookmark ribbon + page edge
 * Dark mode:  Brighter palette with lifted contrast
 *
 * Clean SVG paths — sharp at every size, no blur filters.
 */
export function KnowledgeIcon({
  size = 48,
  className = "",
  ...props
}: KnowledgeIconProps) {
  const uid = useId().replace(/:/g, "");
  const id = (s: string) => `kb-${s}-${uid}`;
  const dark = useDarkMode();

  // ── Colour assignments ───────────────────────────────────────────────────────
  const coverGradStart = dark ? BLUE_MID : BLUE;
  const coverGradEnd = dark ? BLUE_DEEP : BLUE_DEEP;
  const pageColor = dark ? "#e8e4dd" : "#faf8f4";
  const pageEdge = dark ? "#d0cbc2" : "#ede9e1";
  const ribbonTop = dark ? RED_BRIGHT : RED;
  const ribbonBot = dark ? RED_DEEP : RED_DEEP;
  const spineColor = dark ? BLUE_DEEP : BLUE_DEEP;
  const textLineColor = dark ? "rgba(0,93,170,0.35)" : "rgba(0,93,170,0.2)";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className || undefined}
      aria-label="Knowledge Base"
      shapeRendering="geometricPrecision"
      {...props}
    >
      <defs>
        {/* Cover gradient */}
        <linearGradient
          id={id("cover")}
          x1="15"
          y1="20"
          x2="85"
          y2="80"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor={coverGradStart} />
          <stop offset="100%" stopColor={coverGradEnd} />
        </linearGradient>

        {/* Ribbon gradient */}
        <linearGradient
          id={id("ribbon")}
          x1="50"
          y1="14"
          x2="50"
          y2="42"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor={ribbonTop} />
          <stop offset="100%" stopColor={ribbonBot} />
        </linearGradient>
      </defs>

      {/* ── Left cover (back) ───────────────────────────────────────────── */}
      <path
        d="M14 22 C14 19, 16 17, 19 17 L46 17 L46 83 L19 83 C16 83, 14 81, 14 78 Z"
        fill={`url(#${id("cover")})`}
        opacity="0.7"
      />

      {/* ── Right cover (front) ─────────────────────────────────────────── */}
      <path
        d="M54 17 L81 17 C84 17, 86 19, 86 22 L86 78 C86 81, 84 83, 81 83 L54 83 Z"
        fill={`url(#${id("cover")})`}
      />

      {/* ── Spine ───────────────────────────────────────────────────────── */}
      <rect x="46" y="17" width="8" height="66" fill={spineColor} />
      <line
        x1="50"
        y1="17"
        x2="50"
        y2="83"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth="0.5"
      />

      {/* ── Left page ───────────────────────────────────────────────────── */}
      <path
        d="M17 20 L46 20 L46 80 L17 80 C16 80, 16 79, 16 79 L16 21 C16 20, 16 20, 17 20 Z"
        fill={pageColor}
      />
      <path
        d="M17 20 L46 20 L46 80 L17 80 C16 80, 16 79, 16 79 L16 21 C16 20, 16 20, 17 20 Z"
        fill={pageEdge}
        opacity="0.4"
      />

      {/* ── Right page ──────────────────────────────────────────────────── */}
      <path
        d="M54 20 L83 20 C84 20, 84 20, 84 21 L84 79 C84 79, 84 80, 83 80 L54 80 Z"
        fill={pageColor}
      />

      {/* ── Text lines (left page) ──────────────────────────────────────── */}
      {[30, 36, 42, 48, 54, 60].map(y => (
        <line
          key={`l${y}`}
          x1="21"
          y1={y}
          x2="42"
          y2={y}
          stroke={textLineColor}
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      ))}

      {/* ── Text lines (right page) ─────────────────────────────────────── */}
      {[30, 36, 42, 48, 54, 60].map(y => (
        <line
          key={`r${y}`}
          x1="58"
          y1={y}
          x2="80"
          y2={y}
          stroke={textLineColor}
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      ))}

      {/* ── Bookmark ribbon ─────────────────────────────────────────────── */}
      <path
        d="M64 17 L64 40 L67 36 L70 40 L70 17 Z"
        fill={`url(#${id("ribbon")})`}
      />

      {/* ── Page curl hint (bottom-right) ───────────────────────────────── */}
      <path
        d="M84 74 L78 80 L84 80 Z"
        fill={dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"}
      />

      {/* ── Cover edge shine ────────────────────────────────────────────── */}
      <line
        x1="14"
        y1="22"
        x2="14"
        y2="78"
        stroke="rgba(255,255,255,0.12)"
        strokeWidth="0.5"
      />
      <line
        x1="86"
        y1="22"
        x2="86"
        y2="78"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth="0.5"
      />
    </svg>
  );
}

export default KnowledgeIcon;
