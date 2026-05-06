/**
 * Shared authenticated HTTP client for downstream Python microservices.
 *
 * Mints a short-lived request JWT (30s) via signRequestJwt and attaches
 * it as a Bearer token. Used by both admin and knowledge routers.
 *
 * Service URLs:
 *   - knowledge-pipeline-service  (default :9508)
 *   - knowledge-api               (default :9509)
 *   - orchestrator-service        (default :9501)
 *   - analytics-service           (default :9510)
 */

import { TRPCError } from "@trpc/server";
import { signRequestJwt } from "./auth/sign-request-jwt";

type TrpcErrorCode = ConstructorParameters<typeof TRPCError>[0]["code"];

// ── Service Base URLs ────────────────────────────────────────────────────────
export const KNOWLEDGE_PIPELINE_URL =
  process.env.KNOWLEDGE_PIPELINE_URL || "http://localhost:9508";
export const VECTOR_STORE_URL =
  process.env.VECTOR_STORE_URL ||
  process.env.KNOWLEDGE_API_URL ||
  "http://localhost:9509";
export const ORCHESTRATOR_URL =
  process.env.ORCHESTRATOR_URL || "http://localhost:9501";
export const ANALYTICS_URL =
  process.env.ANALYTICS_URL || "http://localhost:9510";
export const LLM_GATEWAY_URL =
  process.env.LLM_GATEWAY_URL || "http://localhost:4000/v1";
/** Base URL without the /v1 path suffix — used for health checks. */
export const LLM_GATEWAY_BASE_URL = LLM_GATEWAY_URL.replace(/\/v1\/?$/, "");

function sanitizeServiceUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return "unknown-service-url";
  }
}

function logServiceFailure(
  url: string,
  status: number,
  statusText: string,
  detail: string
): void {
  console.warn("[ServiceClient] Downstream service request failed", {
    url: sanitizeServiceUrl(url),
    status,
    statusText,
    detail: detail.slice(0, 500),
  });
}

function getSafeServiceErrorMessage(status: number): string {
  switch (status) {
    case 400:
      return "Downstream service rejected the request";
    case 401:
      return "Downstream service authentication failed";
    case 403:
      return "Downstream service authorization failed";
    case 404:
      return "Downstream service resource not found";
    case 408:
      return "Downstream service request timed out";
    case 409:
      return "Downstream service request conflicted";
    case 413:
      return "Downstream service payload is too large";
    case 422:
      return "Downstream service could not process the request";
    case 429:
      return "Downstream service rate limit exceeded";
    default:
      return "Downstream service request failed";
  }
}

// ── Google ID Token for legacy Cloud Run IAM compatibility ───────────────────

const METADATA_URL =
  "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity";

export async function getGoogleIdToken(
  audience: string
): Promise<string | null> {
  if (process.env.NODE_ENV !== "production") return null;
  try {
    const origin = new URL(audience).origin;
    const res = await fetch(
      `${METADATA_URL}?audience=${encodeURIComponent(origin)}`,
      {
        headers: { "Metadata-Flavor": "Google" },
        signal: AbortSignal.timeout(3000),
      }
    );
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

// ── Authenticated Fetch ──────────────────────────────────────────────────────

/** Make an authenticated HTTP request to a downstream Python service. */
export async function serviceCall(
  url: string,
  ctx: { user: any; scopes?: string[]; isGlobalScope?: boolean },
  options: RequestInit = {}
): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) ?? {}),
  };

  const scopes = ctx.scopes?.map(scope => scope.trim()).filter(Boolean);
  const scope = scopes?.[0];
  const token = await signRequestJwt(ctx.user, scope, scopes);
  const idToken = await getGoogleIdToken(url);

  headers["X-Service-Auth"] = `Bearer ${token}`;
  if (idToken) {
    headers["Authorization"] = `Bearer ${idToken}`;
  } else {
    headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    return await fetch(url, { ...options, headers });
  } catch (err: any) {
    console.warn("[ServiceClient] Downstream service unreachable", {
      url: sanitizeServiceUrl(url),
      cause: err?.cause?.code ?? err?.name ?? "unknown",
    });
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Downstream service is unreachable",
    });
  }
}

/**
 * Map HTTP status codes to appropriate TRPC error codes.
 */
function mapHttpStatusToTRPCCode(status: number): TrpcErrorCode {
  switch (status) {
    case 400:
      return "BAD_REQUEST";
    case 401:
      return "INTERNAL_SERVER_ERROR";
    case 403:
      return "FORBIDDEN";
    case 404:
      return "NOT_FOUND";
    case 405:
      return "METHOD_NOT_SUPPORTED";
    case 408:
      return "TIMEOUT";
    case 409:
      return "CONFLICT";
    case 413:
      return "PAYLOAD_TOO_LARGE";
    case 422:
      return "UNPROCESSABLE_CONTENT";
    case 429:
      return "TOO_MANY_REQUESTS";
    case 499:
      return "CLIENT_CLOSED_REQUEST";
    default:
      // For 5xx errors or any other status, use INTERNAL_SERVER_ERROR
      return "INTERNAL_SERVER_ERROR";
  }
}

/**
 * Make an authenticated JSON request — throws TRPCError on non-2xx.
 * Use this for tRPC procedure handlers that proxy to Python services.
 */
export async function serviceJson<T = any>(
  url: string,
  ctx: { user: any; scopes?: string[]; isGlobalScope?: boolean },
  options: RequestInit = {}
): Promise<T> {
  const res = await serviceCall(url, ctx, options);
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    logServiceFailure(url, res.status, res.statusText, text);
    throw new TRPCError({
      code: mapHttpStatusToTRPCCode(res.status),
      message: getSafeServiceErrorMessage(res.status),
    });
  }
  return res.json() as Promise<T>;
}

// ── Case Conversion Utilities ───────────────────────────────────────────────

/** Convert a snake_case string to camelCase. */
function snakeToCamelStr(s: string): string {
  return s.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
}

/** Convert a camelCase string to snake_case. */
function camelToSnakeStr(s: string): string {
  return s.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`);
}

/** Deep-convert all object keys from snake_case to camelCase. */
export function snakeToCamel<T = unknown>(obj: unknown): T {
  if (Array.isArray(obj)) return obj.map(snakeToCamel) as T;
  if (obj !== null && typeof obj === "object" && !(obj instanceof Date)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      out[snakeToCamelStr(k)] = snakeToCamel(v);
    }
    return out as T;
  }
  return obj as T;
}

/** Deep-convert all object keys from camelCase to snake_case. */
export function camelToSnake(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(camelToSnake);
  if (obj !== null && typeof obj === "object" && !(obj instanceof Date)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      out[camelToSnakeStr(k)] = camelToSnake(v);
    }
    return out;
  }
  return obj;
}

/**
 * Authenticated JSON request with automatic snake_case → camelCase normalization.
 * Returns typed T with all keys in camelCase (TypeScript convention).
 */
export async function serviceJsonTyped<T>(
  url: string,
  ctx: { user: any; scopes?: string[]; isGlobalScope?: boolean },
  options: RequestInit = {}
): Promise<T> {
  const raw = await serviceJson(url, ctx, options);
  return snakeToCamel<T>(raw);
}

/**
 * Build a JSON body from a camelCase object, converting keys to snake_case
 * for the Python service. Strips undefined values.
 */
export function buildSnakeBody(obj: Record<string, unknown>): string {
  const cleaned: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) cleaned[k] = v;
  }
  return JSON.stringify(camelToSnake(cleaned));
}

/**
 * Upload a file as multipart/form-data to a downstream Python service.
 * Accepts base64-encoded file content (from the tRPC mutation) and converts
 * it to a proper multipart upload for FastAPI's UploadFile.
 */
export async function serviceMultipartUpload<T>(
  url: string,
  ctx: { user: any; scopes?: string[]; isGlobalScope?: boolean },
  fileBase64: string,
  filename: string,
  contentType: string,
  fields: Record<string, string>
): Promise<T> {
  const scopes = ctx.scopes?.map(scope => scope.trim()).filter(Boolean);
  const scope = scopes?.[0];
  const token = await signRequestJwt(ctx.user, scope, scopes);
  const idToken = await getGoogleIdToken(url);

  const binaryStr = atob(fileBase64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: contentType });

  const form = new FormData();
  form.append("file", blob, filename);
  for (const [k, v] of Object.entries(fields)) {
    form.append(k, v);
  }

  const headers: Record<string, string> = {
    "X-Service-Auth": `Bearer ${token}`,
  };
  if (idToken) {
    headers["Authorization"] = `Bearer ${idToken}`;
  } else {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: form,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    logServiceFailure(url, res.status, res.statusText, text);
    throw new TRPCError({
      code: mapHttpStatusToTRPCCode(res.status),
      message: getSafeServiceErrorMessage(res.status),
    });
  }

  const raw = await res.json();
  return snakeToCamel<T>(raw);
}
