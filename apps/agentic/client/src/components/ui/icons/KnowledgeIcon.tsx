import React, { useId, useSyncExternalStore } from "react";

const IRIS = "#0E7C7B";
const IRIS_LIGHT = "#2EA39E";
const PULSE = IRIS;
const PULSE_LIGHT = IRIS_LIGHT;

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

interface KnowledgeIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
}

/**
 * Hermetic — Knowledge Mark
 *
 * A sealed perimeter enclosing two parallel spines (the knowledge volume)
 * joined by a single horizontal seam. Four corner nodes anchor the seal;
 * two seam nodes mark the controlled crossing points where knowledge is
 * indexed and retrieved.
 */
export function KnowledgeIcon({
  size = 48,
  className = "",
  ...props
}: KnowledgeIconProps) {
  const uid = useId().replace(/:/g, "");
  const id = (s: string) => `kb-${s}-${uid}`;
  const dark = useDarkMode();

  const iris = dark ? IRIS_LIGHT : IRIS;
  const pulse = dark ? PULSE_LIGHT : PULSE;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className || undefined}
      aria-label="Knowledge Domains"
      shapeRendering="geometricPrecision"
      {...props}
    >
      <defs>
        <linearGradient
          id={id("seal")}
          x1="14"
          y1="14"
          x2="86"
          y2="86"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor={iris} />
          <stop offset="100%" stopColor={pulse} />
        </linearGradient>
      </defs>

      {/* Perimeter — closed seal */}
      <circle
        cx="50"
        cy="50"
        r="36"
        stroke={`url(#${id("seal")})`}
        strokeWidth="3"
        fill="none"
      />

      {/* Two spines — the bound volume */}
      <line
        x1="32"
        y1="18"
        x2="32"
        y2="82"
        stroke={`url(#${id("seal")})`}
        strokeWidth="4"
        strokeLinecap="round"
      />
      <line
        x1="68"
        y1="18"
        x2="68"
        y2="82"
        stroke={`url(#${id("seal")})`}
        strokeWidth="4"
        strokeLinecap="round"
      />

      {/* Seam — the indexed crossing */}
      <line
        x1="32"
        y1="50"
        x2="68"
        y2="50"
        stroke={`url(#${id("seal")})`}
        strokeWidth="3"
        strokeLinecap="round"
      />

      {/* Anchor nodes — corners of the seal */}
      <circle cx="32" cy="18" r="4" fill={iris} />
      <circle cx="68" cy="18" r="4" fill={iris} />
      <circle cx="32" cy="82" r="4" fill={iris} />
      <circle cx="68" cy="82" r="4" fill={iris} />

      {/* Seam nodes — controlled crossing points */}
      <circle cx="32" cy="50" r="3.5" fill={pulse} />
      <circle cx="68" cy="50" r="3.5" fill={pulse} />
    </svg>
  );
}

export default KnowledgeIcon;
