import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Tags,
  Plus,
  Trash2,
  Pencil,
  ChevronRight,
  ChevronDown,
  Loader2,
  FolderTree,
  CheckCircle,
  XCircle,
  Search,
  ArrowRight,
  GripVertical,
  Info,
} from "lucide-react";
import { cn, useNotifications } from "@hki/ui";
import { trpc } from "@/lib/trpc";
import { cardCls } from "../types";
import { k } from "../theme";
import type {
  TaxonomyNode,
  TagValidationResult,
} from "@shared/knowledge-types";

// ── Node tree item ──────────────────────────────────────────────────────────

function TaxonomyNodeRow({
  node,
  depth,
  isExpanded,
  onToggle,
  onSelect,
  isSelected,
}: {
  node: TaxonomyNode;
  depth: number;
  isExpanded: boolean;
  onToggle: (id: string) => void;
  onSelect: (node: TaxonomyNode) => void;
  isSelected: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(node)}
      className={cn(
        "w-full flex items-center gap-2 px-4 py-2.5 text-left transition-colors group",
        isSelected
          ? "bg-primary/8 dark:bg-primary/12"
          : "hover:bg-muted/60/50 dark:hover:bg-card/50"
      )}
      style={{ paddingLeft: `${16 + depth * 24}px` }}
    >
      <button
        type="button"
        onClick={e => {
          e.stopPropagation();
          onToggle(node.id);
        }}
        className="p-0.5 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/60" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60" />
        )}
      </button>
      <Tags
        className={cn(
          "w-3.5 h-3.5 shrink-0",
          isSelected ? "text-primary" : "text-muted-foreground/60"
        )}
      />
      <span
        className={cn(
          "text-[13px] font-medium truncate",
          isSelected ? "text-primary dark:text-primary" : "text-foreground"
        )}
      >
        {node.label}
      </span>
      {node.aliases.length > 0 && (
        <span className="text-xs text-muted-foreground/60 ml-auto shrink-0">
          +{node.aliases.length} aliases
        </span>
      )}
    </button>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export default function TaxonomyTab() {
  const [selectedNode, setSelectedNode] = useState<TaxonomyNode | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({
    label: "",
    description: "",
    aliases: "",
  });
  const [validateInput, setValidateInput] = useState("");
  const [validationResult, setValidationResult] =
    useState<TagValidationResult | null>(null);

  const utils = trpc.useUtils();
  const { notify } = useNotifications();

  // ── Queries ──
  const rootsQ = trpc.knowledge.taxonomyListRoots.useQuery(undefined, {
    retry: false,
  });
  const infoQ = trpc.knowledge.taxonomyInfo.useQuery(undefined, {
    retry: false,
  });

  const childrenQ = trpc.knowledge.taxonomyGetChildren.useQuery(
    { nodeId: selectedNode?.id ?? "" },
    { enabled: !!selectedNode, retry: false }
  );

  // ── Mutations ──
  const createMut = trpc.knowledge.taxonomyCreateNode.useMutation({
    onSuccess: node => {
      notify({
        title: `Created "${node.label}"`,
        severity: "success",
        group: "taxonomy",
      });
      setCreateForm({ label: "", description: "", aliases: "" });
      setShowCreateForm(false);
      utils.knowledge.taxonomyListRoots.invalidate();
      utils.knowledge.taxonomyInfo.invalidate();
    },
    onError: e =>
      notify({
        title: "Create failed",
        description: e.message,
        severity: "error",
        group: "taxonomy",
      }),
  });

  const deleteMut = trpc.knowledge.taxonomyDeleteNode.useMutation({
    onSuccess: result => {
      notify({
        title: `Deleted ${result.deleted} node(s)`,
        severity: "info",
        group: "taxonomy",
      });
      setSelectedNode(null);
      utils.knowledge.taxonomyListRoots.invalidate();
      utils.knowledge.taxonomyInfo.invalidate();
    },
    onError: e =>
      notify({
        title: "Delete failed",
        description: e.message,
        severity: "error",
        group: "taxonomy",
      }),
  });

  const validateMut = trpc.knowledge.taxonomyValidateTags.useMutation({
    onSuccess: result => setValidationResult(result),
    onError: e =>
      notify({
        title: "Validation failed",
        description: e.message,
        severity: "error",
        group: "taxonomy",
      }),
  });

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleCreate = () => {
    if (!createForm.label.trim())
      return notify({ title: "Label is required", severity: "warning" });
    const aliases = createForm.aliases
      .split(",")
      .map(a => a.trim())
      .filter(Boolean);
    createMut.mutate({
      label: createForm.label,
      description: createForm.description || undefined,
      aliases: aliases.length ? aliases : undefined,
      parentId: selectedNode?.id,
    });
  };

  const handleValidate = () => {
    const tags = validateInput
      .split(",")
      .map(t => t.trim())
      .filter(Boolean);
    if (!tags.length)
      return notify({ title: "Enter at least one tag", severity: "warning" });
    validateMut.mutate({ tags });
  };

  const roots = (rootsQ.data ?? []) as TaxonomyNode[];
  const children = (childrenQ.data ?? []) as TaxonomyNode[];
  const info = infoQ.data;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="space-y-5"
    >
      {/* ── Summary stats ── */}
      {info && (
        <div className="flex items-center gap-4">
          {[
            { label: "Total Nodes", value: info.totalNodes },
            { label: "Root Categories", value: info.rootCount },
            { label: "Max Depth", value: info.maxDepth },
          ].map(s => (
            <div
              key={s.label}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/60 dark:bg-muted/60"
            >
              <p className="text-sm font-bold text-foreground tabular-nums">
                {s.value}
              </p>
              <p className="text-xs text-muted-foreground/60 font-medium uppercase tracking-wider">
                {s.label}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* ── Tree browser (3 cols) ── */}
        <div className={cn("lg:col-span-3 overflow-hidden", cardCls)}>
          <div className="border-b border-border/30 dark:border-border/30 px-5 py-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <FolderTree className="w-4 h-4 text-primary" /> Taxonomy Tree
            </h3>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className={k.btnSecondary}
            >
              <Plus className="w-3 h-3" /> Add Node
            </button>
          </div>

          {/* Create form */}
          <AnimatePresence>
            {showCreateForm && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="p-4 bg-primary/5 dark:bg-primary/8 border-b border-primary/10 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      value={createForm.label}
                      onChange={e =>
                        setCreateForm(f => ({ ...f, label: e.target.value }))
                      }
                      placeholder="Label *"
                      className={cn(k.input, "text-xs")}
                    />
                    <input
                      value={createForm.aliases}
                      onChange={e =>
                        setCreateForm(f => ({ ...f, aliases: e.target.value }))
                      }
                      placeholder="Aliases (comma-separated)"
                      className={cn(k.input, "text-xs")}
                    />
                  </div>
                  <input
                    value={createForm.description}
                    onChange={e =>
                      setCreateForm(f => ({
                        ...f,
                        description: e.target.value,
                      }))
                    }
                    placeholder="Description (optional)"
                    className={cn(k.input, "text-xs")}
                  />
                  {selectedNode && (
                    <p className="text-xs text-primary dark:text-primary">
                      Creating as child of:{" "}
                      <strong>{selectedNode.label}</strong>
                    </p>
                  )}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCreate}
                      disabled={createMut.isPending}
                      className={k.btnPrimary}
                    >
                      {createMut.isPending ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Plus className="w-3 h-3" />
                      )}
                      Create
                    </button>
                    <button
                      onClick={() => setShowCreateForm(false)}
                      className={k.btnGhost}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Tree list */}
          {rootsQ.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground/60" />
            </div>
          ) : roots.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <Tags className="w-8 h-8 text-muted-foreground/40 mx-auto" />
              <p className="text-sm font-medium text-foreground">
                No taxonomy nodes yet
              </p>
              <p className="text-xs text-muted-foreground">
                Create your first category to organize and tag content.
              </p>
              <button
                onClick={() => setShowCreateForm(true)}
                className={cn(k.btnPrimary, "text-xs px-4 py-2")}
              >
                Create First Category
              </button>
            </div>
          ) : (
            <div className="divide-y divide-border max-h-125 overflow-y-auto">
              {roots.map(node => (
                <TaxonomyNodeRow
                  key={node.id}
                  node={node}
                  depth={0}
                  isExpanded={expandedIds.has(node.id)}
                  onToggle={toggleExpand}
                  onSelect={setSelectedNode}
                  isSelected={selectedNode?.id === node.id}
                />
              ))}
              {/* Show children of selected node */}
              {selectedNode &&
                expandedIds.has(selectedNode.id) &&
                children.map(child => (
                  <TaxonomyNodeRow
                    key={child.id}
                    node={child}
                    depth={1}
                    isExpanded={expandedIds.has(child.id)}
                    onToggle={toggleExpand}
                    onSelect={setSelectedNode}
                    isSelected={selectedNode?.id === child.id}
                  />
                ))}
            </div>
          )}
        </div>

        {/* ── Detail panel + Validation (2 cols) ── */}
        <div className="lg:col-span-2 space-y-5">
          {/* Node detail */}
          {selectedNode ? (
            <div className={cn("overflow-hidden", cardCls)}>
              <div className="border-b border-border/30 dark:border-border/30 px-5 py-3 flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground">
                  {selectedNode.label}
                </h3>
                <button
                  onClick={() => {
                    if (confirm(`Delete "${selectedNode.label}"?`))
                      deleteMut.mutate({
                        nodeId: selectedNode.id,
                        cascade: true,
                      });
                  }}
                  className="p-1.5 rounded-md text-muted-foreground/60 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="p-5 space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Slug", value: selectedNode.slug },
                    { label: "Sort Order", value: selectedNode.sortOrder },
                    { label: "Parent", value: selectedNode.parentId || "Root" },
                    {
                      label: "Created",
                      value: selectedNode.createdAt
                        ? new Date(selectedNode.createdAt).toLocaleDateString()
                        : "—",
                    },
                  ].map(item => (
                    <div
                      key={item.label}
                      className="p-2.5 rounded-xl bg-muted/60 dark:bg-muted/60"
                    >
                      <p className="text-xs text-muted-foreground/60 uppercase tracking-wider mb-0.5">
                        {item.label}
                      </p>
                      <p className="font-medium text-foreground truncate">
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>
                {selectedNode.description && (
                  <p className="text-muted-foreground">
                    {selectedNode.description}
                  </p>
                )}
                {selectedNode.aliases.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground/60 uppercase tracking-wider mb-1">
                      Aliases
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {selectedNode.aliases.map((a: string) => (
                        <span key={a} className={k.pill}>
                          {a}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className={cn("p-8 text-center", cardCls)}>
              <Info className="w-6 h-6 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground/60">
                Select a node to view details
              </p>
            </div>
          )}

          {/* Tag validation */}
          <div className={cn("overflow-hidden", cardCls)}>
            <div className="border-b border-border/30 dark:border-border/30 px-5 py-3">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-primary" /> Validate Tags
              </h3>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-xs text-muted-foreground/60">
                Check if tags match your taxonomy. Invalid tags will get
                suggestions.
              </p>
              <div className="flex gap-2">
                <input
                  value={validateInput}
                  onChange={e => setValidateInput(e.target.value)}
                  placeholder="returns, membership, electronics"
                  className={cn(k.input, "text-xs flex-1")}
                  onKeyDown={e => e.key === "Enter" && handleValidate()}
                />
                <button
                  onClick={handleValidate}
                  disabled={validateMut.isPending}
                  className={k.btnPrimary}
                >
                  {validateMut.isPending ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Search className="w-3 h-3" />
                  )}
                  Check
                </button>
              </div>

              {validationResult && (
                <div className="space-y-2 pt-2">
                  <div className="flex items-center gap-2">
                    {validationResult.allValid ? (
                      <CheckCircle className="w-4 h-4 text-primary" />
                    ) : (
                      <XCircle className="w-4 h-4 text-amber-500" />
                    )}
                    <span className="text-xs font-medium text-foreground">
                      {validationResult.allValid
                        ? "All tags valid"
                        : `${validationResult.invalid.length} invalid tag(s)`}
                    </span>
                  </div>
                  {validationResult.valid.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {validationResult.valid.map((t: string) => (
                        <span
                          key={t}
                          className="px-2 py-0.5 text-xs font-semibold rounded-full kb-duotone-fill"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                  {validationResult.invalid.length > 0 && (
                    <div className="space-y-1.5">
                      {validationResult.invalid.map((t: string) => (
                        <div key={t} className="flex items-start gap-2">
                          <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-red-500/10 text-red-500 shrink-0">
                            {t}
                          </span>
                          {validationResult.suggestions[t]?.length > 0 && (
                            <div className="flex items-center gap-1 flex-wrap">
                              <ArrowRight className="w-3 h-3 text-muted-foreground/60" />
                              {validationResult.suggestions[t].map(
                                (s: string) => (
                                  <span
                                    key={s}
                                    className="px-1.5 py-0.5 text-xs rounded bg-muted/60 dark:bg-muted/60 text-muted-foreground"
                                  >
                                    {s}
                                  </span>
                                )
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
