/**
 * Domains Page — CRUD for active HKI isolation domains
 *
 * Create, edit, delete domains. Each domain scopes the agent to one
 * authorized business boundary (pharmacy, logistics, legal, etc.).
 */

import { useState, useCallback, useEffect } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Users,
  X,
  Loader2,
  Check,
  Layers,
  Bot,
  Search,
  Shield,
  Brain,
  BookOpen,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Eye,
  MessageSquareWarning,
  FlaskConical,
  Database,
  FolderOpen,
  MessageSquare,
  ArrowRight,
  ArrowLeft,
  Rocket,
  Wrench,
  CreditCard,
  Key,
} from "lucide-react";
import { toast } from "sonner";
import {
  cn,
  HkiTable,
  HkiThead,
  HkiTbody,
  HkiTr,
  HkiTh,
  HKITd,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
  StreamIcon,
  STREAM_ICON_OPTIONS,
  IconAction,
} from "@hki/ui";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { FONT_FAMILY } from "@hki/ui";
import type {
  GuardrailConfig,
  KnowledgeConfig,
  MemoryConfig,
  RetrievalStrategy,
  RuntimeApprovalMode,
  RuntimeExecutionPolicyConfig,
  RuntimeModelTier,
} from "@shared/value-streams";
import { a } from "./theme";
import { AdminPageHeader } from "./components/AdminPageHeader";
import { SettingsButton } from "./components";
import {
  DEFAULT_GUARDRAILS,
  DEFAULT_MEMORY,
  DEFAULT_KNOWLEDGE_CONFIG,
  DEFAULT_RUNTIME_EXECUTION_POLICY,
  normalizeKnowledgeConfig,
} from "@shared/value-streams";

// ── Available tools (from the platform's tool registry) ─────────────────────
const AVAILABLE_TOOLS = [
  {
    id: "search_knowledge",
    name: "Search Knowledge",
    description: "Semantic search against the knowledge base",
    category: "search",
  },
  {
    id: "search_products",
    name: "Search Products",
    description: "Search the retail product catalog",
    category: "search",
  },
  {
    id: "check_inventory",
    name: "Check Inventory",
    description: "Real-time inventory levels by location",
    category: "data",
  },
  {
    id: "get_pricing",
    name: "Get Pricing",
    description: "Retrieve current pricing and promotions",
    category: "data",
  },
  {
    id: "get_member_info",
    name: "Member Lookup",
    description: "Look up member details and history",
    category: "data",
  },
  {
    id: "run_report",
    name: "Run Report",
    description: "Generate analytics reports on demand",
    category: "compute",
  },
];

type FormTab = "identity" | "agent" | "knowledge" | "billing";

interface StreamFormData {
  id: string;
  name: string;
  description: string;
  icon: string;
  sampleQuestions: string[];
  systemPrompt: string;
  retrievalStrategy: RetrievalStrategy;
  enabledTools: string[];
  guardrailConfig: GuardrailConfig;
  memoryConfig: MemoryConfig;
  knowledgeConfig: KnowledgeConfig;
  llmApiKey: string;
}

const EMPTY_FORM: StreamFormData = {
  id: "",
  name: "",
  description: "",
  icon: "building",
  sampleQuestions: [],
  systemPrompt: "",
  retrievalStrategy: "hybrid",
  enabledTools: ["search_knowledge"],
  guardrailConfig: { ...DEFAULT_GUARDRAILS },
  memoryConfig: { ...DEFAULT_MEMORY },
  knowledgeConfig: normalizeKnowledgeConfig(DEFAULT_KNOWLEDGE_CONFIG),
  llmApiKey: "",
};

type RuntimeToolSelectionKey =
  | "sensitiveTools"
  | "requireApprovalTools"
  | "denyTools";

function normalizeRuntimePolicy(
  policy?: Partial<RuntimeExecutionPolicyConfig> | null
): RuntimeExecutionPolicyConfig {
  return {
    ...DEFAULT_RUNTIME_EXECUTION_POLICY,
    ...(policy ?? {}),
    budgets: {
      ...DEFAULT_RUNTIME_EXECUTION_POLICY.budgets,
      ...(policy?.budgets ?? {}),
    },
    toolPermissions: {
      ...DEFAULT_RUNTIME_EXECUTION_POLICY.toolPermissions,
      ...(policy?.toolPermissions ?? {}),
      sensitiveTools:
        policy?.toolPermissions?.sensitiveTools ??
        DEFAULT_RUNTIME_EXECUTION_POLICY.toolPermissions?.sensitiveTools,
      requireApprovalTools:
        policy?.toolPermissions?.requireApprovalTools ??
        DEFAULT_RUNTIME_EXECUTION_POLICY.toolPermissions?.requireApprovalTools,
      denyTools:
        policy?.toolPermissions?.denyTools ??
        DEFAULT_RUNTIME_EXECUTION_POLICY.toolPermissions?.denyTools,
      riskOverrides:
        policy?.toolPermissions?.riskOverrides ??
        DEFAULT_RUNTIME_EXECUTION_POLICY.toolPermissions?.riskOverrides,
    },
    memory: {
      ...DEFAULT_RUNTIME_EXECUTION_POLICY.memory,
      ...(policy?.memory ?? {}),
    },
  };
}

const FILE_TYPE_OPTIONS = [
  { value: "pdf", label: "PDF" },
  { value: "docx", label: "DOCX" },
  { value: "txt", label: "TXT" },
  { value: "csv", label: "CSV" },
  { value: "html", label: "HTML" },
  { value: "md", label: "Markdown" },
  { value: "pptx", label: "PPTX" },
  { value: "xlsx", label: "XLSX" },
];

// ═══════════════════════════════════════════════════════════════════════════════
// Knowledge Tab — collection manager (used inside StreamForm)
// ═══════════════════════════════════════════════════════════════════════════════

const DOC_TYPE_OPTIONS = [
  { value: "general", label: "General" },
  { value: "sop", label: "SOP" },
  { value: "policy", label: "Policy" },
  { value: "faq", label: "FAQ" },
  { value: "training", label: "Training" },
  { value: "product", label: "Product" },
  { value: "report", label: "Report" },
];

function KnowledgeTabContent({
  streamId,
  streamName,
  isEdit,
  setConfirmDialog,
}: {
  streamId: string;
  streamName: string;
  isEdit: boolean;
  setConfirmDialog: (dialog: any) => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDept, setNewDept] = useState("");
  const [newDocType, setNewDocType] = useState("general");
  const [newTags, setNewTags] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const utils = trpc.useUtils();

  const collectionsQ = trpc.admin.listCollections.useQuery(
    { valueStreamId: streamId },
    { enabled: !!streamId && isEdit }
  );

  const createMut = trpc.admin.createCollection.useMutation({
    onSuccess: () => {
      toast.success("Collection added");
      utils.admin.listCollections.invalidate();
      setShowAdd(false);
      setNewName("");
      setNewDept("");
      setNewDocType("general");
      setNewTags("");
      setNewDesc("");
    },
    onError: e => toast.error(e.message),
  });

  const deleteMut = trpc.admin.deleteCollection.useMutation({
    onSuccess: () => {
      toast.success("Collection removed");
      utils.admin.listCollections.invalidate();
    },
    onError: e => toast.error(e.message),
  });

  const inputCls = cn(
    a.field,
    "w-full px-4 py-2.5 text-sm rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all"
  );

  if (!isEdit) {
    return (
      <div
        className={cn(
          a.panelPrimary,
          "p-8 rounded-3xl border-dashed text-center space-y-4"
        )}
      >
        <div
          className={cn(
            a.iconPrimary,
            "w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-2"
          )}
        >
          <BookOpen className="w-8 h-8" />
        </div>
        <p className="text-sm font-semibold text-foreground">
          Knowledge Domain
        </p>
        <p className="text-xs text-muted-foreground/80 max-w-sm mx-auto leading-relaxed">
          Save this domain first, then configure its knowledge collections.
        </p>
      </div>
    );
  }

  const collections = collectionsQ.data ?? [];

  return (
    <div className="space-y-4">
      {/* Header + Open domain link */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">
            Knowledge Collections
          </p>
          <p className="text-[11px] text-muted-foreground">
            {collections.length} collection{collections.length !== 1 ? "s" : ""}{" "}
            assigned — each scopes which documents this domain's agent can
            search.
          </p>
        </div>
        <a
          href={`/knowledge?stream=${streamId}`}
          className={cn(
            a.inset,
            "inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-md transition-colors hover:border-primary/20"
          )}
        >
          <BookOpen className="w-3 h-3" /> Open Domain
          <ExternalLink className="w-2.5 h-2.5 opacity-50" />
        </a>
      </div>

      {/* Collection list */}
      {collections.length > 0 ? (
        <div className="space-y-2">
          {collections.map((c: any) => {
            const tags: string[] = (() => {
              try {
                return c.autoTags ? JSON.parse(c.autoTags) : [];
              } catch {
                return [];
              }
            })();
            return (
              <div
                key={c.id}
                className={cn(
                  a.card,
                  "flex items-start justify-between p-4 rounded-[1.25rem] hover:border-primary/20 hover:shadow-sm hover:-translate-y-0.5 transition-all duration-300 group"
                )}
              >
                <div className="flex items-start gap-3.5 min-w-0">
                  <div
                    className={cn(
                      a.iconPrimary,
                      "p-2 rounded-xl shrink-0 mt-0.5 group-hover:scale-105 transition-transform"
                    )}
                  >
                    <FolderOpen className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">
                      {c.name}
                    </p>
                    {c.description && (
                      <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">
                        {c.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {c.department && (
                        <span
                          className={cn(
                            a.pillNeutral,
                            "px-1.5 py-0.5 text-[9px] font-medium rounded border"
                          )}
                        >
                          dept: {c.department}
                        </span>
                      )}
                      <span
                        className={cn(
                          a.pillPrimary,
                          "px-1.5 py-0.5 text-[9px] font-medium rounded border"
                        )}
                      >
                        {c.defaultDocType || "general"}
                      </span>
                      {tags.map((tag: string) => (
                        <span
                          key={tag}
                          className={cn(
                            a.pillPositive,
                            "px-1.5 py-0.5 text-[9px] font-medium rounded border"
                          )}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() =>
                    setConfirmDialog({
                      title: `Remove "${c.name}"?`,
                      description:
                        "This collection will be unlinked from the domain. Documents remain in the knowledge base.",
                      onConfirm: () => deleteMut.mutate({ id: c.id }),
                    })
                  }
                  className="p-1 rounded text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  title="Remove collection"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div
          className={cn(a.inset, "p-4 rounded-lg border-dashed text-center")}
        >
          <Database className="w-6 h-6 text-muted-foreground/60 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">
            No collections yet. Add one to scope this domain's knowledge.
          </p>
        </div>
      )}

      {/* Add collection form */}
      {showAdd ? (
        <div className={cn(a.panelPrimary, "p-4 rounded-lg space-y-3")}>
          <p className="text-xs font-semibold text-foreground">
            Add Collection
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-medium text-muted-foreground mb-1">
                Name *
              </label>
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="e.g. Pharmacy SOPs"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-muted-foreground mb-1">
                Department filter
              </label>
              <input
                value={newDept}
                onChange={e => setNewDept(e.target.value)}
                placeholder="e.g. pharmacy"
                className={inputCls}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-medium text-muted-foreground mb-1">
                Default doc type
              </label>
              <Select value={newDocType} onValueChange={setNewDocType}>
                <SelectTrigger className="h-10 rounded-xl text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOC_TYPE_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-[10px] font-medium text-muted-foreground mb-1">
                Auto-tags (comma separated)
              </label>
              <input
                value={newTags}
                onChange={e => setNewTags(e.target.value)}
                placeholder="rx, compliance"
                className={inputCls}
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-medium text-muted-foreground mb-1">
              Description
            </label>
            <input
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
              placeholder="What this collection covers"
              className={inputCls}
            />
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => setShowAdd(false)}
              className="px-3 py-1.5 text-xs font-medium rounded-md text-muted-foreground hover:bg-muted"
            >
              Cancel
            </button>
            <button
              disabled={!newName.trim() || createMut.isPending}
              onClick={() => {
                const tags = newTags
                  .split(",")
                  .map(t => t.trim())
                  .filter(Boolean);
                createMut.mutate({
                  valueStreamId: streamId,
                  name: newName.trim(),
                  description: newDesc.trim() || undefined,
                  department: newDept.trim() || undefined,
                  defaultDocType: newDocType as any,
                  autoTags: tags.length ? tags : undefined,
                });
              }}
              className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1.5"
            >
              {createMut.isPending && (
                <Loader2 className="w-3 h-3 animate-spin" />
              )}
              Add Collection
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-dashed border-border hover:border-primary/40 hover:bg-primary/2 transition-colors text-muted-foreground hover:text-primary"
        >
          <Plus className="w-3.5 h-3.5" /> Add Collection
        </button>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Domain Form (create / edit) — tabbed wizard
// ═══════════════════════════════════════════════════════════════════════════════

function StreamForm({
  initial,
  isEdit,
  onSave,
  onCancel,
  isSaving,
  setConfirmDialog,
}: {
  initial: StreamFormData;
  isEdit: boolean;
  onSave: (d: StreamFormData) => void;
  onCancel: () => void;
  isSaving: boolean;
  setConfirmDialog: (dialog: any) => void;
}) {
  const [form, setForm] = useState<StreamFormData>({
    ...initial,
    knowledgeConfig: normalizeKnowledgeConfig(initial.knowledgeConfig),
  });
  const [tab, setTab] = useState<FormTab>("identity");
  const [idManuallyEdited, setIdManuallyEdited] = useState(isEdit);

  const generatePersonaMut = trpc.gemini.generatePersona.useMutation({
    onSuccess: data => {
      if (data.persona) {
        setForm(f => ({ ...f, systemPrompt: data.persona }));
        toast.success("Persona generated");
      }
    },
    onError: e => toast.error(`Gemini: ${e.message}`),
  });
  const inputCls = cn(
    a.field,
    "w-full px-4 py-2.5 text-sm rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all"
  );

  const addQuestion = () => {
    if (form.sampleQuestions.length < 5)
      setForm(f => ({ ...f, sampleQuestions: [...f.sampleQuestions, ""] }));
  };
  const updateQuestion = (idx: number, val: string) => {
    setForm(f => ({
      ...f,
      sampleQuestions: f.sampleQuestions.map((q, i) => (i === idx ? val : q)),
    }));
  };
  const removeQuestion = (idx: number) => {
    setForm(f => ({
      ...f,
      sampleQuestions: f.sampleQuestions.filter((_, i) => i !== idx),
    }));
  };

  const toggleTool = (toolId: string) => {
    setForm(f => ({
      ...f,
      enabledTools: f.enabledTools.includes(toolId)
        ? f.enabledTools.filter(t => t !== toolId)
        : [...f.enabledTools, toolId],
      knowledgeConfig: {
        ...f.knowledgeConfig,
        executionPolicy: normalizeRuntimePolicy({
          ...f.knowledgeConfig.executionPolicy,
          toolPermissions: {
            ...normalizeRuntimePolicy(f.knowledgeConfig.executionPolicy)
              .toolPermissions,
            sensitiveTools: (
              normalizeRuntimePolicy(f.knowledgeConfig.executionPolicy)
                .toolPermissions?.sensitiveTools ?? []
            ).filter(t => t !== toolId),
            requireApprovalTools: (
              normalizeRuntimePolicy(f.knowledgeConfig.executionPolicy)
                .toolPermissions?.requireApprovalTools ?? []
            ).filter(t => t !== toolId),
            denyTools: (
              normalizeRuntimePolicy(f.knowledgeConfig.executionPolicy)
                .toolPermissions?.denyTools ?? []
            ).filter(t => t !== toolId),
          },
        }),
      },
    }));
  };

  const toggleGuardrail = (key: keyof GuardrailConfig) => {
    setForm(f => ({
      ...f,
      guardrailConfig: { ...f.guardrailConfig, [key]: !f.guardrailConfig[key] },
    }));
  };
  const runtimePolicy = normalizeRuntimePolicy(
    form.knowledgeConfig.executionPolicy
  );
  const runtimePolicyTools = AVAILABLE_TOOLS.filter(tool =>
    form.enabledTools.includes(tool.id)
  );

  const toggleRuntimeToolSelection = (
    key: RuntimeToolSelectionKey,
    toolId: string
  ) => {
    setForm(f => {
      const currentPolicy = normalizeRuntimePolicy(
        f.knowledgeConfig.executionPolicy
      );
      const currentValues = currentPolicy.toolPermissions?.[key] ?? [];
      const nextValues = currentValues.includes(toolId)
        ? currentValues.filter(t => t !== toolId)
        : [...currentValues, toolId];
      return {
        ...f,
        knowledgeConfig: {
          ...f.knowledgeConfig,
          executionPolicy: {
            ...currentPolicy,
            toolPermissions: {
              ...currentPolicy.toolPermissions,
              [key]: nextValues,
            },
          },
        },
      };
    });
  };

  const updateRuntimePolicy = (
    patch: Partial<RuntimeExecutionPolicyConfig>
  ) => {
    setForm(f => ({
      ...f,
      knowledgeConfig: {
        ...f.knowledgeConfig,
        executionPolicy: normalizeRuntimePolicy({
          ...normalizeRuntimePolicy(f.knowledgeConfig.executionPolicy),
          ...patch,
          budgets: {
            ...normalizeRuntimePolicy(f.knowledgeConfig.executionPolicy)
              .budgets,
            ...(patch.budgets ?? {}),
          },
          toolPermissions: {
            ...normalizeRuntimePolicy(f.knowledgeConfig.executionPolicy)
              .toolPermissions,
            ...(patch.toolPermissions ?? {}),
          },
          memory: {
            ...normalizeRuntimePolicy(f.knowledgeConfig.executionPolicy).memory,
            ...(patch.memory ?? {}),
          },
        }),
      },
    }));
  };

  const TABS: { key: FormTab; label: string; icon: React.ReactNode }[] = [
    {
      key: "identity",
      label: "Identity",
      icon: <Layers className="w-3.5 h-3.5" />,
    },
    { key: "agent", label: "Agent", icon: <Bot className="w-3.5 h-3.5" /> },
    {
      key: "knowledge",
      label: "Knowledge",
      icon: <BookOpen className="w-3.5 h-3.5" />,
    },
    {
      key: "billing",
      label: "Billing",
      icon: <CreditCard className="w-3.5 h-3.5" />,
    },
  ];
  const activeGuardrailCount = Object.values(form.guardrailConfig).filter(
    Boolean
  ).length;
  const promptLayers = [
    {
      title: "Platform Constitution",
      desc: "Always applied. Defines identity, grounding, citations, and enterprise-wide safety behavior.",
      status: "Platform default",
      icon: <Layers className="w-3.5 h-3.5" />,
    },
    {
      title: "Domain Persona",
      desc: form.systemPrompt
        ? "Custom domain-specific overlay that shapes tone, terminology, and escalation boundaries."
        : "No custom persona saved. The orchestrator will use the scope-aware default overlay for this domain.",
      status: form.systemPrompt ? "Custom override" : "Scope default",
      icon: <Bot className="w-3.5 h-3.5" />,
    },
    {
      title: "Runtime Policy",
      desc: `${runtimePolicy.modelTier || "auto"} tier, planning ${runtimePolicy.enablePlanning === false ? "off" : "on"}, ${String(runtimePolicy.toolPermissions?.approvalMode || "sensitive_only").replace(/_/g, " ")} approvals.`,
      status: "Admin configurable",
      icon: <Shield className="w-3.5 h-3.5" />,
    },
    {
      title: "Working Memory",
      desc: form.memoryConfig.enabled
        ? `Enabled with similarity threshold ${form.memoryConfig.similarityThreshold.toFixed(2)}.`
        : "Disabled for this domain.",
      status: form.memoryConfig.enabled ? "Enabled" : "Disabled",
      icon: <Database className="w-3.5 h-3.5" />,
    },
  ];

  return (
    <Dialog
      open={true}
      onOpenChange={open => {
        if (!open) onCancel();
      }}
    >
      <DialogContent
        className={cn(
          a.card,
          "max-w-3xl p-0 overflow-hidden shadow-2xl sm:rounded-3xl [&>button]:hidden"
        )}
      >
        <div className="flex flex-col max-h-[85vh] h-200">
          {/* Header + tabs */}
          <div className="shrink-0 border-b border-border/50 pt-5 pb-0">
            <div className="flex items-center justify-between mb-4 px-6">
              <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
                {isEdit ? "Edit Domain" : "New Domain"}
              </DialogTitle>
              <button
                onClick={onCancel}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted/80 dark:hover:bg-muted/50 text-muted-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div
              className={cn(
                a.inset,
                "flex gap-1.5 p-1.5 mx-6 mb-4 rounded-xl w-fit"
              )}
            >
              {TABS.map(t => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={cn(
                    "flex items-center gap-2 px-5 py-2 text-[13px] font-semibold rounded-lg transition-all duration-300",
                    tab === t.key
                      ? `${a.card} text-primary shadow-sm ring-1 ring-black/5 dark:ring-white/10`
                      : "bg-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t.icon}
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tab content */}
          <div className="p-6 space-y-5 overflow-y-auto flex-1 min-h-0">
            {/* ── Identity Tab ── */}
            {tab === "identity" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      Display Name <span className="text-destructive">*</span>
                    </label>
                    <input
                      value={form.name}
                      onChange={e => {
                        const name = e.target.value;
                        setForm(f => ({
                          ...f,
                          name,
                          ...(idManuallyEdited
                            ? {}
                            : {
                                id: name
                                  .toLowerCase()
                                  .trim()
                                  .replace(/\s+/g, "-")
                                  .replace(/[^a-z0-9-]/g, ""),
                              }),
                        }));
                      }}
                      placeholder="e.g. Pharmacy Operations"
                      className={inputCls}
                      autoFocus={!isEdit}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      ID <span className="text-destructive">*</span>
                      {!isEdit && !idManuallyEdited && (
                        <span className="text-primary/60 ml-1 font-normal">
                          (auto)
                        </span>
                      )}
                    </label>
                    <input
                      value={form.id}
                      onChange={e => {
                        setIdManuallyEdited(true);
                        setForm(f => ({
                          ...f,
                          id: e.target.value
                            .toLowerCase()
                            .replace(/[^a-z0-9-]/g, ""),
                        }));
                      }}
                      disabled={isEdit}
                      placeholder="e.g. pharmacy-operations"
                      className={cn(inputCls, "disabled:opacity-50")}
                      style={{ fontFamily: FONT_FAMILY.mono }}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Description
                  </label>
                  <textarea
                    value={form.description}
                    onChange={e =>
                      setForm(f => ({ ...f, description: e.target.value }))
                    }
                    placeholder="What does this domain cover?"
                    rows={2}
                    className={cn(inputCls, "resize-none")}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Icon
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {STREAM_ICON_OPTIONS.map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        title={opt.label}
                        onClick={() => setForm(f => ({ ...f, icon: opt.id }))}
                        className={cn(
                          "w-9 h-9 rounded-md flex items-center justify-center transition-all",
                          form.icon === opt.id
                            ? "bg-primary/15 ring-2 ring-primary text-primary"
                            : "bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <opt.Icon size={18} />
                      </button>
                    ))}
                  </div>
                  {form.icon && (
                    <p className="mt-1 text-[11px] text-muted-foreground/60">
                      {STREAM_ICON_OPTIONS.find(o => o.id === form.icon)
                        ?.label ?? form.icon}
                    </p>
                  )}
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-muted-foreground">
                      Sample Questions{" "}
                      <span className="text-muted-foreground/60">
                        (shown on chat welcome screen)
                      </span>
                    </label>
                    {form.sampleQuestions.length < 5 && (
                      <button
                        type="button"
                        onClick={addQuestion}
                        className="text-[10px] font-medium text-primary hover:underline"
                      >
                        + Add
                      </button>
                    )}
                  </div>
                  {form.sampleQuestions.length === 0 && (
                    <p className="text-xs text-muted-foreground/72 italic">
                      No sample questions — prompts will be auto-generated from
                      the description.
                    </p>
                  )}
                  <div className="space-y-1.5">
                    {form.sampleQuestions.map((q, idx) => (
                      <div key={idx} className="flex items-center gap-1.5">
                        <span className="text-[10px] text-muted-foreground/65 w-4 text-right shrink-0">
                          {idx + 1}.
                        </span>
                        <input
                          value={q}
                          onChange={e => updateQuestion(idx, e.target.value)}
                          placeholder="e.g. What are today's fill rates?"
                          className={cn(inputCls, "text-xs")}
                          maxLength={200}
                        />
                        <button
                          type="button"
                          onClick={() => removeQuestion(idx)}
                          className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive shrink-0"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* ── Agent Tab ── */}
            {tab === "agent" && (
              <>
                <div className={cn(a.inset, "p-4 rounded-2xl space-y-3")}>
                  <div>
                    <p className="text-xs font-semibold text-foreground">
                      Prompt Architecture
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                      This form only edits the domain-level persona layer. The
                      orchestrator always adds the platform constitution, tool
                      instructions, runtime policy, and optional working memory
                      at execution time.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {promptLayers.map(layer => (
                      <div
                        key={layer.title}
                        className={cn(a.card, "p-3 rounded-xl")}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                            <span className="text-primary">{layer.icon}</span>
                            {layer.title}
                          </span>
                          <span
                            className={cn(
                              a.pillPrimary,
                              "px-1.5 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wide border"
                            )}
                          >
                            {layer.status}
                          </span>
                        </div>
                        <p className="text-[10px] leading-relaxed text-muted-foreground">
                          {layer.desc}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* System Prompt */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-muted-foreground">
                      System Persona
                    </label>
                    <button
                      type="button"
                      className="flex items-center gap-1 text-[10px] font-medium text-primary hover:underline disabled:opacity-50"
                      title="Generate persona with Gemini"
                      disabled={generatePersonaMut.isPending || !form.name}
                      onClick={() =>
                        generatePersonaMut.mutate({
                          streamName: form.name || form.id,
                          streamDescription: form.description,
                          valueStreamId: form.id || undefined,
                        })
                      }
                    >
                      {generatePersonaMut.isPending ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Sparkles className="w-3 h-3" />
                      )}
                      {generatePersonaMut.isPending
                        ? "Generating..."
                        : "Generate with Gemini"}
                    </button>
                  </div>
                  <textarea
                    value={form.systemPrompt}
                    onChange={e =>
                      setForm(f => ({ ...f, systemPrompt: e.target.value }))
                    }
                    placeholder="You are an expert in [domain]. You help users with [tasks]. Always cite sources and..."
                    rows={4}
                    maxLength={4000}
                    className={cn(
                      inputCls,
                      "resize-none text-xs leading-relaxed"
                    )}
                  />
                  <p className="text-[10px] text-muted-foreground/60 mt-1 text-right">
                    {form.systemPrompt.length} / 4000
                  </p>
                </div>

                {/* Retrieval Strategy */}
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-2">
                    Retrieval Strategy
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      {
                        value: "semantic" as const,
                        label: "Semantic",
                        desc: "Vector similarity search (AlloyDB pgvector)",
                        icon: <Search className="w-4 h-4" />,
                      },
                      {
                        value: "hybrid" as const,
                        label: "Hybrid",
                        desc: "Vector + keyword search for best accuracy",
                        icon: <FlaskConical className="w-4 h-4" />,
                      },
                      {
                        value: "graph" as const,
                        label: "Graph",
                        desc: "Knowledge graph traversal (Neo4j)",
                        icon: <Brain className="w-4 h-4" />,
                      },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() =>
                          setForm(f => ({ ...f, retrievalStrategy: opt.value }))
                        }
                        className={cn(
                          "flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center transition-all",
                          form.retrievalStrategy === opt.value
                            ? `${a.panelPrimary} ring-1 ring-primary/20`
                            : `${a.inset} hover:border-primary/20`
                        )}
                      >
                        <div
                          className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center",
                            form.retrievalStrategy === opt.value
                              ? a.iconPrimary
                              : a.iconNeutral
                          )}
                        >
                          {opt.icon}
                        </div>
                        <span className="text-xs font-semibold">
                          {opt.label}
                        </span>
                        <span className="text-[10px] text-muted-foreground leading-tight">
                          {opt.desc}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Enabled Tools */}
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-2">
                    Enabled Tools
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {AVAILABLE_TOOLS.map(tool => (
                      <button
                        key={tool.id}
                        type="button"
                        onClick={() => toggleTool(tool.id)}
                        className={cn(
                          "flex items-start gap-2.5 p-2.5 rounded-lg border text-left transition-all",
                          form.enabledTools.includes(tool.id)
                            ? a.panelPrimary
                            : `${a.inset} hover:border-primary/20`
                        )}
                      >
                        <div
                          className={cn(
                            "w-4 h-4 rounded border flex items-center justify-center shrink-0 mt-0.5",
                            form.enabledTools.includes(tool.id)
                              ? "bg-primary border-primary text-primary-foreground"
                              : "border-border"
                          )}
                        >
                          {form.enabledTools.includes(tool.id) && (
                            <Check className="w-2.5 h-2.5" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-medium block">
                            {tool.name}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {tool.description}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Guardrails */}
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-2">
                    Guardrails
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      {
                        key: "inputValidation" as const,
                        label: "Input Validation",
                        desc: "Validate user queries",
                        icon: <ShieldCheck className="w-3.5 h-3.5" />,
                      },
                      {
                        key: "outputValidation" as const,
                        label: "Output Validation",
                        desc: "Verify response quality",
                        icon: <Eye className="w-3.5 h-3.5" />,
                      },
                      {
                        key: "piiDetection" as const,
                        label: "PII Detection",
                        desc: "Flag personal information",
                        icon: <Shield className="w-3.5 h-3.5" />,
                      },
                      {
                        key: "toxicityFilter" as const,
                        label: "Toxicity Filter",
                        desc: "Block harmful content",
                        icon: <MessageSquareWarning className="w-3.5 h-3.5" />,
                      },
                    ].map(g => (
                      <button
                        key={g.key}
                        type="button"
                        onClick={() => toggleGuardrail(g.key)}
                        className={cn(
                          "flex items-center gap-2.5 p-2.5 rounded-lg border text-left transition-all",
                          form.guardrailConfig[g.key]
                            ? a.panelPrimary
                            : `${a.inset} hover:border-primary/20`
                        )}
                      >
                        <div
                          className={cn(
                            "w-4 h-4 rounded border flex items-center justify-center shrink-0",
                            form.guardrailConfig[g.key]
                              ? "bg-primary border-primary text-primary-foreground"
                              : "border-border"
                          )}
                        >
                          {form.guardrailConfig[g.key] && (
                            <Check className="w-2.5 h-2.5" />
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-muted-foreground">
                            {g.icon}
                          </span>
                          <div>
                            <span className="text-xs font-medium block">
                              {g.label}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {g.desc}
                            </span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Memory Config */}
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-2">
                    Memory & Caching
                  </label>
                  <div className="p-3 rounded-lg border border-border space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-medium">
                          Cache positive feedback
                        </span>
                        <p className="text-[10px] text-muted-foreground">
                          Thumbs-up responses are cached for faster retrieval of
                          similar queries
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setForm(f => ({
                            ...f,
                            memoryConfig: {
                              ...f.memoryConfig,
                              enabled: !f.memoryConfig.enabled,
                            },
                          }))
                        }
                        className={cn(
                          "relative w-9 h-5 rounded-full transition-colors shrink-0",
                          form.memoryConfig.enabled ? "bg-primary" : "bg-border"
                        )}
                      >
                        <span
                          className={cn(
                            "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform",
                            form.memoryConfig.enabled
                              ? "translate-x-4"
                              : "translate-x-0.5"
                          )}
                        />
                      </button>
                    </div>
                    {form.memoryConfig.enabled && (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] text-muted-foreground">
                            Similarity threshold
                          </span>
                          <span className="text-[10px] font-mono font-medium">
                            {form.memoryConfig.similarityThreshold.toFixed(2)}
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0.5"
                          max="1"
                          step="0.01"
                          value={form.memoryConfig.similarityThreshold}
                          onChange={e =>
                            setForm(f => ({
                              ...f,
                              memoryConfig: {
                                ...f.memoryConfig,
                                similarityThreshold: parseFloat(e.target.value),
                              },
                            }))
                          }
                          className="w-full h-1.5 rounded-full appearance-none bg-muted accent-primary"
                        />
                        <div className="flex justify-between text-[9px] text-muted-foreground/60 mt-0.5">
                          <span>Broader (0.50)</span>
                          <span>Stricter (1.00)</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-2">
                    Runtime Policy
                  </label>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-lg border border-border space-y-3">
                        <div>
                          <p className="text-xs font-semibold text-foreground">
                            Model Routing
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            Choose how aggressively this domain escalates to
                            higher-cost reasoning models.
                          </p>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground block mb-1">
                            Model tier
                          </span>
                          <Select
                            value={
                              (runtimePolicy.modelTier || "auto") as string
                            }
                            onValueChange={(value: string) =>
                              updateRuntimePolicy({
                                modelTier: value as RuntimeModelTier,
                              })
                            }
                          >
                            <SelectTrigger className="h-9 rounded-lg text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="auto">Auto</SelectItem>
                              <SelectItem value="fast">Fast</SelectItem>
                              <SelectItem value="smart">Smart</SelectItem>
                              <SelectItem value="thinking">Thinking</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground block mb-1">
                            Explicit model override
                          </span>
                          <input
                            value={runtimePolicy.model ?? ""}
                            onChange={e =>
                              updateRuntimePolicy({
                                model: e.target.value || undefined,
                              })
                            }
                            placeholder="Optional exact model ID"
                            className={cn(inputCls, "text-xs")}
                          />
                        </div>
                        <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/50 px-3 py-2.5">
                          <div>
                            <span className="text-xs font-medium text-foreground">
                              Planning mode
                            </span>
                            <p className="text-[10px] text-muted-foreground">
                              Let the coordinator emit plans before execution on
                              complex requests.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              updateRuntimePolicy({
                                enablePlanning:
                                  runtimePolicy.enablePlanning === false,
                              })
                            }
                            className={cn(
                              "relative w-9 h-5 rounded-full transition-colors shrink-0",
                              runtimePolicy.enablePlanning === false
                                ? "bg-border"
                                : "bg-primary"
                            )}
                          >
                            <span
                              className={cn(
                                "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform",
                                runtimePolicy.enablePlanning === false
                                  ? "translate-x-0.5"
                                  : "translate-x-4"
                              )}
                            />
                          </button>
                        </div>
                      </div>

                      <div className="p-3 rounded-lg border border-border space-y-3">
                        <div>
                          <p className="text-xs font-semibold text-foreground">
                            Budgets
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            Guardrails for turn depth, tool fan-out, and token
                            spend per request.
                          </p>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <span className="text-[10px] text-muted-foreground block mb-1">
                              Max turns
                            </span>
                            <input
                              type="number"
                              min={1}
                              max={50}
                              value={runtimePolicy.budgets?.maxTurns ?? ""}
                              onChange={e =>
                                updateRuntimePolicy({
                                  budgets: {
                                    maxTurns: e.target.value
                                      ? parseInt(e.target.value, 10)
                                      : undefined,
                                  },
                                })
                              }
                              className={cn(inputCls, "text-xs")}
                            />
                          </div>
                          <div>
                            <span className="text-[10px] text-muted-foreground block mb-1">
                              Max tool calls
                            </span>
                            <input
                              type="number"
                              min={1}
                              max={50}
                              value={runtimePolicy.budgets?.maxToolCalls ?? ""}
                              onChange={e =>
                                updateRuntimePolicy({
                                  budgets: {
                                    maxToolCalls: e.target.value
                                      ? parseInt(e.target.value, 10)
                                      : undefined,
                                  },
                                })
                              }
                              className={cn(inputCls, "text-xs")}
                            />
                          </div>
                          <div>
                            <span className="text-[10px] text-muted-foreground block mb-1">
                              Max tokens
                            </span>
                            <input
                              type="number"
                              min={256}
                              max={200000}
                              step={256}
                              value={runtimePolicy.budgets?.maxTokens ?? ""}
                              onChange={e =>
                                updateRuntimePolicy({
                                  budgets: {
                                    maxTokens: e.target.value
                                      ? parseInt(e.target.value, 10)
                                      : undefined,
                                  },
                                })
                              }
                              className={cn(inputCls, "text-xs")}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-3 rounded-lg border border-border space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold text-foreground">
                            Tool Approval Policy
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            Separate read-only tools from approval-gated and
                            blocked actions for this domain.
                          </p>
                        </div>
                        <div className="w-40">
                          <Select
                            value={
                              (runtimePolicy.toolPermissions?.approvalMode ||
                                "sensitive_only") as string
                            }
                            onValueChange={(value: string) =>
                              updateRuntimePolicy({
                                toolPermissions: {
                                  approvalMode: value as RuntimeApprovalMode,
                                },
                              })
                            }
                          >
                            <SelectTrigger className="h-9 rounded-lg text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="never">Never</SelectItem>
                              <SelectItem value="sensitive_only">
                                Sensitive only
                              </SelectItem>
                              <SelectItem value="always">Always</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {runtimePolicyTools.length > 0 ? (
                        <div className="grid grid-cols-3 gap-3">
                          {[
                            {
                              key: "sensitiveTools" as const,
                              title: "Sensitive",
                              desc: "Shown as sensitive and approval-aware.",
                              tone: "border-sky-500/30 bg-sky-500/5 text-sky-700 dark:text-sky-300",
                            },
                            {
                              key: "requireApprovalTools" as const,
                              title: "Require Approval",
                              desc: "Always pause before execution.",
                              tone: "border-blue-500/30 bg-blue-500/5 text-blue-700 dark:text-blue-300",
                            },
                            {
                              key: "denyTools" as const,
                              title: "Blocked",
                              desc: "Removed from execution for this domain.",
                              tone: "border-rose-500/30 bg-rose-500/5 text-rose-700 dark:text-rose-300",
                            },
                          ].map(group => (
                            <div
                              key={group.key}
                              className={cn(
                                "rounded-xl border p-3 space-y-2",
                                group.tone
                              )}
                            >
                              <div>
                                <p className="text-xs font-semibold">
                                  {group.title}
                                </p>
                                <p className="text-[10px] opacity-80 mt-0.5">
                                  {group.desc}
                                </p>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {runtimePolicyTools.map(tool => {
                                  const active = (
                                    runtimePolicy.toolPermissions?.[
                                      group.key
                                    ] ?? []
                                  ).includes(tool.id);
                                  return (
                                    <button
                                      key={`${group.key}-${tool.id}`}
                                      type="button"
                                      onClick={() =>
                                        toggleRuntimeToolSelection(
                                          group.key,
                                          tool.id
                                        )
                                      }
                                      className={cn(
                                        "px-2 py-1 text-[10px] font-semibold rounded-md border transition-all",
                                        active
                                          ? `${a.inset} border-current`
                                          : "border-current/20 bg-transparent opacity-80 hover:opacity-100"
                                      )}
                                    >
                                      {tool.name}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-[11px] text-muted-foreground">
                          Enable at least one tool above to configure
                          approval-sensitive, blocked, or sensitive tool sets.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ── Knowledge Tab ── */}
            {tab === "knowledge" && (
              <div className="space-y-6">
                {/* ─── Platform Settings (read-only) ─── */}
                <div className="p-4 rounded-2xl border border-border/50 bg-muted/30">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Database className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-foreground">
                        Embedding Model
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        Platform-level setting — applies to all domains
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-2.5 rounded-lg bg-background/60 border border-border/30">
                      <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider mb-0.5">
                        Model
                      </p>
                      <p
                        className="text-xs font-semibold text-foreground"
                        style={{ fontFamily: FONT_FAMILY.mono }}
                      >
                        text-embedding-004
                      </p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-background/60 border border-border/30">
                      <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider mb-0.5">
                        Dimensions
                      </p>
                      <p
                        className="text-xs font-semibold text-foreground"
                        style={{ fontFamily: FONT_FAMILY.mono }}
                      >
                        768
                      </p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-background/60 border border-border/30">
                      <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider mb-0.5">
                        Gateway
                      </p>
                      <p className="text-xs font-semibold text-foreground">
                        AI Gateway
                      </p>
                    </div>
                  </div>
                </div>

                {/* ─── Chunking Settings ─── */}
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-2">
                    Chunking
                  </label>
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] text-muted-foreground">
                            Chunk size (tokens)
                          </span>
                          <span className="text-[10px] font-mono font-medium">
                            {form.knowledgeConfig.chunkSize}
                          </span>
                        </div>
                        <input
                          type="range"
                          min="128"
                          max="2048"
                          step="64"
                          value={form.knowledgeConfig.chunkSize}
                          onChange={e =>
                            setForm(f => ({
                              ...f,
                              knowledgeConfig: {
                                ...f.knowledgeConfig,
                                chunkSize: parseInt(e.target.value),
                              },
                            }))
                          }
                          className="w-full h-1.5 rounded-full appearance-none bg-muted accent-primary"
                        />
                        <div className="flex justify-between text-[9px] text-muted-foreground/50 mt-0.5">
                          <span>128</span>
                          <span>2048</span>
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] text-muted-foreground">
                            Overlap (tokens)
                          </span>
                          <span className="text-[10px] font-mono font-medium">
                            {form.knowledgeConfig.chunkOverlap}
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="256"
                          step="16"
                          value={form.knowledgeConfig.chunkOverlap}
                          onChange={e =>
                            setForm(f => ({
                              ...f,
                              knowledgeConfig: {
                                ...f.knowledgeConfig,
                                chunkOverlap: parseInt(e.target.value),
                              },
                            }))
                          }
                          className="w-full h-1.5 rounded-full appearance-none bg-muted accent-primary"
                        />
                        <div className="flex justify-between text-[9px] text-muted-foreground/50 mt-0.5">
                          <span>0</span>
                          <span>256</span>
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground block mb-1">
                          Strategy
                        </span>
                        <Select
                          value={form.knowledgeConfig.chunkStrategy}
                          onValueChange={(v: string) =>
                            setForm(f => ({
                              ...f,
                              knowledgeConfig: {
                                ...f.knowledgeConfig,
                                chunkStrategy:
                                  v as KnowledgeConfig["chunkStrategy"],
                              },
                            }))
                          }
                        >
                          <SelectTrigger className="h-9 rounded-lg text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sentence">Sentence</SelectItem>
                            <SelectItem value="fixed">Fixed</SelectItem>
                            <SelectItem value="sliding_window">
                              Sliding Window
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ─── Search Tuning ─── */}
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-2">
                    Search Tuning
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-muted-foreground">
                          Similarity threshold
                        </span>
                        <span className="text-[10px] font-mono font-medium">
                          {form.knowledgeConfig.similarityThreshold.toFixed(2)}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={form.knowledgeConfig.similarityThreshold}
                        onChange={e =>
                          setForm(f => ({
                            ...f,
                            knowledgeConfig: {
                              ...f.knowledgeConfig,
                              similarityThreshold: parseFloat(e.target.value),
                            },
                          }))
                        }
                        className="w-full h-1.5 rounded-full appearance-none bg-muted accent-primary"
                      />
                      <div className="flex justify-between text-[9px] text-muted-foreground/50 mt-0.5">
                        <span>Broader</span>
                        <span>Stricter</span>
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-muted-foreground">
                          Vector weight
                        </span>
                        <span className="text-[10px] font-mono font-medium">
                          {form.knowledgeConfig.vectorWeight.toFixed(1)}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={form.knowledgeConfig.vectorWeight}
                        onChange={e => {
                          const v = parseFloat(e.target.value);
                          setForm(f => ({
                            ...f,
                            knowledgeConfig: {
                              ...f.knowledgeConfig,
                              vectorWeight: v,
                              bm25Weight: parseFloat((1 - v).toFixed(1)),
                            },
                          }));
                        }}
                        className="w-full h-1.5 rounded-full appearance-none bg-muted accent-primary"
                      />
                      <div className="flex justify-between text-[9px] text-muted-foreground/50 mt-0.5">
                        <span>Keyword</span>
                        <span>Semantic</span>
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-muted-foreground">
                          Top K / max results
                        </span>
                        <span className="text-[10px] font-mono font-medium">
                          {form.knowledgeConfig.maxResults}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="50"
                        step="1"
                        value={form.knowledgeConfig.maxResults}
                        onChange={e =>
                          setForm(f => ({
                            ...f,
                            knowledgeConfig: {
                              ...f.knowledgeConfig,
                              maxResults: parseInt(e.target.value),
                            },
                          }))
                        }
                        className="w-full h-1.5 rounded-full appearance-none bg-muted accent-primary"
                      />
                      <div className="flex justify-between text-[9px] text-muted-foreground/50 mt-0.5">
                        <span>1</span>
                        <span>50</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ─── Ingestion Rules ─── */}
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-2">
                    Ingestion Rules
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-[10px] text-muted-foreground block mb-1">
                        Max document size
                      </span>
                      <Select
                        value={String(form.knowledgeConfig.maxDocSizeMb)}
                        onValueChange={(v: string) =>
                          setForm(f => ({
                            ...f,
                            knowledgeConfig: {
                              ...f.knowledgeConfig,
                              maxDocSizeMb: parseInt(v),
                            },
                          }))
                        }
                      >
                        <SelectTrigger className="h-9 rounded-lg text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10 MB</SelectItem>
                          <SelectItem value="25">25 MB</SelectItem>
                          <SelectItem value="50">50 MB</SelectItem>
                          <SelectItem value="100">100 MB</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground block mb-1.5">
                        Allowed file types
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {FILE_TYPE_OPTIONS.map(ft => {
                          const isActive =
                            form.knowledgeConfig.allowedFileTypes.includes(
                              ft.value
                            );
                          return (
                            <button
                              key={ft.value}
                              type="button"
                              onClick={() =>
                                setForm(f => ({
                                  ...f,
                                  knowledgeConfig: {
                                    ...f.knowledgeConfig,
                                    allowedFileTypes: isActive
                                      ? f.knowledgeConfig.allowedFileTypes.filter(
                                          t => t !== ft.value
                                        )
                                      : [
                                          ...f.knowledgeConfig.allowedFileTypes,
                                          ft.value,
                                        ],
                                  },
                                }))
                              }
                              className={cn(
                                "px-2.5 py-1 text-[10px] font-semibold rounded-md border transition-all",
                                isActive
                                  ? "border-primary/40 bg-primary/10 text-primary"
                                  : "border-border text-muted-foreground hover:border-primary/20"
                              )}
                            >
                              {ft.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* ─── Divider ─── */}
                <div className="h-px bg-border/40" />

                {/* ─── Collections (existing) ─── */}
                <KnowledgeTabContent
                  streamId={form.id}
                  streamName={form.name}
                  isEdit={isEdit}
                  setConfirmDialog={setConfirmDialog}
                />
              </div>
            )}

            {/* ── Billing Tab ── */}
            {tab === "billing" && (
              <div className="space-y-6">
                <div className="p-4 rounded-2xl border border-border/50 bg-muted/30">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Key className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-foreground">
                        LLM API Key
                      </h4>
                      <p className="text-[11px] text-muted-foreground">
                        Optional per-domain override for AI assist routing and
                        billing
                      </p>
                    </div>
                  </div>
                  <input
                    type="password"
                    value={form.llmApiKey}
                    onChange={e =>
                      setForm(f => ({ ...f, llmApiKey: e.target.value }))
                    }
                    placeholder="sk-... or leave blank for platform default"
                    className={inputCls}
                    autoComplete="off"
                  />
                  <p className="text-[10px] text-muted-foreground/70 mt-2">
                    Leave blank to use the platform&apos;s shared gateway key.
                    KB self-service still works without a domain key; this only
                    overrides AI-assisted helper features that use the shared
                    model gateway.
                  </p>
                  <div className="mt-2">
                    {form.llmApiKey?.trim() ? (
                      <span
                        className={cn(
                          a.pillPrimary,
                          "inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full border"
                        )}
                      >
                        Domain key configured
                      </span>
                    ) : (
                      <span
                        className={cn(
                          a.pillWarning,
                          "inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full border"
                        )}
                      >
                        Using platform default credentials
                      </span>
                    )}
                  </div>
                </div>

                <div className={cn(a.inset, "p-4 rounded-2xl")}>
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className={cn(
                        a.iconPrimary,
                        "w-7 h-7 rounded-lg flex items-center justify-center"
                      )}
                    >
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-foreground">
                        FinOps &amp; Rate Limits
                      </h4>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Domain-level budgets, quotas, and spending controls are
                    managed in the external FinOps surface. Use the API key
                    above only when this domain needs a routing override; leave
                    it blank to inherit platform defaults.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Footer actions */}
          <div className="border-t border-border/60 dark:border-border/40 px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Step indicators */}
              <div className="flex items-center gap-1">
                {TABS.map((t, i) => (
                  <div
                    key={t.key}
                    className={cn(
                      "w-2 h-2 rounded-full transition-colors",
                      tab === t.key ? "bg-primary" : "bg-border"
                    )}
                  />
                ))}
              </div>
              {/* Back button */}
              {tab !== "identity" && (
                <button
                  type="button"
                  onClick={() => {
                    const order: FormTab[] = [
                      "identity",
                      "agent",
                      "knowledge",
                      "billing",
                    ];
                    const idx = order.indexOf(tab);
                    setTab(order[Math.max(0, idx - 1)]);
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md text-muted-foreground hover:bg-muted transition-colors"
                >
                  <ArrowLeft className="w-3 h-3" /> Back
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onCancel}
                className="px-3 py-1.5 text-xs font-medium rounded-md text-muted-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  onSave({
                    ...form,
                    sampleQuestions: form.sampleQuestions.filter(q => q.trim()),
                  })
                }
                disabled={!form.id || !form.name || isSaving}
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
              >
                {isSaving && <Loader2 className="w-3 h-3 animate-spin" />}
                {isEdit ? "Update Domain" : "Create Domain"}
              </button>
              {tab !== "knowledge" && (
                <button
                  type="button"
                  onClick={() =>
                    setTab(tab === "identity" ? "agent" : "knowledge")
                  }
                  disabled={!form.id || !form.name}
                  className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50 flex items-center gap-1.5 transition-colors"
                >
                  Next <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Streams Page
// ═══════════════════════════════════════════════════════════════════════════════

type ConfirmState = {
  title: string;
  description: string;
  onConfirm: () => void;
} | null;

export default function StreamsPage() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<StreamFormData | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmState>(null);
  const utils = trpc.useUtils();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("create") !== "1") return;

    setEditing(null);
    setShowForm(true);
    params.delete("create");
    const nextQuery = params.toString();
    const nextUrl = `${window.location.pathname}${
      nextQuery ? `?${nextQuery}` : ""
    }${window.location.hash}`;
    window.history.replaceState({}, "", nextUrl);
  }, []);

  const parseSafe = useCallback(
    (val: string | null | undefined, fallback: any) => {
      if (!val) return fallback;
      try {
        return JSON.parse(val);
      } catch {
        return fallback;
      }
    },
    []
  );

  const streamsQ = trpc.admin.listValueStreams.useQuery(undefined, {
    retry: false,
  });
  const streamRows = (streamsQ.data ?? []).filter((stream: any) => {
    return stream.id !== "global";
  });
  const liveStreamCount = streamRows.filter((stream: any) => {
    return Boolean(stream.isActive);
  }).length;

  const createMut = trpc.admin.createValueStream.useMutation({
    onSuccess: () => {
      toast.success("Domain created");
      utils.admin.listValueStreams.invalidate();
      setShowForm(false);
    },
    onError: e => toast.error(e.message),
  });
  const updateMut = trpc.admin.updateValueStream.useMutation({
    onSuccess: () => {
      toast.success("Domain updated");
      utils.admin.listValueStreams.invalidate();
      setEditing(null);
    },
    onError: e => toast.error(e.message),
  });
  const deleteMut = trpc.admin.deleteValueStream.useMutation({
    onSuccess: () => {
      toast.success("Domain deleted");
      utils.admin.listValueStreams.invalidate();
    },
    onError: e => toast.error(e.message),
  });

  const handleCreate = useCallback(
    (d: StreamFormData) => {
      createMut.mutate({
        id: d.id,
        name: d.name,
        description: d.description || undefined,
        icon: d.icon,
        sampleQuestions: d.sampleQuestions.length
          ? d.sampleQuestions
          : undefined,
        systemPrompt: d.systemPrompt || undefined,
        retrievalStrategy: d.retrievalStrategy,
        enabledTools: d.enabledTools.length ? d.enabledTools : undefined,
        guardrailConfig: d.guardrailConfig,
        memoryConfig: d.memoryConfig,
        knowledgeConfig: normalizeKnowledgeConfig(d.knowledgeConfig),
        llmApiKey: d.llmApiKey || null,
      });
    },
    [createMut]
  );

  const handleUpdate = useCallback(
    (d: StreamFormData) => {
      updateMut.mutate({
        id: d.id,
        name: d.name,
        description: d.description || undefined,
        icon: d.icon,
        sampleQuestions: d.sampleQuestions,
        systemPrompt: d.systemPrompt || null,
        retrievalStrategy: d.retrievalStrategy,
        enabledTools: d.enabledTools,
        guardrailConfig: d.guardrailConfig,
        memoryConfig: d.memoryConfig,
        knowledgeConfig: normalizeKnowledgeConfig(d.knowledgeConfig),
        llmApiKey: d.llmApiKey || null,
      });
    },
    [updateMut]
  );

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Domains"
        description="Define active HKI domains, signed scope boundaries, system prompts, tool permissions, and knowledge policy for each agent surface in the control plane."
        icon={Layers}
        action={
          <SettingsButton
            onClick={() => setShowForm(true)}
            size="sm"
            variant="brand"
            className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold"
          >
            <Plus className="h-3.5 w-3.5" /> New Domain
          </SettingsButton>
        }
        stats={[
          {
            label: "Configured domains",
            value: String(streamRows.length),
            tone: "primary",
          },
          {
            label: "Live now",
            value: String(liveStreamCount),
            tone: liveStreamCount > 0 ? "positive" : "neutral",
          },
          {
            label: "Global domain",
            value: "1",
            tone: "neutral",
          },
        ]}
      />

      {/* Create form */}
      {showForm && (
        <StreamForm
          initial={{ ...EMPTY_FORM }}
          isEdit={false}
          onSave={handleCreate}
          onCancel={() => setShowForm(false)}
          isSaving={createMut.isPending}
          setConfirmDialog={setConfirmDialog}
        />
      )}

      {/* Edit form */}
      {editing && (
        <StreamForm
          initial={editing}
          isEdit
          onSave={handleUpdate}
          onCancel={() => setEditing(null)}
          isSaving={updateMut.isPending}
          setConfirmDialog={setConfirmDialog}
        />
      )}

      {/* Empty state */}
      {!showForm &&
        !editing &&
        !streamsQ.isLoading &&
        (streamsQ.data ?? []).length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
            <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center">
              <Rocket className="w-10 h-10 text-primary/60" />
            </div>
            <div>
              <p className="text-lg font-bold text-foreground mb-1">
                Create your first Domain
              </p>
              <p className="text-sm text-muted-foreground max-w-md leading-relaxed">
                Domains scope the AI agent to a sealed business boundary. Each
                domain gets its own persona, knowledge base, tools, and
                guardrails.
              </p>
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-6 py-3 text-sm font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/20 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300"
            >
              <Plus className="w-4 h-4" /> New Domain
            </button>
          </div>
        )}

      {/* Domain table */}
      {(streamsQ.isLoading || (streamsQ.data ?? []).length > 0) && (
        <HkiTable loading={streamsQ.isLoading} loadingRows={5} loadingCols={7}>
          <HkiThead sticky>
            <HkiTr noHover>
              <HkiTh>Domain</HkiTh>
              <HkiTh>Description</HkiTh>
              <HkiTh>Agent Config</HkiTh>
              <HkiTh align="center">Users</HkiTh>
              <HkiTh align="center">Status</HkiTh>
              <HkiTh align="right">Actions</HkiTh>
            </HkiTr>
          </HkiThead>
          <HkiTbody>
            {(streamsQ.data ?? []).map((s: any) => {
              const tools: string[] = (() => {
                try {
                  return s.enabledTools ? JSON.parse(s.enabledTools) : [];
                } catch {
                  return [];
                }
              })();
              const guardrails: Record<string, boolean> = (() => {
                try {
                  return s.guardrailConfig ? JSON.parse(s.guardrailConfig) : {};
                } catch {
                  return {};
                }
              })();
              const activeGuardrails =
                Object.values(guardrails).filter(Boolean).length;
              const strategy = s.retrievalStrategy || "hybrid";
              const knowledgeConfig = normalizeKnowledgeConfig(
                parseSafe(s.knowledgeConfig, { ...DEFAULT_KNOWLEDGE_CONFIG })
              );
              const runtimePolicy = normalizeRuntimePolicy(
                knowledgeConfig.executionPolicy
              );

              return (
                <HkiTr key={s.id}>
                  <HKITd>
                    <div className="flex items-center gap-2.5">
                      <span className="text-foreground/70">
                        <StreamIcon id={s.icon} size={22} />
                      </span>
                      <div>
                        <span className="font-semibold text-foreground block">
                          {s.name}
                        </span>
                        <code
                          className="text-[10px] text-muted-foreground/60"
                          style={{ fontFamily: FONT_FAMILY.mono }}
                        >
                          {s.id}
                        </code>
                      </div>
                    </div>
                  </HKITd>
                  <HKITd className="text-muted-foreground text-xs max-w-50">
                    <span className="line-clamp-2">{s.description || "—"}</span>
                  </HKITd>
                  <HKITd>
                    <div className="flex flex-wrap gap-1.5">
                      <span
                        className={cn(
                          "px-1.5 py-0.5 text-[9px] font-semibold rounded-full uppercase tracking-wide",
                          strategy === "hybrid"
                            ? "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                            : strategy === "semantic"
                              ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                              : "bg-slate-500/10 text-slate-600 dark:text-slate-400"
                        )}
                      >
                        {strategy}
                      </span>
                      {tools.length > 0 && (
                        <span className="px-1.5 py-0.5 text-[9px] font-semibold rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center gap-0.5">
                          <Wrench className="w-2.5 h-2.5" /> {tools.length}
                        </span>
                      )}
                      <span
                        className={cn(
                          a.pillNeutral,
                          "px-1.5 py-0.5 text-[9px] font-semibold rounded-full border"
                        )}
                      >
                        {runtimePolicy.modelTier || "auto"}
                      </span>
                      {activeGuardrails > 0 && (
                        <span
                          className={cn(
                            a.pillPrimary,
                            "px-1.5 py-0.5 text-[9px] font-semibold rounded-full border flex items-center gap-0.5"
                          )}
                        >
                          <Shield className="w-2.5 h-2.5" /> {activeGuardrails}
                        </span>
                      )}
                      <span
                        className={cn(
                          a.pillWarning,
                          "px-1.5 py-0.5 text-[9px] font-semibold rounded-full border"
                        )}
                      >
                        {String(
                          runtimePolicy.toolPermissions?.approvalMode ||
                            "sensitive_only"
                        ).replace(/_/g, "-")}
                      </span>
                      <span
                        className={cn(
                          a.pillNeutral,
                          "px-1.5 py-0.5 text-[9px] font-semibold rounded-full border flex items-center gap-0.5"
                        )}
                      >
                        <Layers className="w-2.5 h-2.5" /> layered
                      </span>
                      <span
                        className={cn(
                          a.pillPrimary,
                          "px-1.5 py-0.5 text-[9px] font-semibold rounded-full border flex items-center gap-0.5"
                        )}
                      >
                        <Bot className="w-2.5 h-2.5" />{" "}
                        {s.systemPrompt ? "custom-persona" : "default-persona"}
                      </span>
                      {(s as any).llmApiKey ? (
                        <span
                          className={cn(
                            a.pillPrimary,
                            "px-1.5 py-0.5 text-[9px] font-semibold rounded-full border"
                          )}
                        >
                          stream-key
                        </span>
                      ) : (
                        <span
                          className={cn(
                            a.pillWarning,
                            "px-1.5 py-0.5 text-[9px] font-semibold rounded-full border"
                          )}
                        >
                          platform-key
                        </span>
                      )}
                    </div>
                  </HKITd>
                  <HKITd className="text-center">
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Users className="w-3 h-3" /> {s.userCount}
                    </span>
                  </HKITd>
                  <HKITd className="text-center">
                    <span
                      className={cn(
                        "px-2 py-0.5 text-[10px] font-semibold rounded-full uppercase tracking-wider border",
                        s.isActive ? a.pillPositive : a.pillNeutral
                      )}
                    >
                      {s.isActive ? "Active" : "Inactive"}
                    </span>
                  </HKITd>
                  <HKITd className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <IconAction
                        icon={<MessageSquare />}
                        label="Launch Chat"
                        variant="primary"
                        href={`/chat?scope=${s.id}`}
                      />
                      <IconAction
                        icon={<BookOpen />}
                        label="Open Domain"
                        variant="success"
                        href={`/knowledge?stream=${s.id}`}
                      />
                      <IconAction
                        icon={<Pencil />}
                        label="Edit"
                        variant="default"
                        onClick={() => {
                          setEditing({
                            id: s.id,
                            name: s.name,
                            description: s.description || "",
                            icon: s.icon,
                            sampleQuestions: parseSafe(s.sampleQuestions, []),
                            systemPrompt: s.systemPrompt || "",
                            retrievalStrategy: s.retrievalStrategy || "hybrid",
                            enabledTools: parseSafe(s.enabledTools, [
                              "search_knowledge",
                            ]),
                            guardrailConfig: parseSafe(s.guardrailConfig, {
                              ...DEFAULT_GUARDRAILS,
                            }),
                            memoryConfig: parseSafe(s.memoryConfig, {
                              ...DEFAULT_MEMORY,
                            }),
                            knowledgeConfig: normalizeKnowledgeConfig(
                              parseSafe(s.knowledgeConfig, {
                                ...DEFAULT_KNOWLEDGE_CONFIG,
                              })
                            ),
                            llmApiKey: (s as any).llmApiKey || "",
                          });
                        }}
                      />
                      {s.id !== "global" && (
                        <IconAction
                          icon={<Trash2 />}
                          label="Delete"
                          variant="destructive"
                          onClick={() =>
                            setConfirmDialog({
                              title: `Delete "${s.name}"?`,
                              description:
                                "All users will be unassigned from this domain. This action cannot be undone.",
                              onConfirm: () => deleteMut.mutate({ id: s.id }),
                            })
                          }
                        />
                      )}
                    </div>
                  </HKITd>
                </HkiTr>
              );
            })}
          </HkiTbody>
        </HkiTable>
      )}

      {/* Styled confirmation dialog — replaces native confirm() */}
      <Dialog
        open={!!confirmDialog}
        onOpenChange={open => {
          if (!open) setConfirmDialog(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{confirmDialog?.title}</DialogTitle>
            <DialogDescription>{confirmDialog?.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex justify-end gap-2 pt-2">
            <DialogClose asChild>
              <button className="px-4 py-2 text-sm rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors">
                Cancel
              </button>
            </DialogClose>
            <button
              onClick={() => {
                confirmDialog?.onConfirm();
                setConfirmDialog(null);
              }}
              className="px-4 py-2 text-sm rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 font-semibold transition-colors"
            >
              Delete
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
