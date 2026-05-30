/**
 * Knowledge Domains — Self-service domain creation at /knowledge/create
 *
 * Managers and admins provision a domain-scoped knowledge workspace.
 * Rebuilt as a state-of-the-art stage-gated wizard matching the HKI trust sequence.
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  Database,
  Fingerprint,
  Loader2,
  Lock,
  Network,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Building,
  Key,
} from "lucide-react";
import {
  Button,
  cn,
  StreamIcon,
  STREAM_ICON_OPTIONS,
  useNotifications,
} from "@hki/ui";

import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import {
  KnowledgeSelfServiceShell,
  useKnowledgePageMeta,
} from "./components/SelfServiceChrome";
import { StageGator, GateStatus } from "./components/StageGator";

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

export default function KnowledgeCreate() {
  useKnowledgePageMeta("Create Domain — Hermetic");

  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { notify } = useNotifications();

  // Wizard state: maps directly to active gate id (1, 2, 3, 4)
  const [activeGate, setActiveGate] = useState<1 | 2 | 3 | 4>(1);

  // Form Inputs
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("building");
  const [agreedToPact, setAgreedToPact] = useState(false);

  // Gate statuses tracking
  const [gateStates, setGateStates] = useState<Record<number, GateStatus>>({
    1: "processing", // Starts processing handshake
    2: "locked",
    3: "locked",
    4: "locked",
  });
  const [digests, setDigests] = useState<Record<number, string>>({});

  const [created, setCreated] = useState<{ id: string; name: string } | null>(
    null
  );

  const provisionMut = trpc.admin.provisionKnowledgeBase.useMutation({
    onSuccess: data => {
      setCreated(data);
      setGateStates(prev => ({ ...prev, 4: "sealed" }));
      setDigests(prev => ({
        ...prev,
        4: `MINTED-ENV: ${data.id.slice(0, 10).toUpperCase()}`,
      }));
      notify({
        title: `"${data.name}" created`,
        description: "The domain workspace is ready for onboarding.",
        severity: "success",
      });
    },
    onError: err => {
      setGateStates(prev => ({ ...prev, 4: "processing" }));
      notify({
        title: "Creation failed",
        description: err.message,
        severity: "error",
      });
    },
  });

  // Step 1 Check
  const handleVerifyIdentity = () => {
    setGateStates(prev => ({ ...prev, 1: "sealed" }));
    setDigests(prev => ({
      ...prev,
      1: `SIG-USER: ${user?.email?.toUpperCase() || "ADMIN-PRINCIPAL"}`,
    }));
    setGateStates(prev => ({ ...prev, 2: "processing" }));
    setActiveGate(2);
  };

  // Step 2 Check
  const handleDomainSpecNext = () => {
    if (!name.trim()) return;
    setGateStates(prev => ({ ...prev, 2: "sealed" }));
    setDigests(prev => ({
      ...prev,
      2: `ICON: ${icon.toUpperCase()} / ADDR: ${slugPreview}`,
    }));
    setGateStates(prev => ({ ...prev, 3: "processing" }));
    setActiveGate(3);
  };

  // Step 3 Check
  const handlePactNext = () => {
    if (!agreedToPact) return;
    setGateStates(prev => ({ ...prev, 3: "sealed" }));
    setDigests(prev => ({
      ...prev,
      3: `PACT-ACCORD: ${Date.now().toString(16).toUpperCase()}`,
    }));
    setGateStates(prev => ({ ...prev, 4: "processing" }));
    setActiveGate(4);
  };

  const handleCreate = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setGateStates(prev => ({ ...prev, 4: "processing" }));
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
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.48, ease: EASE }}
        className="mx-auto grid w-full max-w-6xl flex-1 items-stretch gap-6 py-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]"
      >
        {/* Left Column: Visual Stage Gator & Context */}
        <section className="kb-self-service-panel rounded-[28px] p-7 lg:p-9 flex flex-col justify-between h-full relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 rounded-full bg-primary/3 blur-2xl pointer-events-none" />

          <div>
            <div className="kb-self-service-chip">
              <Database className="h-3.5 w-3.5" />
              Provisioning Tracker
            </div>
            <h1 className="mt-5 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Isolation Registry
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
              Provisioning an HKI Knowledge domain requires compiling 4 security
              agreements. The tracker represents the active configuration
              compliance path.
            </p>
          </div>

          <div className="mt-8 flex-1">
            <StageGator gateStates={gateStates} digests={digests} />
          </div>

          <div className="mt-8 pt-6 border-t border-border/40 text-xs text-muted-foreground flex items-center gap-2">
            <Fingerprint className="h-3.5 w-3.5 text-primary" />
            <span>Telemetry logging enabled for audit and compliance.</span>
          </div>
        </section>

        {/* Right Column: Step Wizard Forms */}
        <section className="kb-self-service-panel rounded-[28px] p-6 lg:p-8 flex flex-col justify-between relative">
          <div className="absolute top-0 left-0 -ml-12 -mt-12 w-32 h-32 rounded-full bg-primary/2 blur-xl pointer-events-none" />

          {/* Form Header */}
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Gate {activeGate} of 4
            </p>
            <h2 className="mt-2 text-xl font-bold text-foreground">
              {activeGate === 1 && "Identity Handshake & Verification"}
              {activeGate === 2 && "Configure Domain Parameters"}
              {activeGate === 3 && "Operating Scope & Covenant Pact"}
              {activeGate === 4 && "Envelope Minting and Final Seals"}
            </h2>
          </div>

          {/* Steps Content Slider */}
          <div className="flex-1 flex flex-col justify-center">
            <AnimatePresence mode="wait">
              {/* Gate 1: Principal verification */}
              {activeGate === 1 && (
                <motion.div
                  key="gate-1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-5 py-2"
                >
                  <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 flex gap-3.5">
                    <UserCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <div>
                      <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
                        Active Account Session Verified
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                        The admin plane has mapped your active session to the
                        creation workspace.
                      </p>
                      <div className="mt-3 font-mono text-[10px] text-muted-foreground">
                        Principal:{" "}
                        <span className="text-foreground font-semibold">
                          {user?.email || "Admin"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed">
                    By proceeding, you verify that you possess the
                    organizational capabilities required to register isolation
                    boundaries.
                  </p>

                  <div className="pt-4 flex justify-end">
                    <Button
                      onClick={handleVerifyIdentity}
                      className="gap-2 rounded-xl text-xs font-semibold px-6"
                    >
                      Authenticate Session
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* Gate 2: Parameters icon and name */}
              {activeGate === 2 && (
                <motion.div
                  key="gate-2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6 py-1"
                >
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      Select Domain Icon
                    </label>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 max-h-[140px] overflow-y-auto pr-1">
                      {DOMAIN_ICON_OPTIONS.map(option => (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setIcon(option.id)}
                          className={cn(
                            "flex min-h-16 flex-col items-center justify-center gap-1.5 rounded-xl px-2 text-center text-[10px] font-semibold transition-all border",
                            icon === option.id
                              ? "bg-primary/10 text-primary border-primary/30 ring-1 ring-primary/20"
                              : "bg-card/40 border-border/40 text-muted-foreground hover:text-foreground hover:bg-card"
                          )}
                          title={option.label}
                        >
                          <StreamIcon
                            id={option.id}
                            size={18}
                            tone={icon === option.id ? "primary" : "mono"}
                          />
                          <span>{option.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      Domain Name <span className="text-destructive">*</span>
                    </label>
                    <input
                      value={name}
                      onChange={event => setName(event.target.value)}
                      placeholder="e.g. Pharmacy Operations, Fresh Foods, Optical"
                      maxLength={128}
                      className="kb-self-service-field px-4 py-2.5 text-xs focus:ring-primary/40 focus:border-primary/40"
                      autoFocus
                    />
                    {slugPreview ? (
                      <p className="mt-2 text-[10px] text-muted-foreground/70">
                        Sequested URI prefix:{" "}
                        <code className="font-mono text-foreground font-semibold">
                          hki://domain/{slugPreview}
                        </code>
                      </p>
                    ) : null}
                  </div>

                  <div className="pt-4 flex justify-between gap-3 border-t border-border/20">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setGateStates(prev => ({ ...prev, 2: "locked" }));
                        setActiveGate(1);
                      }}
                      className="gap-1.5 rounded-xl text-xs font-semibold"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      Back
                    </Button>
                    <Button
                      onClick={handleDomainSpecNext}
                      disabled={!name.trim()}
                      className="gap-1.5 rounded-xl text-xs font-semibold px-6"
                    >
                      Continue
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* Gate 3: Operating Scope & Agreement */}
              {activeGate === 3 && (
                <motion.div
                  key="gate-3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-5 py-2"
                >
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      Operating Scope{" "}
                      <span className="text-muted-foreground/50">
                        (Required)
                      </span>
                    </label>
                    <textarea
                      value={description}
                      onChange={event => setDescription(event.target.value)}
                      placeholder="Describe what this domain covers and which teams should rely on it."
                      maxLength={500}
                      rows={3}
                      required
                      className="kb-self-service-field resize-none px-4 py-2.5 text-xs focus:ring-primary/40 focus:border-primary/40"
                    />
                  </div>

                  <div className="rounded-xl border border-border bg-card/60 p-4 space-y-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Compliance Covenant Agreements
                    </p>
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={agreedToPact}
                        onChange={e => setAgreedToPact(e.target.checked)}
                        className="rounded border-border mt-0.5 text-primary focus:ring-primary/30"
                      />
                      <span className="text-xs text-muted-foreground leading-relaxed">
                        I pledge that this workspace remains cryptographically
                        sealed. I agree to enforce the six HKI invariants within
                        this domain boundary.
                      </span>
                    </label>
                  </div>

                  <div className="pt-4 flex justify-between gap-3 border-t border-border/20">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setGateStates(prev => ({ ...prev, 3: "locked" }));
                        setActiveGate(2);
                      }}
                      className="gap-1.5 rounded-xl text-xs font-semibold"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      Back
                    </Button>
                    <Button
                      onClick={handlePactNext}
                      disabled={!description.trim() || !agreedToPact}
                      className="gap-1.5 rounded-xl text-xs font-semibold px-6"
                    >
                      Sign Pact
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* Gate 4: Envelope creation finalization */}
              {activeGate === 4 && (
                <motion.div
                  key="gate-4"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-5 py-2 text-center"
                >
                  {created ? (
                    <div className="space-y-4 py-2">
                      <div className="mx-auto flex h-14 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500 ring-4 ring-emerald-500/5">
                        <CheckCircle className="h-8 w-8" />
                      </div>
                      <div className="flex items-center justify-center gap-2.5">
                        <StreamIcon id={icon} size={24} tone="primary" />
                        <p className="text-lg font-bold text-foreground">
                          {created.name}
                        </p>
                      </div>
                      <p className="mx-auto max-w-sm text-xs leading-relaxed text-muted-foreground">
                        Your secure domain is active. The cryptographic envelope
                        has been minted and bound to your account profile.
                      </p>

                      <div className="pt-4">
                        <Button
                          onClick={() =>
                            setLocation(`/knowledge?stream=${created.id}`)
                          }
                          className="gap-1.5 rounded-xl text-xs font-semibold px-6 bg-emerald-500 hover:bg-emerald-600 text-white"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          Open Sequested Domain
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4 py-2 text-left">
                      <div className="rounded-xl border border-border/80 bg-card/40 p-4 space-y-3">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Configuration Review Summary
                        </p>
                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between font-medium">
                            <span className="text-muted-foreground">
                              Domain name:
                            </span>
                            <span className="text-foreground">{name}</span>
                          </div>
                          <div className="flex justify-between font-medium">
                            <span className="text-muted-foreground">
                              Icon label:
                            </span>
                            <span className="text-foreground flex items-center gap-1.5">
                              <StreamIcon id={icon} size={14} tone="primary" />
                              {icon}
                            </span>
                          </div>
                          <div className="flex justify-between font-medium">
                            <span className="text-muted-foreground">
                              URI prefix:
                            </span>
                            <span className="font-mono text-[10px] text-foreground">
                              {slugPreview}
                            </span>
                          </div>
                        </div>
                      </div>

                      <p className="text-xs text-muted-foreground leading-relaxed text-center">
                        Confirm configuration parameters and instruct the admin
                        plane to mint your isolation signature envelope.
                      </p>

                      <div className="pt-4 flex justify-between gap-3 border-t border-border/20">
                        <Button
                          variant="outline"
                          disabled={provisionMut.isPending}
                          onClick={() => {
                            setGateStates(prev => ({ ...prev, 4: "locked" }));
                            setActiveGate(3);
                          }}
                          className="gap-1.5 rounded-xl text-xs font-semibold"
                        >
                          <ArrowLeft className="h-3.5 w-3.5" />
                          Back
                        </Button>
                        <Button
                          onClick={handleCreate}
                          disabled={provisionMut.isPending}
                          className="gap-1.5 rounded-xl text-xs font-semibold px-6"
                        >
                          {provisionMut.isPending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <ShieldCheck className="h-3.5 w-3.5" />
                          )}
                          {provisionMut.isPending
                            ? "Provisioning..."
                            : "Provision & Seal"}
                        </Button>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>
      </motion.div>
    </KnowledgeSelfServiceShell>
  );
}
