/**
 * Knowledge Base — Welcome page at /welcome
 *
 * Minimal, modern landing with HKI brand identity.
 */

import { useEffect } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { Button, COSTCO_BLUE } from "@hki/ui";
import { useAuth } from "@/_core/hooks/useAuth";
import { canAccessKnowledgeWorkspace } from "@/_core/access/knowledge";
import { useTheme } from "@/contexts/ThemeContext";
import { AgenticIcon } from "@/components/ui/icons/AgenticIcon";
import { KnowledgeIcon } from "@/components/ui/icons/KnowledgeIcon";
import { ArrowRight, KeyRound, LogIn, MailPlus, Moon, Sun } from "lucide-react";

const ease = [0.22, 1, 0.36, 1] as const;

export default function KnowledgeWelcome() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [, setLocation] = useLocation();

  const canOpenKnowledge = canAccessKnowledgeWorkspace(user?.role);
  const primaryHref = canOpenKnowledge
    ? "/knowledge"
    : user
      ? "/knowledge/request-access"
      : "/login?from=knowledge";
  const primaryLabel = canOpenKnowledge
    ? "Open Knowledge Base"
    : user
      ? "Request Access"
      : "Sign In";

  const navigate = (path: string) => setLocation(path);

  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
    const prevHref = link?.href;
    const prevTitle = document.title;
    if (link) link.href = "/favicon-knowledge.svg";
    document.title = "Knowledge Base — HKI Agentic";
    return () => {
      if (link && prevHref) link.href = prevHref;
      document.title = prevTitle;
    };
  }, []);

  return (
    <div className="relative flex min-h-screen flex-col bg-background text-foreground">
      {/* Background grid */}
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.03] dark:opacity-[0.04]"
        style={{
          backgroundImage: `
            linear-gradient(${COSTCO_BLUE}40 1px, transparent 1px),
            linear-gradient(90deg, ${COSTCO_BLUE}40 1px, transparent 1px)
          `,
          backgroundSize: "56px 56px",
        }}
      />

      {/* ── Top bar ── */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4">
        <a
          href="/"
          onClick={e => {
            e.preventDefault();
            setLocation("/");
          }}
          className="flex items-center gap-2.5 transition-opacity hover:opacity-80"
        >
          <AgenticIcon size={22} className="text-primary" />
          <span className="text-sm font-bold">
            <span className="text-primary">HKI</span>{" "}
            <span className="text-muted-foreground">Agentic</span>
          </span>
        </a>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
            title={
              theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
            }
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </button>
          {!user && (
            <Button
              onClick={() => navigate("/login?from=knowledge")}
              variant="outline"
              className="gap-1.5 rounded-lg px-4 text-xs font-medium"
            >
              <LogIn className="h-3.5 w-3.5" />
              Sign In
            </Button>
          )}
        </div>
      </header>

      {/* ── Hero ── */}
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-16">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease }}
          className="flex w-full max-w-lg flex-col items-center text-center"
        >
          <div className="relative mb-8">
            <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4 dark:bg-primary/10">
              <KnowledgeIcon size={48} />
            </div>
            {/* Red accent dot */}
            <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-secondary ring-2 ring-background" />
          </div>

          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            <span className="text-primary">Knowledge</span>{" "}
            <span className="text-secondary">Base</span>
          </h1>

          <p className="mt-3 max-w-md text-base leading-relaxed text-muted-foreground">
            Curate trusted content for your team's AI agent.
          </p>

          <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
            <Button
              onClick={() => navigate(primaryHref)}
              size="lg"
              className="gap-2 rounded-xl px-8 text-sm font-semibold"
            >
              {primaryLabel}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </motion.div>

        {/* ── Secondary actions ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.2, ease }}
          className="mt-10 flex flex-wrap items-center justify-center gap-3"
        >
          <Button
            onClick={() => navigate("/knowledge/join")}
            variant="outline"
            className="gap-2 rounded-xl text-xs hover:bg-primary/10 hover:border-primary/40 hover:text-primary transition-all"
          >
            <KeyRound className="h-3.5 w-3.5" />
            Join with Invite Code
          </Button>
          <Button
            onClick={() => navigate("/knowledge/request-access")}
            variant="outline"
            className="gap-2 rounded-xl text-xs hover:bg-secondary/10 hover:border-secondary/40 hover:text-secondary transition-all"
          >
            <MailPlus className="h-3.5 w-3.5" />
            Request Access
          </Button>
        </motion.div>
      </main>

      {/* ── Footer ── */}
      <footer className="relative z-10 border-t border-border/40 px-6 py-5 dark:border-white/6">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <p className="text-xs text-muted-foreground">
            <span className="text-primary font-medium">HKI</span>{" "}
            <span className="text-secondary/80">&middot;</span> Innovation &
            Technology
          </p>
          <a
            href="/"
            onClick={e => {
              e.preventDefault();
              setLocation("/");
            }}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Agentic Platform
          </a>
        </div>
      </footer>
    </div>
  );
}
