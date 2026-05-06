import { motion } from "framer-motion";

/**
 * GlobalBackdrop
 *
 * A premium, abstract background for dense data dashboards.
 * Features:
 * - A 2D structural micro-grid for architectural grounding
 * - Very subtle, slow-moving ambient mesh gradients
 * - Vignetting and noise overlays
 */
export function GlobalBackdrop() {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none bg-[#F1F5F9] dark:bg-[#06080A]">
      {/* ── 1. Soft Ambient Mesh Gradients ──────────────────────────────── */}
      {/* Light Mode Gradients */}
      <motion.div
        className="absolute top-[-20%] left-[-10%] w-[60%] h-[70%] rounded-full opacity-30 dark:opacity-0"
        style={{
          background:
            "radial-gradient(circle at center, rgba(14, 165, 233, 0.08) 0%, transparent 60%)",
          filter: "blur(60px)",
        }}
        animate={{
          x: ["0%", "5%", "0%"],
          y: ["0%", "8%", "0%"],
        }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute top-[-10%] right-[-10%] w-[50%] h-[60%] rounded-full opacity-20 dark:opacity-0"
        style={{
          background:
            "radial-gradient(circle at center, rgba(139, 92, 246, 0.06) 0%, transparent 60%)",
          filter: "blur(60px)",
        }}
        animate={{
          x: ["0%", "-5%", "0%"],
          y: ["0%", "5%", "0%"],
        }}
        transition={{
          duration: 18,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 2,
        }}
      />

      {/* Dark Mode Gradients */}
      <motion.div
        className="absolute top-[-20%] left-[-10%] w-[60%] h-[70%] rounded-full opacity-0 dark:opacity-[0.15]"
        style={{
          background:
            "radial-gradient(circle at center, rgba(56, 189, 248, 1) 0%, transparent 60%)",
          filter: "blur(80px)",
        }}
        animate={{
          x: ["0%", "5%", "0%"],
          y: ["0%", "8%", "0%"],
        }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full opacity-0 dark:opacity-[0.12]"
        style={{
          background:
            "radial-gradient(circle at center, rgba(167, 139, 250, 1) 0%, transparent 60%)",
          filter: "blur(80px)",
        }}
        animate={{
          x: ["0%", "-5%", "0%"],
          y: ["0%", "-8%", "0%"],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 5,
        }}
      />

      {/* ── 2. Structural Micro-Grid ──────────────────────────────────── */}
      {/* Removed per user request */}

      {/* ── 3. Subtle Grain Overlay ───────────────────────────────────── */}
      <div
        className="absolute inset-0 opacity-[0.03] dark:opacity-[0.04]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E\")",
          backgroundSize: "256px 256px",
        }}
      />

      {/* ── 4. Edge Fade Vignetting ───────────────────────────────────── */}
      <div className="absolute inset-0 left-0 right-0 h-[30%] bg-linear-to-b from-[#F1F5F9] via-[#F1F5F9]/60 to-transparent dark:from-[#06080A] dark:via-[#06080A]/60" />
      <div className="absolute bottom-0 left-0 right-0 h-[40%] bg-linear-to-t from-[#F1F5F9] via-[#F1F5F9]/30 to-transparent dark:from-[#06080A] dark:via-[#06080A]/40" />
      <div className="absolute inset-y-0 left-0 w-[5%] bg-linear-to-r from-[#F1F5F9] to-transparent dark:from-[#06080A]" />
      <div className="absolute inset-y-0 right-0 w-[5%] bg-linear-to-l from-[#F1F5F9] to-transparent dark:from-[#06080A]" />
    </div>
  );
}
