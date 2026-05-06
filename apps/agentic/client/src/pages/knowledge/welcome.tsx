/**
 * Knowledge Domains — Public self-service entry at /welcome
 */

import { motion } from "framer-motion";
import { useLocation } from "wouter";
import {
  ArrowRight,
  Database,
  KeyRound,
  Layers,
  MailPlus,
  Network,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@hki/ui";

import { canAccessKnowledgeWorkspace } from "@/_core/access/knowledge";
import { useAuth } from "@/_core/hooks/useAuth";
import { KnowledgeIcon } from "@/components/ui/icons/KnowledgeIcon";
import {
  KnowledgeSelfServiceShell,
  useKnowledgePageMeta,
} from "./components/SelfServiceChrome";

const EASE = [0.22, 1, 0.36, 1] as const;

export default function KnowledgeWelcome() {
  useKnowledgePageMeta("Knowledge Domains — Hermetic");

  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const canOpenKnowledge = canAccessKnowledgeWorkspace(user?.role);
  const primaryHref = canOpenKnowledge
    ? "/knowledge"
    : user
      ? "/knowledge/request-access"
      : "/login?from=knowledge";
  const primaryLabel = canOpenKnowledge
    ? "Open Domains"
    : user
      ? "Request Domain Access"
      : "Sign In";

  const navigate = (path: string) => setLocation(path);

  return (
    <KnowledgeSelfServiceShell showSignIn>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-5 py-6 lg:grid-cols-[minmax(0,1.04fr)_minmax(0,0.96fr)]"
      >
        <section className="kb-self-service-panel overflow-hidden rounded-[28px] p-7 lg:p-10">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/16">
              <KnowledgeIcon size={44} />
            </div>
            <div>
              <div className="kb-self-service-chip">
                <ShieldCheck className="h-3.5 w-3.5" />
                Hermetic Knowledge Isolation
              </div>
              <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Enterprise agent boundary
              </p>
            </div>
          </div>

          <h1 className="mt-7 max-w-2xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Knowledge Domains
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground">
            A secure self-service control point for the knowledge your agents
            can retrieve, cite, validate, and act on. Domains keep enterprise AI
            work scoped, auditable, and ready for production.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button
              onClick={() => navigate(primaryHref)}
              size="lg"
              className="gap-2 rounded-xl px-7 text-sm font-semibold"
            >
              {primaryLabel}
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              onClick={() => navigate("/knowledge/join")}
              size="lg"
              variant="outline"
              className="gap-2 rounded-xl px-7 text-sm font-semibold"
            >
              <KeyRound className="h-4 w-4" />
              Join Domain
            </Button>
          </div>

          <div className="mt-9 grid gap-3 sm:grid-cols-3">
            {[
              ["Scoped retrieval", "No hidden global fallback"],
              ["Curated content", "Ingest, review, publish"],
              ["Agent validation", "Measure answers before launch"],
            ].map(([title, body]) => (
              <div
                key={title}
                className="kb-self-service-inset rounded-2xl p-4"
              >
                <p className="text-sm font-semibold text-foreground">{title}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {body}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-4">
          {[
            {
              icon: Database,
              title: "Open domain workspace",
              body: "Select an assigned domain and continue knowledge operations.",
              action: primaryLabel,
              href: primaryHref,
            },
            {
              icon: KeyRound,
              title: "Accept invite",
              body: "Enter an admin-issued invite code and bind access to your account.",
              action: "Enter code",
              href: "/knowledge/join",
            },
            {
              icon: MailPlus,
              title: "Request access",
              body: "Ask platform admins for domain access with a business justification.",
              action: "Request access",
              href: "/knowledge/request-access",
            },
          ].map(item => (
            <button
              key={item.title}
              type="button"
              onClick={() => navigate(item.href)}
              className="kb-self-service-panel group flex items-center gap-4 rounded-3xl p-5 text-left transition-transform hover:-translate-y-0.5"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <item.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">
                  {item.title}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {item.body}
                </p>
              </div>
              <div className="hidden items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground transition-colors group-hover:text-primary sm:flex">
                {item.action}
                <ArrowRight className="h-3.5 w-3.5" />
              </div>
            </button>
          ))}

          <div className="kb-self-service-graphic rounded-3xl p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Domain graph
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Knowledge, policy, tools, and agent activity align to the same
                  scoped boundary.
                </p>
              </div>
              <Network className="h-8 w-8 text-primary" />
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2">
              {["Content", "Policy", "Agents"].map(label => (
                <div
                  key={label}
                  className="rounded-xl bg-card/86 px-3 py-2 text-center text-xs font-semibold text-foreground shadow-sm ring-1 ring-border/50"
                >
                  {label}
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-center text-primary">
              <Layers className="h-5 w-5" />
            </div>
          </div>
        </section>
      </motion.div>
    </KnowledgeSelfServiceShell>
  );
}
