import { cn } from "@hki/ui";

type Domain = {
  id: string;
  label: string;
  scope: string;
  detail: string;
  color: string;
  x: number;
  y: number;
  anchorX: number;
  anchorY: number;
  delay: string;
};

const DOMAINS: readonly Domain[] = [
  {
    id: "payments",
    label: "Payments",
    scope: "active: payments",
    detail: "retrieval, cache, tools",
    color: "#059669",
    x: 52,
    y: 70,
    anchorX: 225,
    anchorY: 150,
    delay: "0s",
  },
  {
    id: "fraud",
    label: "Fraud",
    scope: "active: fraud",
    detail: "signals, cases, tools",
    color: "#2563eb",
    x: 488,
    y: 70,
    anchorX: 488,
    anchorY: 150,
    delay: "0.7s",
  },
  {
    id: "pharma",
    label: "Pharma",
    scope: "active: pharma",
    detail: "policy, review, memory",
    color: "#7c3aed",
    x: 52,
    y: 368,
    anchorX: 225,
    anchorY: 448,
    delay: "1.4s",
  },
  {
    id: "legal",
    label: "Legal",
    scope: "active: legal",
    detail: "hold, privilege, audit",
    color: "#d97706",
    x: 488,
    y: 368,
    anchorX: 488,
    anchorY: 448,
    delay: "2.1s",
  },
];

const CENTER = { x: 360, y: 280 };

function railPath(domain: Domain) {
  const side = domain.anchorX < CENTER.x ? -1 : 1;
  const cp1x = CENTER.x + side * 96;
  const cp1y = CENTER.y + (domain.anchorY < CENTER.y ? -56 : 56);
  const cp2x = domain.anchorX - side * 84;
  const cp2y = domain.anchorY;
  return `M${CENTER.x},${CENTER.y} C${cp1x},${cp1y} ${cp2x},${cp2y} ${domain.anchorX},${domain.anchorY}`;
}

function DomainCard({ domain }: { domain: Domain }) {
  return (
    <g>
      <rect
        x={domain.x}
        y={domain.y}
        width="188"
        height="104"
        rx="18"
        fill="var(--card)"
        stroke="var(--border)"
        strokeWidth="1"
        filter="url(#hkiHeroCardShadow)"
      />
      <rect
        x={domain.x + 14}
        y={domain.y + 14}
        width="34"
        height="34"
        rx="10"
        fill={domain.color}
        fillOpacity="0.11"
        stroke={domain.color}
        strokeOpacity="0.35"
      />
      <circle cx={domain.x + 31} cy={domain.y + 31} r="6" fill={domain.color} />
      <text
        x={domain.x + 60}
        y={domain.y + 31}
        fill="var(--foreground)"
        fontSize="18"
        fontWeight="800"
        letterSpacing="-0.02em"
      >
        {domain.label}
      </text>
      <rect
        x={domain.x + 18}
        y={domain.y + 55}
        width="130"
        height="20"
        rx="10"
        fill={domain.color}
        fillOpacity="0.08"
        stroke={domain.color}
        strokeOpacity="0.18"
      />
      <text
        x={domain.x + 30}
        y={domain.y + 68.5}
        fill={domain.color}
        fontSize="9.5"
        fontFamily="ui-monospace,'JetBrains Mono',monospace"
        fontWeight="800"
        letterSpacing="0.04em"
      >
        {domain.scope}
      </text>
      <text
        x={domain.x + 18}
        y={domain.y + 92}
        fill="var(--muted-foreground)"
        fontSize="12"
        fontWeight="600"
      >
        {domain.detail}
      </text>
    </g>
  );
}

function Rail({ domain }: { domain: Domain }) {
  const path = railPath(domain);
  const id = `hkiHeroRailPath-${domain.id}`;
  return (
    <g>
      <path
        d={path}
        fill="none"
        stroke={domain.color}
        strokeWidth="22"
        strokeLinecap="round"
        strokeOpacity="0.08"
      />
      <path
        d={path}
        fill="none"
        stroke={domain.color}
        strokeWidth="4"
        strokeLinecap="round"
        strokeOpacity="0.48"
      />
      <path id={id} d={path} fill="none" stroke="none" />
      <circle r="5.5" fill={domain.color}>
        <animateMotion
          dur="4.2s"
          begin={domain.delay}
          repeatCount="indefinite"
          calcMode="spline"
          keyTimes="0;1"
          keySplines="0.42 0 0.2 1"
        >
          <mpath href={`#${id}`} />
        </animateMotion>
      </circle>
    </g>
  );
}

function EnvelopeCore() {
  return (
    <g filter="url(#hkiHeroCoreShadow)">
      <path
        d="M250 196H470C478 196 484 202 484 210V360C484 368 478 374 470 374H250C242 374 236 368 236 360V210C236 202 242 196 250 196Z"
        fill="var(--card)"
        stroke="var(--primary)"
        strokeOpacity="0.3"
        strokeWidth="1.5"
      />
      <path
        d="M246 211L360 296L474 211"
        fill="none"
        stroke="var(--primary)"
        strokeOpacity="0.2"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M246 360L326 288"
        fill="none"
        stroke="var(--foreground)"
        strokeOpacity="0.09"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M474 360L394 288"
        fill="none"
        stroke="var(--foreground)"
        strokeOpacity="0.09"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M246 211H474V226L360 304L246 226Z"
        fill="var(--primary)"
        fillOpacity="0.055"
      />
      <text
        x="266"
        y="233"
        fill="var(--primary)"
        fontSize="12"
        fontWeight="900"
        letterSpacing="0.14em"
      >
        HKI ENVELOPE
      </text>
      <text
        x="267"
        y="252"
        fill="var(--muted-foreground)"
        fontSize="10"
        fontFamily="ui-monospace,'JetBrains Mono',monospace"
        fontWeight="700"
      >
        signed runtime contract
      </text>
      <g transform="translate(424 219)">
        <circle
          cx="22"
          cy="22"
          r="21"
          fill="var(--primary)"
          fillOpacity="0.12"
          stroke="var(--primary)"
          strokeOpacity="0.34"
        />
        <path
          d="M13 22L19 28L32 15"
          fill="none"
          stroke="var(--primary)"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>

      <rect
        x="268"
        y="286"
        width="184"
        height="66"
        rx="16"
        fill="var(--background)"
        fillOpacity="0.72"
        stroke="var(--border)"
      />

      {[
        ["org", "acme"],
        ["active", "one domain"],
        ["authz", "narrowed set"],
      ].map(([label, value], index) => (
        <g key={label} transform={`translate(282 ${304 + index * 18})`}>
          <text
            x="0"
            y="0"
            fill="var(--muted-foreground)"
            fontSize="9"
            fontFamily="ui-monospace,'JetBrains Mono',monospace"
            fontWeight="700"
            letterSpacing="0.08em"
          >
            {label}
          </text>
          <text
            x="154"
            y="0"
            textAnchor="end"
            fill="var(--foreground)"
            fontSize="10"
            fontFamily="ui-monospace,'JetBrains Mono',monospace"
            fontWeight="800"
          >
            {value}
          </text>
        </g>
      ))}

      <g transform="translate(300 358)">
        <rect
          width="120"
          height="28"
          rx="14"
          fill="var(--primary)"
          fillOpacity="0.13"
          stroke="var(--primary)"
          strokeOpacity="0.3"
        />
        <text
          x="60"
          y="18.5"
          textAnchor="middle"
          fill="var(--primary)"
          fontSize="10"
          fontWeight="900"
          letterSpacing="0.12em"
        >
          SIGNED SCOPE
        </text>
      </g>
    </g>
  );
}

function BoundaryFrame() {
  return (
    <g>
      <path
        d="M120 280 C120 174 205 98 360 98 C515 98 600 174 600 280 C600 386 515 462 360 462 C205 462 120 386 120 280Z"
        fill="var(--primary)"
        fillOpacity="0.035"
        stroke="var(--primary)"
        strokeOpacity="0.16"
        strokeWidth="1.25"
      />
      <path
        d="M174 280 C174 204 238 150 360 150 C482 150 546 204 546 280 C546 356 482 410 360 410 C238 410 174 356 174 280Z"
        fill="none"
        stroke="var(--foreground)"
        strokeOpacity="0.08"
        strokeWidth="1"
      />
      <text
        x="360"
        y="88"
        textAnchor="middle"
        fill="var(--muted-foreground)"
        fontSize="10"
        fontWeight="800"
        letterSpacing="0.24em"
      >
        DOMAIN CUSTODY FIELD
      </text>
    </g>
  );
}

export function HeroArt({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 720 560"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid meet"
      className={cn("pointer-events-none select-none", className)}
    >
      <defs>
        <linearGradient id="hkiHeroSurface" x1="0" y1="0" x2="720" y2="560">
          <stop stopColor="var(--background)" />
          <stop offset="0.52" stopColor="var(--card)" />
          <stop offset="1" stopColor="var(--muted)" stopOpacity="0.45" />
        </linearGradient>
        <filter
          id="hkiHeroCardShadow"
          x="-20%"
          y="-35%"
          width="140%"
          height="170%"
          colorInterpolationFilters="sRGB"
        >
          <feDropShadow
            dx="0"
            dy="12"
            stdDeviation="12"
            floodColor="black"
            floodOpacity="0.08"
          />
        </filter>
        <filter
          id="hkiHeroCoreShadow"
          x="-24%"
          y="-30%"
          width="148%"
          height="170%"
          colorInterpolationFilters="sRGB"
        >
          <feDropShadow
            dx="0"
            dy="18"
            stdDeviation="16"
            floodColor="black"
            floodOpacity="0.13"
          />
        </filter>
      </defs>

      <rect width="720" height="560" rx="28" fill="url(#hkiHeroSurface)" />
      <path
        d="M44 452 C176 392 260 392 386 438 C492 477 576 456 676 398 L676 560 L44 560Z"
        fill="var(--primary)"
        fillOpacity="0.045"
      />
      <path
        d="M40 128 C160 78 252 83 366 132 C481 181 570 176 680 104"
        fill="none"
        stroke="var(--foreground)"
        strokeOpacity="0.055"
        strokeWidth="20"
        strokeLinecap="round"
      />

      <BoundaryFrame />
      {DOMAINS.map(domain => (
        <Rail key={`rail-${domain.id}`} domain={domain} />
      ))}
      <EnvelopeCore />
      {DOMAINS.map(domain => (
        <DomainCard key={domain.id} domain={domain} />
      ))}

      <g transform="translate(262 488)">
        <rect
          width="196"
          height="34"
          rx="17"
          fill="var(--card)"
          stroke="var(--border)"
        />
        <circle cx="22" cy="17" r="5" fill="var(--success)" />
        <text
          x="42"
          y="21"
          fill="var(--foreground)"
          fontSize="12"
          fontWeight="800"
        >
          Runtime proof, not trust
        </text>
      </g>
    </svg>
  );
}
