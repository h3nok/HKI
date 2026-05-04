/**
 * Knowledge Base — Invite login page at /knowledge/join
 *
 * Public page where invited users enter their email + invite code
 * to gain access to a value stream's knowledge base.
 */

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import {
  BookOpen,
  Key,
  ArrowRight,
  Loader2,
  CheckCircle,
  ArrowLeft,
  Shield,
  User,
  LogIn,
} from "lucide-react";
import { Button, useNotifications, COSTCO_BLUE, FONT_FAMILY } from "@hki/ui";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { AgenticIcon } from "@/components/ui/icons/AgenticIcon";

const EASE = [0.22, 1, 0.36, 1] as const;

export default function KnowledgeJoin() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
    const prevHref = link?.href;
    const prevTitle = document.title;
    if (link) link.href = "/favicon-knowledge.svg";
    document.title = "Join Knowledge Base — HKI Agentic";
    return () => {
      if (link && prevHref) link.href = prevHref;
      document.title = prevTitle;
    };
  }, []);
  const [code, setCode] = useState("");
  const [success, setSuccess] = useState<{
    role: string;
    valueStreamId?: string;
  } | null>(null);

  // Auto-fill invite code from URL query param (?code=ABC1D234)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlCode = params.get("code");
    if (urlCode) setCode(urlCode.toUpperCase());
  }, []);

  const { notify } = useNotifications();
  const acceptMut = trpc.admin.acceptInvite.useMutation({
    onSuccess: (d: any) => {
      setSuccess({ role: d.role, valueStreamId: d.valueStreamId });
      notify({
        title: "Welcome! You now have access.",
        severity: "success",
        group: "team",
      });
    },
    onError: (e: any) =>
      notify({
        title: "Invite failed",
        description: e.message,
        severity: "error",
        group: "team",
      }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setLocation(`/login?from=${encodeURIComponent("/knowledge/join")}`);
      return;
    }
    if (!code.trim())
      return notify({ title: "Invite code is required", severity: "warning" });
    acceptMut.mutate({ inviteCode: code.trim().toUpperCase() });
  };

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
      {/* Nav */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4">
        <a
          href="/welcome"
          onClick={e => {
            e.preventDefault();
            setLocation("/welcome");
          }}
          className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Knowledge Base
        </a>
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
      </header>

      {/* Main */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-6 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
          className="w-full max-w-md"
        >
          {!success ? (
            <>
              <div className="text-center mb-8">
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, delay: 0.1, ease: EASE }}
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5 bg-primary/10 ring-1 ring-primary/20"
                >
                  <Key className="w-7 h-7 text-primary" />
                </motion.div>
                <h1 className="text-2xl font-bold tracking-tight mb-2">
                  <span className="text-primary">Join</span>{" "}
                  <span className="text-secondary">Knowledge Base</span>
                </h1>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
                  Enter the invite code from your workspace administrator.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="p-6 rounded-2xl border border-border/50 bg-card shadow-sm space-y-4">
                  {/* Account */}
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-2">
                      <User className="w-3.5 h-3.5" /> Your Account
                    </label>
                    {user ? (
                      <div className="w-full px-4 py-3 text-sm rounded-xl border border-border bg-muted/50 text-foreground">
                        {user.email || user.name || "Signed in"}
                        <p className="text-xs text-muted-foreground mt-1">
                          The invite must match this email.
                        </p>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          setLocation(
                            `/login?from=${encodeURIComponent("/knowledge/join")}`
                          )
                        }
                        className="w-full gap-2 rounded-xl hover:bg-primary/10 hover:border-primary/40 hover:text-primary transition-all"
                      >
                        <LogIn className="w-4 h-4" /> Sign in to continue
                      </Button>
                    )}
                  </div>

                  {/* Invite code */}
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-2">
                      <Key className="w-3.5 h-3.5" /> Invite Code
                    </label>
                    <input
                      value={code}
                      onChange={e => setCode(e.target.value.toUpperCase())}
                      placeholder="ABCD1234"
                      maxLength={8}
                      required
                      className="w-full px-4 py-3 text-sm rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all uppercase tracking-[0.2em] text-center font-mono"
                      style={{
                        fontFamily: FONT_FAMILY.mono,
                        letterSpacing: "0.2em",
                      }}
                    />
                    <p className="text-xs text-muted-foreground/50 mt-1.5 text-center">
                      8-character code from your invite email
                    </p>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={!user || code.length < 4 || acceptMut.isPending}
                  className="w-full gap-2 rounded-xl py-3 text-sm font-semibold"
                >
                  {acceptMut.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Shield className="w-4 h-4" />
                  )}
                  {acceptMut.isPending ? "Verifying..." : "Join Knowledge Base"}
                  {!acceptMut.isPending && <ArrowRight className="w-4 h-4" />}
                </Button>
              </form>

              <div className="mt-8 text-center space-y-2">
                <p className="text-xs text-muted-foreground">
                  Don't have an invite code?{" "}
                  <a
                    href="/knowledge/request-access"
                    onClick={e => {
                      e.preventDefault();
                      setLocation("/knowledge/request-access");
                    }}
                    className="text-primary hover:underline font-medium"
                  >
                    Request access
                  </a>
                </p>
                <a
                  href="/login?from=knowledge"
                  onClick={e => {
                    e.preventDefault();
                    setLocation("/login?from=knowledge");
                  }}
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  Already have full access? Sign in{" "}
                  <ArrowRight className="w-3 h-3" />
                </a>
              </div>
            </>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease: EASE }}
              className="text-center"
            >
              <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 bg-emerald-500/10 ring-1 ring-emerald-500/20 dark:bg-emerald-500/15">
                <CheckCircle className="w-10 h-10 text-emerald-500 dark:text-emerald-400" />
              </div>
              <h2 className="text-2xl font-bold mb-2 text-foreground">
                You're In!
              </h2>
              <p className="text-sm text-muted-foreground mb-2">
                You've been granted{" "}
                <span className="text-primary font-semibold">
                  {success.role}
                </span>{" "}
                access
                {success.valueStreamId && (
                  <>
                    {" "}
                    to{" "}
                    <span className="text-foreground font-medium">
                      {success.valueStreamId}
                    </span>
                  </>
                )}
                .
              </p>
              <p className="text-xs text-muted-foreground/60 mb-8">
                You can now access the knowledge base for your workspace.
              </p>
              <Button
                onClick={() =>
                  setLocation(
                    success.valueStreamId
                      ? `/knowledge?stream=${encodeURIComponent(success.valueStreamId)}`
                      : "/knowledge"
                  )
                }
                className="gap-2 rounded-xl px-8"
              >
                <BookOpen className="w-4 h-4" /> Open Knowledge Base{" "}
                <ArrowRight className="w-4 h-4" />
              </Button>
            </motion.div>
          )}
        </motion.div>
      </div>

      <footer className="relative z-10 border-t border-border/40 px-6 py-5 dark:border-white/6">
        <p className="text-center text-xs text-muted-foreground">
          <span className="text-primary font-medium">HKI</span>{" "}
          <span className="text-secondary/80">&middot;</span> Innovation &
          Technology
        </p>
      </footer>
    </div>
  );
}
