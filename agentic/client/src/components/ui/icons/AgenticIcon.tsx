import React, { useId, useSyncExternalStore } from "react";

// ── Brand Palette ──────────────────────────────────────────────────────────────
const BLUE = "#005DAA";
const BLUE_MID = "#0074CC";
const BLUE_DEEP = "#003B75";
const RED = "#E31837";
const RED_BRIGHT = "#FF2D4D";
const RED_DEEP = "#A81230";

// ── Dark-mode detector (listens for class changes on <html>) ─────────────────
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

// ── Agent Status ───────────────────────────────────────────────────────────────
export type AgentStatus = "idle" | "thinking" | "active" | "error";

interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  primaryColor?: string;
  secondaryColor?: string;
  glow?: boolean;
  status?: AgentStatus;
  /** Rotation angle (degrees) for the arrow — 0 = right, 90 = down */
  arrowAngle?: number;
}

/**
 * HKI Innovations — Agentic Brand Mark
 *
 * Light mode: Blue C · Red core + arrow
 * Dark mode:  Red C · Blue core + arrow  (inverted)
 *
 * Clean, crisp, no blur filters — sharp at every size.
 */
export function AgenticIcon({
  size = 48,
  primaryColor: _primaryColor,
  secondaryColor: _secondaryColor,
  glow: _glow,
  status: _status,
  arrowAngle = 0,
  className = "",
  ...props
}: IconProps) {
  const uid = useId().replace(/:/g, "");
  const id = (s: string) => `ci-${s}-${uid}`;
  const dark = useDarkMode();

  // Color assignments — inverted in dark mode, brighter for contrast
  const arcGradStart = dark ? RED_BRIGHT : BLUE_MID;
  const arcGradEnd = dark ? RED : BLUE_DEEP;
  const coreStart = dark ? "#3B9AFF" : RED_BRIGHT;
  const coreMid = dark ? BLUE_MID : RED;
  const coreEnd = dark ? BLUE : RED_DEEP;
  const arrowColor = dark ? "#3B9AFF" : RED_BRIGHT;
  const capColor = dark ? RED_BRIGHT : BLUE;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 400 400"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className || undefined}
      aria-label="HKI Agentic"
      shapeRendering="geometricPrecision"
      {...props}
    >
      <defs>
        <linearGradient
          id={id("c")}
          x1="80"
          y1="72"
          x2="288"
          y2="328"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor={arcGradStart} />
          <stop offset="100%" stopColor={arcGradEnd} />
        </linearGradient>
        <radialGradient id={id("r")} cx="48%" cy="44%" r="50%">
          <stop offset="0%" stopColor={coreStart} />
          <stop offset="60%" stopColor={coreMid} />
          <stop offset="100%" stopColor={coreEnd} />
        </radialGradient>
      </defs>

      {/* C Arc — true circular arc, r=108, centered at (200,200) */}
      <path
        d="M288 136 A 108 108 0 1 0 288 264"
        stroke={`url(#${id("c")})`}
        strokeWidth="28"
        strokeLinecap="round"
        fill="none"
      />

      {/* Core */}
      <circle cx="200" cy="200" r="32" fill={`url(#${id("r")})`} />
      <circle
        cx="200"
        cy="200"
        r="36"
        fill="none"
        stroke="#fff"
        strokeWidth="4"
        opacity="0.15"
      />
      <ellipse cx="192" cy="192" rx="12" ry="8" fill="#fff" opacity="0.4" />

      {/* Arrow → rotates to follow cursor via arrowAngle prop */}
      <g
        transform={`rotate(${arrowAngle}, 200, 200)`}
        style={{ transition: "transform 0.15s ease-out" }}
      >
        <path
          d="M232 200 L312 200"
          stroke={arrowColor}
          strokeWidth="12"
          strokeLinecap="round"
        />
        <path
          d="M284 176 L312 200 L284 224"
          stroke={arrowColor}
          strokeWidth="12"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </g>

      {/* C Endpoint Caps */}
      <circle cx="288" cy="136" r="8" fill={capColor} opacity="0.5" />
      <circle cx="288" cy="264" r="8" fill={capColor} opacity="0.5" />
    </svg>
  );
}

export default AgenticIcon;
