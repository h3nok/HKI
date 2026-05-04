/**
 * Google Drive Sync Worker
 *
 * Performs the actual work of syncing files from a Google Drive folder
 * into the knowledge pipeline. Uses stored OAuth refresh tokens from
 * the connector record to:
 *
 *   1. Authenticate with Google Drive API
 *   2. List all files in the configured folder (recursively if enabled)
 *   3. Download each supported file
 *   4. POST to the pipeline service's /v1/ingest/file endpoint
 *   5. Update the sync record with progress
 *
 * Supported file types:
 *   PDF, DOCX, TXT, CSV, Markdown, Google Docs (exported as text),
 *   Google Sheets (exported as CSV)
 */

import { OAuth2Client } from "google-auth-library";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { createLogger } from "../_core/logger";
import {
  knowledgeConnectors,
  knowledgeConnectorSyncs,
} from "../../drizzle/schema";

// ── Config ───────────────────────────────────────────────────────────────────

const log = createLogger("gdrive-sync");

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";

// Import centralized URL from service-client
import { KNOWLEDGE_PIPELINE_URL as PIPELINE_URL } from "../service-client";

// Mime types we can ingest
const SUPPORTED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
  "text/markdown",
]);

// Google Workspace types → export as
const GOOGLE_EXPORT_MAP: Record<string, { mime: string; ext: string }> = {
  "application/vnd.google-apps.document": { mime: "text/plain", ext: "txt" },
  "application/vnd.google-apps.spreadsheet": { mime: "text/csv", ext: "csv" },
};

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  parents?: string[];
}

interface SyncProgress {
  filesDiscovered: number;
  filesProcessed: number;
  filesFailed: number;
  filesSkipped: number;
  bytesDownloaded: number;
  apiCalls: number;
  errors: string[];
}

export function buildDriveSourceRef(fileId: string): string {
  return `google-drive:${fileId}`;
}

function isRevokedDriveCredentialError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("invalid_grant") ||
    normalized.includes("token has been expired or revoked") ||
    normalized.includes("invalid credentials") ||
    normalized.includes("unauthorized_client") ||
    normalized.includes("reauth")
  );
}

// ── OAuth Helper ─────────────────────────────────────────────────────────────

function createOAuthClient(credentials: {
  access_token: string;
  refresh_token: string | null;
  expiry_date: number | null;
}): OAuth2Client {
  const client = new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
  client.setCredentials({
    access_token: credentials.access_token,
    refresh_token: credentials.refresh_token ?? undefined,
    expiry_date: credentials.expiry_date ?? undefined,
  });
  return client;
}

async function getAccessToken(client: OAuth2Client): Promise<string> {
  const { token } = await client.getAccessToken();
  if (!token) throw new Error("Failed to obtain access token from Google");
  return token;
}

// ── Drive API Helpers ────────────────────────────────────────────────────────

async function listDriveFiles(
  accessToken: string,
  folderId: string | null,
  includeSubfolders: boolean,
  progress: SyncProgress
): Promise<DriveFile[]> {
  const allFiles: DriveFile[] = [];
  const foldersToScan = [folderId || "root"];

  while (foldersToScan.length > 0) {
    const currentFolder = foldersToScan.shift()!;

    // Build query: files in this folder, not trashed
    const q = `'${currentFolder}' in parents and trashed = false`;
    let pageToken: string | undefined;

    do {
      const params = new URLSearchParams({
        q,
        fields:
          "nextPageToken, files(id, name, mimeType, size, modifiedTime, parents)",
        pageSize: "100",
        orderBy: "modifiedTime desc",
        supportsAllDrives: "true",
        includeItemsFromAllDrives: "true",
      });
      if (pageToken) params.set("pageToken", pageToken);

      const resp = await fetch(
        `https://www.googleapis.com/drive/v3/files?${params}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      progress.apiCalls++;

      if (!resp.ok) {
        const err = await resp.text();
        throw new Error(`Drive API error (${resp.status}): ${err}`);
      }

      const data = await resp.json();
      const files: DriveFile[] = data.files || [];

      for (const file of files) {
        // If it's a folder and we're recursive, queue it
        if (file.mimeType === "application/vnd.google-apps.folder") {
          if (includeSubfolders) {
            foldersToScan.push(file.id);
          }
          continue;
        }

        // Check if it's a type we can ingest
        if (
          SUPPORTED_MIME_TYPES.has(file.mimeType) ||
          file.mimeType in GOOGLE_EXPORT_MAP
        ) {
          allFiles.push(file);
        }
      }

      pageToken = data.nextPageToken;
    } while (pageToken);
  }

  return allFiles;
}

async function downloadDriveFile(
  accessToken: string,
  file: DriveFile,
  progress: SyncProgress
): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
  let url: string;
  let filename = file.name;
  let contentType = file.mimeType;

  // Google Workspace types need export
  if (file.mimeType in GOOGLE_EXPORT_MAP) {
    const exportInfo = GOOGLE_EXPORT_MAP[file.mimeType];
    url = `https://www.googleapis.com/drive/v3/files/${file.id}/export?mimeType=${encodeURIComponent(exportInfo.mime)}&supportsAllDrives=true`;
    filename = `${file.name}.${exportInfo.ext}`;
    contentType = exportInfo.mime;
  } else {
    url = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&supportsAllDrives=true`;
  }

  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  progress.apiCalls++;

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(
      `Download failed for "${file.name}" (${resp.status}): ${err}`
    );
  }

  const arrayBuffer = await resp.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  progress.bytesDownloaded += buffer.length;

  return { buffer, filename, contentType };
}

// ── Pipeline Upload Helper ───────────────────────────────────────────────────

async function uploadToPipeline(
  buffer: Buffer,
  filename: string,
  contentType: string,
  authToken: string,
  metadata: {
    title: string;
    department: string;
    documentType: string;
    tags: string;
    sourceRef: string;
    streamId?: string | null;
    connectorId: string;
    syncId: string;
  }
): Promise<{ success: boolean; jobId?: string; error?: string }> {
  // Build multipart/form-data manually
  const boundary = `----FormBoundary${Date.now()}`;
  const parts: Buffer[] = [];

  // File part
  parts.push(
    Buffer.from(
      `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
        `Content-Type: ${contentType}\r\n\r\n`
    )
  );
  parts.push(buffer);
  parts.push(Buffer.from("\r\n"));

  // Form field helper
  const addField = (name: string, value: string) => {
    parts.push(
      Buffer.from(
        `--${boundary}\r\n` +
          `Content-Disposition: form-data; name="${name}"\r\n\r\n` +
          `${value}\r\n`
      )
    );
  };

  addField("title", metadata.title);
  addField("department", metadata.department);
  addField("document_type", metadata.documentType);
  addField("tags", metadata.tags);
  addField("source_ref", metadata.sourceRef);
  if (metadata.streamId) addField("stream_id", metadata.streamId);

  // Closing boundary
  parts.push(Buffer.from(`--${boundary}--\r\n`));
  const body = Buffer.concat(parts);

  try {
    const { getGoogleIdToken } = await import("../service-client");
    const idToken = await getGoogleIdToken(PIPELINE_URL);
    const pipelineHeaders: Record<string, string> = {
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
      "X-Service-Auth": `Bearer ${authToken}`,
    };
    if (idToken) {
      pipelineHeaders["Authorization"] = `Bearer ${idToken}`;
    } else {
      pipelineHeaders["Authorization"] = `Bearer ${authToken}`;
    }
    const resp = await fetch(`${PIPELINE_URL}/v1/ingest/file`, {
      method: "POST",
      headers: pipelineHeaders,
      body,
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return {
        success: false,
        error: `Pipeline ${resp.status}: ${errText.slice(0, 200)}`,
      };
    }

    const result = await resp.json();
    return { success: true, jobId: result.job_id };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ── Main Sync Function ──────────────────────────────────────────────────────

export interface SyncOptions {
  connectorId: string;
  syncId: string;
  credentials: {
    access_token: string;
    refresh_token: string | null;
    expiry_date: number | null;
  };
  config: {
    folderId: string | null;
    folderName: string;
    includeSubfolders: boolean;
    mimeTypes?: string[];
    streamId?: string | null;
  };
  authToken: string;
  department?: string;
  /** Stored change token for incremental sync — null means full scan */
  lastSyncToken?: string | null;
}

// ── Incremental Sync via Drive Changes API ──────────────────────────────────

async function getStartPageToken(accessToken: string): Promise<string> {
  const resp = await fetch(
    "https://www.googleapis.com/drive/v3/changes/startPageToken?supportsAllDrives=true",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!resp.ok) throw new Error(`Failed to get startPageToken: ${resp.status}`);
  const data = await resp.json();
  return data.startPageToken;
}

async function getDriveFileParents(
  accessToken: string,
  fileId: string,
  progress: SyncProgress,
  parentCache: Map<string, string[] | null>
): Promise<string[] | null> {
  if (parentCache.has(fileId)) {
    return parentCache.get(fileId) ?? null;
  }

  const params = new URLSearchParams({
    fields: "id,parents",
    supportsAllDrives: "true",
  });
  const resp = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?${params}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  progress.apiCalls++;

  if (resp.status === 404) {
    parentCache.set(fileId, null);
    return null;
  }

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Drive metadata error (${resp.status}): ${err}`);
  }

  const data = await resp.json();
  const parents = Array.isArray(data.parents)
    ? (data.parents as string[])
    : null;
  parentCache.set(fileId, parents);
  return parents;
}

export async function isDriveFileInConfiguredFolder(
  accessToken: string,
  file: DriveFile,
  folderId: string | null,
  includeSubfolders: boolean,
  progress: SyncProgress,
  parentCache: Map<string, string[] | null> = new Map()
): Promise<boolean> {
  if (!folderId) return true;

  const directParents = file.parents ?? [];
  if (directParents.includes(folderId)) return true;
  if (!includeSubfolders) return false;

  const queue = [...directParents];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const parentId = queue.shift();
    if (!parentId || visited.has(parentId)) continue;
    visited.add(parentId);

    if (parentId === folderId) return true;

    const nextParents = await getDriveFileParents(
      accessToken,
      parentId,
      progress,
      parentCache
    );
    if (!nextParents || nextParents.length === 0) continue;
    if (nextParents.includes(folderId)) return true;

    queue.push(...nextParents);
  }

  return false;
}

async function listChangedFiles(
  accessToken: string,
  pageToken: string,
  folderId: string | null,
  includeSubfolders: boolean,
  progress: SyncProgress
): Promise<{ files: DriveFile[]; newToken: string }> {
  const files = new Map<string, DriveFile>();
  const parentCache = new Map<string, string[] | null>();
  let currentToken = pageToken;
  let newStartPageToken = pageToken;

  while (currentToken) {
    const params = new URLSearchParams({
      pageToken: currentToken,
      fields:
        "nextPageToken, newStartPageToken, changes(fileId, file(id, name, mimeType, size, modifiedTime, parents), removed)",
      pageSize: "100",
      includeRemoved: "false",
      spaces: "drive",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
    });

    const resp = await fetch(
      `https://www.googleapis.com/drive/v3/changes?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    progress.apiCalls++;

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Changes API error (${resp.status}): ${err}`);
    }

    const data = await resp.json();

    for (const change of data.changes || []) {
      if (change.removed || !change.file) continue;
      const file: DriveFile = change.file;
      if (file.mimeType === "application/vnd.google-apps.folder") continue;

      const inConfiguredFolder = await isDriveFileInConfiguredFolder(
        accessToken,
        file,
        folderId,
        includeSubfolders,
        progress,
        parentCache
      );
      if (!inConfiguredFolder) {
        continue;
      }

      if (
        SUPPORTED_MIME_TYPES.has(file.mimeType) ||
        file.mimeType in GOOGLE_EXPORT_MAP
      ) {
        files.set(file.id, file);
      }
    }

    currentToken = data.nextPageToken || "";
    if (data.newStartPageToken) {
      newStartPageToken = data.newStartPageToken;
    }
  }

  return { files: Array.from(files.values()), newToken: newStartPageToken };
}

// ── Connector Record Update ─────────────────────────────────────────────────

async function updateConnectorRecord(
  connectorId: string,
  success: boolean,
  progress: SyncProgress,
  durationMs: number,
  newSyncToken?: string
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const now = new Date();
  const stats = {
    filesProcessed: progress.filesProcessed,
    filesFailed: progress.filesFailed,
    filesSkipped: progress.filesSkipped,
    bytesDownloaded: progress.bytesDownloaded,
    durationMs,
  };

  if (success) {
    await db
      .update(knowledgeConnectors)
      .set({
        lastSyncAt: now,
        lastSyncStats: JSON.stringify(stats),
        consecutiveErrors: 0,
        lastErrorAt: null,
        lastErrorMessage: null,
        ...(newSyncToken ? { lastSyncToken: newSyncToken } : {}),
      })
      .where(eq(knowledgeConnectors.id, connectorId));
  } else {
    const [connector] = await db
      .select({ consecutiveErrors: knowledgeConnectors.consecutiveErrors })
      .from(knowledgeConnectors)
      .where(eq(knowledgeConnectors.id, connectorId))
      .limit(1);

    const errorCount = (connector?.consecutiveErrors ?? 0) + 1;
    const shouldPause = errorCount >= 5;
    const primaryError = progress.errors[0]?.slice(0, 500) || "Unknown error";
    const revokedCredentials = isRevokedDriveCredentialError(primaryError);

    await db
      .update(knowledgeConnectors)
      .set({
        lastSyncAt: now,
        lastSyncStats: JSON.stringify(stats),
        consecutiveErrors: errorCount,
        lastErrorAt: now,
        lastErrorMessage: revokedCredentials
          ? "Google Drive authorization expired or was revoked. Reconnect this source to resume syncing."
          : primaryError,
        ...(revokedCredentials
          ? { status: "revoked" as const }
          : shouldPause
            ? { status: "paused" as const }
            : {}),
      })
      .where(eq(knowledgeConnectors.id, connectorId));

    if (revokedCredentials) {
      log.warn(
        { connectorId, errorCount },
        "Connector marked revoked after Google auth failure"
      );
      return;
    }

    if (shouldPause) {
      log.warn(
        { connectorId, errorCount },
        "Connector auto-paused after consecutive failures"
      );
    }
  }
}

// ── Main Sync Function ──────────────────────────────────────────────────────

/**
 * Execute a Google Drive sync — incremental if a change token exists,
 * full scan otherwise. Updates both the sync record and the connector
 * record with stats, errors, and the change token for next run.
 */
export async function executeGoogleDriveSync(
  options: SyncOptions
): Promise<void> {
  const {
    connectorId,
    syncId,
    credentials,
    config,
    authToken,
    department,
    lastSyncToken,
  } = options;
  const startTime = Date.now();

  const progress: SyncProgress = {
    filesDiscovered: 0,
    filesProcessed: 0,
    filesFailed: 0,
    filesSkipped: 0,
    bytesDownloaded: 0,
    apiCalls: 0,
    errors: [],
  };

  const db = await getDb();

  const updateSyncRecord = async (
    status: "running" | "completed" | "failed" | "partial"
  ) => {
    if (!db) return;
    const values: Record<string, unknown> = {
      status,
      filesDiscovered: progress.filesDiscovered,
      filesProcessed: progress.filesProcessed,
      filesFailed: progress.filesFailed,
      filesSkipped: progress.filesSkipped,
      bytesDownloaded: progress.bytesDownloaded,
      apiCalls: progress.apiCalls,
      rateLimitHits: 0,
      durationMs: Date.now() - startTime,
      errors:
        progress.errors.length > 0
          ? JSON.stringify(progress.errors.slice(0, 50))
          : null,
    };
    if (status === "completed" || status === "failed") {
      values.completedAt = new Date();
    }
    await db
      .update(knowledgeConnectorSyncs)
      .set(values)
      .where(eq(knowledgeConnectorSyncs.id, syncId));
  };

  let newSyncToken: string | undefined;

  try {
    const isIncremental = !!lastSyncToken;
    log.info(
      { syncId, connectorId, isIncremental },
      `Starting ${isIncremental ? "incremental" : "full"} sync`
    );

    const oauthClient = createOAuthClient(credentials);
    const accessToken = await getAccessToken(oauthClient);

    let files: DriveFile[];

    if (isIncremental) {
      const result = await listChangedFiles(
        accessToken,
        lastSyncToken!,
        config.folderId,
        config.includeSubfolders,
        progress
      );
      files = result.files;
      newSyncToken = result.newToken;
    } else {
      files = await listDriveFiles(
        accessToken,
        config.folderId,
        config.includeSubfolders,
        progress
      );
      newSyncToken = await getStartPageToken(accessToken);
      progress.apiCalls++;
    }

    progress.filesDiscovered = files.length;
    log.info(
      { syncId, fileCount: files.length, isIncremental },
      `Discovered ${files.length} files`
    );

    if (files.length === 0) {
      await updateSyncRecord("completed");
      await updateConnectorRecord(
        connectorId,
        true,
        progress,
        Date.now() - startTime,
        newSyncToken
      );
      return;
    }

    await updateSyncRecord("running");

    const concurrency = 3;
    for (let i = 0; i < files.length; i += concurrency) {
      const batch = files.slice(i, i + concurrency);

      await Promise.allSettled(
        batch.map(async file => {
          try {
            const { buffer, filename, contentType } = await downloadDriveFile(
              accessToken,
              file,
              progress
            );

            const result = await uploadToPipeline(
              buffer,
              filename,
              contentType,
              authToken,
              {
                title: file.name,
                department: department || "google-drive",
                documentType: contentType.includes("pdf") ? "pdf" : "general",
                tags: `connector:${connectorId},drive-sync`,
                sourceRef: buildDriveSourceRef(file.id),
                streamId: config.streamId ?? null,
                connectorId,
                syncId,
              }
            );

            if (result.success) {
              progress.filesProcessed++;
            } else {
              progress.filesFailed++;
              progress.errors.push(`${file.name}: ${result.error}`);
            }
          } catch (err: any) {
            progress.filesFailed++;
            progress.errors.push(`${file.name}: ${err.message}`);
          }
        })
      );

      await updateSyncRecord("running");
    }

    const allFailed =
      progress.filesFailed === progress.filesDiscovered &&
      progress.filesDiscovered > 0;
    const finalStatus = allFailed ? "failed" : "completed";

    await updateSyncRecord(finalStatus);
    await updateConnectorRecord(
      connectorId,
      !allFailed,
      progress,
      Date.now() - startTime,
      newSyncToken
    );

    log.info(
      {
        syncId,
        status: finalStatus,
        processed: progress.filesProcessed,
        failed: progress.filesFailed,
        skipped: progress.filesSkipped,
        discovered: progress.filesDiscovered,
        durationSec: ((Date.now() - startTime) / 1000).toFixed(1),
      },
      `Sync ${finalStatus}`
    );
  } catch (err: any) {
    log.error({ err, syncId }, "Fatal error in sync");
    progress.errors.push(`Fatal: ${err.message}`);
    await updateSyncRecord("failed");
    await updateConnectorRecord(
      connectorId,
      false,
      progress,
      Date.now() - startTime
    );
  }
}
