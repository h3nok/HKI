/**
 * Knowledge Domains — Invite acceptance at /knowledge/join
 *
 * Public page where invited users enter an invite code to gain access to a
 * domain-scoped knowledge workspace.
 */

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import {
  ArrowRight,
  BookOpen,
  CheckCircle,
  Key,
  Loader2,
  LogIn,
  Shield,
  User,
} from "lucide-react";
import { Button, useNotifications } from "@hki/ui";

import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import {
  KnowledgeSelfServiceShell,
  useKnowledgePageMeta,
} from "./components/SelfServiceChrome";

const EASE = [0.22, 1, 0.36, 1] as const;

export default function KnowledgeJoin() {
  useKnowledgePageMeta("Join Domain — Hermetic");

  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { notify } = useNotifications();
  const [code, setCode] = useState("");
  const [success, setSuccess] = useState<{
    role: string;
    valueStreamId?: string;
  } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlCode = params.get("code");
    if (urlCode) setCode(urlCode.toUpperCase());
  }, []);

  const acceptMut = trpc.admin.acceptInvite.useMutation({
    onSuccess: (data: any) => {
      setSuccess({ role: data.role, valueStreamId: data.valueStreamId });
      notify({
        title: "Domain access granted",
        severity: "success",
        group: "team",
      });
    },
    onError: (error: any) =>
      notify({
        title: "Invite failed",
        description: error.message,
        severity: "error",
        group: "team",
      }),
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) {
      setLocation(`/login?from=${encodeURIComponent("/knowledge/join")}`);
      return;
    }
    if (!code.trim()) {
      notify({ title: "Invite code is required", severity: "warning" });
      return;
    }
    acceptMut.mutate({ inviteCode: code.trim().toUpperCase() });
  };

  return (
    <KnowledgeSelfServiceShell
      back={{ href: "/welcome", label: "Knowledge Domains" }}
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="mx-auto grid w-full max-w-5xl flex-1 items-center gap-5 py-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]"
      >
        <section className="kb-self-service-panel rounded-[28px] p-7 lg:p-9">
          <div className="kb-self-service-chip">
            <Key className="h-3.5 w-3.5" />
            Domain Invite
          </div>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Join a knowledge domain
          </h1>
          <p className="mt-4 max-w-md text-sm leading-6 text-muted-foreground">
            Invite codes are issued by domain administrators. Sign in with the
            account tied to the invite, then enter the code to attach access to
            the correct domain boundary.
          </p>

          <div className="mt-7 grid gap-3">
            {[
              "Code is validated against your signed-in account.",
              "Access is scoped to the assigned domain.",
              "The workspace opens with the domain already selected.",
            ].map(item => (
              <div
                key={item}
                className="kb-self-service-inset flex items-center gap-3 rounded-2xl px-4 py-3"
              >
                <Shield className="h-4 w-4 text-primary" />
                <span className="text-sm text-muted-foreground">{item}</span>
              </div>
            ))}
          </div>
        </section>

        {!success ? (
          <form
            onSubmit={handleSubmit}
            className="kb-self-service-panel rounded-[28px] p-6 lg:p-8"
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Accept Access
              </p>
              <h2 className="mt-2 text-xl font-semibold text-foreground">
                Verify account and code
              </h2>
            </div>

            <div className="mt-6 space-y-5">
              <div>
                <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  <User className="h-3.5 w-3.5" />
                  Your account
                </label>
                {user ? (
                  <div className="kb-self-service-inset rounded-2xl px-4 py-3">
                    <p className="text-sm font-medium text-foreground">
                      {user.email || user.name || "Signed in"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      The invite must match this account.
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
                    className="w-full gap-2 rounded-xl"
                  >
                    <LogIn className="h-4 w-4" />
                    Sign in to continue
                  </Button>
                )}
              </div>

              <div>
                <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  <Key className="h-3.5 w-3.5" />
                  Invite code
                </label>
                <input
                  value={code}
                  onChange={event => setCode(event.target.value.toUpperCase())}
                  placeholder="ABCD1234"
                  maxLength={8}
                  required
                  className="kb-self-service-field px-4 py-3 text-center font-mono uppercase tracking-[0.2em]"
                />
                <p className="mt-2 text-center text-xs text-muted-foreground/70">
                  8-character code from the domain invite
                </p>
              </div>

              <Button
                type="submit"
                disabled={!user || code.length < 4 || acceptMut.isPending}
                className="w-full gap-2 rounded-xl py-3 text-sm font-semibold"
              >
                {acceptMut.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Shield className="h-4 w-4" />
                )}
                {acceptMut.isPending ? "Verifying..." : "Join Domain"}
                {!acceptMut.isPending ? (
                  <ArrowRight className="h-4 w-4" />
                ) : null}
              </Button>
            </div>

            <div className="mt-6 flex flex-col items-center gap-2 text-center text-xs">
              <button
                type="button"
                onClick={() => setLocation("/knowledge/request-access")}
                className="font-medium text-primary hover:underline"
              >
                Request access instead
              </button>
              <button
                type="button"
                onClick={() => setLocation("/login?from=knowledge")}
                className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
              >
                Already have access? Sign in
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          </form>
        ) : (
          <motion.section
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.42, ease: EASE }}
            className="kb-self-service-panel rounded-[28px] p-8 text-center"
          >
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <CheckCircle className="h-8 w-8" />
            </div>
            <h2 className="mt-5 text-2xl font-semibold text-foreground">
              Domain access granted
            </h2>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
              You now have{" "}
              <span className="font-semibold text-foreground">
                {success.role}
              </span>{" "}
              access
              {success.valueStreamId ? (
                <>
                  {" "}
                  to{" "}
                  <span className="font-medium text-foreground">
                    {success.valueStreamId}
                  </span>
                </>
              ) : null}
              .
            </p>
            <Button
              onClick={() =>
                setLocation(
                  success.valueStreamId
                    ? `/knowledge?stream=${encodeURIComponent(success.valueStreamId)}`
                    : "/knowledge"
                )
              }
              className="mt-7 gap-2 rounded-xl px-8"
            >
              <BookOpen className="h-4 w-4" />
              Open Domain
              <ArrowRight className="h-4 w-4" />
            </Button>
          </motion.section>
        )}
      </motion.div>
    </KnowledgeSelfServiceShell>
  );
}
