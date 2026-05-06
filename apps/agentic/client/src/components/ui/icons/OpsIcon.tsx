import React, { useId, useSyncExternalStore } from "react";

const IRIS = "#0E7C7B";
const IRIS_LIGHT = "#2EA39E";
const PULSE = "#E07A1F";
const PULSE_LIGHT = "#F19A4A";

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
 * Hermetic — Control Plane Mark
 *
 * A closed shield silhouette with three descending telemetry bars and a
 * single status node. The shield encloses (no broadcast arcs, no leakage):
 * operations are observed *inside* the seal, never radiated outside it.
 */
export function OpsIcon({ size = 48, className = "", ...props }: OpsIconProps) {
  const uid = useId().replace(/:/g, "");
  const id = (s: string) => `ops-${s}-${uid}`;
  const dark = useDarkMode();

  const iris = `var(--ops-icon-iris, ${dark ? IRIS_LIGHT : IRIS})`;
  const pulse = `var(--ops-icon-pulse, ${dark ? PULSE_LIGHT : PULSE})`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      fill="none"
      className={className}
      aria-label="Hermetic Control Plane"
      role="img"
      shapeRendering="geometricPrecision"
      {...props}
    >
      <defs>
        <linearGradient
          id={id("seal")}
          x1="22"
          y1="14"
          x2="78"
          y2="88"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor={iris} />
          <stop offset="100%" stopColor={pulse} />
        </linearGradient>
      </defs>

      {/* Shield perimeter — closed, no break */}
      <path
        d="M50 14 L78 26 L78 52 C78 70 64 82 50 88 C36 82 22 70 22 52 L22 26 Z"
        fill="none"
        stroke={`url(#${id("seal")})`}
        strokeWidth="3"
        strokeLinejoin="round"
      />

      {/* Telemetry bars — observed inside the seal */}
      <rect
        x="34"
        y="40"
        width="30"
        height="3"
        rx="1.5"
        fill={iris}
        opacity="0.9"
      />
      <rect
        x="34"
        y="48"
        width="22"
        height="3"
        rx="1.5"
        fill={iris}
        opacity="0.6"
      />
      <rect
        x="34"
        y="56"
        width="14"
        height="3"
        rx="1.5"
        fill={iris}
        opacity="0.35"
      />

      {/* Status node — single controlled signal at the seam */}
      <circle cx="68" cy="30" r="3" fill={pulse} />
    </svg>
  );
}
