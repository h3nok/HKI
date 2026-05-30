/**
 * HKI Login — Clean, branded SSO entry point.
 *
 * Full-screen with subtle ambient gradient, glass card,
 * and HKI two-tone branding consistent with the platform.
 *
 * Conditional branding: ?from=knowledge shows KnowledgeIcon + "Knowledge Domains"
 */

import { useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { getLoginUrl } from "../const";
import { useAuth } from "@/_core/hooks/useAuth";
import { Building2, Code, ArrowRight, Shield, Moon, Sun } from "lucide-react";
import { motion } from "framer-motion";
import { KnowledgeIcon } from "@/components/ui/icons/KnowledgeIcon";
import { useTheme } from "@/contexts/ThemeContext";
import { usePageMeta } from "@/hooks/usePageMeta";
import { getPostLoginPath } from "./login-routing";
import { HkiMark } from "@hki/ui";

const EASE = [0.22, 1, 0.36, 1] as const;
const IRIS = "var(--hki-iris-500)";

function colorMix(color: string, amount: number, base = "transparent") {
  return `color-mix(in srgb, ${color} ${amount}%, ${base})`;
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
    isFromKnowledge ? "Knowledge Domains — Sign In" : "HKI — Sign In",
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
          background: "var(--background)",
        }}
      />

      {/* Grid lines */}
      <div
        className="absolute inset-0 opacity-[0.03] dark:opacity-[0.03]"
        style={{
          backgroundImage: "none",
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
          <div className="fixed top-0 left-0 right-0 z-50 text-center text-[10px] py-1 font-bold uppercase tracking-widest bg-primary/10 text-primary border-b border-primary/20 backdrop-blur-sm">
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
            <motion.div
              className="absolute inset-0 rounded-full blur-2xl"
              style={{
                opacity: isDark ? 0.35 : 0.15,
                background: colorMix(IRIS, isDark ? 28 : 14),
                transform: "scale(2)",
              }}
              animate={{
                opacity: isDark ? [0.22, 0.42, 0.22] : [0.1, 0.2, 0.1],
              }}
              transition={{
                duration: 2.6,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
            <motion.div
              className="relative"
              animate={{ y: [0, -3, 0], rotate: [-1, 1, -1] }}
              transition={{
                duration: 3.2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              {isFromKnowledge ? (
                <KnowledgeIcon size={64} />
              ) : (
                <HkiMark size={64} variant="color" />
              )}
            </motion.div>
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
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-normal leading-[1.1]">
              <span style={{ color: "var(--primary)" }}>Knowledge</span>
              <span className="mx-1" />
              <span style={{ color: "var(--foreground)" }}>Domains</span>
            </h1>
          ) : (
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-normal leading-[1.1]">
              <span style={{ color: "var(--primary)" }}>Hermetic</span>
              <span className="mx-1" />
              <span style={{ color: "var(--primary)" }}>Isolation</span>
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
            : "Sign in to run scoped agentic workflows under one active domain"}
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
                ? colorMix("var(--neutral-0)", 12)
                : colorMix("var(--neutral-950)", 8),
              background: isDark
                ? colorMix("var(--neutral-0)", 7)
                : colorMix("var(--neutral-0)", 75),
              boxShadow: "var(--shadow-lg)",
            }}
          >
            {/* SSO Button */}
            <a
              href={getLoginUrl()}
              className="group relative w-full h-13 rounded-xl font-semibold text-[15px] text-primary-foreground
                         flex items-center justify-center gap-3 overflow-hidden
                         transition-all duration-300 hover:-translate-y-0.5
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              style={{
                background: "var(--primary)",
                boxShadow: "var(--shadow-md)",
              }}
            >
              {/* Shimmer effect */}
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{
                  background: "transparent",
                  backgroundSize: "200% 100%",
                  animation: "shimmer 2s infinite linear",
                }}
              />
              <Building2 className="w-5 h-5 relative z-10" />
              <span className="relative z-10">Sign in with HKI SSO</span>
              <ArrowRight className="w-4 h-4 ml-0.5 relative z-10 group-hover:translate-x-0.5 transition-transform" />
            </a>

            <p className="text-center text-[11px] text-muted-foreground/85 mt-3 tracking-wide">
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
                    <span className="bg-background/80 backdrop-blur-sm px-3 text-[10px] text-muted-foreground/80 uppercase tracking-widest">
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
              <Shield className="w-3 h-3 text-primary" />
              <span className="text-[11px] text-muted-foreground/85">
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
          <p className="text-[11px] text-muted-foreground/75">
            © 2026 HKI · Hermetic Knowledge Isolation
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
