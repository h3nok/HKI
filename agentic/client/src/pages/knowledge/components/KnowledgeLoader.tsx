/**
 * Knowledge Loader — Open book with turning page animation
 *
 * SVG-based open book. The right-hand page flips left repeatedly,
 * simulating reading/loading. Matches the BookOpen brand icon.
 */

import { motion } from "framer-motion";
import { ACCENT } from "../theme";

export default function KnowledgeLoader() {
  const glowPulse = [
    `0 0 0 0 ${ACCENT}00`,
    `0 0 0 8px ${ACCENT}1A`,
    `0 0 0 0 ${ACCENT}00`,
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35 }}
        className="flex flex-col items-center gap-8"
      >
        {/* Ambient glow */}
        <div className="absolute w-64 h-64 rounded-full bg-primary/8 dark:bg-primary/12 blur-3xl pointer-events-none" />
        {/* SVG open book with animated turning page */}
        <div className="relative">
          {/* Pulsing shimmer ring */}
          <motion.div
            className="absolute inset-0 rounded-2xl"
            animate={{
              boxShadow: glowPulse,
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
          <svg
            width="120"
            height="90"
            viewBox="0 0 96 72"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-label="Loading"
            className="relative drop-shadow-lg"
          >
            {/* Book shadow */}
            <ellipse
              cx="48"
              cy="68"
              rx="32"
              ry="4"
              fill={ACCENT}
              fillOpacity="0.15"
            />

            {/* Left cover */}
            <path
              d="M48 12 C48 12 28 10 10 14 L10 62 C28 58 48 60 48 60 Z"
              fill={ACCENT}
              fillOpacity="0.18"
              stroke={ACCENT}
              strokeOpacity="0.6"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />

            {/* Left page lines */}
            <line
              x1="18"
              y1="24"
              x2="42"
              y2="22"
              stroke={ACCENT}
              strokeOpacity="0.4"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <line
              x1="18"
              y1="31"
              x2="42"
              y2="29"
              stroke={ACCENT}
              strokeOpacity="0.3"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <line
              x1="18"
              y1="38"
              x2="42"
              y2="36"
              stroke={ACCENT}
              strokeOpacity="0.3"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <line
              x1="18"
              y1="45"
              x2="38"
              y2="43"
              stroke={ACCENT}
              strokeOpacity="0.25"
              strokeWidth="1.5"
              strokeLinecap="round"
            />

            {/* Right cover (static back) */}
            <path
              d="M48 12 C48 12 68 10 86 14 L86 62 C68 58 48 60 48 60 Z"
              fill={ACCENT}
              fillOpacity="0.12"
              stroke={ACCENT}
              strokeOpacity="0.4"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />

            {/* Spine */}
            <line
              x1="48"
              y1="11"
              x2="48"
              y2="61"
              stroke={ACCENT}
              strokeWidth="3"
              strokeLinecap="round"
              strokeOpacity="0.8"
            />

            {/* Turning page — animates from right side to left */}
            <path
              d="M48 13 C58 11 72 11 84 14 L84 60 C72 57 58 57 48 59 Z"
              fill={ACCENT}
              fillOpacity="0.28"
              stroke={ACCENT}
              strokeOpacity="0.7"
              strokeWidth="1.5"
              strokeLinejoin="round"
            >
              <animate
                attributeName="d"
                dur="2s"
                repeatCount="indefinite"
                calcMode="spline"
                keySplines="0.42 0 0.58 1; 0.42 0 0.58 1; 0.42 0 0.58 1"
                keyTimes="0; 0.45; 0.55; 1"
                values="
                M48 13 C58 11 72 11 84 14 L84 60 C72 57 58 57 48 59 Z;
                M48 13 C48 12 48 12 48 13 L48 59 C48 58 48 58 48 59 Z;
                M48 13 C38 11 24 11 12 14 L12 60 C24 57 38 57 48 59 Z;
                M48 13 C58 11 72 11 84 14 L84 60 C72 57 58 57 48 59 Z
              "
              />
              <animate
                attributeName="fill-opacity"
                dur="2s"
                repeatCount="indefinite"
                calcMode="spline"
                keySplines="0.42 0 0.58 1; 0.42 0 0.58 1; 0.42 0 0.58 1"
                keyTimes="0; 0.45; 0.55; 1"
                values="0.28; 0.12; 0.28; 0.28"
              />
            </path>

            {/* Page turn line highlight */}
            <line
              x1="48"
              y1="13"
              x2="48"
              y2="59"
              stroke={ACCENT}
              strokeOpacity="0"
              strokeWidth="1.5"
            >
              <animate
                attributeName="stroke-opacity"
                dur="2s"
                repeatCount="indefinite"
                keyTimes="0; 0.4; 0.5; 1"
                values="0; 0.6; 0; 0"
              />
            </line>
          </svg>
        </div>

        <motion.div
          className="text-center space-y-2"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
        >
          <p className="text-sm font-semibold text-foreground">
            Loading Knowledge Base
          </p>
          <div className="flex items-center justify-center gap-1">
            <motion.div
              className="w-1.5 h-1.5 rounded-full bg-primary"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: 0 }}
            />
            <motion.div
              className="w-1.5 h-1.5 rounded-full bg-primary"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}
            />
            <motion.div
              className="w-1.5 h-1.5 rounded-full bg-primary"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: 0.4 }}
            />
          </div>
          <p className="text-xs text-muted-foreground/60">
            Preparing your workspace…
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}
