import assert from "node:assert/strict";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import net from "node:net";
import { setTimeout as sleep } from "node:timers/promises";
import { pathToFileURL } from "node:url";

import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";

import type { AppRouter } from "../server/routers";
import {
  getSyntheticUserReasons,
  isSmokeStream,
} from "../server/_core/synthetic-cleanup";

type AuthMode = "auto" | "dev" | "iap";
type CleanupAction = "keep" | "delete" | "deactivate" | "already-inactive";

type CleanupUser = {
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  role: "admin" | "manager" | "operator" | "viewer";
  department: string | null;
  isActive: number | boolean;
  loginMethod: string | null;
  valueStreams: string | null;
  assignedStreams: string[];
  lastSignedIn: Date | string | null;
  createdAt: Date | string | null;
};

type CleanupPlanEntry = {
  user: CleanupUser;
  action: CleanupAction;
  reasons: string[];
};

type CleanupPlan = {
  entries: CleanupPlanEntry[];
  duplicateGroups: number;
  syntheticMatches: number;
};

type CleanupValueStream = {
  id: string;
  name?: string | null;
};

type PortForwardHandle = {
  process: ChildProcessWithoutNullStreams;
  logs: string[];
  baseUrl: string;
};

type CliOptions = {
  apply: boolean;
  authMode: AuthMode;
  duplicateEmails: string[];
  includeHvsi: boolean;
  deleteSyntheticUsers: boolean;
  deleteSmokeStreams: boolean;
};

const DEFAULT_NAMESPACE =
  process.env.KB_USER_CLEANUP_NAMESPACE ?? process.env.NAMESPACE ?? "platform";
const DEFAULT_SERVICE = process.env.KB_USER_CLEANUP_SERVICE ?? "agentic-bff";
const DEFAULT_SERVICE_PORT = Number(
  process.env.KB_USER_CLEANUP_SERVICE_PORT ?? "9001"
);
const DEFAULT_LOCAL_PORT = Number(process.env.KB_USER_CLEANUP_PORT ?? "39002");
const DEFAULT_HOST = process.env.KB_USER_CLEANUP_HOST ?? "127.0.0.1";
const DEFAULT_BASE_URL = process.env.AGENTIC_BASE_URL?.trim() || "";
const KEEP_PORT_FORWARD =
  process.env.KB_USER_CLEANUP_KEEP_PORT_FORWARD === "true";
const DEFAULT_ADMIN_EMAIL =
  process.env.KB_USER_CLEANUP_ADMIN_EMAIL?.trim().toLowerCase() ||
  "hghebrechristos@hki.com";
const DEFAULT_ADMIN_OPEN_ID =
  process.env.KB_USER_CLEANUP_ADMIN_OPEN_ID?.trim() || "kb-user-cleanup-admin";
const DEFAULT_INCLUDE_HVSI =
  process.env.KB_USER_CLEANUP_INCLUDE_HVSI !== "false";
const DEFAULT_DELETE_SYNTHETIC_USERS =
  process.env.KB_USER_CLEANUP_DELETE_SYNTHETIC_USERS === "true";
const DEFAULT_DELETE_SMOKE_STREAMS =
  process.env.KB_USER_CLEANUP_DELETE_SMOKE_STREAMS === "true";

const PAGE_LIMIT = 100;

const rolePriority: Record<CleanupUser["role"], number> = {
  admin: 0,
  manager: 1,
  operator: 2,
  viewer: 3,
};

function parseAuthMode(value: string | undefined): AuthMode {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "dev" || normalized === "iap" || normalized === "auto") {
    return normalized;
  }
  return "auto";
}

function splitCsv(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map(item => normalizeEmail(item))
    .filter((item): item is string => Boolean(item));
}

function printHelp() {
  console.log(`Usage: pnpm exec tsx scripts/kb-user-cleanup.ts [options]
       make kb-user-cleanup ARGS="--duplicate-email ${DEFAULT_ADMIN_EMAIL}"
       make kb-user-cleanup ARGS="--duplicate-email ${DEFAULT_ADMIN_EMAIL} --apply"

Preview mode is the default. Pass --apply to deactivate active matches.

Options:
  --apply                       Apply the planned cleanup actions.
  --duplicate-email <email>     Inspect duplicate rows for this email. Repeatable.
  --include-hvsi                Include HVSI/debug/smoke identities (default).
  --exclude-hvsi                Skip HVSI/debug/smoke identities.
  --delete-synthetic-users      Delete matched synthetic/test users instead of only deactivating them.
  --delete-smoke-streams        Delete leftover HVSI smoke value streams.
  --auth-mode <auto|dev|iap>    Override login flow. Default: ${parseAuthMode(process.env.KB_USER_CLEANUP_AUTH_MODE)}
  --help                        Show this help text.

Environment variables:
  AGENTIC_BASE_URL                  Optional direct BFF URL. When unset, the script port-forwards the cluster service.
  KB_USER_CLEANUP_ADMIN_EMAIL       Admin email used for the session. Default: ${DEFAULT_ADMIN_EMAIL}
  KB_USER_CLEANUP_ADMIN_OPEN_ID     OpenID used for login. Default: ${DEFAULT_ADMIN_OPEN_ID}
  KB_USER_CLEANUP_DUPLICATE_EMAILS  Comma-separated duplicate emails to inspect.
  KB_USER_CLEANUP_INCLUDE_HVSI      Set to false to skip HVSI identities.
  KB_USER_CLEANUP_DELETE_SYNTHETIC_USERS  Set to true to delete synthetic/test users during apply mode.
  KB_USER_CLEANUP_DELETE_SMOKE_STREAMS    Set to true to delete HVSI smoke streams during apply mode.
  KB_USER_CLEANUP_AUTH_MODE         auto, dev, or iap. Default: auto.
  KB_USER_CLEANUP_NAMESPACE         Kubernetes namespace for port-forward. Default: ${DEFAULT_NAMESPACE}
  KB_USER_CLEANUP_SERVICE           Kubernetes service for port-forward. Default: ${DEFAULT_SERVICE}
  KB_USER_CLEANUP_SERVICE_PORT      Remote service port. Default: ${DEFAULT_SERVICE_PORT}
  KB_USER_CLEANUP_PORT              Preferred local port for port-forward. Default: ${DEFAULT_LOCAL_PORT}
  KB_USER_CLEANUP_HOST              Local bind host for port-forward. Default: ${DEFAULT_HOST}
  KB_USER_CLEANUP_KEEP_PORT_FORWARD Keep the port-forward alive after the run. Default: false
`);
}

function log(message: string) {
  console.log(`[kb-user-cleanup] ${message}`);
}

function trimLogLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function tailLogs(logs: string[], count = 20): string {
  return logs.slice(-count).join("\n");
}

function normalizeEmail(email: string | null | undefined) {
  if (email == null) return null;
  const normalized = email.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function normalizeText(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function isActiveUser(user: Pick<CleanupUser, "isActive">): boolean {
  return Boolean(Number(user.isActive));
}

function getLoginMethodPriority(method: string | null | undefined) {
  if (method === "google") return 0;
  if (method === "google-iap") return 2;
  return 1;
}

function getTime(value: Date | string | null | undefined): number {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function comparePreferredUsers(
  left: CleanupUser,
  right: CleanupUser,
  currentUserId: number
) {
  if (left.id === currentUserId) return -1;
  if (right.id === currentUserId) return 1;

  const activityDelta = Number(right.isActive) - Number(left.isActive);
  if (activityDelta !== 0) return activityDelta;

  const methodDelta =
    getLoginMethodPriority(left.loginMethod) -
    getLoginMethodPriority(right.loginMethod);
  if (methodDelta !== 0) return methodDelta;

  const roleDelta = rolePriority[left.role] - rolePriority[right.role];
  if (roleDelta !== 0) return roleDelta;

  const lastSignedInDelta =
    getTime(right.lastSignedIn) - getTime(left.lastSignedIn);
  if (lastSignedInDelta !== 0) return lastSignedInDelta;

  return left.id - right.id;
}

function actionPriority(action: CleanupAction) {
  if (action === "keep") return 3;
  if (action === "delete") return 2;
  if (action === "deactivate") return 1;
  return 0;
}

function upsertEntry(
  entries: Map<number, CleanupPlanEntry>,
  user: CleanupUser,
  action: CleanupAction,
  reason: string
) {
  const existing = entries.get(user.id);
  if (!existing) {
    entries.set(user.id, { user, action, reasons: [reason] });
    return;
  }

  if (actionPriority(action) > actionPriority(existing.action)) {
    existing.action = action;
  }
  if (!existing.reasons.includes(reason)) {
    existing.reasons.push(reason);
  }
}

export function buildCleanupPlan(
  users: CleanupUser[],
  currentUserId: number,
  options: Pick<
    CliOptions,
    "duplicateEmails" | "includeHvsi" | "deleteSyntheticUsers"
  >
): CleanupPlan {
  const entries = new Map<number, CleanupPlanEntry>();
  const duplicateEmailSet = new Set(
    options.duplicateEmails
      .map(email => normalizeEmail(email))
      .filter((email): email is string => Boolean(email))
  );

  let duplicateGroups = 0;
  const usersByEmail = new Map<string, CleanupUser[]>();
  for (const user of users) {
    const email = normalizeEmail(user.email);
    if (!email) continue;
    const group = usersByEmail.get(email) ?? [];
    group.push(user);
    usersByEmail.set(email, group);
  }

  for (const [email, group] of usersByEmail) {
    if (group.length < 2) continue;
    if (duplicateEmailSet.size > 0 && !duplicateEmailSet.has(email)) continue;
    duplicateGroups += 1;

    const sorted = [...group].sort((left, right) =>
      comparePreferredUsers(left, right, currentUserId)
    );
    const keepUser = sorted[0];
    upsertEntry(
      entries,
      keepUser,
      "keep",
      `keep canonical duplicate for ${email}`
    );

    for (const user of sorted.slice(1)) {
      if (user.id === currentUserId) {
        upsertEntry(entries, user, "keep", `keep current session for ${email}`);
        continue;
      }

      upsertEntry(
        entries,
        user,
        isActiveUser(user) ? "deactivate" : "already-inactive",
        `duplicate email ${email}`
      );
    }
  }

  let syntheticMatches = 0;
  if (options.includeHvsi) {
    for (const user of users) {
      const reasons = getSyntheticUserReasons(user);
      if (reasons.length === 0) continue;
      syntheticMatches += 1;

      if (user.id === currentUserId) {
        upsertEntry(entries, user, "keep", "keep current session user");
        continue;
      }

      upsertEntry(
        entries,
        user,
        options.deleteSyntheticUsers
          ? "delete"
          : isActiveUser(user)
            ? "deactivate"
            : "already-inactive",
        `matched ${reasons.join(", ")}`
      );
    }
  }

  const sortedEntries = [...entries.values()].sort((left, right) => {
    const actionDelta =
      actionPriority(right.action) - actionPriority(left.action);
    if (actionDelta !== 0) return actionDelta;
    const emailDelta = normalizeText(left.user.email).localeCompare(
      normalizeText(right.user.email)
    );
    if (emailDelta !== 0) return emailDelta;
    return left.user.id - right.user.id;
  });

  return {
    entries: sortedEntries,
    duplicateGroups,
    syntheticMatches,
  };
}

function formatTimestamp(value: Date | string | null | undefined) {
  const timestamp = getTime(value);
  if (!timestamp) return "never";
  return new Date(timestamp).toISOString();
}

function describeEntry(entry: CleanupPlanEntry) {
  const user = entry.user;
  return [
    `${entry.action.toUpperCase().padEnd(16)}`,
    `id=${String(user.id).padEnd(5)}`,
    `email=${user.email ?? "<none>"}`,
    `name=${user.name ?? "<none>"}`,
    `role=${user.role}`,
    `active=${isActiveUser(user) ? "yes" : "no"}`,
    `login=${user.loginMethod ?? "unknown"}`,
    `openId=${user.openId}`,
    `lastSignedIn=${formatTimestamp(user.lastSignedIn)}`,
    `reasons=${entry.reasons.join("; ")}`,
  ].join(" | ");
}

function printPlan(plan: CleanupPlan, options: CliOptions) {
  console.log("");
  console.log(options.apply ? "APPLY PLAN" : "PREVIEW PLAN");
  console.log("----------------------------------------");
  if (plan.entries.length === 0) {
    console.log("No matching users found.");
  } else {
    for (const entry of plan.entries) {
      console.log(describeEntry(entry));
    }
  }

  const deactivateCount = plan.entries.filter(
    entry => entry.action === "deactivate"
  ).length;
  const deleteCount = plan.entries.filter(
    entry => entry.action === "delete"
  ).length;
  const alreadyInactiveCount = plan.entries.filter(
    entry => entry.action === "already-inactive"
  ).length;
  const keepCount = plan.entries.filter(
    entry => entry.action === "keep"
  ).length;

  console.log("");
  console.log("Summary:");
  console.log(`  duplicate groups inspected: ${plan.duplicateGroups}`);
  console.log(`  synthetic/test matches: ${plan.syntheticMatches}`);
  console.log(`  keep rows: ${keepCount}`);
  console.log(`  delete rows: ${deleteCount}`);
  console.log(`  deactivate rows: ${deactivateCount}`);
  console.log(`  already inactive rows: ${alreadyInactiveCount}`);
  if (!options.apply && (deleteCount > 0 || deactivateCount > 0)) {
    console.log("");
    console.log(
      `Run again with --apply${deleteCount > 0 ? " --delete-synthetic-users" : ""} to apply the actions above.`
    );
  }
}

function printSmokeStreamPlan(
  streams: CleanupValueStream[],
  options: CliOptions
) {
  console.log("");
  console.log(
    options.apply && options.deleteSmokeStreams
      ? "SMOKE STREAM CLEANUP"
      : "SMOKE STREAM PREVIEW"
  );
  console.log("----------------------------------------");

  if (streams.length === 0) {
    console.log("No smoke streams found.");
  } else {
    for (const stream of streams) {
      const action =
        options.apply && options.deleteSmokeStreams
          ? "DELETE-STREAM"
          : "FOUND-STREAM";
      console.log(
        `${action.padEnd(16)} | id=${stream.id} | name=${stream.name ?? "<none>"}`
      );
    }
  }

  console.log("");
  console.log(`  smoke streams found: ${streams.length}`);
  if (streams.length > 0 && (!options.apply || !options.deleteSmokeStreams)) {
    console.log("");
    console.log(
      "Run again with --apply --delete-smoke-streams to remove the smoke streams above."
    );
  }
}

async function isPortAvailable(port: number, host: string): Promise<boolean> {
  return await new Promise(resolve => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.listen(port, host, () => {
      server.close(() => resolve(true));
    });
  });
}

async function findAvailablePort(
  startPort: number,
  host: string
): Promise<number> {
  for (let port = startPort; port < startPort + 20; port += 1) {
    if (await isPortAvailable(port, host)) {
      return port;
    }
  }

  throw new Error(
    `Could not find an available local port starting at ${startPort}`
  );
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs = 5_000
): Promise<Response> {
  return await fetch(input, {
    ...(init ?? {}),
    signal: AbortSignal.timeout(timeoutMs),
  });
}

async function waitForHealth(
  baseUrl: string,
  timeoutMs = 20_000
): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const candidates = [`${baseUrl}/api/health`, `${baseUrl}/health`];
      for (const url of candidates) {
        const response = await fetchWithTimeout(url, undefined, 2_000).catch(
          () => null
        );
        if (response?.ok) {
          return;
        }
      }
    } catch {
      // Retry until deadline.
    }

    await sleep(500);
  }

  throw new Error(`Timed out waiting for ${baseUrl} health endpoint`);
}

async function onceOrTimeout(
  child: ChildProcessWithoutNullStreams,
  timeoutMs: number
): Promise<void> {
  await Promise.race([
    new Promise<void>(resolve => {
      child.once("exit", () => resolve());
      child.once("close", () => resolve());
    }),
    sleep(timeoutMs).then(() => undefined),
  ]);
}

async function startPortForward(): Promise<PortForwardHandle> {
  const localPort = await findAvailablePort(DEFAULT_LOCAL_PORT, DEFAULT_HOST);
  const logs: string[] = [];
  let spawnError: Error | null = null;
  const args = [
    "-n",
    DEFAULT_NAMESPACE,
    "port-forward",
    `service/${DEFAULT_SERVICE}`,
    `${localPort}:${DEFAULT_SERVICE_PORT}`,
    "--address",
    DEFAULT_HOST,
  ];
  const child = spawn("kubectl", args, {
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.once("error", error => {
    spawnError = error;
  });

  child.stdout.on("data", chunk => {
    const text = String(chunk);
    for (const line of text.split("\n")) {
      const normalized = trimLogLine(line);
      if (normalized) logs.push(normalized);
    }
  });

  child.stderr.on("data", chunk => {
    const text = String(chunk);
    for (const line of text.split("\n")) {
      const normalized = trimLogLine(line);
      if (normalized) logs.push(normalized);
    }
  });

  const baseUrl = `http://${DEFAULT_HOST}:${localPort}`;

  try {
    await waitForHealth(baseUrl);
  } catch (error) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }

    const logTail = tailLogs(logs);
    const message = spawnError?.message
      ? `kubectl failed to start: ${spawnError.message}`
      : error instanceof Error
        ? error.message
        : String(error);
    throw new Error(
      `Port-forward failed: ${message}${logTail ? `\n${logTail}` : ""}`
    );
  }

  return { process: child, logs, baseUrl };
}

async function stopPortForward(
  handle: PortForwardHandle | null
): Promise<void> {
  if (!handle || KEEP_PORT_FORWARD || handle.process.killed) {
    return;
  }

  handle.process.kill("SIGTERM");
  await onceOrTimeout(handle.process, 5_000);
}

function buildDevLoginUrl(baseUrl: string, params: Record<string, string>) {
  const url = new URL(`${baseUrl}/api/dev-login`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url;
}

async function loginDev(baseUrl: string, email: string, openId: string) {
  const response = await fetchWithTimeout(
    buildDevLoginUrl(baseUrl, {
      role: "admin",
      email,
      openId,
      redirect: "/knowledge",
    }),
    { redirect: "manual" },
    10_000
  );

  assert.ok(
    response.status >= 200 && response.status < 400,
    `Expected dev login to succeed, got HTTP ${response.status}`
  );

  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookie, "Expected dev login to issue a session cookie");

  return {
    cookie,
    location: response.headers.get("location") ?? null,
  };
}

async function loginViaIap(baseUrl: string, email: string, openId: string) {
  const response = await fetchWithTimeout(
    `${baseUrl}/api/auth/google/login`,
    {
      headers: {
        "x-goog-authenticated-user-email": `accounts.google.com:${email}`,
        "x-goog-authenticated-user-id": `accounts.google.com:${openId}`,
      },
      redirect: "manual",
    },
    10_000
  );

  assert.ok(
    response.status >= 300 && response.status < 400,
    `Expected IAP login redirect, got HTTP ${response.status}`
  );

  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookie, "Expected IAP login to issue a session cookie");

  return {
    cookie,
    location: response.headers.get("location") ?? null,
  };
}

function createClient(baseUrl: string, cookie: string) {
  return createTRPCProxyClient<AppRouter>({
    links: [
      httpBatchLink({
        url: `${baseUrl}/api/trpc`,
        transformer: superjson,
        headers() {
          return { cookie };
        },
      }),
    ],
  });
}

function resolveAuthMode(
  baseUrl: string,
  authMode: AuthMode,
  usedPortForward: boolean
) {
  if (authMode !== "auto") return authMode;
  if (usedPortForward) return "iap";

  try {
    const host = new URL(baseUrl).hostname;
    return host === "127.0.0.1" || host === "localhost" ? "dev" : "iap";
  } catch {
    return "iap";
  }
}

async function createAdminClient(
  baseUrl: string,
  authMode: AuthMode,
  usedPortForward: boolean
) {
  const effectiveAuthMode = resolveAuthMode(baseUrl, authMode, usedPortForward);
  log(`Authenticating with ${effectiveAuthMode} login flow`);

  const login =
    effectiveAuthMode === "dev"
      ? await loginDev(baseUrl, DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_OPEN_ID)
      : await loginViaIap(baseUrl, DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_OPEN_ID);

  return {
    authMode: effectiveAuthMode,
    client: createClient(baseUrl, login.cookie),
  };
}

async function fetchAllUsers(client: ReturnType<typeof createClient>) {
  const users: CleanupUser[] = [];
  let offset = 0;

  while (true) {
    const page = await client.admin.listUsers.query({
      limit: PAGE_LIMIT,
      offset,
    });
    users.push(...(page.users as CleanupUser[]));
    offset += page.users.length;
    if (offset >= page.total || page.users.length === 0) {
      return users;
    }
  }
}

function isMissingSetUserActiveProcedure(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('No procedure found on path "admin.setUserActive"');
}

async function deactivateUser(
  client: ReturnType<typeof createClient>,
  userId: number
): Promise<boolean> {
  try {
    const result = await client.admin.setUserActive.mutate({
      userId,
      isActive: false,
    });
    return Boolean(result.changed);
  } catch (error) {
    if (!isMissingSetUserActiveProcedure(error)) {
      throw error;
    }

    const result = await client.admin.toggleUserActive.mutate({ userId });
    return result.isActive === false;
  }
}

async function deleteSyntheticUser(
  client: ReturnType<typeof createClient>,
  userId: number
) {
  await client.admin.deleteSyntheticUser.mutate({ userId });
}

async function fetchSmokeStreams(client: ReturnType<typeof createClient>) {
  const streams = await client.admin.listValueStreams.query();
  return (streams as CleanupValueStream[]).filter(stream =>
    isSmokeStream(stream)
  );
}

function parseArgs(argv: string[]): CliOptions {
  const duplicateEmails = splitCsv(
    process.env.KB_USER_CLEANUP_DUPLICATE_EMAILS
  );
  let apply = false;
  let includeHvsi = DEFAULT_INCLUDE_HVSI;
  let authMode = parseAuthMode(process.env.KB_USER_CLEANUP_AUTH_MODE);
  let deleteSyntheticUsers = DEFAULT_DELETE_SYNTHETIC_USERS;
  let deleteSmokeStreams = DEFAULT_DELETE_SMOKE_STREAMS;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--") {
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
    if (arg === "--apply") {
      apply = true;
      continue;
    }
    if (arg === "--include-hvsi") {
      includeHvsi = true;
      continue;
    }
    if (arg === "--exclude-hvsi") {
      includeHvsi = false;
      continue;
    }
    if (arg === "--delete-synthetic-users") {
      deleteSyntheticUsers = true;
      continue;
    }
    if (arg === "--delete-smoke-streams") {
      deleteSmokeStreams = true;
      continue;
    }
    if (arg === "--duplicate-email" || arg === "--email") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error(`${arg} requires an email value`);
      }
      duplicateEmails.push(value);
      index += 1;
      continue;
    }
    if (arg === "--auth-mode") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("--auth-mode requires a value");
      }
      authMode = parseAuthMode(value);
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return {
    apply,
    authMode,
    duplicateEmails: Array.from(
      new Set(
        duplicateEmails
          .map(email => normalizeEmail(email))
          .filter((email): email is string => Boolean(email))
      )
    ),
    includeHvsi,
    deleteSyntheticUsers,
    deleteSmokeStreams,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  let portForward: PortForwardHandle | null = null;

  try {
    if (!DEFAULT_BASE_URL) {
      portForward = await startPortForward();
    }

    const baseUrl = portForward?.baseUrl ?? DEFAULT_BASE_URL;
    const usedPortForward = !DEFAULT_BASE_URL;

    log(`Using base URL ${baseUrl}`);
    await waitForHealth(baseUrl);

    const { client } = await createAdminClient(
      baseUrl,
      options.authMode,
      usedPortForward
    );

    const currentUser = await client.auth.me.query();
    assert.ok(currentUser, "Expected an authenticated user");
    assert.equal(
      currentUser.role,
      "admin",
      "KB user cleanup requires an admin session"
    );

    log(
      `Authenticated as ${currentUser.email ?? currentUser.openId} (user ${currentUser.id})`
    );

    const users = await fetchAllUsers(client);
    log(`Fetched ${users.length} users`);

    const plan = buildCleanupPlan(users, currentUser.id, options);
    const smokeStreams = await fetchSmokeStreams(client);
    printPlan(plan, options);
    printSmokeStreamPlan(smokeStreams, options);

    if (!options.apply) {
      return;
    }

    const deleteEntries = plan.entries.filter(
      entry => entry.action === "delete"
    );
    const actionable = plan.entries.filter(
      entry => entry.action === "deactivate"
    );
    if (
      deleteEntries.length === 0 &&
      actionable.length === 0 &&
      !(options.deleteSmokeStreams && smokeStreams.length > 0)
    ) {
      log("No synthetic users or smoke streams required cleanup.");
      return;
    }

    let deletedUsers = 0;
    for (const entry of deleteEntries) {
      log(
        `Deleting synthetic user ${entry.user.id} (${entry.user.email ?? entry.user.openId})`
      );
      await deleteSyntheticUser(client, entry.user.id);
      deletedUsers += 1;
    }

    let deactivated = 0;
    for (const entry of actionable) {
      log(
        `Deactivating user ${entry.user.id} (${entry.user.email ?? entry.user.openId})`
      );
      const changed = await deactivateUser(client, entry.user.id);
      if (changed) {
        deactivated += 1;
      }
    }

    if (options.deleteSmokeStreams) {
      let deletedStreams = 0;
      for (const stream of smokeStreams) {
        log(`Deleting smoke stream ${stream.id}`);
        await client.admin.deleteValueStream.mutate({ id: stream.id });
        deletedStreams += 1;
      }
      log(`Deleted ${deletedStreams} smoke stream(s)`);
    }

    log(`Deleted ${deletedUsers} synthetic user(s)`);
    log(`Deactivated ${deactivated} user(s)`);
  } finally {
    await stopPortForward(portForward);
  }
}

const isMainModule =
  process.argv[1] != null &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  main().catch(error => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[kb-user-cleanup] Failed: ${message}`);
    process.exitCode = 1;
  });
}
