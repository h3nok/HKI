import React, { useId, useSyncExternalStore } from "react";

// ── Brand Palette ──────────────────────────────────────────────────────────────
const BLUE = "#005DAA";
const BLUE_LIGHT = "#0074CC";
const BLUE_DEEP = "#003B75";
const RED = "#E31837";
const RED_BRIGHT = "#FF2D4D";

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

interface OpsIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
}

/**
 * AI Operations Hub — Brand Mark
 *
 * A command-center shield with layered bars and a red signal arc.
 * Blue shield body, red accent pulse — HKI brand fusion.
 *
 * Light: Blue shield, red signal
 * Dark:  Brightened for contrast
 */
export function OpsIcon({ size = 48, className = "", ...props }: OpsIconProps) {
  const uid = useId().replace(/:/g, "");
  const id = (s: string) => `ops-${s}-${uid}`;
  const dark = useDarkMode();

  const blue = dark ? BLUE_LIGHT : BLUE;
  const blueDeep = dark ? BLUE : BLUE_DEEP;
  const red = dark ? RED_BRIGHT : RED;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      fill="none"
      className={className}
      aria-label="AI Operations"
      role="img"
      {...props}
    >
      <defs>
        {/* Shield gradient */}
        <linearGradient
          id={id("shieldGrad")}
          x1="26"
          y1="18"
          x2="74"
          y2="80"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor={blue} />
          <stop offset="100%" stopColor={blueDeep} />
        </linearGradient>
        {/* Inner fill */}
        <linearGradient
          id={id("innerGrad")}
          x1="30"
          y1="30"
          x2="70"
          y2="76"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor={blue} stopOpacity="0.15" />
          <stop offset="100%" stopColor={blueDeep} stopOpacity="0.08" />
        </linearGradient>
      </defs>

      {/* ── Shield body ── */}
      <path
        d="M50 14 L78 26 L78 52 C78 70 64 82 50 88 C36 82 22 70 22 52 L22 26 Z"
        fill={`url(#${id("innerGrad")})`}
        stroke={`url(#${id("shieldGrad")})`}
        strokeWidth="3"
        strokeLinejoin="round"
      />

      {/* ── Command bars (operations dashboard metaphor) ── */}
      <rect
        x="36"
        y="40"
        width="28"
        height="3"
        rx="1.5"
        fill={blue}
        opacity="0.85"
      />
      <rect
        x="36"
        y="48"
        width="22"
        height="3"
        rx="1.5"
        fill={blue}
        opacity="0.55"
      />
      <rect
        x="36"
        y="56"
        width="16"
        height="3"
        rx="1.5"
        fill={blue}
        opacity="0.35"
      />

      {/* ── Red signal arcs (broadcast/pulse) ── */}
      <path
        d="M64 30 Q74 36 74 48"
        fill="none"
        stroke={red}
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.9"
      />
      <path
        d="M68 26 Q82 34 82 50"
        fill="none"
        stroke={red}
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.5"
      />

      {/* ── Red status dot ── */}
      <circle cx="64" cy="30" r="3" fill={red} />
    </svg>
  );
}
