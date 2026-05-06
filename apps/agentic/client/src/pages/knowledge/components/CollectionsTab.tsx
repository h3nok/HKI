import { useState } from "react";
import { motion } from "framer-motion";
import { Database, Plus, Trash2, Loader2, FolderOpen, Tag } from "lucide-react";
import { cn, useNotifications } from "@hki/ui";
import { trpc } from "@/lib/trpc";
import { cardCls, surfaceCls } from "../types";
import { k } from "../theme";

interface CollectionsTabProps {
  selectedStream: string;
  streamLabel: string;
}

export default function CollectionsTab({
  selectedStream,
  streamLabel,
}: CollectionsTabProps) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    department: "",
    defaultDocType: "general",
    autoTags: "",
  });

  const utils = trpc.useUtils();

  const collectionsQ = trpc.admin.listCollections.useQuery(
    { valueStreamId: selectedStream },
    { enabled: !!selectedStream, retry: false }
  );

  const { notify } = useNotifications();
  const createMut = trpc.admin.createCollection.useMutation({
    onSuccess: () => {
      notify({
        title: "Collection created",
        severity: "success",
        group: "collections",
      });
      setForm({
        name: "",
        department: "",
        defaultDocType: "general",
        autoTags: "",
      });
      setShowForm(false);
      utils.admin.listCollections.invalidate();
    },
    onError: (e: any) =>
      notify({
        title: "Create failed",
        description: e.message,
        severity: "error",
        group: "collections",
      }),
  });

  const deleteMut = trpc.admin.deleteCollection.useMutation({
    onSuccess: () => {
      notify({
        title: "Collection deleted",
        severity: "info",
        group: "collections",
      });
      utils.admin.listCollections.invalidate();
    },
    onError: (e: any) =>
      notify({
        title: "Delete failed",
        description: e.message,
        severity: "error",
        group: "collections",
      }),
  });

  const handleCreate = () => {
    if (!form.name.trim())
      return notify({
        title: "Collection name is required",
        severity: "warning",
      });
    if (!selectedStream)
      return notify({
        title: "Select a domain first",
        severity: "warning",
      });
    const autoTags = form.autoTags
      .split(",")
      .map(t => t.trim())
      .filter(Boolean);
    createMut.mutate({
      valueStreamId: selectedStream,
      name: form.name.trim(),
      department: form.department.trim() || undefined,
      defaultDocType: (form.defaultDocType || undefined) as any,
      autoTags: autoTags.length ? autoTags : undefined,
    });
  };

  const collections = (collectionsQ.data ?? []) as any[];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Database className="w-4 h-4 text-primary" /> Collections
          </h3>
          <p className="text-xs text-muted-foreground/60 mt-0.5">
            {selectedStream
              ? `Organize knowledge into collections for ${streamLabel}`
              : "Select a domain to manage collections"}
          </p>
        </div>
        {selectedStream && (
          <button
            onClick={() => setShowForm(!showForm)}
            className={k.btnPrimary}
          >
            <Plus className="w-3.5 h-3.5" /> New Collection
          </button>
        )}
      </div>

      {!selectedStream && (
        <div className="border border-dashed border-border/25 dark:border-border/25 rounded-2xl p-8 text-center space-y-2">
          <Database className="w-10 h-10 text-muted-foreground dark:text-muted-foreground/40 mx-auto" />
          <p className="text-sm text-muted-foreground">No domain selected</p>
          <p className="text-xs text-muted-foreground/60">
            Use the domain selector in the header to pick a domain.
          </p>
        </div>
      )}

      {/* ── Create Form ── */}
      {showForm && selectedStream && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className={cn("overflow-hidden", cardCls)}
        >
          <div className="border-b border-border/30 dark:border-border/30 px-5 py-3">
            <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Plus className="w-4 h-4 text-primary" /> New Collection
            </h4>
          </div>
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Name <span className="text-destructive">*</span>
                </label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Pharmacy SOPs"
                  className={k.input}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Department
                </label>
                <input
                  value={form.department}
                  onChange={e =>
                    setForm(f => ({ ...f, department: e.target.value }))
                  }
                  placeholder="e.g. Pharmacy, Operations"
                  className={k.input}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Default Doc Type
                </label>
                <select
                  value={form.defaultDocType}
                  onChange={e =>
                    setForm(f => ({ ...f, defaultDocType: e.target.value }))
                  }
                  className={k.input}
                >
                  {[
                    "general",
                    "policy",
                    "sop",
                    "faq",
                    "training",
                    "report",
                    "memo",
                  ].map(t => (
                    <option key={t} value={t}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Auto-Tags{" "}
                  <span className="text-muted-foreground/50">
                    (comma-separated)
                  </span>
                </label>
                <input
                  value={form.autoTags}
                  onChange={e =>
                    setForm(f => ({ ...f, autoTags: e.target.value }))
                  }
                  placeholder="e.g. sop, compliance"
                  className={k.input}
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={handleCreate}
                disabled={!form.name.trim() || createMut.isPending}
                className={k.btnPrimary}
              >
                {createMut.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Plus className="w-3.5 h-3.5" />
                )}
                Create Collection
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Collections Grid ── */}
      {selectedStream && (
        <>
          {collectionsQ.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground/60" />
            </div>
          ) : collections.length === 0 ? (
            <div className="border border-dashed border-border/25 rounded-2xl p-8 text-center space-y-2">
              <FolderOpen className="w-10 h-10 text-muted-foreground/40 mx-auto" />
              <p className="text-sm font-medium text-foreground">
                No collections yet
              </p>
              <p className="text-xs text-muted-foreground">
                Collections help organize documents by department and type.
              </p>
              <button
                onClick={() => setShowForm(true)}
                className={cn(k.btnPrimary, "text-xs px-4 py-2 mt-2")}
              >
                Create First Collection
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {collections.map((col: any) => (
                <div key={col.id} className={cn("p-4 group", cardCls)}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary/10 shrink-0">
                        <Database className="w-4 h-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-foreground truncate">
                          {col.name}
                        </p>
                        {col.department && (
                          <p className="text-xs text-muted-foreground/60">
                            {col.department}
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        if (confirm(`Delete "${col.name}"?`))
                          deleteMut.mutate({ id: col.id });
                      }}
                      className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
                      title="Delete collection"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1 mt-2">
                    {col.defaultDocType && (
                      <span
                        className={cn(
                          "px-1.5 py-0.5 text-xs font-semibold rounded-full uppercase tracking-wider",
                          surfaceCls,
                          "text-muted-foreground dark:text-muted-foreground/60"
                        )}
                      >
                        {col.defaultDocType}
                      </span>
                    )}
                    {(Array.isArray(col.autoTags)
                      ? col.autoTags
                      : typeof col.autoTags === "string"
                        ? col.autoTags
                            .split(",")
                            .map((t: string) => t.trim())
                            .filter(Boolean)
                        : []
                    ).map((tag: string) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs font-medium rounded-full bg-primary/8 text-primary dark:text-primary"
                      >
                        <Tag className="w-2.5 h-2.5" /> {tag}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}
