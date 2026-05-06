/**
 * ActiveConnectors — Dashboard showing connected sources with live sync status.
 *
 * Displays each active connector as a card with:
 *   - Source type icon & name
 *   - Connection health indicator (green/amber/red pulse)
 *   - Last sync time + next scheduled sync
 *   - Sync stats (files processed, errors, bytes)
 *   - Quick actions (sync now, pause, disconnect)
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  RefreshCw,
  Pause,
  Trash2,
  Play,
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Zap,
  FileText,
  HardDrive,
  ExternalLink,
} from "lucide-react";
import { cn, Progress, useNotifications } from "@hki/ui";
import { trpc } from "@/lib/trpc";
import { k } from "../../theme";
import { SOURCE_TYPES } from "./ConnectorCatalog";

// ── Types ────────────────────────────────────────────────────────────────────

interface ConnectorRow {
  id: string;
  type: string;
  name: string;
  status: "active" | "paused" | "error" | "revoked";
  syncIntervalMinutes: number;
  lastSyncAt: string | null;
  lastSyncStats: {
    filesProcessed?: number;
    filesFailed?: number;
    bytesDownloaded?: number;
    durationMs?: number;
  } | null;
  lastErrorAt: string | null;
  lastErrorMessage: string | null;
  consecutiveErrors: number;
  config: Record<string, unknown>;
  createdAt: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getSourceMeta(type: string) {
  return (
    SOURCE_TYPES.find(s => s.id === type) ?? {
      icon: "🔌",
      name: type,
      bgColor: "bg-muted",
      color: "text-muted-foreground",
    }
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min}m ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function buildGoogleReconnectUrl(connector: ConnectorRow): string | null {
  if (connector.type !== "google_drive") return null;

  const params = new URLSearchParams({
    name: connector.name,
    syncInterval: String(connector.syncIntervalMinutes),
    existingConnectorId: connector.id,
  });

  const folderId =
    typeof connector.config.folderId === "string"
      ? connector.config.folderId
      : "";
  const folderName =
    typeof connector.config.folderName === "string"
      ? connector.config.folderName
      : "";
  const streamId =
    typeof connector.config.streamId === "string"
      ? connector.config.streamId
      : "";
  const streamName =
    typeof connector.config.streamName === "string"
      ? connector.config.streamName
      : "";

  if (folderId) params.set("folderId", folderId);
  if (folderName) params.set("folderName", folderName);
  if (streamId) params.set("streamId", streamId);
  if (streamName) params.set("streamName", streamName);

  return `/api/connectors/google-drive/auth?${params.toString()}`;
}

// ── Single Connector Card ────────────────────────────────────────────────────

function ConnectorCard({
  connector,
  onRefresh,
}: {
  connector: ConnectorRow;
  onRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const meta = getSourceMeta(connector.type);

  const { notify } = useNotifications();
  const syncMut = trpc.connectors.triggerSync.useMutation({
    onSuccess: () => {
      notify({
        title: `Sync started for ${connector.name}`,
        severity: "success",
        group: "connector",
      });
      onRefresh();
    },
    onError: e =>
      notify({
        title: "Sync failed",
        description: e.message,
        severity: "error",
        group: "connector",
      }),
  });

  const updateMut = trpc.connectors.update.useMutation({
    onSuccess: () => {
      onRefresh();
    },
    onError: e =>
      notify({
        title: "Update failed",
        description: e.message,
        severity: "error",
        group: "connector",
      }),
  });

  const deleteMut = trpc.connectors.delete.useMutation({
    onSuccess: () => {
      notify({
        title: `Disconnected ${connector.name}`,
        severity: "info",
        group: "connector",
      });
      onRefresh();
    },
    onError: e =>
      notify({
        title: "Disconnect failed",
        description: e.message,
        severity: "error",
        group: "connector",
      }),
  });

  const isHealthy =
    connector.status === "active" && connector.consecutiveErrors === 0;
  const isWarning =
    connector.status === "active" &&
    connector.consecutiveErrors > 0 &&
    connector.consecutiveErrors < 3;
  const isError =
    connector.status === "error" || connector.consecutiveErrors >= 3;
  const isPaused = connector.status === "paused";
  const requiresReconnect =
    connector.type === "google_drive" && connector.status === "revoked";
  const isSyncing = syncMut.isPending;
  const reconnectUrl = buildGoogleReconnectUrl(connector);

  const stats = connector.lastSyncStats;
  const nextSyncMin = connector.lastSyncAt
    ? Math.max(
        0,
        connector.syncIntervalMinutes -
          Math.floor(
            (Date.now() - new Date(connector.lastSyncAt).getTime()) / 60_000
          )
      )
    : 0;

  return (
    <motion.div
      layout
      className={cn(
        "rounded-xl border overflow-hidden transition-colors",
        isError || requiresReconnect
          ? "border-red-500/30 dark:border-red-400/20 bg-red-500/5"
          : isWarning
            ? "border-primary/30 dark:border-primary/20 bg-primary/5"
            : isPaused
              ? "border-border/30 dark:border-border/30 bg-card dark:bg-card/80"
              : "border-border/30 dark:border-border/30 bg-card dark:bg-card/90"
      )}
    >
      {/* Header row */}
      <div className="flex items-center gap-3 p-4">
        {/* Icon + health dot */}
        <div className="relative shrink-0">
          <div
            className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center text-lg",
              meta.bgColor
            )}
          >
            {meta.icon}
          </div>
          <span
            className={cn(
              "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background",
              isHealthy && "bg-primary",
              isWarning && "bg-primary/80",
              (isError || requiresReconnect) && "bg-red-500",
              isPaused && "bg-muted-foreground/40 dark:bg-white/20"
            )}
          />
        </div>

        {/* Name + status */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-foreground truncate">
              {connector.name}
            </span>
            <span
              className={cn(
                "px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider rounded",
                isHealthy && "kb-duotone-fill",
                isWarning && "bg-primary/10 text-primary",
                (isError || requiresReconnect) &&
                  "bg-red-500/10 text-red-600 dark:text-red-400",
                isPaused &&
                  "bg-muted/60 dark:bg-muted/60 text-muted-foreground/60"
              )}
            >
              {connector.status}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            {connector.lastSyncAt && (
              <span className="text-xs text-muted-foreground/60 flex items-center gap-1">
                <Clock className="w-2.5 h-2.5" />
                Synced {relativeTime(connector.lastSyncAt)}
              </span>
            )}
            {connector.status === "active" && nextSyncMin > 0 && (
              <span className="text-xs text-muted-foreground/50">
                Next in {nextSyncMin}m
              </span>
            )}
          </div>
        </div>

        {/* Quick stats */}
        {stats && (
          <div className="hidden sm:flex items-center gap-3 shrink-0">
            {stats.filesProcessed != null && (
              <div className="text-center">
                <div className="text-xs font-bold text-foreground">
                  {stats.filesProcessed}
                </div>
                <div className="text-xs text-muted-foreground/60">files</div>
              </div>
            )}
            {stats.filesFailed != null && stats.filesFailed > 0 && (
              <div className="text-center">
                <div className="text-xs font-bold text-red-500">
                  {stats.filesFailed}
                </div>
                <div className="text-xs text-muted-foreground/60">errors</div>
              </div>
            )}
            {stats.bytesDownloaded != null && (
              <div className="text-center">
                <div className="text-xs font-bold text-foreground">
                  {formatBytes(stats.bytesDownloaded)}
                </div>
                <div className="text-xs text-muted-foreground/60">data</div>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => syncMut.mutate({ id: connector.id })}
            disabled={isSyncing || isPaused || requiresReconnect}
            className="p-1.5 rounded-lg kb-duotone-icon-hover disabled:opacity-40"
            title="Sync now"
          >
            {isSyncing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            onClick={() =>
              updateMut.mutate({
                id: connector.id,
                status: isPaused ? "active" : "paused",
              })
            }
            disabled={requiresReconnect}
            className="p-1.5 rounded-lg hover:bg-primary/10 text-primary transition-colors"
            title={isPaused ? "Resume" : "Pause"}
          >
            {isPaused ? (
              <Play className="w-3.5 h-3.5" />
            ) : (
              <Pause className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            onClick={() => setExpanded(e => !e)}
            className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-muted-foreground/60 transition-colors"
          >
            {expanded ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Error banner */}
      {(isError || requiresReconnect) && connector.lastErrorMessage && (
        <div className="mx-4 mb-3 px-3 py-2 rounded-lg bg-red-500/5 border border-red-500/15 flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-red-600 dark:text-red-400">
              {requiresReconnect
                ? "Reconnect required"
                : `${connector.consecutiveErrors} consecutive failures`}
            </p>
            <p className="text-xs text-red-500/70 mt-0.5 line-clamp-2">
              {connector.lastErrorMessage}
            </p>
            {requiresReconnect && reconnectUrl ? (
              <button
                type="button"
                onClick={() => {
                  window.location.href = reconnectUrl;
                }}
                className="mt-2 inline-flex items-center gap-1 rounded-lg border border-red-500/20 bg-background px-2.5 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-500/5 dark:bg-card dark:text-red-300"
              >
                <ExternalLink className="h-3 w-3" />
                Reconnect Google Drive
              </button>
            ) : null}
          </div>
        </div>
      )}

      {/* Expanded detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 border-t border-border/50 dark:border-border/40">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-3">
                <div>
                  <div className="text-xs text-muted-foreground/60 mb-0.5">
                    Type
                  </div>
                  <div className="text-xs font-medium text-foreground">
                    {meta.name}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground/60 mb-0.5">
                    Sync Interval
                  </div>
                  <div className="text-xs font-medium text-foreground">
                    Every {connector.syncIntervalMinutes}m
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground/60 mb-0.5">
                    Created
                  </div>
                  <div className="text-xs font-medium text-foreground">
                    {relativeTime(connector.createdAt)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground/60 mb-0.5">
                    Health
                  </div>
                  <div className="flex items-center gap-1">
                    {isHealthy && (
                      <CheckCircle className="w-3 h-3 text-primary" />
                    )}
                    {isWarning && (
                      <AlertTriangle className="w-3 h-3 text-primary" />
                    )}
                    {(isError || requiresReconnect) && (
                      <XCircle className="w-3 h-3 text-red-500" />
                    )}
                    <span className="text-xs font-medium text-foreground">
                      {isHealthy
                        ? "Healthy"
                        : isWarning
                          ? "Degraded"
                          : requiresReconnect
                            ? "Reconnect required"
                            : isError
                              ? "Failing"
                              : "Paused"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Danger zone */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/30 dark:border-border/40">
                <button
                  onClick={() => {
                    if (
                      confirm(
                        `Disconnect "${connector.name}"? This will stop all syncs.`
                      )
                    ) {
                      deleteMut.mutate({ id: connector.id });
                    }
                  }}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                >
                  <Trash2 className="w-3 h-3" /> Disconnect
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

interface ActiveConnectorsProps {
  connectors: ConnectorRow[];
  isLoading?: boolean;
  onRefresh: () => void;
}

export default function ActiveConnectors({
  connectors,
  isLoading,
  onRefresh,
}: ActiveConnectorsProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map(i => (
          <div
            key={i}
            className="h-20 rounded-xl bg-muted/60 dark:bg-muted/30 animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (connectors.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <div className="w-12 h-12 rounded-2xl bg-muted/60 dark:bg-muted/60 flex items-center justify-center mb-3">
          <Zap className="w-6 h-6 text-muted-foreground/40" />
        </div>
        <p className="text-xs text-muted-foreground/60 font-medium">
          No connected sources
        </p>
        <p className="text-xs text-muted-foreground/50 dark:text-muted-foreground mt-0.5">
          Connect a data source above to start syncing knowledge automatically
        </p>
      </div>
    );
  }

  // Summary stats
  const totalFiles = connectors.reduce(
    (sum, c) => sum + (c.lastSyncStats?.filesProcessed ?? 0),
    0
  );
  const totalErrors = connectors.reduce(
    (sum, c) => sum + (c.lastSyncStats?.filesFailed ?? 0),
    0
  );
  const activeCount = connectors.filter(c => c.status === "active").length;
  const errorCount = connectors.filter(
    c =>
      c.status === "error" || c.status === "revoked" || c.consecutiveErrors >= 3
  ).length;

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex items-center gap-4 px-1">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-primary" />
          <span className="text-xs font-medium text-muted-foreground dark:text-muted-foreground/60">
            {activeCount} active
          </span>
        </div>
        {errorCount > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-xs font-medium text-red-500">
              {errorCount} failing
            </span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <FileText className="w-3 h-3 text-muted-foreground/60" />
          <span className="text-xs font-medium text-muted-foreground dark:text-muted-foreground/60">
            {totalFiles} files synced
          </span>
        </div>
        {totalErrors > 0 && (
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-3 h-3 text-primary" />
            <span className="text-xs font-medium text-primary">
              {totalErrors} errors
            </span>
          </div>
        )}
      </div>

      {/* Connector cards */}
      <div className="space-y-2">
        {connectors.map(c => (
          <ConnectorCard key={c.id} connector={c} onRefresh={onRefresh} />
        ))}
      </div>
    </div>
  );
}
