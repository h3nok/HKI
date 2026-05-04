/**
 * Google Drive Connector — OAuth Routes
 *
 * Handles the OAuth2 flow specifically for Google Drive access.
 * This is SEPARATE from the login OAuth — it requests drive.readonly scope
 * and stores the refresh token as connector credentials.
 *
 * Flow:
 *   1. GET /api/connectors/google-drive/auth
 *      → Validates user session, encodes state (userId, connectorName, folderConfig)
 *      → Redirects to Google consent screen with drive.readonly scope
 *
 *   2. GET /api/connectors/google-drive/callback
 *      → Exchanges auth code for tokens
 *      → Stores refresh_token encrypted in knowledgeConnectors table
 *      → Creates connector record
 *      → Redirects to Sources tab with success param
 */

import { Router, Request, Response } from "express";
import { TRPCError } from "@trpc/server";
import { OAuth2Client } from "google-auth-library";
import { nanoid } from "nanoid";
import { SignJWT, jwtVerify } from "jose";
import { and, eq } from "drizzle-orm";
import { getDb } from "../db";
import { createLogger } from "../_core/logger";
import { createRouteRateLimiter } from "../_core/rate-limit";
import { knowledgeConnectors } from "../../drizzle/schema";
import { sdk } from "../_core/sdk";
import { ENV } from "../_core/env";
import { storeConnectorCredentials } from "./connector-credentials";
import { requireConnectorSelectionStreamId } from "./stream-access";

const log = createLogger("gdrive-auth");

// ── Config ───────────────────────────────────────────────────────────────────

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const DRIVE_REDIRECT_URI =
  process.env.GOOGLE_DRIVE_REDIRECT_URI ||
  `${ENV.baseUrl}/api/connectors/google-drive/callback`;

const STATE_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "dev-jwt-secret-change-me"
);
const OAUTH_CALLBACK_TRANSFER_TTL_MS = 60_000;
const OAUTH_CALLBACK_COMPLETE_PATH =
  "/api/connectors/google-drive/callback/complete";

// Scopes needed for Drive folder sync (read-only access + user email for display)
const DRIVE_SCOPES = [
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
];

function getGoogleIdentityRateLimitKey(req: Request): string | undefined {
  const rawHeader = req.headers["x-goog-authenticated-user-email"];
  const iapEmailHeader = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
  if (!iapEmailHeader) {
    return undefined;
  }

  const email = iapEmailHeader
    .replace(/^accounts\.google\.com:/, "")
    .trim()
    .toLowerCase();

  return email ? `iap:${email}` : undefined;
}

const googleDriveOauthRateLimit = createRouteRateLimiter({
  identifier: "google-drive-oauth",
  windowMs: 5 * 60_000,
  limit: 10,
  message:
    "Too many Google Drive authorization requests. Please try again in a few minutes.",
  keyBuilder: getGoogleIdentityRateLimitKey,
});

const googleDriveStatusRateLimit = createRouteRateLimiter({
  identifier: "google-drive-oauth-status",
  windowMs: 60_000,
  limit: 120,
  message: "Too many Google Drive status requests. Please try again shortly.",
  keyBuilder: getGoogleIdentityRateLimitKey,
});

// ── OAuth Client ─────────────────────────────────────────────────────────────

function createDriveOAuthClient(): OAuth2Client {
  return new OAuth2Client(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    DRIVE_REDIRECT_URI
  );
}

// ── State JWT (prevents CSRF, carries connector config through redirect) ─────

interface OAuthStatePayload {
  userId: number;
  orgId: string;
  existingConnectorId?: string;
  connectorName: string;
  folderId?: string;
  folderName?: string;
  syncInterval: number;
  streamId?: string;
  streamName?: string;
}

interface OAuthCallbackTransferPayload {
  code: string;
  state: string;
}

interface OAuthCallbackTransferRecord extends OAuthCallbackTransferPayload {
  expiresAt: number;
}

const oauthCallbackTransfers = new Map<string, OAuthCallbackTransferRecord>();

const oauthCallbackTransferCleanupTimer = setInterval(() => {
  const now = Date.now();
  oauthCallbackTransfers.forEach((transfer, handoffId) => {
    if (transfer.expiresAt <= now) {
      oauthCallbackTransfers.delete(handoffId);
    }
  });
}, OAUTH_CALLBACK_TRANSFER_TTL_MS);

oauthCallbackTransferCleanupTimer.unref();

function buildKnowledgeRedirect(params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }

  const query = search.toString();
  return query ? `/knowledge?${query}` : "/knowledge";
}

async function encodeState(payload: OAuthStatePayload): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m") // 10 minute window to complete OAuth
    .sign(STATE_SECRET);
}

async function decodeState(state: string): Promise<OAuthStatePayload | null> {
  try {
    const { payload } = await jwtVerify(state, STATE_SECRET);
    return payload as unknown as OAuthStatePayload;
  } catch {
    return null;
  }
}

function storeCallbackTransfer(payload: OAuthCallbackTransferPayload): string {
  const handoffId = nanoid(24);
  oauthCallbackTransfers.set(handoffId, {
    ...payload,
    expiresAt: Date.now() + OAUTH_CALLBACK_TRANSFER_TTL_MS,
  });
  return handoffId;
}

function consumeCallbackTransfer(
  handoffId: string
): OAuthCallbackTransferPayload | null {
  const transfer = oauthCallbackTransfers.get(handoffId);
  if (!transfer) {
    return null;
  }

  oauthCallbackTransfers.delete(handoffId);
  if (transfer.expiresAt <= Date.now()) {
    return null;
  }

  return {
    code: transfer.code,
    state: transfer.state,
  };
}

function parseSingleQueryParam(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0] : undefined;
  }

  return undefined;
}

function setNoStoreHeaders(res: Response) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Referrer-Policy", "no-referrer");
}

// ── Routes ───────────────────────────────────────────────────────────────────

const router = Router();

/**
 * Step 1: Initiate Google Drive OAuth
 * GET /api/connectors/google-drive/auth?name=...&folderId=...&folderName=...&syncInterval=30&streamId=...&streamName=...
 *
 * Requires an active user session (same cookie as the app).
 */
router.get(
  "/auth",
  googleDriveOauthRateLimit,
  async (req: Request, res: Response) => {
    try {
      // Authenticate the current user
      const user = await sdk.authenticateRequest(req);
      if (!user) {
        return res
          .status(401)
          .json({ error: "Not authenticated. Please log in first." });
      }

      // Validate required params
      const connectorName = (req.query.name as string) || "Google Drive";
      const existingConnectorId = req.query.existingConnectorId as
        | string
        | undefined;
      const folderId = req.query.folderId as string | undefined;
      const folderName = req.query.folderName as string | undefined;
      const syncInterval = parseInt(req.query.syncInterval as string) || 30;
      const streamId = req.query.streamId as string | undefined;
      const streamName =
        (req.query.streamName as string | undefined) ||
        (req.query.stream as string | undefined);
      const resolvedStreamId = requireConnectorSelectionStreamId(
        { user },
        streamId,
        "Select a value stream before connecting Google Drive"
      );

      if (
        !GOOGLE_CLIENT_ID ||
        GOOGLE_CLIENT_ID === "__GOOGLE_CLIENT_ID_NOT_SET__"
      ) {
        return res.status(500).json({
          error:
            "Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.",
        });
      }

      if (existingConnectorId) {
        const db = await getDb();
        if (!db) {
          return res.status(500).json({
            error: "Database unavailable while validating the connector",
          });
        }

        const [existingConnector] = await db
          .select({
            id: knowledgeConnectors.id,
            createdBy: knowledgeConnectors.createdBy,
          })
          .from(knowledgeConnectors)
          .where(
            and(
              eq(knowledgeConnectors.id, existingConnectorId),
              eq(knowledgeConnectors.orgId, user.orgId ?? "default"),
              eq(knowledgeConnectors.type, "google_drive")
            )
          )
          .limit(1);

        if (!existingConnector) {
          return res.status(404).json({ error: "Connector not found" });
        }

        if (user.role !== "admin" && existingConnector.createdBy !== user.id) {
          return res.status(403).json({
            error: "You do not have permission to reconnect this connector.",
          });
        }
      }

      // Encode state for CSRF protection + carrying config through redirect
      const state = await encodeState({
        userId: user.id,
        orgId: user.orgId ?? "default",
        existingConnectorId,
        connectorName,
        folderId,
        folderName,
        syncInterval,
        streamId: resolvedStreamId ?? undefined,
        streamName:
          resolvedStreamId && resolvedStreamId === streamId
            ? streamName
            : undefined,
      });

      // Build Google OAuth URL with Drive scopes
      const client = createDriveOAuthClient();
      const authUrl = client.generateAuthUrl({
        access_type: "offline", // We need a refresh_token for background sync
        scope: DRIVE_SCOPES,
        prompt: "consent", // Always show consent to get refresh_token
        state,
        include_granted_scopes: true,
      });

      log.info(
        { userId: user.id, connectorName },
        "Initiating Google Drive OAuth"
      );
      res.redirect(authUrl);
    } catch (error) {
      if (error instanceof TRPCError) {
        const statusCode =
          error.code === "BAD_REQUEST"
            ? 400
            : error.code === "FORBIDDEN"
              ? 403
              : error.code === "UNAUTHORIZED"
                ? 401
                : 500;

        log.warn(
          { err: error, statusCode },
          "Auth initiation rejected by connector stream guard"
        );
        return res.status(statusCode).json({ error: error.message });
      }

      log.error({ err: error }, "Auth initiation failed");
      res
        .status(500)
        .json({ error: "Failed to initiate Google Drive connection" });
    }
  }
);

/**
 * Step 2: OAuth Callback — exchange code, store tokens, create connector
 * GET /api/connectors/google-drive/callback?code=...&state=...
 */
router.get(
  "/callback",
  googleDriveOauthRateLimit,
  async (req: Request, res: Response) => {
    setNoStoreHeaders(res);

    const oauthError = parseSingleQueryParam(req.query.error);
    const code = parseSingleQueryParam(req.query.code);
    const state = parseSingleQueryParam(req.query.state);

    // Handle user denial
    if (oauthError) {
      log.warn({ oauthError }, "User denied access");
      return res.redirect(buildKnowledgeRedirect({ error: "access_denied" }));
    }

    if (!code || !state) {
      return res.redirect(
        buildKnowledgeRedirect({ error: "invalid_callback" })
      );
    }

    try {
      const handoffId = storeCallbackTransfer({
        code,
        state,
      });

      return res.redirect(
        303,
        `${OAUTH_CALLBACK_COMPLETE_PATH}?handoff=${encodeURIComponent(handoffId)}`
      );
    } catch (error) {
      log.error({ err: error }, "OAuth callback handoff failed");
      return res.redirect(buildKnowledgeRedirect({ error: "oauth_failed" }));
    }
  }
);

router.get(
  "/callback/complete",
  googleDriveOauthRateLimit,
  async (req: Request, res: Response) => {
    setNoStoreHeaders(res);

    const handoffId = parseSingleQueryParam(req.query.handoff);

    if (!handoffId) {
      return res.redirect(
        buildKnowledgeRedirect({ error: "invalid_callback" })
      );
    }

    try {
      const callbackTransfer = consumeCallbackTransfer(handoffId);
      if (!callbackTransfer) {
        log.error("Invalid or expired OAuth callback handoff token");
        return res.redirect(buildKnowledgeRedirect({ error: "expired_state" }));
      }

      // Decode and validate state JWT
      const statePayload = await decodeState(callbackTransfer.state);
      if (!statePayload) {
        log.error("Invalid or expired state token");
        return res.redirect(buildKnowledgeRedirect({ error: "expired_state" }));
      }

      if (!statePayload.streamId || statePayload.streamId === "global") {
        log.error(
          {
            userId: statePayload.userId,
            connectorName: statePayload.connectorName,
          },
          "Google Drive OAuth callback missing explicit connector stream"
        );
        return res.redirect(
          buildKnowledgeRedirect({
            error: "missing_stream",
          })
        );
      }

      // Exchange authorization code for tokens
      const client = createDriveOAuthClient();
      const { tokens } = await client.getToken(callbackTransfer.code);

      if (!tokens.refresh_token) {
        log.error(
          "No refresh_token received. User may need to revoke and re-authorize."
        );
        return res.redirect(
          buildKnowledgeRedirect({
            error: "missing_refresh_token",
            stream: statePayload.streamId,
          })
        );
      }

      if (!tokens.access_token) {
        return res.redirect(
          buildKnowledgeRedirect({
            error: "no_access_token",
            stream: statePayload.streamId,
          })
        );
      }

      // Get the user's email for display purposes
      let driveEmail = "";
      try {
        const userInfoResp = await fetch(
          "https://www.googleapis.com/oauth2/v2/userinfo",
          {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
          }
        );
        if (userInfoResp.ok) {
          const userInfo = await userInfoResp.json();
          driveEmail = userInfo.email || "";
        }
      } catch {
        // Non-critical — we can proceed without email
      }

      // Store the connector in the database
      const db = await getDb();
      if (!db) {
        return res.redirect(
          buildKnowledgeRedirect({
            error: "db_unavailable",
            stream: statePayload.streamId,
          })
        );
      }

      const storedCredentials = storeConnectorCredentials({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || null,
        expiry_date: tokens.expiry_date || null,
        token_type: tokens.token_type || "Bearer",
        scope: tokens.scope || DRIVE_SCOPES.join(" "),
        connected_email: driveEmail,
      });

      // Config: folder selection + sync settings
      const config = JSON.stringify({
        folderId: statePayload.folderId || null,
        folderName: statePayload.folderName || "Entire Drive",
        includeSubfolders: true,
        mimeTypes: [
          "application/pdf",
          "application/vnd.google-apps.document",
          "application/vnd.google-apps.spreadsheet",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "text/plain",
          "text/csv",
          "text/markdown",
        ],
        connectedEmail: driveEmail,
        streamId: statePayload.streamId || null,
        streamName: statePayload.streamName || null,
      });

      const connectorId = statePayload.existingConnectorId || nanoid(21);

      if (statePayload.existingConnectorId) {
        await db
          .update(knowledgeConnectors)
          .set({
            streamId: statePayload.streamId,
            name: statePayload.connectorName,
            status: "active",
            credentialsEncrypted: storedCredentials.value,
            credentialsVersion: storedCredentials.version,
            config,
            syncIntervalMinutes: statePayload.syncInterval,
            consecutiveErrors: 0,
            lastSyncAt: null,
            lastSyncToken: null,
            lastSyncStats: null,
            lastErrorAt: null,
            lastErrorMessage: null,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(knowledgeConnectors.id, statePayload.existingConnectorId),
              eq(knowledgeConnectors.orgId, statePayload.orgId),
              eq(knowledgeConnectors.type, "google_drive")
            )
          );
      } else {
        await db.insert(knowledgeConnectors).values({
          id: connectorId,
          orgId: statePayload.orgId,
          streamId: statePayload.streamId,
          createdBy: statePayload.userId,
          type: "google_drive",
          name: statePayload.connectorName,
          status: "active",
          credentialsEncrypted: storedCredentials.value,
          credentialsVersion: storedCredentials.version,
          config,
          syncIntervalMinutes: statePayload.syncInterval,
          consecutiveErrors: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      log.info(
        {
          connectorId,
          userId: statePayload.userId,
          driveEmail,
          reconnected: Boolean(statePayload.existingConnectorId),
        },
        statePayload.existingConnectorId
          ? "Connector reconnected"
          : "Connector created"
      );

      res.redirect(
        buildKnowledgeRedirect({
          connected: "google_drive",
          connectorId,
          stream: statePayload.streamId,
        })
      );
    } catch (error) {
      log.error({ err: error }, "OAuth callback error");
      res.redirect(buildKnowledgeRedirect({ error: "oauth_failed" }));
    }
  }
);

/**
 * Validate that Google Drive OAuth is configured
 * GET /api/connectors/google-drive/status
 */
router.get(
  "/status",
  googleDriveStatusRateLimit,
  (_req: Request, res: Response) => {
    const configured = !!(
      GOOGLE_CLIENT_ID &&
      GOOGLE_CLIENT_ID !== "__GOOGLE_CLIENT_ID_NOT_SET__" &&
      GOOGLE_CLIENT_SECRET &&
      GOOGLE_CLIENT_SECRET !== "__GOOGLE_CLIENT_SECRET_NOT_SET__"
    );

    res.json({
      configured,
      redirectUri: DRIVE_REDIRECT_URI,
      scopes: DRIVE_SCOPES,
    });
  }
);

export default router;
