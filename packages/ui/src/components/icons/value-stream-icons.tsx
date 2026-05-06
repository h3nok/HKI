/**
 * HKI Value Stream Icon Set
 * Two-color HKI palette: Blue (#0066B2) for primary structure,
 * Red (#E31837) for the key identifying accent on each icon.
 *
 * Icon IDs (≤8 chars, fits varchar(8) in DB):
 *   "global" | "pharma" | "fresh" | "optical" | "ecom" | "wh" |
 *   "pkg" | "tools" | "fin" | "store" | "truck" | "chart" | "building"
 *
 * Usage:
 *   import { StreamIcon, STREAM_ICON_OPTIONS } from "@hki/ui";
 *   <StreamIcon id="pharma" size={24} />
 */

const BLUE = "var(--stream-icon-blue, #0066B2)"; // HKI Blue — primary structure
const RED = "var(--stream-icon-red, #E31837)"; // HKI Red — accent / defining detail
const BLUE_FILL = "var(--stream-icon-blue-fill, #0066B218)";
const RED_FILL = "var(--stream-icon-red-fill, #E3183718)";

interface VSIconProps {
  size?: number;
  className?: string | undefined;
}

const svgProps = (size: number, className?: string | undefined) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  className,
});

// ── Globe — blue sphere + latitude lines, red meridians ───────────────────────
export function GlobalIcon({ size = 20, className }: VSIconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <circle cx="12" cy="12" r="9" stroke={BLUE} />
      <line x1="3.22" y1="9" x2="20.78" y2="9" stroke={BLUE} />
      <line x1="3.22" y1="15" x2="20.78" y2="15" stroke={BLUE} />
      {/* Red meridian curves */}
      <path d="M12 3c-3.5 3-5.5 5.5-5.5 9s2 6 5.5 9" stroke={RED} />
      <path d="M12 3c3.5 3 5.5 5.5 5.5 9s-2 6-5.5 9" stroke={RED} />
    </svg>
  );
}

// ── Pharmacy — blue pill outline, red center split line ───────────────────────
export function PharmaIcon({ size = 20, className }: VSIconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <path
        d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"
        stroke={BLUE}
      />
      {/* Red dividing line */}
      <path d="m8.5 8.5 7 7" stroke={RED} strokeWidth={2} />
    </svg>
  );
}

// ── Fresh Foods — blue leaf body, red center vein ─────────────────────────────
export function FreshIcon({ size = 20, className }: VSIconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <path
        d="M12 11C9 8 6 7 4 4c3 0 6 2 8 7Z"
        stroke={BLUE}
        fill={BLUE_FILL}
      />
      <path
        d="M12 11c3-3 6-4 8-7-3 0-6 2-8 7Z"
        stroke={BLUE}
        fill={BLUE_FILL}
      />
      {/* Red center vein */}
      <path d="M12 22V11" stroke={RED} strokeWidth={1.75} />
    </svg>
  );
}

// ── Optical — blue lens rings, red bridge + temples ───────────────────────────
export function OpticalIcon({ size = 20, className }: VSIconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <circle cx="7" cy="14" r="4" stroke={BLUE} />
      <circle cx="17" cy="14" r="4" stroke={BLUE} />
      {/* Red bridge and arms */}
      <path d="M11 14q1-1.5 2 0" stroke={RED} strokeWidth={1.75} />
      <path d="M3 12 1.5 9" stroke={RED} strokeWidth={1.75} />
      <path d="M21 12 22.5 9" stroke={RED} strokeWidth={1.75} />
    </svg>
  );
}

// ── E-Commerce — blue basket, red wheels ─────────────────────────────────────
export function EcomIcon({ size = 20, className }: VSIconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <path d="M2 3h3l2 11h12l2-8H6" stroke={BLUE} />
      {/* Red wheels */}
      <circle cx="9" cy="19" r="1.5" stroke={RED} strokeWidth={1.75} />
      <circle cx="17" cy="19" r="1.5" stroke={RED} strokeWidth={1.75} />
    </svg>
  );
}

// ── Warehouse — blue building + roof, red roller door ────────────────────────
export function WarehouseIcon({ size = 20, className }: VSIconProps) {
  return (
    <svg {...svgProps(size, className)}>
      {/* Blue building */}
      <path d="M2 10 12 3 22 10" stroke={BLUE} />
      <rect x="2" y="10" width="20" height="12" rx="1" stroke={BLUE} />
      {/* Red roller door */}
      <rect x="7" y="15" width="10" height="7" rx="0.5" stroke={RED} />
      <line x1="7" y1="17.5" x2="17" y2="17.5" stroke={RED} />
      <line x1="7" y1="20" x2="17" y2="20" stroke={RED} />
    </svg>
  );
}

// ── Package — blue box frame, red seam/tape line ──────────────────────────────
export function PackageIcon({ size = 20, className }: VSIconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <path
        d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"
        stroke={BLUE}
      />
      <polyline points="3.29 7 12 12 20.71 7" stroke={BLUE} />
      <line x1="12" y1="22" x2="12" y2="12" stroke={BLUE} />
      {/* Red tape/label stripe */}
      <line x1="8" y1="5" x2="16" y2="10" stroke={RED} strokeWidth={2} />
    </svg>
  );
}

// ── Maintenance — blue wrench body, red highlight tip ────────────────────────
export function ToolsIcon({ size = 20, className }: VSIconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <path
        d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"
        stroke={BLUE}
      />
      {/* Red accent at the pivot tip */}
      <circle cx="5.5" cy="18.5" r="1.2" stroke={RED} strokeWidth={1.5} />
    </svg>
  );
}

// ── Finance — blue coin ring, red dollar sign ─────────────────────────────────
export function FinanceIcon({ size = 20, className }: VSIconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <circle cx="12" cy="12" r="9" stroke={BLUE} />
      {/* Red dollar sign */}
      <path d="M12 7v10" stroke={RED} strokeWidth={1.75} />
      <path
        d="M9 9c0-1 1-1.5 3-1.5s3 .5 3 2c0 1-1 1.5-3 2s-3 1-3 2.5c0 1.5 1 2 3 2s3-.5 3-2"
        stroke={RED}
        strokeWidth={1.75}
      />
    </svg>
  );
}

// ── Store — blue building + windows + door, red awning ───────────────────────
export function StoreIcon({ size = 20, className }: VSIconProps) {
  return (
    <svg {...svgProps(size, className)}>
      {/* Blue building body */}
      <rect x="3" y="11" width="18" height="11" rx="1" stroke={BLUE} />
      <rect x="4" y="13" width="5" height="4" rx="0.5" stroke={BLUE} />
      <rect x="15" y="13" width="5" height="4" rx="0.5" stroke={BLUE} />
      <rect x="9" y="16" width="6" height="6" stroke={BLUE} />
      {/* Red awning */}
      <path d="M3 6h18v3l-1.5 2H4.5L3 9V6z" stroke={RED} fill={RED_FILL} />
    </svg>
  );
}

// ── Delivery Truck — blue cargo box, red cab ─────────────────────────────────
export function TruckIcon({ size = 20, className }: VSIconProps) {
  return (
    <svg {...svgProps(size, className)}>
      {/* Blue cargo section */}
      <rect x="1" y="5" width="14" height="14" rx="1" stroke={BLUE} />
      <line x1="15" y1="5" x2="15" y2="19" stroke={BLUE} />
      {/* Red cab + wheels */}
      <path d="M15 10h4l3 3v6h-7V10z" stroke={RED} fill={RED_FILL} />
      <circle cx="6" cy="20" r="2" stroke={RED} strokeWidth={1.75} />
      <circle cx="18.5" cy="20" r="2" stroke={RED} strokeWidth={1.75} />
    </svg>
  );
}

// ── Analytics — blue base bars, red lead bar ─────────────────────────────────
export function ChartIcon({ size = 20, className }: VSIconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <line x1="1" y1="22" x2="23" y2="22" stroke={BLUE} />
      <rect x="2" y="15" width="4" height="7" stroke={BLUE} />
      <rect x="9" y="10" width="4" height="12" stroke={BLUE} />
      {/* Red leading bar */}
      <rect x="16" y="6" width="4" height="16" stroke={RED} fill={RED_FILL} />
    </svg>
  );
}

// ── Building — blue shell, red window accents ─────────────────────────────────
export function BuildingIcon({ size = 20, className }: VSIconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <rect x="4" y="2" width="16" height="20" rx="1" stroke={BLUE} />
      <rect x="9" y="18" width="6" height="4" stroke={BLUE} />
      {/* Red windows */}
      <rect x="7" y="5" width="3" height="3" stroke={RED} />
      <rect x="14" y="5" width="3" height="3" stroke={RED} />
      <rect x="7" y="11" width="3" height="3" stroke={RED} />
      <rect x="14" y="11" width="3" height="3" stroke={RED} />
    </svg>
  );
}

// ── Icon registry ─────────────────────────────────────────────────────────────

export type ValueStreamIconId =
  | "global"
  | "pharma"
  | "fresh"
  | "optical"
  | "ecom"
  | "wh"
  | "pkg"
  | "tools"
  | "fin"
  | "store"
  | "truck"
  | "chart"
  | "building";

export interface StreamIconOption {
  id: ValueStreamIconId;
  label: string;
  Icon: React.ComponentType<VSIconProps>;
}

export type StreamIconTone = "duo" | "mono" | "primary";

export const STREAM_ICON_OPTIONS: StreamIconOption[] = [
  { id: "global", label: "Global", Icon: GlobalIcon },
  { id: "pharma", label: "Pharmacy", Icon: PharmaIcon },
  { id: "fresh", label: "Fresh Foods", Icon: FreshIcon },
  { id: "optical", label: "Optical", Icon: OpticalIcon },
  { id: "ecom", label: "E-Commerce", Icon: EcomIcon },
  { id: "wh", label: "Warehouse", Icon: WarehouseIcon },
  { id: "pkg", label: "Logistics", Icon: PackageIcon },
  { id: "tools", label: "Maintenance", Icon: ToolsIcon },
  { id: "fin", label: "Finance", Icon: FinanceIcon },
  { id: "store", label: "Store Ops", Icon: StoreIcon },
  { id: "truck", label: "Delivery", Icon: TruckIcon },
  { id: "chart", label: "Analytics", Icon: ChartIcon },
  { id: "building", label: "General", Icon: BuildingIcon },
];

// ── Unified renderer ──────────────────────────────────────────────────────────

/**
 * Renders the HKI-branded SVG icon for a value stream icon ID.
 * Falls back to BuildingIcon for unknown/legacy values.
 */
export function StreamIcon({
  id,
  size = 20,
  className,
  tone = "duo",
}: VSIconProps & { id: string; tone?: StreamIconTone }) {
  const opt = STREAM_ICON_OPTIONS.find(o => o.id === id);
  const IconComp = opt?.Icon ?? BuildingIcon;

  if (tone === "duo") {
    return <IconComp size={size} className={className} />;
  }

  const toneColor = tone === "primary" ? "var(--primary)" : "currentColor";
  const style = {
    "--stream-icon-blue": toneColor,
    "--stream-icon-red": toneColor,
    "--stream-icon-blue-fill": `color-mix(in srgb, ${toneColor} 14%, transparent)`,
    "--stream-icon-red-fill": `color-mix(in srgb, ${toneColor} 14%, transparent)`,
  } as React.CSSProperties;

  return (
    <span className={className} style={style}>
      <IconComp size={size} className="block" />
    </span>
  );
}
