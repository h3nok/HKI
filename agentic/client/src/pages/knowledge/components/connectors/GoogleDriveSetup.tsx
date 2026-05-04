/**
 * GoogleDriveSetup — Guided connection flow for Google Drive.
 *
 * Step 1: Name your connector + optional folder URL
 * Step 2: Click "Connect with Google" → opens OAuth redirect
 * Step 3: After callback, shows success state
 *
 * This component renders inline (not a modal) within the Sources tab.
 */

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ExternalLink,
  FolderOpen,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Clock,
  Shield,
} from "lucide-react";
import { cn } from "@hki/ui";

// ── Tokens ───────────────────────────────────────────────────────────────────
const t1 = "text-foreground";
const t2 = "text-muted-foreground dark:text-muted-foreground/60";
const t3 = "text-muted-foreground/70 dark:text-muted-foreground/45";
const card =
  "rounded-2xl bg-card dark:bg-card/70 border border-border/40 dark:border-border/30";
const inputCls = cn(
  "w-full px-3 py-2 rounded-lg text-sm border transition-colors",
  "border-border/40 dark:border-border/70 bg-background dark:bg-muted/50",
  "text-foreground placeholder:text-muted-foreground/50",
  "focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
);

interface GoogleDriveSetupProps {
  streamName?: string;
  streamId?: string;
  onBack: () => void;
  onConnected?: (connectorId: string) => void;
}

function getOAuthErrorMessage(error: string): string {
  switch (error) {
    case "access_denied":
      return "Google Drive access was denied. Retry the connection when you are ready to grant read-only access.";
    case "missing_refresh_token":
      return "Google did not return a refresh token, so background sync cannot run. Reconnect and approve the consent screen again, or revoke the existing app access in Google before retrying.";
    case "expired_state":
      return "The Google Drive connection session expired before OAuth completed. Start the connection again.";
    case "invalid_callback":
      return "Google returned an incomplete callback. Retry the connection flow.";
    case "no_access_token":
      return "Google did not return an access token. Retry the connection flow.";
    case "db_unavailable":
      return "The connector could not be saved because the application database is unavailable.";
    case "oauth_failed":
      return "Google Drive OAuth failed before the connector could be created. Retry the connection flow.";
    default:
      return `Google Drive connection failed: ${error}`;
  }
}

// Parse folder ID from a Google Drive URL
function parseFolderIdFromUrl(
  url: string
): { folderId: string; folderName: string } | null {
  if (!url.trim()) return null;
  try {
    const u = new URL(url);
    // https://drive.google.com/drive/folders/FOLDER_ID
    const match = u.pathname.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    if (match) return { folderId: match[1], folderName: "" };
  } catch {
    // If it's not a URL, treat it as a raw folder ID
    if (/^[a-zA-Z0-9_-]{10,}$/.test(url.trim())) {
      return { folderId: url.trim(), folderName: "" };
    }
  }
  return null;
}

export default function GoogleDriveSetup({
  streamName,
  streamId,
  onBack,
  onConnected,
}: GoogleDriveSetupProps) {
  const [name, setName] = useState(
    streamName ? `${streamName} — Google Drive` : "Google Drive"
  );
  const [folderUrl, setFolderUrl] = useState("");
  const [syncInterval, setSyncInterval] = useState(30);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);

  // Check for OAuth callback results in URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connected");
    const connectorId = params.get("connectorId");
    const error = params.get("error");

    if (connected === "google_drive" && connectorId) {
      setOauthError(null);
      onConnected?.(connectorId);
      // Clean up URL params
      const url = new URL(window.location.href);
      url.searchParams.delete("connected");
      url.searchParams.delete("connectorId");
      window.history.replaceState({}, "", url.toString());
    }

    if (error) {
      setOauthError(getOAuthErrorMessage(error));
      setIsRedirecting(false);
      // Clean up URL params
      const url = new URL(window.location.href);
      url.searchParams.delete("error");
      window.history.replaceState({}, "", url.toString());
    }
  }, [onConnected]);

  const handleConnect = () => {
    setOauthError(null);
    setIsRedirecting(true);

    // Build the OAuth initiation URL with connector config as query params
    const params = new URLSearchParams({
      name: name.trim() || "Google Drive",
      syncInterval: String(syncInterval),
    });

    if (streamId) params.set("streamId", streamId);
    if (streamName) params.set("streamName", streamName);

    const folder = parseFolderIdFromUrl(folderUrl);
    if (folder) {
      params.set("folderId", folder.folderId);
      if (folder.folderName) params.set("folderName", folder.folderName);
    }

    // Redirect to the OAuth initiation endpoint
    window.location.href = `/api/connectors/google-drive/auth?${params.toString()}`;
  };

  const folder = parseFolderIdFromUrl(folderUrl);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onBack}
          className="p-1.5 -ml-1.5 rounded-lg hover:bg-black/4 dark:hover:bg-white/4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-muted-foreground/60" />
        </button>
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-[#4285F4]/10 flex items-center justify-center text-lg">
            📁
          </div>
          <div>
            <h2 className={cn("text-sm font-bold", t1)}>
              Connect Google Drive
            </h2>
            <p className={cn("text-[11px]", t2)}>
              Grant read-only access to sync documents automatically
            </p>
          </div>
        </div>
      </div>

      {/* Setup form */}
      <div className={cn("p-5", card)}>
        {oauthError && (
          <div className="mb-5 rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2.5">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
              <p className="text-xs leading-relaxed text-red-600 dark:text-red-300">
                {oauthError}
              </p>
            </div>
          </div>
        )}

        {/* Step 1: Connector name */}
        <div className="mb-5">
          <label className={cn("block text-xs font-semibold mb-1.5", t1)}>
            Connection name
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Pharmacy SOPs — Google Drive"
            className={inputCls}
          />
          <p className={cn("text-xs mt-1", t3)}>
            A label to identify this connection in your sources list
          </p>
        </div>

        {/* Step 2: Folder (optional) */}
        <div className="mb-5">
          <label className={cn("block text-xs font-semibold mb-1.5", t1)}>
            Folder URL or ID
            <span className={cn("font-normal ml-1", t3)}>(optional)</span>
          </label>
          <div className="relative">
            <FolderOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
            <input
              type="text"
              value={folderUrl}
              onChange={e => setFolderUrl(e.target.value)}
              placeholder="https://drive.google.com/drive/folders/..."
              className={cn(inputCls, "pl-9")}
            />
          </div>
          {folderUrl && folder && (
            <p className="text-xs mt-1 text-primary flex items-center gap-1">
              <CheckCircle className="w-3 h-3" /> Folder ID:{" "}
              {folder.folderId.slice(0, 20)}...
            </p>
          )}
          {folderUrl && !folder && (
            <p className="text-xs mt-1 text-amber-500 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Could not parse folder ID
              from URL
            </p>
          )}
          {!folderUrl && (
            <p className={cn("text-xs mt-1", t3)}>
              Leave empty to sync your entire Drive. You can restrict to a
              folder later.
            </p>
          )}
        </div>

        {/* Step 3: Sync interval */}
        <div className="mb-6">
          <label className={cn("block text-xs font-semibold mb-1.5", t1)}>
            Sync frequency
          </label>
          <div className="flex items-center gap-2">
            {([15, 30, 60, 360] as const).map(mins => (
              <button
                key={mins}
                onClick={() => setSyncInterval(mins)}
                className={cn(
                  "flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-colors",
                  syncInterval === mins
                    ? "kb-duotone-chip-border"
                    : "border-border/40 dark:border-border/30 text-muted-foreground dark:text-muted-foreground/60 hover:border-border/70 dark:hover:border-white/10"
                )}
              >
                <Clock className="w-3 h-3" />
                {mins < 60 ? `${mins}m` : `${mins / 60}h`}
              </button>
            ))}
          </div>
        </div>

        {/* Permissions explainer */}
        <div className="mb-6 p-3 rounded-xl bg-primary/5 dark:bg-primary/8 border border-primary/10">
          <div className="flex items-start gap-2.5">
            <Shield className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <div>
              <p className={cn("text-xs font-semibold", t1)}>
                What access will be granted?
              </p>
              <ul className="mt-1.5 space-y-1">
                <li className={cn("text-[11px] leading-relaxed", t2)}>
                  <strong className={t1}>Read-only</strong> — we can view and
                  download files, but never modify or delete anything
                </li>
                <li className={cn("text-[11px] leading-relaxed", t2)}>
                  <strong className={t1}>Folder-targeted</strong> — Agentic will
                  only sync the folder you configure here, or your full Drive if
                  you leave it blank
                </li>
                <li className={cn("text-[11px] leading-relaxed", t2)}>
                  <strong className={t1}>Disconnectable</strong> — disconnecting
                  here stops local syncs and attempts to revoke the stored
                  Google connector token automatically
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Connect button */}
        <button
          onClick={handleConnect}
          disabled={isRedirecting || !name.trim()}
          className={cn(
            "w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-sm transition-all",
            "bg-[#4285F4] hover:bg-[#3275E4] active:bg-[#2A65D4] text-white",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "shadow-sm hover:shadow-md hover:shadow-[#4285F4]/10"
          )}
        >
          {isRedirecting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Redirecting to Google...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#fff"
                  fillOpacity=".8"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#fff"
                  fillOpacity=".8"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 001 12c0 1.77.42 3.44 1.18 4.93l3.66-2.84z"
                  fill="#fff"
                  fillOpacity=".8"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#fff"
                  fillOpacity=".8"
                />
              </svg>
              Connect with Google
              <ExternalLink className="w-3 h-3 opacity-60" />
            </>
          )}
        </button>
      </div>

      {/* SOP Steps */}
      <div className="mt-5">
        <p
          className={cn(
            "text-xs font-semibold uppercase tracking-wider mb-2",
            t3
          )}
        >
          How it works
        </p>
        <div className="space-y-2">
          {[
            {
              step: "1",
              label: "Authorize",
              desc: "You'll be redirected to Google to grant read-only access",
            },
            {
              step: "2",
              label: "Select scope",
              desc: "Google shows which account and what permissions are requested",
            },
            {
              step: "3",
              label: "Auto-sync",
              desc: "Files are indexed automatically on your chosen schedule",
            },
          ].map(s => (
            <div key={s.step} className="flex items-start gap-2.5">
              <span
                className={cn(
                  "w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5",
                  "kb-duotone-fill"
                )}
              >
                {s.step}
              </span>
              <div>
                <p className={cn("text-xs font-semibold", t1)}>{s.label}</p>
                <p className={cn("text-[11px]", t2)}>{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
