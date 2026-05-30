/**
 * Knowledge Domains — Request access intake form at /knowledge/request-access
 *
 * Rebuilt as a premium, state-gated wizard representing the trust sequence.
 * Users submit an access request to the HKI Admin compliance queue.
 */

import { type ChangeEvent, type FormEvent, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { Button, useNotifications } from "@hki/ui";
import {
  ArrowRight,
  ArrowLeft,
  Briefcase,
  Building2,
  CheckCircle,
  Clock3,
  Loader2,
  Mail,
  MessageSquareText,
  Send,
  ShieldCheck,
  Sparkles,
  User,
  Clock,
  FileText,
  Lock,
} from "lucide-react";

import { trpc } from "../../lib/trpc";
import {
  KnowledgeSelfServiceShell,
  useKnowledgePageMeta,
} from "./components/SelfServiceChrome";
import { StageGator, GateStatus, StageGate } from "./components/StageGator";

const EASE = [0.22, 1, 0.36, 1] as const;

const DEPARTMENTS = [
  "Pharmacy",
  "Optical",
  "Fresh Foods",
  "Bakery",
  "Membership",
  "E-Commerce",
  "Logistics",
  "Merchandising",
  "IT / Technology",
  "Finance",
  "HR / People",
  "Legal / Compliance",
  "Marketing",
  "Operations",
  "Other",
];

const REQUEST_GATES: StageGate[] = [
  {
    id: 1,
    title: "Principal Handshake",
    description: "Verify identity and workspace work email.",
    icon: User,
  },
  {
    id: 2,
    title: "Domain Scope Spec",
    description: "Target requested department and knowledge domain.",
    icon: Building2,
  },
  {
    id: 3,
    title: "Justification Accord",
    description: "Specify the operational purpose and business justification.",
    icon: FileText,
  },
  {
    id: 4,
    title: "Queue Review Seal",
    description: "Submit request to compliance board and seal ticket.",
    icon: Clock,
  },
];

export default function KnowledgeRequestAccess() {
  useKnowledgePageMeta("Request Domain Access — Hermetic");

  const [, setLocation] = useLocation();
  const { notify } = useNotifications();

  // Wizard state: maps directly to active gate id (1, 2, 3, 4)
  const [activeGate, setActiveGate] = useState<1 | 2 | 3 | 4>(1);

  // Form Inputs
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [department, setDepartment] = useState("");
  const [valueStream, setValueStream] = useState("");
  const [justification, setJustification] = useState("");
  const [managerEmail, setManagerEmail] = useState("");

  // Submission States
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Gate statuses tracking
  const [gateStates, setGateStates] = useState<Record<number, GateStatus>>({
    1: "processing", // Starts processing handshake
    2: "locked",
    3: "locked",
    4: "locked",
  });
  const [digests, setDigests] = useState<Record<number, string>>({});

  const submitMut = trpc.admin.submitAccessRequest.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      setGateStates(prev => ({ ...prev, 4: "sealed" }));
      setDigests(prev => ({
        ...prev,
        4: `TICKET-SEAL: ${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
      }));
      notify({
        title: "Request submitted successfully",
        description: "Your domain access ticket has been queued for review.",
        severity: "success",
        group: "team",
      });
    },
    onError: error => {
      setGateStates(prev => ({ ...prev, 4: "processing" }));
      const msg = error.message || "Something went wrong. Please try again.";
      setSubmitError(msg);
      notify({
        title: "Submission failed",
        description: msg,
        severity: "error",
        group: "team",
      });
    },
  });

  // Step 1 Check
  const handleVerifyIdentity = () => {
    if (!name.trim() || !email.trim().includes("@")) return;
    setGateStates(prev => ({ ...prev, 1: "sealed" }));
    setDigests(prev => ({
      ...prev,
      1: `SIG: ${email.trim().toUpperCase()}`,
    }));
    setGateStates(prev => ({ ...prev, 2: "processing" }));
    setActiveGate(2);
  };

  // Step 2 Check
  const handleScopeNext = () => {
    if (!department) return;
    setGateStates(prev => ({ ...prev, 2: "sealed" }));
    setDigests(prev => ({
      ...prev,
      2: `DEPT: ${department.toUpperCase()}${valueStream.trim() ? ` / BOUND: ${valueStream.trim().toUpperCase()}` : ""}`,
    }));
    setGateStates(prev => ({ ...prev, 3: "processing" }));
    setActiveGate(3);
  };

  // Step 3 Check
  const handleJustificationNext = () => {
    if (justification.trim().length < 10) return;
    setGateStates(prev => ({ ...prev, 3: "sealed" }));
    setDigests(prev => ({
      ...prev,
      3: `JUSTIFY: ${justification.trim().slice(0, 12).toUpperCase()}...`,
    }));
    setGateStates(prev => ({ ...prev, 4: "processing" }));
    setActiveGate(4);
  };

  // Step 4 Submit
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitError(null);
    setGateStates(prev => ({ ...prev, 4: "processing" }));
    submitMut.mutate({
      name: name.trim(),
      email: email.trim(),
      department,
      valueStream: valueStream.trim() || undefined,
      justification: justification.trim(),
      managerEmail: managerEmail.trim() || undefined,
    });
  };

  const handleResetForm = () => {
    setName("");
    setEmail("");
    setDepartment("");
    setValueStream("");
    setJustification("");
    setManagerEmail("");
    setActiveGate(1);
    setGateStates({
      1: "processing",
      2: "locked",
      3: "locked",
      4: "locked",
    });
    setDigests({});
    setSubmitted(false);
    setSubmitError(null);
  };

  const labelCls =
    "mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground";
  const helperCls = "mt-2 text-xs text-muted-foreground/70";

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
        {/* Left Column: Visual Stage Gator & Compliance Context */}
        <section className="kb-self-service-panel rounded-[28px] p-7 lg:p-9 flex flex-col justify-between h-full relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 rounded-full bg-primary/3 blur-2xl pointer-events-none" />

          <div>
            <div className="kb-self-service-chip">
              <Send className="h-3.5 w-3.5" />
              Intake Registration
            </div>
            <h1 className="mt-5 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Access Compliance
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
              Requesting domain access requires passing our identity and scope
              handshakes. Use the tracker to verify compliance at each step.
            </p>
          </div>

          <div className="mt-8 flex-1">
            <StageGator
              gateStates={gateStates}
              digests={digests}
              gates={REQUEST_GATES}
              title="Access Intake Gates"
              subtitle="Sequential review steps for compliance gate certification."
            />
          </div>

          <div className="mt-8 pt-6 border-t border-border/40 text-xs text-muted-foreground flex items-center gap-2">
            <Lock className="h-3.5 w-3.5 text-primary" />
            <span>
              Traceable tickets sealed inside our global compliance audit index.
            </span>
          </div>
        </section>

        {/* Right Column: Step Wizard Forms */}
        <section className="kb-self-service-panel rounded-[28px] p-6 lg:p-8 flex flex-col justify-between relative">
          <div className="absolute top-0 left-0 -ml-12 -mt-12 w-32 h-32 rounded-full bg-primary/2 blur-xl pointer-events-none" />

          {/* Form Header */}
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Step {activeGate} of 4
            </p>
            <h2 className="mt-2 text-xl font-bold text-foreground">
              {activeGate === 1 && "Identity Handshake & Verification"}
              {activeGate === 2 && "Target Domain Scope Specification"}
              {activeGate === 3 && "Operational Purpose justification"}
              {activeGate === 4 && "Certify & Seal Compliance Ticket"}
            </h2>
          </div>

          {/* Step Contents */}
          <div className="flex-1 flex flex-col justify-center">
            <AnimatePresence mode="wait">
              {!submitted ? (
                <>
                  {/* Gate 1: Principal Identity */}
                  {activeGate === 1 && (
                    <motion.div
                      key="gate-1"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.3 }}
                      className="space-y-5 py-2"
                    >
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                          <label className={labelCls}>
                            <User className="h-3.5 w-3.5" />
                            Full name
                          </label>
                          <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="Jane Doe"
                            required
                            className="kb-self-service-field px-4 py-3"
                          />
                        </div>
                        <div>
                          <label className={labelCls}>
                            <Mail className="h-3.5 w-3.5" />
                            Work email
                          </label>
                          <input
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="you@hki.com"
                            required
                            className="kb-self-service-field px-4 py-3"
                          />
                        </div>
                      </div>

                      <p className="text-xs text-muted-foreground leading-relaxed">
                        To request a secure isolation boundary, you must supply
                        your active, authorized workspace work credentials.
                      </p>

                      <div className="pt-4 flex justify-between gap-3 border-t border-border/20">
                        <Button
                          variant="outline"
                          onClick={() => setLocation("/knowledge/join")}
                          className="gap-1.5 rounded-xl text-xs font-semibold"
                        >
                          Have invite code?
                        </Button>
                        <Button
                          onClick={handleVerifyIdentity}
                          disabled={!name.trim() || !email.trim().includes("@")}
                          className="gap-2 rounded-xl text-xs font-semibold px-6"
                        >
                          Authenticate Principal
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </motion.div>
                  )}

                  {/* Gate 2: Scope Spec */}
                  {activeGate === 2 && (
                    <motion.div
                      key="gate-2"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.3 }}
                      className="space-y-5 py-1"
                    >
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                          <label className={labelCls}>
                            <Building2 className="h-3.5 w-3.5" />
                            Department
                          </label>
                          <select
                            value={department}
                            onChange={e => setDepartment(e.target.value)}
                            required
                            className="kb-self-service-field px-4 py-3"
                          >
                            <option value="" disabled>
                              Select department
                            </option>
                            {DEPARTMENTS.map(dept => (
                              <option key={dept} value={dept}>
                                {dept}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className={labelCls}>
                            <Briefcase className="h-3.5 w-3.5" />
                            Domain{" "}
                            <span className="text-muted-foreground/50">
                              (optional)
                            </span>
                          </label>
                          <input
                            type="text"
                            value={valueStream}
                            onChange={e => setValueStream(e.target.value)}
                            placeholder="e.g. Pharmacy, Fresh Foods"
                            className="kb-self-service-field px-4 py-3"
                          />
                        </div>
                      </div>

                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Identify the corporate division and knowledge domain you
                        require access to. This ensures admins approve the
                        precise isolation group matching your role.
                      </p>

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
                          onClick={handleScopeNext}
                          disabled={!department}
                          className="gap-1.5 rounded-xl text-xs font-semibold px-6"
                        >
                          Confirm Scope
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </motion.div>
                  )}

                  {/* Gate 3: Justification */}
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
                        <label className={labelCls}>
                          <MessageSquareText className="h-3.5 w-3.5" />
                          Business justification
                        </label>
                        <textarea
                          value={justification}
                          onChange={e => setJustification(e.target.value)}
                          placeholder="Describe how your team will use this domain and what decisions it supports."
                          required
                          rows={3}
                          className="kb-self-service-field resize-none px-4 py-3"
                        />
                        <p className={helperCls}>Minimum 10 characters</p>
                      </div>

                      <div>
                        <label className={labelCls}>
                          <Mail className="h-3.5 w-3.5" />
                          Manager email{" "}
                          <span className="text-muted-foreground/50">
                            (optional)
                          </span>
                        </label>
                        <input
                          type="email"
                          value={managerEmail}
                          onChange={e => setManagerEmail(e.target.value)}
                          placeholder="manager@hki.com"
                          className="kb-self-service-field px-4 py-3"
                        />
                        <p className={helperCls}>
                          CC'd on compliance audit notifications
                        </p>
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
                          onClick={handleJustificationNext}
                          disabled={justification.trim().length < 10}
                          className="gap-1.5 rounded-xl text-xs font-semibold px-6"
                        >
                          Sign Justification
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </motion.div>
                  )}

                  {/* Gate 4: Submit & Seal */}
                  {activeGate === 4 && (
                    <motion.div
                      key="gate-4"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.3 }}
                      className="space-y-5 py-2"
                    >
                      <div className="rounded-xl border border-border bg-card/60 p-4 space-y-3">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Compliance Ticket Review
                        </p>
                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between font-medium">
                            <span className="text-muted-foreground">
                              Requestor:
                            </span>
                            <span className="text-foreground">
                              {name} ({email})
                            </span>
                          </div>
                          <div className="flex justify-between font-medium">
                            <span className="text-muted-foreground">
                              Scope division:
                            </span>
                            <span className="text-foreground">
                              {department}
                            </span>
                          </div>
                          {valueStream.trim() && (
                            <div className="flex justify-between font-medium">
                              <span className="text-muted-foreground">
                                Target Domain:
                              </span>
                              <span className="text-foreground font-semibold">
                                {valueStream}
                              </span>
                            </div>
                          )}
                          <div className="flex flex-col gap-1 pt-1.5 border-t border-border/30">
                            <span className="text-muted-foreground font-semibold uppercase tracking-wider text-[9px]">
                              Justification:
                            </span>
                            <span className="text-foreground italic leading-relaxed text-[11px] line-clamp-2">
                              "{justification}"
                            </span>
                          </div>
                        </div>
                      </div>

                      {submitError && (
                        <div className="rounded-xl border border-destructive/20 bg-destructive/8 p-3 text-xs text-destructive text-center">
                          {submitError}
                        </div>
                      )}

                      <p className="text-xs text-muted-foreground leading-relaxed text-center">
                        Upon submission, your justification is sealed in our
                        audit registries, and a review ticket is pushed to the
                        admin compliance queue.
                      </p>

                      <div className="pt-4 flex justify-between gap-3 border-t border-border/20">
                        <Button
                          variant="outline"
                          disabled={submitMut.isPending}
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
                          onClick={handleSubmit}
                          disabled={submitMut.isPending}
                          className="gap-1.5 rounded-xl text-xs font-semibold px-6"
                        >
                          {submitMut.isPending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Send className="h-3.5 w-3.5" />
                          )}
                          {submitMut.isPending
                            ? "Submitting..."
                            : "Submit & Seal Ticket"}
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </>
              ) : (
                /* Submitted State success card */
                <motion.div
                  key="success-screen"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.42, ease: EASE }}
                  className="space-y-5 py-4 text-center"
                >
                  <div className="mx-auto flex h-14 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500 ring-4 ring-emerald-500/5">
                    <CheckCircle className="h-8 w-8" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground">
                    Access Ticket Sequested
                  </h3>
                  <p className="mx-auto max-w-sm text-xs leading-relaxed text-muted-foreground">
                    Your request has been successfully signed and logged. It has
                    beenCC'd to your manager and queued for administrative
                    audit.
                  </p>
                  <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/3 p-3 text-xs max-w-md mx-auto">
                    <p className="text-[10px] text-emerald-500/60 font-mono">
                      CC NOTIFICATION DISPATCHED TO:
                    </p>
                    <p className="font-semibold text-emerald-500 mt-1">
                      {managerEmail.trim() ||
                        "Compliance Queue Default Handler"}
                    </p>
                  </div>
                  <p className="text-[11px] text-muted-foreground/80 italic">
                    Typical turnaround: 1-2 business days.
                  </p>

                  <div className="pt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
                    <Button
                      onClick={() => setLocation("/welcome")}
                      className="gap-1.5 rounded-xl text-xs font-semibold px-6"
                    >
                      Back to Domains
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      onClick={handleResetForm}
                      variant="outline"
                      className="rounded-xl text-xs font-semibold px-6"
                    >
                      Submit Another
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>
      </motion.div>
    </KnowledgeSelfServiceShell>
  );
}
