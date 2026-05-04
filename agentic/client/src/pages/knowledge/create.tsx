/**
 * Knowledge Base — Self-service creation page at /knowledge/create
 *
 * Managers and admins can provision a new Knowledge Base for their team.
 * Creates: value stream + default collection + assigns creator to the stream.
 */

import { useState } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import {
  BookOpen,
  ArrowRight,
  Loader2,
  CheckCircle,
  ArrowLeft,
  Sparkles,
} from "lucide-react";
import { useNotifications } from "@hki/ui";
import { trpc } from "@/lib/trpc";

const EASE = [0.22, 1, 0.36, 1] as const;

const ICONS = [
  "📚",
  "🏥",
  "🛒",
  "⚙️",
  "📊",
  "🔬",
  "🏢",
  "💊",
  "🍎",
  "👓",
  "🎯",
  "📋",
];

export default function KnowledgeCreate() {
  const [, setLocation] = useLocation();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("📚");
  const [created, setCreated] = useState<{ id: string; name: string } | null>(
    null
  );

  const { notify } = useNotifications();

  const provisionMut = trpc.admin.provisionKnowledgeBase.useMutation({
    onSuccess: data => {
      setCreated(data);
      notify({
        title: `"${data.name}" created!`,
        description: "Your knowledge base is ready. Let's get started.",
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

  // Derive slug preview
  const slugPreview = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Back link */}
      <div className="p-4">
        <button
          onClick={() => setLocation("/welcome")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
          className="w-full max-w-lg"
        >
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-primary/10">
              <BookOpen className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">
              Create a Knowledge Base
            </h1>
            <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
              Set up a dedicated knowledge base for your team and start curating
              trusted content after setup.
            </p>
          </div>

          {/* Success state */}
          {created ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-2xl border border-border/30 bg-card p-8 text-center space-y-5"
            >
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto bg-primary/10">
                <CheckCircle className="w-7 h-7 text-primary" />
              </div>
              <div>
                <p className="text-lg font-bold text-foreground">
                  {icon} {created.name}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Your knowledge base is ready. Let's start the onboarding
                  journey.
                </p>
              </div>
              <button
                data-testid="kb-create-open"
                onClick={() => setLocation(`/knowledge?stream=${created.id}`)}
                className="inline-flex items-center gap-2 px-6 py-3 text-sm font-bold rounded-xl transition-all hover:-translate-y-0.5 kb-duotone-accent-solid kb-duotone-accent-solid-hover"
              >
                <Sparkles className="w-4 h-4" /> Open Knowledge Base
                <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>
          ) : (
            /* Creation form */
            <div className="rounded-2xl border border-border/30 bg-card p-6 space-y-5">
              {/* Icon picker */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Icon
                </label>
                <div className="flex flex-wrap gap-2">
                  {ICONS.map(ic => (
                    <button
                      key={ic}
                      type="button"
                      onClick={() => setIcon(ic)}
                      className={`w-10 h-10 rounded-xl text-lg flex items-center justify-center transition-all ${
                        icon === ic
                          ? "ring-2 ring-primary ring-offset-2 ring-offset-background bg-primary/10 scale-110"
                          : "hover:bg-muted/60"
                      }`}
                    >
                      {ic}
                    </button>
                  ))}
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Knowledge Base Name{" "}
                  <span className="text-destructive">*</span>
                </label>
                <input
                  data-testid="kb-create-name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") handleCreate();
                  }}
                  placeholder="e.g. Pharmacy SOPs, Fresh Foods, Optical"
                  maxLength={128}
                  className="w-full px-4 py-3 rounded-xl border border-border/30 bg-muted/10 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:ring-offset-1 focus:border-primary/40"
                  autoFocus
                />
                {slugPreview && (
                  <p className="text-xs text-muted-foreground/50 mt-1.5">
                    Your unique address:{" "}
                    <code className="font-mono">{slugPreview}</code>
                  </p>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Description{" "}
                  <span className="text-muted-foreground/40">(optional)</span>
                </label>
                <textarea
                  data-testid="kb-create-description"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="What will this knowledge base cover? e.g. Standard operating procedures for in-store pharmacy operations"
                  maxLength={500}
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-border/30 bg-muted/10 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:ring-offset-1 focus:border-primary/40 resize-none"
                />
              </div>

              {/* Defaults info */}
              <div className="rounded-xl bg-muted/40 p-3.5 space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">
                  What you get
                </p>
                <ul className="text-xs text-muted-foreground/60 space-y-0.5">
                  <li>• Smart search that finds what your team needs</li>
                  <li>• Built-in privacy and safety checks</li>
                  <li>• Works with PDF, Word, Excel, PowerPoint, and more</li>
                  <li>• A guided setup walkthrough to get you started</li>
                </ul>
              </div>

              {/* Submit */}
              <button
                data-testid="kb-create-submit"
                onClick={handleCreate}
                disabled={!name.trim() || provisionMut.isPending}
                className="w-full flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-bold rounded-xl transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0 kb-duotone-accent-solid kb-duotone-accent-solid-hover"
              >
                {provisionMut.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Setting things
                    up…
                  </>
                ) : (
                  <>
                    Create Knowledge Base <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
