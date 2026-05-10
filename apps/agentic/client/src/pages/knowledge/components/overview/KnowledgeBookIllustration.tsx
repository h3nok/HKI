/**
 * KnowledgeBookIllustration
 *
 * The entire hero card IS an open book. Filled page surfaces with
 * paper tint, deep gutter shadow along the spine, visible page
 * stacking on the bottom edge, and page-curl shading that darkens
 * toward the binding. Every pixel of the card reads as book.
 *
 * HKI Iris (#0E7C7B) — contour, text lines
 * Ink Neutral (#18212B) — page mass, shadow, paper tint
 * HKI Iris duotone — spine only
 */

import { memo } from "react";
import { cn } from "@hki/ui";

const B = "#0E7C7B";
const S = "#18212B";
const R = B;

const CSS = `
@media (prefers-reduced-motion: no-preference) {
  @keyframes kbi-fade { from { opacity: 0 } to { opacity: 1 } }
  @keyframes kbi-up   { from { opacity: 0; transform: translateY(4px) } to { opacity: 1; transform: translateY(0) } }
  @keyframes kbi-settle {
    from { opacity: 0; transform: translateY(8px) scale(.985) }
    to { opacity: 1; transform: translateY(0) scale(1) }
  }
  @keyframes kbi-draw {
    from { opacity: 0; stroke-dashoffset: 228 }
    to { opacity: 0.32; stroke-dashoffset: 0 }
  }

  .kbi-base  { animation: kbi-settle .75s cubic-bezier(.2,.85,.22,1) both }
  .kbi-pages { animation: kbi-settle .82s cubic-bezier(.2,.85,.22,1) .04s both }
  .kbi-leaf  { animation: kbi-fade .28s linear both }
  .kbi-shad  { animation: kbi-fade .85s ease-out .34s both }
  .kbi-spine { animation: kbi-fade .45s linear .34s both }
  .kbi-spine line { stroke-dasharray: 228; stroke-dashoffset: 228; animation: kbi-draw .9s ease-out .34s both }
  .kbi-pg    { animation: kbi-up  .9s ease-out .28s both }
  .kbi-curl  { animation: kbi-fade .8s ease-out .52s both }
}

/* Dark mode needs contrast, not raw opacity amplification */
:is(.dark, [data-theme="dark"]) .kbi-boost {
  filter: brightness(1.1) contrast(1.04) saturate(0.88);
}

.kbi-dark { display: none; }

:is(.dark, [data-theme="dark"]) .kbi-light { display: none; }
:is(.dark, [data-theme="dark"]) .kbi-dark { display: inline; }
`;

interface Props {
  className?: string;
  /** Rotate the book so the spine runs horizontally (book lying flat on a surface) */
  horizontal?: boolean;
}

function KnowledgeBookIllustration({ className, horizontal }: Props) {
  if (horizontal) return <FloorBookView className={className} />;

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden",
        className
      )}
    >
      <style>{CSS}</style>

      <svg
        aria-hidden
        viewBox="0 0 960 280"
        fill="none"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full kbi-boost"
      >
        <defs>
          <clipPath id="kbi-page-left" clipPathUnits="userSpaceOnUse">
            <rect x="0" y="0" width="480" height="280">
              <animate
                attributeName="x"
                values="480;0"
                dur="900ms"
                begin="0s"
                fill="freeze"
                calcMode="spline"
                keySplines="0.22 0.8 0.22 1"
                keyTimes="0;1"
              />
              <animate
                attributeName="width"
                values="0;480"
                dur="900ms"
                begin="0s"
                fill="freeze"
                calcMode="spline"
                keySplines="0.22 0.8 0.22 1"
                keyTimes="0;1"
              />
            </rect>
          </clipPath>
          <clipPath id="kbi-page-right" clipPathUnits="userSpaceOnUse">
            <rect x="480" y="0" width="480" height="280">
              <animate
                attributeName="width"
                values="0;480"
                dur="900ms"
                begin="0s"
                fill="freeze"
                calcMode="spline"
                keySplines="0.22 0.8 0.22 1"
                keyTimes="0;1"
              />
            </rect>
          </clipPath>
          {/* Left page shading — darkens toward spine gutter */}
          <linearGradient id="kbi-shade-l" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={S} stopOpacity="0" />
            <stop offset="60%" stopColor={S} stopOpacity="0.04" />
            <stop offset="88%" stopColor={S} stopOpacity="0.07" />
            <stop offset="100%" stopColor={S} stopOpacity="0.12" />
          </linearGradient>
          {/* Right page shading — mirror */}
          <linearGradient id="kbi-shade-r" x1="1" y1="0" x2="0" y2="0">
            <stop offset="0%" stopColor={S} stopOpacity="0" />
            <stop offset="60%" stopColor={S} stopOpacity="0.03" />
            <stop offset="88%" stopColor={S} stopOpacity="0.07" />
            <stop offset="100%" stopColor={S} stopOpacity="0.12" />
          </linearGradient>
          {/* Spine gutter — deep V shadow */}
          <linearGradient id="kbi-gutter" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={S} stopOpacity="0" />
            <stop offset="30%" stopColor={S} stopOpacity="0.04" />
            <stop offset="45%" stopColor={S} stopOpacity="0.10" />
            <stop offset="50%" stopColor={S} stopOpacity="0.16" />
            <stop offset="55%" stopColor={S} stopOpacity="0.10" />
            <stop offset="70%" stopColor={S} stopOpacity="0.04" />
            <stop offset="100%" stopColor={S} stopOpacity="0" />
          </linearGradient>
          {/* Spine gutter in dark mode — slightly narrower and calmer */}
          <linearGradient id="kbi-gutter-dark" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={S} stopOpacity="0" />
            <stop offset="34%" stopColor={S} stopOpacity="0.03" />
            <stop offset="46%" stopColor={S} stopOpacity="0.08" />
            <stop offset="50%" stopColor={S} stopOpacity="0.12" />
            <stop offset="54%" stopColor={S} stopOpacity="0.08" />
            <stop offset="66%" stopColor={S} stopOpacity="0.03" />
            <stop offset="100%" stopColor={S} stopOpacity="0" />
          </linearGradient>
          {/* Page edge highlight — top crease catch-light */}
          <linearGradient id="kbi-highlight" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor={S} stopOpacity="0" />
            <stop offset="100%" stopColor={S} stopOpacity="0.06" />
          </linearGradient>
          {/* Soft drop shadow filter */}
          <filter id="kbi-drop" x="-2%" y="-2%" width="104%" height="106%">
            <feDropShadow
              dx="0"
              dy="1"
              stdDeviation="3"
              floodColor={S}
              floodOpacity="0.06"
            />
          </filter>
        </defs>

        {/* ═══════════════════════════════════════════════════
            LAYER 0 — BACK COVER (filled, dark tint)
            ═══════════════════════════════════════════════════ */}
        <g className="kbi-base">
          <path
            d="M480 278 C310 256 90 248 0 254 L0 18 C90 10 310 16 480 42 C650 16 870 10 960 18 L960 254 C870 248 650 256 480 278Z"
            fill={S}
            fillOpacity="0.018"
          />
        </g>

        {/* ═══════════════════════════════════════════════════
            LAYER 1 — PAGE STACK (6 visible edges = thick book)
            ═══════════════════════════════════════════════════ */}
        <g className="kbi-pages">
          {/* Each page is slightly inset + lighter, building thickness */}
          <path
            d="M480 274 C320 256 110 250 10 254 L10 24 C110 18 320 22 480 44 C640 22 850 18 950 24 L950 254 C850 250 640 256 480 274Z"
            fill={S}
            fillOpacity="0.016"
          />
          <path
            d="M480 271 C325 254 118 248 18 252 L18 27 C118 22 325 25 480 45 C635 25 842 22 942 27 L942 252 C842 248 635 254 480 271Z"
            fill={S}
            fillOpacity="0.012"
          />
          <path
            d="M480 268 C330 252 125 246 25 250 L25 30 C125 25 330 28 480 47 C630 28 835 25 935 30 L935 250 C835 246 630 252 480 268Z"
            fill={S}
            fillOpacity="0.009"
          />
          <path
            d="M480 265 C335 250 132 244 32 248 L32 33 C132 28 335 31 480 49 C625 31 828 28 928 33 L928 248 C828 244 625 250 480 265Z"
            fill={S}
            fillOpacity="0.007"
          />
          <path
            d="M480 263 C338 248 138 243 38 246 L38 36 C138 31 338 34 480 51 C622 34 822 31 922 36 L922 246 C822 243 622 248 480 263Z"
            fill={S}
            fillOpacity="0.005"
          />
          <path
            d="M480 261 C340 247 142 242 42 244 L42 38 C142 34 340 36 480 53 C620 36 818 34 918 38 L918 244 C818 242 620 247 480 261Z"
            fill={S}
            fillOpacity="0.003"
          />
        </g>

        {/* ═══════════════════════════════════════════════════
            LAYER 2 — TOP PAGE (filled surface, the main page)
            ═══════════════════════════════════════════════════ */}
        <g
          className="kbi-leaf kbi-leaf-l"
          clipPath="url(#kbi-page-left)"
          filter="url(#kbi-drop)"
        >
          {/* Left leaf — opens from the spine on load */}
          <path
            d="M480 258 C342 244 150 238 45 242 L45 42 C150 36 342 40 480 56 C618 40 810 36 915 42 L915 242 C810 238 618 244 480 258Z"
            fill={S}
            fillOpacity="0.015"
          />
          <path
            d="M45 42 C150 36 342 40 480 56 C618 40 810 36 915 42"
            stroke={B}
            strokeWidth="1.35"
            opacity="0.36"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d="M45 242 C150 238 342 244 480 258 C618 244 810 238 915 242"
            stroke={B}
            strokeWidth="0.95"
            opacity="0.2"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d="M480 258 C342 244 150 238 45 242 L45 42 C150 36 342 40 480 56Z"
            fill="url(#kbi-shade-l)"
          />
          <path
            d="M45 42 C150 36 342 40 480 56 C618 40 810 36 915 42 L915 52 C810 46 618 50 480 66 C342 50 150 46 45 52Z"
            fill="url(#kbi-highlight)"
          />

          {/* Left page editorial framing */}
          <g
            className="kbi-pg"
            stroke={B}
            strokeLinecap="round"
            fill="none"
            opacity="0.22"
          >
            <line
              x1="100"
              y1="60"
              x2="248"
              y2="60"
              strokeWidth="0.95"
              vectorEffect="non-scaling-stroke"
            />
            <line
              x1="100"
              y1="68"
              x2="204"
              y2="68"
              strokeWidth="0.75"
              vectorEffect="non-scaling-stroke"
            />
          </g>

          {/* Left page */}
          <g
            className="kbi-pg"
            stroke={B}
            strokeWidth="0.7"
            strokeLinecap="round"
            opacity="0.18"
          >
            <line x1="100" y1="72" x2="438" y2="76" />
            <line x1="100" y1="86" x2="436" y2="90" />
            <line x1="100" y1="100" x2="350" y2="103" />
            <line x1="100" y1="120" x2="432" y2="122" />
            <line x1="100" y1="134" x2="430" y2="135" />
            <line x1="100" y1="148" x2="410" y2="148" />
            <line x1="100" y1="162" x2="380" y2="160" />
            <line x1="100" y1="182" x2="435" y2="178" />
            <line x1="100" y1="196" x2="424" y2="190" />
            <line x1="100" y1="210" x2="300" y2="205" />
          </g>
        </g>

        <g
          className="kbi-leaf kbi-leaf-r"
          clipPath="url(#kbi-page-right)"
          filter="url(#kbi-drop)"
        >
          {/* Right leaf — opens from the spine on load */}
          <path
            d="M480 258 C342 244 150 238 45 242 L45 42 C150 36 342 40 480 56 C618 40 810 36 915 42 L915 242 C810 238 618 244 480 258Z"
            fill={S}
            fillOpacity="0.015"
          />
          <path
            d="M45 42 C150 36 342 40 480 56 C618 40 810 36 915 42"
            stroke={B}
            strokeWidth="1.35"
            opacity="0.50"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d="M45 242 C150 238 342 244 480 258 C618 244 810 238 915 242"
            stroke={B}
            strokeWidth="0.95"
            opacity="0.35"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d="M480 258 C618 244 810 238 915 242 L915 42 C810 36 618 40 480 56Z"
            fill="url(#kbi-shade-r)"
          />
          <path
            d="M45 42 C150 36 342 40 480 56 C618 40 810 36 915 42 L915 52 C810 46 618 50 480 66 C342 50 150 46 45 52Z"
            fill="url(#kbi-highlight)"
          />

          {/* Right page editorial framing */}
          <g
            className="kbi-pg"
            stroke={B}
            strokeLinecap="round"
            fill="none"
            opacity="0.22"
          >
            <line
              x1="522"
              y1="60"
              x2="670"
              y2="60"
              strokeWidth="0.95"
              vectorEffect="non-scaling-stroke"
            />
            <line
              x1="522"
              y1="68"
              x2="626"
              y2="68"
              strokeWidth="0.75"
              vectorEffect="non-scaling-stroke"
            />
          </g>

          {/* Right page */}
          <g
            className="kbi-pg"
            stroke={B}
            strokeWidth="0.7"
            strokeLinecap="round"
            opacity="0.18"
          >
            <line x1="522" y1="76" x2="860" y2="72" />
            <line x1="522" y1="90" x2="860" y2="86" />
            <line x1="522" y1="104" x2="860" y2="100" />
            <line x1="522" y1="118" x2="780" y2="115" />
            <line x1="522" y1="138" x2="860" y2="136" />
            <line x1="522" y1="152" x2="860" y2="150" />
            <line x1="522" y1="166" x2="820" y2="164" />
            <line x1="522" y1="186" x2="855" y2="185" />
            <line x1="522" y1="200" x2="855" y2="200" />
            <line x1="522" y1="214" x2="855" y2="215" />
            <line x1="522" y1="228" x2="740" y2="228" />
          </g>

          {/* Bottom-right corner lift — suggests a turnable page */}
          <g className="kbi-curl">
            <path
              d="M900 230 Q912 228 914 240 Q910 238 900 238Z"
              fill={S}
              fillOpacity="0.025"
            />
            <path
              d="M900 230 Q912 228 914 240"
              stroke={S}
              strokeWidth="0.4"
              opacity="0.18"
              fill="none"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        </g>

        {/* ═══════════════════════════════════════════════════
            LAYER 3 — SHADOWS (gutter, curls, thickness)
            ═══════════════════════════════════════════════════ */}
        <g className="kbi-shad">
          {/* Spine gutter — tuned separately for light and dark surfaces */}
          <rect
            className="kbi-light"
            x="440"
            y="36"
            width="80"
            height="240"
            fill="url(#kbi-gutter)"
          />
          <rect
            className="kbi-dark"
            x="448"
            y="42"
            width="64"
            height="228"
            fill="url(#kbi-gutter-dark)"
          />
          {/* Bottom page thickness — solid filled bands */}
          <path
            d="M480 258 C342 244 150 238 45 242 L45 249 C150 245 342 250 480 266 C618 250 810 245 915 249 L915 242 C810 238 618 244 480 258Z"
            fill={S}
            opacity="0.045"
          />
          <path
            d="M480 266 C342 250 150 245 45 249 L45 255 C150 251 342 256 480 272 C618 256 810 251 915 255 L915 249 C810 245 618 250 480 266Z"
            fill={S}
            opacity="0.030"
          />
          <path
            d="M480 272 C342 256 150 251 45 255 L45 260 C150 257 342 261 480 276 C618 261 810 257 915 260 L915 255 C810 251 618 256 480 272Z"
            fill={S}
            opacity="0.018"
          />
        </g>

        {/* ═══════════════════════════════════════════════════
            LAYER 4 — SPINE
            ═══════════════════════════════════════════════════ */}
        <g className="kbi-spine">
          {/* Main spine — red */}
          <line
            x1="480"
            y1="42"
            x2="480"
            y2="270"
            stroke={R}
            strokeWidth="1.35"
            opacity="0.50"
            vectorEffect="non-scaling-stroke"
          />
        </g>
      </svg>
    </div>
  );
}

const MemoizedKnowledgeBookIllustration = memo(KnowledgeBookIllustration);

MemoizedKnowledgeBookIllustration.displayName = "KnowledgeBookIllustration";

export default MemoizedKnowledgeBookIllustration;

/* ═══════════════════════════════════════════════════════════════════
   FloorBookView — open book lying flat on warehouse floor,
   one-point perspective. VP at center-top. Spine runs vertically
   toward the horizon. Curved page edges bow outward from the spine.
   Multiple page layers for thickness. Pages flip open on load.
   ═══════════════════════════════════════════════════════════════════ */

const FLOOR_CSS = `
@media (prefers-reduced-motion: no-preference) {
  @keyframes fb-enter {
    from { opacity: 0; transform: translateY(10px) }
    to { opacity: 1; transform: translateY(0) }
  }

  @keyframes fb-lines {
    from { opacity: 0 }
    to { opacity: 1 }
  }

  .fb-enter {
    animation: fb-enter 520ms cubic-bezier(.22,.8,.22,1) both;
  }

  .fb-lines {
    animation: fb-lines 420ms ease-out 120ms both;
  }
}

.fb-dark { display: none; }

:is(.dark,[data-theme="dark"]) .fb-light { display: none !important; }
:is(.dark,[data-theme="dark"]) .fb-dark { display: inline !important; }
`;

function FloorBookView({ className }: { className?: string }) {
  const leftPagePath = [
    "M 480 84",
    "C 426 86 350 98 278 118",
    "C 202 139 145 162 96 194",
    "C 210 188 326 188 454 200",
    "C 465 159 473 120 480 84",
    "Z",
  ].join(" ");

  const rightPagePath = [
    "M 480 84",
    "C 534 86 610 98 682 118",
    "C 758 139 815 162 864 194",
    "C 750 188 634 188 506 200",
    "C 495 159 487 120 480 84",
    "Z",
  ].join(" ");

  const gutterPath = [
    "M 464 88",
    "C 470 120 473 156 474 198",
    "L 486 198",
    "C 487 156 490 120 496 88",
    "Z",
  ].join(" ");

  const turningPageRightPath = [
    "M 480 86",
    "C 534 88 608 100 678 119",
    "C 746 138 800 159 850 190",
    "C 738 186 632 187 508 198",
    "C 497 159 490 121 480 86",
    "Z",
  ].join(" ");

  const turningPageFoldPath = [
    "M 480 86",
    "C 482 88 484 104 486 124",
    "C 487 146 487 170 486 198",
    "C 484 198 482 198 480 198",
    "C 479 159 479 121 480 86",
    "Z",
  ].join(" ");

  const turningPageLeftPath = [
    "M 480 86",
    "C 426 88 352 100 282 119",
    "C 214 138 160 159 110 190",
    "C 222 186 328 187 452 198",
    "C 463 159 470 121 480 86",
    "Z",
  ].join(" ");

  const leftLines = [
    { x1: 220, y1: 132, x2: 392, y2: 142 },
    { x1: 202, y1: 148, x2: 374, y2: 156 },
    { x1: 188, y1: 164, x2: 352, y2: 170 },
    { x1: 214, y1: 180, x2: 336, y2: 185 },
  ];
  const rightLines = [
    { x1: 568, y1: 142, x2: 740, y2: 132 },
    { x1: 586, y1: 156, x2: 758, y2: 148 },
    { x1: 606, y1: 170, x2: 766, y2: 164 },
    { x1: 624, y1: 184, x2: 744, y2: 180 },
  ];

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden",
        className
      )}
    >
      <style>{FLOOR_CSS}</style>

      <svg
        aria-hidden
        viewBox="0 0 960 240"
        fill="none"
        preserveAspectRatio="xMidYMax slice"
        className="absolute bottom-0 left-0 h-[56%] w-full"
      >
        <defs>
          <linearGradient id="fb-fade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="white" stopOpacity="0" />
            <stop offset="24%" stopColor="white" stopOpacity="0.3" />
            <stop offset="52%" stopColor="white" stopOpacity="0.82" />
            <stop offset="100%" stopColor="white" stopOpacity="1" />
          </linearGradient>
          <mask id="fb-mask">
            <rect width="960" height="240" fill="url(#fb-fade)" />
          </mask>

          <linearGradient id="fb-page-light" x1="0" y1="84" x2="0" y2="200">
            <stop offset="0%" stopColor="#F7FAFC" stopOpacity="0.98" />
            <stop offset="100%" stopColor="#DEE8F0" stopOpacity="0.9" />
          </linearGradient>
          <linearGradient id="fb-page-dark" x1="0" y1="84" x2="0" y2="200">
            <stop offset="0%" stopColor="#16212D" stopOpacity="0.94" />
            <stop offset="100%" stopColor="#0F1721" stopOpacity="0.98" />
          </linearGradient>
          <radialGradient id="fb-shadow-light" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={B} stopOpacity="0.08" />
            <stop offset="100%" stopColor={B} stopOpacity="0" />
          </radialGradient>
          <radialGradient id="fb-shadow-dark" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={S} stopOpacity="0.16" />
            <stop offset="100%" stopColor={S} stopOpacity="0" />
          </radialGradient>
          <linearGradient id="fb-gutter" x1="464" y1="88" x2="496" y2="88">
            <stop offset="0%" stopColor={S} stopOpacity="0" />
            <stop offset="50%" stopColor={S} stopOpacity="0.18" />
            <stop offset="100%" stopColor={S} stopOpacity="0" />
          </linearGradient>
        </defs>

        <g mask="url(#fb-mask)">
          <ellipse
            className="fb-enter fb-light"
            cx="480"
            cy="208"
            rx="236"
            ry="18"
            fill="url(#fb-shadow-light)"
          />
          <ellipse
            className="fb-enter fb-dark"
            cx="480"
            cy="208"
            rx="236"
            ry="18"
            fill="url(#fb-shadow-dark)"
          />

          <g className="fb-enter">
            <path
              className="fb-light"
              d={leftPagePath}
              fill="url(#fb-page-light)"
              stroke={B}
              strokeWidth="0.95"
              strokeOpacity="0.14"
            />
            <path
              className="fb-light"
              d={rightPagePath}
              fill="url(#fb-page-light)"
              stroke={B}
              strokeWidth="0.95"
              strokeOpacity="0.14"
            />
            <path
              className="fb-dark"
              d={leftPagePath}
              fill="url(#fb-page-dark)"
            />
            <path
              className="fb-dark"
              d={rightPagePath}
              fill="url(#fb-page-dark)"
            />

            <path d={gutterPath} fill="url(#fb-gutter)" />

            <path
              d="M 480 84 C 426 86 350 98 278 118 C 202 139 145 162 96 194"
              stroke={B}
              strokeWidth="1.05"
              opacity="0.24"
              fill="none"
              strokeLinecap="round"
            />
            <path
              d="M 480 84 C 534 86 610 98 682 118 C 758 139 815 162 864 194"
              stroke={B}
              strokeWidth="1.05"
              opacity="0.24"
              fill="none"
              strokeLinecap="round"
            />
            <path
              d="M 96 194 C 210 188 326 188 454 200"
              stroke={B}
              strokeWidth="0.9"
              opacity="0.17"
              fill="none"
              strokeLinecap="round"
            />
            <path
              d="M 506 200 C 634 188 750 188 864 194"
              stroke={B}
              strokeWidth="0.9"
              opacity="0.17"
              fill="none"
              strokeLinecap="round"
            />

            <line
              x1="480"
              y1="88"
              x2="480"
              y2="198"
              stroke={R}
              strokeWidth="1.35"
              opacity="0.56"
            />

            <path
              className="fb-light"
              d={turningPageRightPath}
              fill="url(#fb-page-light)"
              stroke={B}
              strokeWidth="0.95"
              strokeOpacity="0.22"
              opacity="0"
            >
              <animate
                attributeName="d"
                dur="1.45s"
                begin="0.18s"
                repeatCount="1"
                fill="freeze"
                calcMode="spline"
                keySplines="0.42 0 0.58 1; 0.42 0 0.58 1"
                keyTimes="0; 0.56; 1"
                values={`${turningPageRightPath};${turningPageFoldPath};${turningPageLeftPath}`}
              />
              <animate
                attributeName="opacity"
                dur="1.45s"
                begin="0.18s"
                repeatCount="1"
                fill="freeze"
                keyTimes="0; 0.08; 0.56; 1"
                values="0;0.9;0.58;0"
              />
              <animate
                attributeName="fill-opacity"
                dur="1.45s"
                begin="0.18s"
                repeatCount="1"
                fill="freeze"
                keyTimes="0; 0.56; 1"
                values="0.82;0.62;0.2"
              />
            </path>

            <path
              className="fb-dark"
              d={turningPageRightPath}
              fill="url(#fb-page-dark)"
              stroke={B}
              strokeWidth="1"
              strokeOpacity="0.24"
              opacity="0"
            >
              <animate
                attributeName="d"
                dur="1.45s"
                begin="0.18s"
                repeatCount="1"
                fill="freeze"
                calcMode="spline"
                keySplines="0.42 0 0.58 1; 0.42 0 0.58 1"
                keyTimes="0; 0.56; 1"
                values={`${turningPageRightPath};${turningPageFoldPath};${turningPageLeftPath}`}
              />
              <animate
                attributeName="opacity"
                dur="1.45s"
                begin="0.18s"
                repeatCount="1"
                fill="freeze"
                keyTimes="0; 0.08; 0.56; 1"
                values="0;0.88;0.54;0"
              />
              <animate
                attributeName="fill-opacity"
                dur="1.45s"
                begin="0.18s"
                repeatCount="1"
                fill="freeze"
                keyTimes="0; 0.56; 1"
                values="0.92;0.74;0.26"
              />
            </path>

            <line
              x1="480"
              y1="88"
              x2="480"
              y2="198"
              stroke={B}
              strokeWidth="1.1"
              strokeOpacity="0"
            >
              <animate
                attributeName="stroke-opacity"
                dur="1.45s"
                begin="0.18s"
                repeatCount="1"
                fill="freeze"
                keyTimes="0; 0.44; 0.6; 1"
                values="0;0.36;0.14;0"
              />
            </line>
          </g>

          <g className="fb-lines">
            {leftLines.map((line, index) => (
              <line
                key={`left-line-${index}`}
                x1={line.x1}
                y1={line.y1}
                x2={line.x2}
                y2={line.y2}
                stroke={B}
                strokeWidth={index === 0 ? "1.05" : "0.8"}
                opacity={index === 0 ? "0.24" : "0.18"}
                strokeLinecap="round"
              />
            ))}
            {rightLines.map((line, index) => (
              <line
                key={`right-line-${index}`}
                x1={line.x1}
                y1={line.y1}
                x2={line.x2}
                y2={line.y2}
                stroke={B}
                strokeWidth={index === 0 ? "1.05" : "0.8"}
                opacity={index === 0 ? "0.24" : "0.18"}
                strokeLinecap="round"
              />
            ))}
          </g>
        </g>
      </svg>
    </div>
  );
}
