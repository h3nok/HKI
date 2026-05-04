/**
 * HKI Agentic Login — Clean, branded SSO entry point.
 *
 * Full-screen with subtle ambient gradient, glass card,
 * and "COSTCO AGENTIC" two-tone branding consistent with the platform.
 *
 * Conditional branding: ?from=knowledge shows KnowledgeIcon + "Knowledge Base"
 */

import { useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { getLoginUrl } from "../const";
import { useAuth } from "@/_core/hooks/useAuth";
import { Building2, Code, ArrowRight, Shield, Moon, Sun } from "lucide-react";
import { motion } from "framer-motion";
import { AgenticIcon } from "@/components/ui/icons/AgenticIcon";
import { KnowledgeIcon } from "@/components/ui/icons/KnowledgeIcon";
import { useTheme } from "@/contexts/ThemeContext";
import { usePageMeta } from "@/hooks/usePageMeta";
import { getPostLoginPath } from "./login-routing";

const EASE = [0.22, 1, 0.36, 1] as const;

// ── Floating orb ───────────────────────────────────────────────────────────
function Orb({
  color,
  size,
  x,
  y,
  delay,
  duration,
}: {
  color: string;
  size: number;
  x: string;
  y: string;
  delay: number;
  duration: number;
}) {
  return (
    <motion.div
      className="absolute rounded-full pointer-events-none"
      style={{
        width: size,
        height: size,
        left: x,
        top: y,
        background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
        filter: `blur(${size * 0.4}px)`,
      }}
      animate={{
        y: [0, -30, 0, 20, 0],
        x: [0, 15, -10, 5, 0],
        scale: [1, 1.1, 0.95, 1.05, 1],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    />
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export function AgenticLoginPage() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const isDev =
    (import.meta.env.DEV || import.meta.env.MODE === "development") &&
    !window.location.hostname.endsWith(".hki.com");
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  // Detect product context via ?from=<product|path>
  const fromParam = useMemo(
    () => new URLSearchParams(window.location.search).get("from"),
    []
  );
  const decodedFrom = useMemo(
    () => (fromParam ? decodeURIComponent(fromParam) : ""),
    [fromParam]
  );
  const isFromKnowledge = useMemo(() => {
    if (!decodedFrom) return false;
    return decodedFrom === "knowledge" || decodedFrom.startsWith("/knowledge");
  }, [decodedFrom]);

  useEffect(() => {
    if (!decodedFrom || sessionStorage.getItem("loginReturnTo")) return;

    if (isFromKnowledge) {
      sessionStorage.setItem(
        "loginReturnTo",
        decodedFrom === "knowledge" ? "/knowledge" : decodedFrom
      );
      return;
    }

    if (decodedFrom === "chat" || decodedFrom === "/chat") {
      sessionStorage.setItem("loginReturnTo", "/chat");
    }
  }, [decodedFrom, isFromKnowledge]);

  useEffect(() => {
    if (loading || !user) return;

    const returnTo = getPostLoginPath(
      user.role,
      sessionStorage.getItem("loginReturnTo")
    );
    sessionStorage.removeItem("loginReturnTo");
    setLocation(returnTo);
  }, [loading, setLocation, user]);

  usePageMeta(
    isFromKnowledge ? "Knowledge Base — Sign In" : "HKI Agentic — Sign In",
    isFromKnowledge ? "/favicon-knowledge.svg" : "/favicon.svg"
  );

  if (!loading && user) {
    return null;
  }

  return (
    <div className="fixed inset-0 overflow-hidden bg-background">
      {/* ── Ambient canvas ── */}
      {/* Base gradient mesh */}
      <div
        className="absolute inset-0"
        style={{
          background: isDark
            ? "radial-gradient(ellipse 80% 60% at 50% 40%, rgba(0,93,170,0.12) 0%, transparent 60%), " +
              "radial-gradient(ellipse 60% 50% at 75% 70%, rgba(227,24,55,0.06) 0%, transparent 50%), " +
              "radial-gradient(ellipse 50% 40% at 20% 80%, rgba(0,93,170,0.05) 0%, transparent 50%)"
            : "radial-gradient(ellipse 80% 60% at 50% 40%, rgba(0,93,170,0.06) 0%, transparent 60%), " +
              "radial-gradient(ellipse 60% 50% at 75% 70%, rgba(227,24,55,0.03) 0%, transparent 50%), " +
              "radial-gradient(ellipse 50% 40% at 20% 80%, rgba(0,93,170,0.03) 0%, transparent 50%)",
        }}
      />

      {/* Floating orbs — reduced to 2 for subtlety */}
      <Orb
        color={isDark ? "rgba(0,93,170,0.18)" : "rgba(0,93,170,0.06)"}
        size={450}
        x="12%"
        y="20%"
        delay={0}
        duration={14}
      />
      <Orb
        color={isDark ? "rgba(227,24,55,0.12)" : "rgba(227,24,55,0.04)"}
        size={380}
        x="65%"
        y="55%"
        delay={3}
        duration={16}
      />

      {/* Grid lines */}
      <div
        className="absolute inset-0 opacity-[0.03] dark:opacity-[0.03]"
        style={{
          backgroundImage: isDark
            ? "linear-gradient(rgba(255,255,255,.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.15) 1px, transparent 1px)"
            : "linear-gradient(rgba(0,0,0,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,.06) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
        }}
      />

      {/* Grain */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.025] dark:opacity-[0.035]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
          backgroundSize: "200px 200px",
        }}
      />

      {/* ── Content layer ── */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 py-12">
        {/* Theme toggle — top right */}
        <button
          onClick={toggleTheme}
          className="fixed top-5 right-5 z-50 p-2.5 rounded-xl
                     text-foreground/50 hover:text-foreground/80
                     hover:bg-foreground/5 border border-foreground/8 hover:border-foreground/15
                     transition-all duration-200 backdrop-blur-sm"
          aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
        >
          {theme === "light" ? (
            <Moon className="w-4 h-4" />
          ) : (
            <Sun className="w-4 h-4" />
          )}
        </button>

        {/* Dev banner */}
        {isDev && (
          <div className="fixed top-0 left-0 right-0 z-50 text-center text-[10px] py-1 font-bold uppercase tracking-widest bg-yellow-500/10 text-yellow-400 border-b border-yellow-500/20 backdrop-blur-sm">
            Development Environment
          </div>
        )}

        {/* Hero icon — conditional based on referrer */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: EASE }}
          className="flex flex-col items-center mb-6"
        >
          <div className="relative">
            {/* Soft glow behind icon */}
            <div
              className="absolute inset-0 rounded-full blur-2xl"
              style={{
                opacity: isDark ? 0.35 : 0.15,
                background: isFromKnowledge
                  ? "radial-gradient(circle, rgba(0,93,170,0.5) 0%, rgba(0,93,170,0.1) 70%, transparent 85%)"
                  : "radial-gradient(circle, rgba(0,93,170,0.5) 0%, rgba(227,24,55,0.15) 60%, transparent 80%)",
                transform: "scale(2)",
              }}
            />
            {isFromKnowledge ? (
              <KnowledgeIcon size={64} />
            ) : (
              <AgenticIcon size={64} />
            )}
          </div>
        </motion.div>

        {/* Brand name — conditional */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease: EASE }}
          className="text-center mb-3"
        >
          {isFromKnowledge ? (
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight leading-[1.1]">
              <span style={{ color: "var(--primary)" }}>Knowledge</span>
              <span className="mx-1" />
              <span style={{ color: "var(--destructive)" }}>Base</span>
            </h1>
          ) : (
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight leading-[1.1]">
              <span style={{ color: "var(--primary)" }}>HKI</span>
              <span className="mx-1" />
              <span style={{ color: "var(--destructive)" }}>Agentic</span>
            </h1>
          )}
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4, ease: EASE }}
          className="text-muted-foreground text-sm sm:text-base text-center max-w-xs mb-10 leading-relaxed"
        >
          {isFromKnowledge
            ? "Sign in to access your enterprise knowledge library"
            : "Autonomous agents that reason, act, and learn across your workflows"}
        </motion.p>

        {/* ── Glass login card ── */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.5, ease: EASE }}
          className="w-full max-w-sm"
        >
          <div
            className="rounded-2xl p-7 border backdrop-blur-xl"
            style={{
              borderColor: isDark
                ? "rgba(255,255,255,0.12)"
                : "rgba(0,0,0,0.08)",
              background: isDark
                ? "rgba(255,255,255,0.07)"
                : "rgba(255,255,255,0.75)",
              boxShadow: isDark
                ? "0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06), inset 0 1px 0 rgba(255,255,255,0.08)"
                : "0 8px 32px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.03), inset 0 1px 0 rgba(255,255,255,0.8)",
            }}
          >
            {/* SSO Button */}
            <a
              href={getLoginUrl()}
              className="group relative w-full h-13 rounded-xl font-semibold text-[15px] text-white
                         flex items-center justify-center gap-3 overflow-hidden
                         transition-all duration-300 hover:-translate-y-0.5
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              style={{
                background:
                  "linear-gradient(135deg, var(--primary) 0%, color-mix(in srgb, var(--primary) 80%, white) 50%, var(--primary) 100%)",
                boxShadow:
                  "0 4px 16px rgba(0,93,170,0.35), 0 0 0 1px rgba(0,93,170,0.1)",
              }}
            >
              {/* Shimmer effect */}
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{
                  background:
                    "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.15) 50%, transparent 60%)",
                  backgroundSize: "200% 100%",
                  animation: "shimmer 2s infinite linear",
                }}
              />
              <Building2 className="w-5 h-5 relative z-10" />
              <span className="relative z-10">Sign in with HKI SSO</span>
              <ArrowRight className="w-4 h-4 ml-0.5 relative z-10 group-hover:translate-x-0.5 transition-transform" />
            </a>

            <p className="text-center text-[11px] text-muted-foreground/70 mt-3 tracking-wide">
              Corporate single sign-on via Google Workspace
            </p>

            {/* Dev bypass */}
            {isDev && (
              <>
                <div className="relative my-5">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border/40" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-background/80 backdrop-blur-sm px-3 text-[10px] text-muted-foreground/60 uppercase tracking-widest">
                      or
                    </span>
                  </div>
                </div>

                <a
                  href="/api/dev-login"
                  className="w-full h-11 rounded-xl font-medium text-sm flex items-center justify-center gap-3
                             border border-border/50 text-muted-foreground hover:text-foreground
                             hover:border-border hover:bg-muted/50 transition-all duration-200
                             focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                  <Code className="w-4 h-4" />
                  <span>Development Login</span>
                </a>
              </>
            )}

            {/* Security note */}
            <div className="flex items-center justify-center gap-1.5 mt-6 pt-4 border-t border-border/40">
              <Shield className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              <span className="text-[11px] text-muted-foreground/70">
                End-to-end encrypted · SOC 2 compliant
              </span>
            </div>
          </div>
        </motion.div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 1 }}
          className="mt-10 text-center"
        >
          <p className="text-[11px] text-muted-foreground/60">
            © 2025 HKI · Innovation Labs
          </p>
        </motion.div>
      </div>

      {/* Shimmer keyframes */}
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}

export default AgenticLoginPage;
