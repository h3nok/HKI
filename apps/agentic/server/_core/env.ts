import { createLogger } from "./logger";

const log = createLogger("env");
const isProduction = process.env.NODE_ENV === "production";
const isDevelopment = process.env.NODE_ENV === "development";
const DEFAULT_LOCAL_DATABASE_URL =
  "mysql://root:root@127.0.0.1:9306/hki_agentic";
const DEFAULT_EMAIL_FROM = "AI Platform <noreply@hki.com>";

export function isKbHermeticIsolationEnabled(): boolean {
  return process.env.KB_HERMETIC_ISOLATION === "true";
}

function redactDatabaseUrl(url?: string): string {
  if (!url) return "<unset>";
  try {
    const parsed = new URL(url);
    if (parsed.password) parsed.password = "******";
    return parsed.toString();
  } catch {
    return url.replace(/:(.*?)@/, ":******@");
  }
}

function parseEmailList(
  value: string | undefined,
  fallback: string[] = []
): string[] {
  const source = value ?? fallback.join(",");
  return source
    .split(",")
    .map(item => item.trim().toLowerCase())
    .filter(Boolean);
}

export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? DEFAULT_LOCAL_DATABASE_URL,
  dbAutoMigrate:
    process.env.DB_AUTO_MIGRATE != null
      ? process.env.DB_AUTO_MIGRATE === "true"
      : isDevelopment,
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  superAdminEmails: parseEmailList(process.env.SUPER_ADMIN_EMAILS, [
    "hghebrechristos@hki.com",
  ]),
  baseUrl: process.env.BASE_URL ?? "http://localhost:9001",
  isProduction,
  isDevelopment,
  /** Dev bypass only when BOTH NODE_ENV=development AND DEV_BYPASS=true */
  devBypassEnabled: isDevelopment && process.env.DEV_BYPASS === "true",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  kbHermeticIsolation: isKbHermeticIsolationEnabled(),
  /** Cost per 1M tokens in USD, from COST_PER_MILLION_TOKENS env var. */
  costPerMillion: parseFloat(process.env.COST_PER_MILLION_TOKENS ?? "0.075"),
};

/** Validate required env at startup; throw in production if critical vars missing. */
export function validateEnv(): void {
  const missing: string[] = [];
  const warnings: string[] = [];
  const emailSendingEnabled = process.env.EMAIL_ENABLED === "true";
  const smtpPort = process.env.SMTP_PORT || "587";

  // Log BASE_URL configuration for OAuth debugging
  log.info(
    { baseUrl: ENV.baseUrl, fromEnv: !!process.env.BASE_URL },
    "BASE_URL configured"
  );
  log.info({ nodeEnv: process.env.NODE_ENV }, "NODE_ENV");
  log.info({ databaseUrl: redactDatabaseUrl(ENV.databaseUrl) }, "DATABASE_URL");
  log.info({ dbAutoMigrate: ENV.dbAutoMigrate }, "DB_AUTO_MIGRATE");
  log.info(
    { superAdminEmailCount: ENV.superAdminEmails.length },
    "SUPER_ADMIN_EMAILS configured"
  );
  log.info(
    {
      emailSendingEnabled,
      runningInProduction: isProduction,
      smtpConfigured: !!process.env.SMTP_HOST,
      smtpHost: process.env.SMTP_HOST || "<unset>",
      smtpPort,
      emailFrom: process.env.EMAIL_FROM || DEFAULT_EMAIL_FROM,
    },
    "EMAIL delivery configuration"
  );
  log.info(
    { kbHermeticIsolation: isKbHermeticIsolationEnabled() },
    "KB hermetic isolation configuration"
  );

  // JWT_SECRET is ALWAYS required — empty secret allows trivial JWT forgery
  if (!ENV.cookieSecret) {
    if (isProduction) {
      missing.push(
        "JWT_SECRET (session signing) — CRITICAL: empty secret allows JWT forgery"
      );
    } else {
      log.error(
        "JWT_SECRET is empty — sessions are signed with an empty key. Set JWT_SECRET in .env."
      );
    }
  }

  if (isProduction && !ENV.databaseUrl) missing.push("DATABASE_URL");

  // ── Production-only: OAuth + service auth ──
  if (isProduction) {
    if (!process.env.GOOGLE_CLIENT_ID) missing.push("GOOGLE_CLIENT_ID");
    if (!process.env.GOOGLE_CLIENT_SECRET) missing.push("GOOGLE_CLIENT_SECRET");
    if (!process.env.SERVICE_AUTH_SECRET)
      missing.push("SERVICE_AUTH_SECRET (BFF ↔ Python service JWT)");
  }

  // ── Service URLs — warn if non-default (helps catch misconfigurations) ──
  const serviceUrls = {
    ORCHESTRATOR_URL: process.env.ORCHESTRATOR_URL,
    KNOWLEDGE_PIPELINE_URL: process.env.KNOWLEDGE_PIPELINE_URL,
    VECTOR_STORE_URL: process.env.VECTOR_STORE_URL,
  };
  for (const [name, value] of Object.entries(serviceUrls)) {
    if (value) {
      log.info({ [name]: value }, `${name} configured`);
    } else if (isProduction) {
      warnings.push(
        `${name} not set — using localhost default (expected in dev only)`
      );
    }
  }

  // ── Multi-pod: REDIS_URL recommended for WebSocket broadcast ──
  if (isProduction && !process.env.REDIS_URL) {
    warnings.push(
      "REDIS_URL not set — WebSocket trace broadcast limited to single pod"
    );
  }

  if (isProduction && !process.env.CONNECTOR_CREDENTIALS_SECRET) {
    warnings.push(
      "CONNECTOR_CREDENTIALS_SECRET not set — connector credentials encryption will fall back to JWT_SECRET"
    );
  }

  if (!process.env.SMTP_HOST && (isProduction || emailSendingEnabled)) {
    warnings.push(
      emailSendingEnabled
        ? "EMAIL_ENABLED=true but SMTP_HOST is not set — invite, approval, and access-request notification emails will not be sent"
        : "SMTP_HOST not set — outbound Agentic email delivery is not configured"
    );
  }

  if (process.env.SMTP_USER && !process.env.SMTP_PASS) {
    warnings.push(
      "SMTP_USER is set but SMTP_PASS is missing — authenticated SMTP relay may fail"
    );
  }

  if (!process.env.SMTP_USER && process.env.SMTP_PASS) {
    warnings.push(
      "SMTP_PASS is set but SMTP_USER is missing — authenticated SMTP relay may fail"
    );
  }

  if (Number.isNaN(parseInt(smtpPort, 10))) {
    warnings.push("SMTP_PORT is invalid — expected an integer like 587 or 465");
  }

  if (warnings.length > 0) {
    for (const w of warnings) {
      log.warn(w);
    }
  }

  if (missing.length > 0) {
    const msg = `Missing required environment: ${missing.join(", ")}`;
    if (isProduction) {
      throw new Error(msg);
    }
    log.warn(msg + " — server may run with limited functionality.");
  }
}
