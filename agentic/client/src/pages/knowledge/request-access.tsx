/**
 * Knowledge Base — Request Access intake form at /knowledge/request-access
 *
 * Public page where users can submit a request for KB access.
 * Captures name, email, department, value stream of interest, business
 * justification, and optional manager email. Submits to the BFF which
 * can route the request to admins via email / Slack / ticketing.
 */

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { Button, COSTCO_BLUE, COSTCO_RED } from "@hki/ui";
import { trpc } from "../../lib/trpc";
import { AgenticIcon } from "@/components/ui/icons/AgenticIcon";
import { useTheme } from "@/contexts/ThemeContext";
import {
  Mail,
  User,
  Building2,
  MessageSquareText,
  ArrowRight,
  ArrowLeft,
  Loader2,
  CheckCircle,
  Send,
  Briefcase,
  Moon,
  Sun,
  ShieldCheck,
  Clock3,
  Sparkles,
} from "lucide-react";

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
  const [, setLocation] = useLocation();
  const { theme, toggleTheme } = useTheme();
  const [form, setForm] = useState<RequestForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const submitMut = trpc.admin.submitAccessRequest.useMutation({
    onSuccess: () => {
      setSubmitting(false);
      setSubmitted(true);
    },
    onError: err => {
      setSubmitting(false);
      setSubmitError(err.message || "Something went wrong. Please try again.");
    },
  });

  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
    const prevHref = link?.href;
    const prevTitle = document.title;
    if (link) link.href = "/favicon-knowledge.svg";
    document.title = "Request Access — Knowledge Base";
    return () => {
      if (link && prevHref) link.href = prevHref;
      document.title = prevTitle;
    };
  }, []);

  const set =
    (field: keyof RequestForm) =>
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >
    ) =>
      setForm(prev => ({ ...prev, [field]: e.target.value }));

  const canSubmit =
    form.name.trim() &&
    form.email.trim() &&
    form.department &&
    form.justification.trim().length >= 10;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

  const panelCls =
    "rounded-[28px] border border-slate-200/80 bg-white/92 shadow-[0_24px_90px_-32px_rgba(15,23,42,0.35)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/82 dark:shadow-[0_28px_90px_-36px_rgba(0,0,0,0.72)]";
  const inputCls =
    "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 placeholder:text-slate-400 shadow-[0_1px_0_rgba(255,255,255,0.9)] transition-all focus:border-[color:var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[color:color-mix(in_srgb,var(--color-primary)_14%,transparent)] dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-50 dark:placeholder:text-slate-500";
  const labelCls =
    "mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600 dark:text-slate-300";
  const helperCls = "mt-1.5 text-xs text-slate-500 dark:text-slate-400";

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-background text-foreground">
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
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background: `
            radial-gradient(circle at 16% 18%, ${COSTCO_BLUE}18 0%, transparent 24%),
            radial-gradient(circle at 82% 14%, ${COSTCO_RED}18 0%, transparent 22%),
            radial-gradient(circle at 50% 100%, ${COSTCO_BLUE}10 0%, transparent 48%)
          `,
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
            <span style={{ color: "var(--primary)" }}>HKI</span>{" "}
            <span className="text-muted-foreground">Agentic</span>
          </span>
        </a>
        <button
          onClick={toggleTheme}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/80 bg-white/90 text-slate-600 shadow-sm transition-colors hover:text-slate-950 dark:border-white/10 dark:bg-slate-950/80 dark:text-slate-300 dark:hover:text-white"
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
      </header>

      {/* Main */}
      <div className="relative z-10 flex flex-1 items-center justify-center px-6 pb-16 pt-4">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
          className="w-full max-w-6xl"
        >
          {!submitted ? (
            <div className="grid gap-5 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
              <section
                className={`${panelCls} relative overflow-hidden p-7 lg:p-9`}
              >
                <div className="relative">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, delay: 0.1, ease: EASE }}
                    className="mb-6 flex h-15 w-15 items-center justify-center rounded-3xl border border-rose-200/70 bg-rose-50 text-rose-600 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300"
                  >
                    <Send className="h-7 w-7" />
                  </motion.div>

                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                    Knowledge Base Access
                  </p>
                  <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-950 dark:text-white">
                    Request Access
                  </h1>
                  <p className="mt-4 max-w-md text-base leading-7 text-slate-600 dark:text-slate-300">
                    Tell us about your team, your value stream, and why you need
                    the knowledge workspace. We route this to platform admins
                    for review and follow-up.
                  </p>

                  <div className="mt-7 grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                    {[
                      {
                        icon: ShieldCheck,
                        title: "Reviewed",
                        body: "Each request is triaged by an admin before access is granted.",
                      },
                      {
                        icon: Sparkles,
                        title: "Scoped",
                        body: "Value-stream access is limited to the knowledge your team should see.",
                      },
                      {
                        icon: Clock3,
                        title: "Fast",
                        body: "Typical turnaround is one to two business days once submitted.",
                      },
                    ].map(item => (
                      <div
                        key={item.title}
                        className="rounded-2xl border border-slate-200/80 bg-slate-50/90 p-4 dark:border-white/10 dark:bg-white/5"
                      >
                        <item.icon className="mb-3 h-4 w-4 text-primary" />
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                          {item.title}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-400">
                          {item.body}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-8 rounded-3xl border border-slate-200/80 bg-[linear-gradient(135deg,rgba(0,93,170,0.08),rgba(227,24,55,0.06))] p-5 dark:border-white/10 dark:bg-[linear-gradient(135deg,rgba(0,93,170,0.18),rgba(227,24,55,0.10))]">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-600 dark:text-slate-300">
                      Already invited?
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-300">
                      If you already have a code from an administrator, skip the
                      queue and join directly.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => setLocation("/knowledge/join")}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition-colors hover:border-primary/50 hover:text-primary dark:border-white/12 dark:bg-slate-950/80 dark:text-white"
                      >
                        Enter invite code <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setLocation("/login?from=knowledge")}
                        className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
                      >
                        Already have access? Sign in
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              <form
                onSubmit={handleSubmit}
                className={`${panelCls} space-y-5 p-7 lg:p-9`}
              >
                <div>
                  <h2 className="text-xl font-semibold text-slate-950 dark:text-white">
                    Access request details
                  </h2>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    Use your HKI email and describe the operational need
                    clearly.
                  </p>
                </div>

                <div className="space-y-5 rounded-3xl border border-slate-200/80 bg-slate-50/70 p-5 dark:border-white/10 dark:bg-white/4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>
                        <User className="w-3.5 h-3.5" /> Full Name
                      </label>
                      <input
                        type="text"
                        value={form.name}
                        onChange={set("name")}
                        placeholder="Jane Doe"
                        required
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>
                        <Mail className="w-3.5 h-3.5" /> Work Email
                      </label>
                      <input
                        type="email"
                        value={form.email}
                        onChange={set("email")}
                        placeholder="you@hki.com"
                        required
                        className={inputCls}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>
                        <Building2 className="w-3.5 h-3.5" /> Department
                      </label>
                      <select
                        value={form.department}
                        onChange={set("department")}
                        required
                        className={`${inputCls} ${!form.department ? "text-slate-400 dark:text-slate-500" : ""}`}
                      >
                        <option value="" disabled>
                          Select department
                        </option>
                        {DEPARTMENTS.map(d => (
                          <option
                            key={d}
                            value={d}
                            className="bg-card text-foreground"
                          >
                            {d}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>
                        <Briefcase className="w-3.5 h-3.5" /> Value Stream{" "}
                        <span className="text-slate-400 dark:text-slate-500">
                          (optional)
                        </span>
                      </label>
                      <input
                        type="text"
                        value={form.valueStream}
                        onChange={set("valueStream")}
                        placeholder="e.g. Pharmacy, Fresh Foods"
                        className={inputCls}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={labelCls}>
                      <MessageSquareText className="w-3.5 h-3.5" /> Business
                      Justification
                    </label>
                    <textarea
                      value={form.justification}
                      onChange={set("justification")}
                      placeholder="Describe how your team will use the Knowledge Base..."
                      required
                      rows={3}
                      className={`${inputCls} resize-none`}
                    />
                    <p className={helperCls}>Minimum 10 characters</p>
                  </div>

                  <div>
                    <label className={labelCls}>
                      <Mail className="w-3.5 h-3.5" /> Manager Email{" "}
                      <span className="text-slate-400 dark:text-slate-500">
                        (optional)
                      </span>
                    </label>
                    <input
                      type="email"
                      value={form.managerEmail}
                      onChange={set("managerEmail")}
                      placeholder="manager@hki.com"
                      className={inputCls}
                    />
                    <p className={helperCls}>
                      CC'd on the approval notification
                    </p>
                  </div>
                </div>

                {submitError && (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
                    {submitError}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={!canSubmit || submitting}
                  className="w-full gap-2 rounded-2xl py-3.5 text-sm font-semibold shadow-[0_18px_50px_-24px_rgba(0,93,170,0.8)]"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  {submitting ? "Submitting..." : "Submit Request"}
                  {!submitting && <ArrowRight className="w-4 h-4" />}
                </Button>
              </form>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease: EASE }}
              className={`${panelCls} mx-auto max-w-xl p-10 text-center`}
            >
              <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 bg-emerald-500/10 ring-1 ring-emerald-500/20 dark:bg-emerald-500/15">
                <CheckCircle className="w-10 h-10 text-emerald-500 dark:text-emerald-400" />
              </div>
              <h2 className="text-2xl font-bold mb-2 text-slate-950 dark:text-white">
                Request Submitted
              </h2>
              <p className="mx-auto mb-2 max-w-sm text-sm text-slate-600 dark:text-slate-300">
                Your request has been sent. You'll receive an email at{" "}
                <span className="font-medium text-slate-950 dark:text-white">
                  {form.email}
                </span>{" "}
                once approved.
              </p>
              <p className="mb-8 text-xs text-slate-500 dark:text-slate-400">
                Typical turnaround is 1-2 business days.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Button
                  onClick={() => setLocation("/")}
                  className="gap-2 rounded-xl px-6"
                >
                  Back to Home <ArrowRight className="w-4 h-4" />
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
            </motion.div>
          )}
        </motion.div>
      </div>

      <footer className="relative z-10 border-t border-border/40 px-6 py-5 dark:border-white/6">
        <p className="text-center text-xs text-muted-foreground">
          <span style={{ color: "var(--primary)" }}>HKI</span>{" "}
          <span className="text-secondary/80">&middot;</span> Innovation &
          Technology
        </p>
      </footer>
    </div>
  );
}
