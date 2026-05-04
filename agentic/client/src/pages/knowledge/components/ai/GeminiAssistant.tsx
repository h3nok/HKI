/**
 * GeminiAssistant — persistent right-side AI assistant panel for Knowledge.
 *
 * Props:
 *   page       — KnowledgeTab key (drives system prompt on the BFF)
 *   pageData   — optional snapshot of current page state for context
 *   suggestions — 2-3 quick-start prompts shown as chips
 *   open       — controlled open/closed state
 *   onToggle   — callback to toggle open/closed
 *
 * Renders as a docked sidebar panel (right edge). Conversation persists
 * across tab switches — only cleared on explicit "Clear" click.
 * Page context badge updates automatically when you switch tabs.
 *
 * Keyboard: Cmd+J / Ctrl+J toggles the panel.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Send,
  Loader2,
  CornerDownLeft,
  PanelRightClose,
  Trash2,
  Lightbulb,
  ArrowRight,
  type LucideIcon,
  Upload,
  BookOpen,
  ShieldCheck,
  LayoutDashboard,
  Activity,
  Brain,
  Target,
  Layers,
  FileSearch,
  Plug,
  BarChart3,
  Zap,
} from "lucide-react";
import { cn } from "@hki/ui";
import { trpc } from "@/lib/trpc";
import { FONT_FAMILY } from "@hki/ui";

// ── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  page?: string;
}

export interface GeminiAssistantProps {
  page: string;
  pageData?: Record<string, unknown>;
  suggestions?: string[];
  open: boolean;
  onToggle: () => void;
  valueStreamId?: string;
}

// ── Page contextual help ─────────────────────────────────────────────────────

interface PageContext {
  label: string;
  icon: LucideIcon;
  headline: string;
  desc: string;
  actions: { icon: LucideIcon; label: string; hint: string }[];
  tips: string[];
}

const PAGE_CTX: Record<string, PageContext> = {
  overview: {
    label: "Overview",
    icon: LayoutDashboard,
    headline: "Your knowledge command center",
    desc: "Health metrics, pipeline status, and getting started guidance.",
    actions: [
      {
        icon: BarChart3,
        label: "Check health",
        hint: "Review doc count, chunk coverage, and freshness",
      },
      {
        icon: Target,
        label: "Find gaps",
        hint: "Run gap analysis to identify missing topics",
      },
    ],
    tips: [
      "Upload 10+ documents for meaningful coverage scores",
      "Run gap analysis weekly to track improvement",
    ],
  },
  ingest: {
    label: "Ingest",
    icon: Upload,
    headline: "AI-powered content ingestion",
    desc: "Every document flows through Extract → Enrich → Chunk → Index.",
    actions: [
      {
        icon: FileSearch,
        label: "Upload files",
        hint: "PDF, DOCX, TXT, CSV — AI auto-enriches metadata",
      },
      {
        icon: Plug,
        label: "Connect sources",
        hint: "Google Drive auto-sync, SharePoint coming soon",
      },
      {
        icon: Brain,
        label: "AI enrichment",
        hint: "Title, tags, department, and type detected automatically",
      },
    ],
    tips: [
      "SOPs and policies produce the best agent answers",
      "Batch upload processes files in parallel",
      "Leave title empty — AI detects it automatically",
    ],
  },
  library: {
    label: "Library",
    icon: BookOpen,
    headline: "Browse and manage content",
    desc: "All indexed documents with metadata, chunks, entity graph, collections, and taxonomy.",
    actions: [
      {
        icon: FileSearch,
        label: "Search documents",
        hint: "Full-text and semantic search across all content",
      },
      {
        icon: Layers,
        label: "Organize",
        hint: "Collections, taxonomy tree, and tag management",
      },
    ],
    tips: [
      "Check freshness — stale docs degrade agent quality",
      "Build taxonomy before bulk ingestion for best entity mapping",
    ],
  },
  govern: {
    label: "Govern",
    icon: ShieldCheck,
    headline: "Review, team, and compliance",
    desc: "Review workflow, team access management, and compliance controls.",
    actions: [
      {
        icon: ShieldCheck,
        label: "Review queue",
        hint: "Approve, reject, or request revision on submitted documents",
      },
      {
        icon: Activity,
        label: "Team access",
        hint: "Invite team members and manage roles",
      },
    ],
    tips: [
      "Enable review gate for sensitive domains (HR, Legal)",
      "Pending documents are NOT retrievable until approved",
    ],
  },
  validate: {
    label: "Validate",
    icon: ShieldCheck,
    headline: "Test and verify quality",
    desc: "Retrieval testing, gap analysis, and coverage scoring.",
    actions: [
      {
        icon: Target,
        label: "Run gap analysis",
        hint: "AI scores coverage 0–100 and identifies missing topics",
      },
      {
        icon: Zap,
        label: "Test retrieval",
        hint: "Ask questions and verify the agent finds correct chunks",
      },
      {
        icon: BarChart3,
        label: "Track coverage",
        hint: "Compare scores over time in Coverage History",
      },
    ],
    tips: [
      "High-severity gaps should be addressed first",
      "Re-run analysis after adding content to see delta",
      "Coverage ≥75 is good, ≥90 is excellent",
    ],
  },
  activity: {
    label: "Activity",
    icon: Activity,
    headline: "Pipeline activity and alerts",
    desc: "Track ingestion jobs, system alerts, and notification history.",
    actions: [
      {
        icon: Activity,
        label: "View jobs",
        hint: "Filter by active, completed, or failed status",
      },
      {
        icon: ShieldCheck,
        label: "Review alerts",
        hint: "System notifications with severity and context",
      },
    ],
    tips: [
      "Failed jobs often mean unsupported format or size limit",
      "Check the Activity tab after bulk uploads",
    ],
  },
};

const DEFAULT_CTX: PageContext = {
  label: "Knowledge",
  icon: Sparkles,
  headline: "AI Knowledge Assistant",
  desc: "Ask me anything about your knowledge base.",
  actions: [],
  tips: [],
};

function getPageCtx(page: string): PageContext {
  return PAGE_CTX[page] ?? DEFAULT_CTX;
}

// ── Minimal markdown renderer (no dependency) ────────────────────────────────

function MiniMarkdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("### ")) {
      elements.push(
        <p
          key={i}
          className="text-[11px] font-bold text-foreground mt-2 mb-0.5"
        >
          {inlineFormat(line.slice(4))}
        </p>
      );
    } else if (line.startsWith("## ")) {
      elements.push(
        <p key={i} className="text-xs font-bold text-foreground mt-2 mb-0.5">
          {inlineFormat(line.slice(3))}
        </p>
      );
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      elements.push(
        <p
          key={i}
          className="text-[11px] text-muted-foreground pl-3 leading-relaxed"
        >
          <span className="text-primary mr-1">•</span>
          {inlineFormat(line.slice(2))}
        </p>
      );
    } else if (/^\d+\.\s/.test(line)) {
      const match = line.match(/^(\d+)\.\s(.*)$/);
      if (match) {
        elements.push(
          <p
            key={i}
            className="text-[11px] text-muted-foreground pl-3 leading-relaxed"
          >
            <span className="text-primary font-bold mr-1">{match[1]}.</span>
            {inlineFormat(match[2])}
          </p>
        );
      }
    } else if (line.trim() === "") {
      elements.push(<div key={i} className="h-1.5" />);
    } else {
      elements.push(
        <p
          key={i}
          className="text-[11px] text-muted-foreground leading-relaxed"
        >
          {inlineFormat(line)}
        </p>
      );
    }
  }

  return <div className="space-y-0.5">{elements}</div>;
}

function inlineFormat(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*.*?\*\*|\*.*?\*|`[^`]+`)/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parts.push(text.slice(lastIdx, match.index));
    }
    const m = match[0];
    if (m.startsWith("**") && m.endsWith("**")) {
      parts.push(
        <strong key={match.index} className="font-bold text-foreground">
          {m.slice(2, -2)}
        </strong>
      );
    } else if (m.startsWith("*") && m.endsWith("*")) {
      parts.push(<em key={match.index}>{m.slice(1, -1)}</em>);
    } else if (m.startsWith("`") && m.endsWith("`")) {
      parts.push(
        <code
          key={match.index}
          className="px-1 py-0.5 text-xs rounded bg-muted dark:bg-card text-primary dark:text-primary"
          style={{ fontFamily: FONT_FAMILY.mono }}
        >
          {m.slice(1, -1)}
        </code>
      );
    }
    lastIdx = match.index + m.length;
  }

  if (lastIdx < text.length) {
    parts.push(text.slice(lastIdx));
  }

  return parts.length === 0 ? text : <>{parts}</>;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function GeminiAssistant({
  page,
  pageData,
  suggestions = [],
  open,
  onToggle,
  valueStreamId,
}: GeminiAssistantProps) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const assistMut = trpc.gemini.pageAssist.useMutation();

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, assistMut.isPending]);

  // Focus input when panel opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [open]);

  // Cmd+J / Ctrl+J toggle
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "j") {
        e.preventDefault();
        onToggle();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onToggle]);

  const submit = useCallback(
    (text: string) => {
      const q = text.trim();
      if (!q || assistMut.isPending) return;

      const userMsg: ChatMessage = { role: "user", content: q, page };
      const updatedHistory = [...messages, userMsg];
      setMessages(updatedHistory);
      setInput("");

      assistMut.mutate(
        {
          page,
          question: q,
          pageData,
          history: updatedHistory.slice(-8).map(m => ({
            role: m.role,
            content: m.content,
          })),
          valueStreamId,
        },
        {
          onSuccess: data => {
            setMessages(prev => [
              ...prev,
              { role: "assistant", content: data.answer, page },
            ]);
          },
          onError: err => {
            setMessages(prev => [
              ...prev,
              {
                role: "assistant",
                content: `Sorry, I couldn't help right now. (${err.message})`,
                page,
              },
            ]);
          },
        }
      );
    },
    [assistMut, messages, page, pageData]
  );

  // When closed, render nothing — the floating "Ask Gemini" widget in the parent handles opening.
  if (!open) return null;

  // ── Expanded sidebar panel ──
  return (
    <motion.div
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 340, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="hidden lg:flex flex-col shrink-0 h-full border-l border-border/30 dark:border-border/30 bg-background dark:bg-card/95 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/30 dark:border-border/30 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center bg-primary/10 shrink-0">
            <Sparkles className="w-3 h-3 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-foreground leading-none truncate">
              Gemini Assistant
            </p>
            <p className="text-xs text-muted-foreground/60 leading-none mt-0.5 truncate">
              Viewing: {getPageCtx(page).label}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              className="p-1.5 rounded-lg text-muted-foreground/40 hover:text-red-500 dark:hover:text-red-400 transition-colors"
              title="Clear conversation"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
          <button
            onClick={onToggle}
            className="p-1.5 rounded-lg text-muted-foreground/40 hover:text-muted-foreground/60 dark:hover:text-muted-foreground/75 transition-colors"
            title="Close panel (⌘J)"
          >
            <PanelRightClose className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Messages area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0"
      >
        {/* Contextual empty state */}
        {messages.length === 0 &&
          !assistMut.isPending &&
          (() => {
            const ctx = getPageCtx(page);
            const PageIcon = ctx.icon;
            return (
              <div className="space-y-3 pt-2">
                {/* Page context card */}
                <div className="rounded-xl border border-primary/15 dark:border-primary/10 bg-primary/3 dark:bg-primary/5 p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center bg-primary/10 dark:bg-primary/15 shrink-0">
                      <PageIcon className="w-3 h-3 text-primary dark:text-primary" />
                    </div>
                    <p className="text-[11px] font-bold text-primary dark:text-primary">
                      {ctx.headline}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {ctx.desc}
                  </p>
                </div>

                {/* Key actions */}
                {ctx.actions.length > 0 && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground/60 dark:text-muted-foreground/65 px-1 mb-1.5">
                      Key Actions
                    </p>
                    <div className="space-y-1">
                      {ctx.actions.map((a, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-2 px-2.5 py-2 rounded-lg bg-white/60 dark:bg-card border border-border/30 dark:border-border/40"
                        >
                          <a.icon className="w-3 h-3 text-primary dark:text-primary shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-foreground">
                              {a.label}
                            </p>
                            <p className="text-xs text-muted-foreground/60 leading-snug">
                              {a.hint}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quick tips */}
                {ctx.tips.length > 0 && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground/60 dark:text-muted-foreground/65 px-1 mb-1.5">
                      <Lightbulb className="w-2.5 h-2.5 inline mr-0.5 -mt-px" />{" "}
                      Quick Tips
                    </p>
                    <div className="space-y-1">
                      {ctx.tips.map((t, i) => (
                        <p
                          key={i}
                          className="text-xs text-muted-foreground leading-relaxed px-2.5"
                        >
                          <span className="text-amber-500 mr-1">·</span>
                          {t}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Suggestion prompts */}
                {suggestions.length > 0 && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground/60 dark:text-muted-foreground/65 px-1 mb-1.5">
                      Ask me
                    </p>
                    <div className="space-y-1">
                      {suggestions.map((s, i) => (
                        <button
                          key={i}
                          onClick={() => submit(s)}
                          className={cn(
                            "w-full text-left px-3 py-2 rounded-xl text-xs leading-relaxed",
                            "text-foreground dark:text-foreground",
                            "border border-border dark:border-border/50",
                            "kb-duotone-border-hover-strong",
                            "kb-duotone-bg-hover-soft",
                            "transition-all duration-150 group"
                          )}
                        >
                          <ArrowRight className="w-2.5 h-2.5 inline mr-1 text-primary opacity-50 group-hover:opacity-100 transition-opacity" />
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

        {/* Chat messages */}
        {messages.map((msg, i) => {
          // Show page context badge if this message was from a different page
          const prevPage = i > 0 ? messages[i - 1].page : page;
          const showPageSwitch =
            msg.page && msg.page !== prevPage && msg.role === "user";

          return (
            <div key={i}>
              {showPageSwitch && (
                <div className="flex items-center gap-2 py-1">
                  <div className="flex-1 h-px bg-black/5 dark:bg-muted/70" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 dark:text-muted-foreground/65">
                    {getPageCtx(msg.page!).label}
                  </span>
                  <div className="flex-1 h-px bg-black/5 dark:bg-muted/70" />
                </div>
              )}
              <div
                className={cn(
                  "flex",
                  msg.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[88%] px-3 py-2 rounded-2xl",
                    msg.role === "user"
                      ? "bg-primary text-white rounded-br-md"
                      : "bg-card dark:bg-muted/50 border border-border dark:border-border/50 rounded-bl-md"
                  )}
                >
                  {msg.role === "user" ? (
                    <p className="text-[11px] leading-relaxed">{msg.content}</p>
                  ) : (
                    <MiniMarkdown text={msg.content} />
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Loading indicator */}
        {assistMut.isPending && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 px-3 py-2 rounded-2xl rounded-bl-md bg-card dark:bg-muted/50 border border-border dark:border-border/50">
              <Loader2 className="w-3 h-3 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground/60">
                Thinking…
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="px-3 py-2.5 border-t border-black/5 dark:border-border/30 shrink-0">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit(input);
              }
            }}
            placeholder="Ask a question…"
            disabled={assistMut.isPending}
            className={cn(
              "flex-1 px-3 py-2 text-[11px] rounded-xl",
              "bg-card dark:bg-muted/40",
              "border border-border/30 dark:border-border/30",
              "text-foreground dark:text-foreground",
              "placeholder:text-muted-foreground/50 dark:placeholder:text-muted-foreground/45",
              "focus:outline-none focus:ring-2 focus:ring-primary/30",
              "disabled:opacity-50"
            )}
          />
          <button
            onClick={() => submit(input)}
            disabled={!input.trim() || assistMut.isPending}
            className={cn(
              "p-2 rounded-xl transition-all duration-150",
              input.trim() && !assistMut.isPending
                ? "bg-primary text-white hover:bg-primary/90 active:bg-primary/80 shadow-sm"
                : "bg-muted/60 dark:bg-muted/50 text-muted-foreground/40"
            )}
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex items-center justify-between mt-1.5 px-1">
          <p className="text-xs text-muted-foreground/55 dark:text-muted-foreground/50">
            Gemini 2.0 Flash
          </p>
          <p className="text-xs text-muted-foreground/55 dark:text-muted-foreground/50 flex items-center gap-0.5">
            <CornerDownLeft className="w-2.5 h-2.5" /> send · ⌘J toggle
          </p>
        </div>
      </div>
    </motion.div>
  );
}
