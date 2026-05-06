/**
 * Knowledge Domains — Self-service domain creation at /knowledge/create
 *
 * Managers and admins provision a domain-scoped knowledge workspace.
 * Creates: domain + default collection + assigns creator to the domain.
 */

import { useState } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import {
  ArrowRight,
  CheckCircle,
  Database,
  Fingerprint,
  Loader2,
  Network,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  Button,
  cn,
  StreamIcon,
  STREAM_ICON_OPTIONS,
  useNotifications,
} from "@hki/ui";

import { trpc } from "@/lib/trpc";
import {
  KnowledgeSelfServiceShell,
  useKnowledgePageMeta,
} from "./components/SelfServiceChrome";

const EASE = [0.22, 1, 0.36, 1] as const;

const DOMAIN_ICON_OPTIONS = STREAM_ICON_OPTIONS.filter(option =>
  [
    "building",
    "pharma",
    "fresh",
    "optical",
    "ecom",
    "wh",
    "pkg",
    "tools",
    "fin",
    "store",
    "chart",
    "global",
  ].includes(option.id)
);

const DOMAIN_CONTRACT = [
  {
    icon: ShieldCheck,
    title: "Isolated by default",
    body: "Documents, chunks, prompts, tools, and invitations bind to one active domain.",
  },
  {
    icon: Fingerprint,
    title: "Auditable boundary",
    body: "Every setup action creates traceable admin state for security review.",
  },
  {
    icon: Network,
    title: "Agent ready",
    body: "The workspace opens with onboarding, ingestion, validation, and governance views.",
  },
];

export default function KnowledgeCreate() {
  useKnowledgePageMeta("Create Domain — Hermetic");

  const [, setLocation] = useLocation();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("building");
  const [created, setCreated] = useState<{ id: string; name: string } | null>(
    null
  );

  const { notify } = useNotifications();

  const provisionMut = trpc.admin.provisionKnowledgeBase.useMutation({
    onSuccess: data => {
      setCreated(data);
      notify({
        title: `"${data.name}" created`,
        description: "The domain workspace is ready for onboarding.",
        severity: "success",
      });
    },
    onError: err => {
      notify({
        title: "Creation failed",
        description: err.message,
        severity: "error",
      });
    },
  });

  const handleCreate = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    provisionMut.mutate({
      name: trimmed,
      description: description.trim() || undefined,
      icon,
    });
  };

  const slugPreview = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);

  return (
    <KnowledgeSelfServiceShell
      back={{ href: "/welcome", label: "Knowledge Domains" }}
      showSignIn={false}
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.48, ease: EASE }}
        className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-5 py-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]"
      >
        <section className="kb-self-service-panel overflow-hidden rounded-[28px] p-6 lg:p-8">
          <div className="kb-self-service-chip">
            <Database className="h-3.5 w-3.5" />
            Domain Provisioning
          </div>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Create a secure knowledge domain
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
            Provision the boundary an enterprise agent needs before it can
            retrieve, reason, or act. The domain becomes the unit for content,
            access, evaluation, and audit.
          </p>

          <div className="kb-self-service-graphic mt-7 rounded-3xl p-5">
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              {DOMAIN_CONTRACT.map(item => (
                <div
                  key={item.title}
                  className="rounded-2xl bg-card/86 p-4 shadow-sm ring-1 ring-border/50 backdrop-blur"
                >
                  <item.icon className="mb-3 h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold text-foreground">
                    {item.title}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {item.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {created ? (
          <motion.section
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="kb-self-service-panel rounded-[28px] p-8 text-center"
          >
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <CheckCircle className="h-8 w-8" />
            </div>
            <div className="mt-5 flex items-center justify-center gap-3">
              <StreamIcon id={icon} size={30} tone="primary" />
              <p className="text-xl font-semibold text-foreground">
                {created.name}
              </p>
            </div>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">
              The domain is ready. Open it to ingest governed knowledge,
              validate retrieval, and prepare agent access.
            </p>
            <Button
              data-testid="kb-create-open"
              onClick={() => setLocation(`/knowledge?stream=${created.id}`)}
              className="mt-7 gap-2 rounded-xl px-6"
            >
              <Sparkles className="h-4 w-4" />
              Open Domain
              <ArrowRight className="h-4 w-4" />
            </Button>
          </motion.section>
        ) : (
          <section className="kb-self-service-panel rounded-[28px] p-6 lg:p-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Domain Setup
              </p>
              <h2 className="mt-2 text-xl font-semibold text-foreground">
                Define the agent boundary
              </h2>
            </div>

            <div className="mt-6 space-y-5">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Domain icon
                </label>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {DOMAIN_ICON_OPTIONS.map(option => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setIcon(option.id)}
                      className={cn(
                        "flex min-h-20 flex-col items-center justify-center gap-2 rounded-2xl px-2 text-center text-[11px] font-semibold transition-all",
                        icon === option.id
                          ? "bg-primary/10 text-primary ring-2 ring-primary/30"
                          : "kb-self-service-inset text-muted-foreground hover:text-foreground"
                      )}
                      title={option.label}
                    >
                      <StreamIcon
                        id={option.id}
                        size={22}
                        tone={icon === option.id ? "primary" : "mono"}
                      />
                      <span>{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Domain name <span className="text-destructive">*</span>
                </label>
                <input
                  data-testid="kb-create-name"
                  value={name}
                  onChange={event => setName(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === "Enter") handleCreate();
                  }}
                  placeholder="e.g. Pharmacy Operations, Fresh Foods, Optical"
                  maxLength={128}
                  className="kb-self-service-field px-4 py-3"
                  autoFocus
                />
                {slugPreview ? (
                  <p className="mt-2 text-xs text-muted-foreground/70">
                    Domain address:{" "}
                    <code className="font-mono text-foreground">
                      {slugPreview}
                    </code>
                  </p>
                ) : null}
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Operating scope{" "}
                  <span className="text-muted-foreground/50">(optional)</span>
                </label>
                <textarea
                  data-testid="kb-create-description"
                  value={description}
                  onChange={event => setDescription(event.target.value)}
                  placeholder="Describe what this domain covers and which teams should rely on it."
                  maxLength={500}
                  rows={4}
                  className="kb-self-service-field resize-none px-4 py-3"
                />
              </div>

              <div className="kb-self-service-inset rounded-2xl p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Provisioned with
                </p>
                <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                  <span>Domain-scoped collection</span>
                  <span>Admin assignment</span>
                  <span>Onboarding workflow</span>
                  <span>Validation workspace</span>
                </div>
              </div>

              <Button
                data-testid="kb-create-submit"
                onClick={handleCreate}
                disabled={!name.trim() || provisionMut.isPending}
                className="w-full gap-2 rounded-xl py-3 text-sm font-semibold"
              >
                {provisionMut.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ShieldCheck className="h-4 w-4" />
                )}
                {provisionMut.isPending ? "Provisioning..." : "Create Domain"}
                {!provisionMut.isPending ? (
                  <ArrowRight className="h-4 w-4" />
                ) : null}
              </Button>
            </div>
          </section>
        )}
      </motion.div>
    </KnowledgeSelfServiceShell>
  );
}
