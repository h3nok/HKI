/**
 * Knowledge Domains — Request access intake form at /knowledge/request-access
 *
 * Public page where users submit a request for domain-scoped knowledge access.
 */

import { type ChangeEvent, type FormEvent, useState } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { Button } from "@hki/ui";
import {
  ArrowRight,
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
} from "lucide-react";

import { trpc } from "../../lib/trpc";
import {
  KnowledgeSelfServiceShell,
  useKnowledgePageMeta,
} from "./components/SelfServiceChrome";

const EASE = [0.22, 1, 0.36, 1] as const;

interface RequestForm {
  name: string;
  email: string;
  department: string;
  valueStream: string;
  justification: string;
  managerEmail: string;
}

const EMPTY_FORM: RequestForm = {
  name: "",
  email: "",
  department: "",
  valueStream: "",
  justification: "",
  managerEmail: "",
};

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

export default function KnowledgeRequestAccess() {
  useKnowledgePageMeta("Request Domain Access — Hermetic");

  const [, setLocation] = useLocation();
  const [form, setForm] = useState<RequestForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const submitMut = trpc.admin.submitAccessRequest.useMutation({
    onSuccess: () => {
      setSubmitting(false);
      setSubmitted(true);
    },
    onError: error => {
      setSubmitting(false);
      setSubmitError(
        error.message || "Something went wrong. Please try again."
      );
    },
  });

  const set =
    (field: keyof RequestForm) =>
    (
      event: ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >
    ) =>
      setForm(prev => ({ ...prev, [field]: event.target.value }));

  const canSubmit =
    form.name.trim() &&
    form.email.trim() &&
    form.department &&
    form.justification.trim().length >= 10;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);
    submitMut.mutate({
      name: form.name.trim(),
      email: form.email.trim(),
      department: form.department,
      valueStream: form.valueStream.trim() || undefined,
      justification: form.justification.trim(),
      managerEmail: form.managerEmail.trim() || undefined,
    });
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
        transition={{ duration: 0.5, ease: EASE }}
        className="mx-auto flex w-full max-w-6xl flex-1 items-center py-6"
      >
        {!submitted ? (
          <div className="grid w-full gap-5 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
            <section className="kb-self-service-panel rounded-[28px] p-7 lg:p-9">
              <div className="kb-self-service-chip">
                <Send className="h-3.5 w-3.5" />
                Access Intake
              </div>
              <h1 className="mt-5 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                Request domain access
              </h1>
              <p className="mt-4 max-w-md text-sm leading-6 text-muted-foreground">
                Tell platform admins which domain your team needs and why. The
                request gives security and operations enough context to approve
                the right boundary.
              </p>

              <div className="mt-7 grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                {[
                  {
                    icon: ShieldCheck,
                    title: "Reviewed",
                    body: "Admins approve access before any domain data is visible.",
                  },
                  {
                    icon: Sparkles,
                    title: "Scoped",
                    body: "The approval maps you to the knowledge your role should use.",
                  },
                  {
                    icon: Clock3,
                    title: "Traceable",
                    body: "Requests stay visible for compliance and follow-up.",
                  },
                ].map(item => (
                  <div
                    key={item.title}
                    className="kb-self-service-inset rounded-2xl p-4"
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

              <div className="kb-self-service-graphic mt-7 rounded-3xl p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Already invited?
                </p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  If an administrator sent an invite code, join directly and
                  skip the intake queue.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setLocation("/knowledge/join")}
                    className="gap-2 rounded-xl"
                  >
                    Enter invite code
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setLocation("/login?from=knowledge")}
                    className="rounded-xl"
                  >
                    Sign in
                  </Button>
                </div>
              </div>
            </section>

            <form
              onSubmit={handleSubmit}
              className="kb-self-service-panel rounded-[28px] p-6 lg:p-8"
            >
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Request Details
                </p>
                <h2 className="mt-2 text-xl font-semibold text-foreground">
                  Explain the operational need
                </h2>
              </div>

              <div className="mt-6 space-y-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelCls}>
                      <User className="h-3.5 w-3.5" />
                      Full name
                    </label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={set("name")}
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
                      value={form.email}
                      onChange={set("email")}
                      placeholder="you@hki.com"
                      required
                      className="kb-self-service-field px-4 py-3"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelCls}>
                      <Building2 className="h-3.5 w-3.5" />
                      Department
                    </label>
                    <select
                      value={form.department}
                      onChange={set("department")}
                      required
                      className="kb-self-service-field px-4 py-3"
                    >
                      <option value="" disabled>
                        Select department
                      </option>
                      {DEPARTMENTS.map(department => (
                        <option key={department} value={department}>
                          {department}
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
                      value={form.valueStream}
                      onChange={set("valueStream")}
                      placeholder="e.g. Pharmacy, Fresh Foods"
                      className="kb-self-service-field px-4 py-3"
                    />
                  </div>
                </div>

                <div>
                  <label className={labelCls}>
                    <MessageSquareText className="h-3.5 w-3.5" />
                    Business justification
                  </label>
                  <textarea
                    value={form.justification}
                    onChange={set("justification")}
                    placeholder="Describe how your team will use this domain and what decisions it supports."
                    required
                    rows={4}
                    className="kb-self-service-field resize-none px-4 py-3"
                  />
                  <p className={helperCls}>Minimum 10 characters</p>
                </div>

                <div>
                  <label className={labelCls}>
                    <Mail className="h-3.5 w-3.5" />
                    Manager email{" "}
                    <span className="text-muted-foreground/50">(optional)</span>
                  </label>
                  <input
                    type="email"
                    value={form.managerEmail}
                    onChange={set("managerEmail")}
                    placeholder="manager@hki.com"
                    className="kb-self-service-field px-4 py-3"
                  />
                  <p className={helperCls}>CC'd on the approval notification</p>
                </div>
              </div>

              {submitError ? (
                <div className="mt-5 rounded-2xl border border-destructive/20 bg-destructive/8 px-4 py-3 text-xs text-destructive">
                  {submitError}
                </div>
              ) : null}

              <Button
                type="submit"
                disabled={!canSubmit || submitting}
                className="mt-6 w-full gap-2 rounded-xl py-3 text-sm font-semibold"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {submitting ? "Submitting..." : "Submit Request"}
                {!submitting ? <ArrowRight className="h-4 w-4" /> : null}
              </Button>
            </form>
          </div>
        ) : (
          <motion.section
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.42, ease: EASE }}
            className="kb-self-service-panel mx-auto max-w-xl rounded-[28px] p-8 text-center"
          >
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <CheckCircle className="h-8 w-8" />
            </div>
            <h2 className="mt-5 text-2xl font-semibold text-foreground">
              Request submitted
            </h2>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
              Your request has been sent. You will receive an email at{" "}
              <span className="font-medium text-foreground">{form.email}</span>{" "}
              once approved.
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              Typical turnaround is 1-2 business days.
            </p>
            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button
                onClick={() => setLocation("/welcome")}
                className="gap-2 rounded-xl px-6"
              >
                Back to Domains
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                onClick={() => {
                  setSubmitted(false);
                  setForm(EMPTY_FORM);
                }}
                variant="outline"
                className="rounded-xl px-6"
              >
                Submit Another
              </Button>
            </div>
          </motion.section>
        )}
      </motion.div>
    </KnowledgeSelfServiceShell>
  );
}
