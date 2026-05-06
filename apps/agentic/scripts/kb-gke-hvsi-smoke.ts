import assert from "node:assert/strict";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import net from "node:net";
import { setTimeout as sleep } from "node:timers/promises";

import {
  createTRPCProxyClient,
  httpBatchLink,
  TRPCClientError,
} from "@trpc/client";
import superjson from "superjson";

import type { AppRouter } from "../server/routers";

const DEFAULT_NAMESPACE =
  process.env.KB_GKE_SMOKE_NAMESPACE ?? process.env.NAMESPACE ?? "platform";
const DEFAULT_SERVICE = process.env.KB_GKE_SMOKE_SERVICE ?? "agentic-bff";
const DEFAULT_SERVICE_PORT = Number(
  process.env.KB_GKE_SMOKE_SERVICE_PORT ?? "9001"
);
const DEFAULT_LOCAL_PORT = Number(process.env.KB_GKE_SMOKE_PORT ?? "39001");
const DEFAULT_HOST = process.env.KB_GKE_SMOKE_HOST ?? "127.0.0.1";
const DEFAULT_BASE_URL = process.env.AGENTIC_BASE_URL?.trim() || "";
const KEEP_PORT_FORWARD = process.env.KB_GKE_SMOKE_KEEP_PORT_FORWARD === "true";
const SKIP_CLEANUP = process.env.KB_GKE_SMOKE_SKIP_CLEANUP === "true";
const DEFAULT_ADMIN_EMAIL =
  process.env.KB_GKE_SMOKE_ADMIN_EMAIL?.trim().toLowerCase() ||
  "hghebrechristos@hki.com";
const DEFAULT_ADMIN_OPEN_ID =
  process.env.KB_GKE_SMOKE_ADMIN_OPEN_ID?.trim() || "kb-gke-smoke-admin";
const STREAM_PREFIX = (
  process.env.KB_GKE_SMOKE_STREAM_PREFIX ?? "hvsi-gke-smoke"
)
  .toLowerCase()
  .replace(/[^a-z0-9-]+/g, "-")
  .replace(/^-+|-+$/g, "")
  .slice(0, 32);
const STREAM_NAME_PREFIX =
  process.env.KB_GKE_SMOKE_NAME_PREFIX?.trim() || "HVSI GKE Smoke";

type PortForwardHandle = {
  process: ChildProcessWithoutNullStreams;
  logs: string[];
  baseUrl: string;
};

function printHelp() {
  console.log(`Usage: pnpm test:kb-gke-hvsi-smoke
       pnpm test:kb-gke-hvsi-smoke --cleanup-existing

Environment variables:
  AGENTIC_BASE_URL               Optional direct BFF URL. When unset, the script port-forwards the in-cluster service.
  KB_GKE_SMOKE_NAMESPACE         Kubernetes namespace. Default: ${DEFAULT_NAMESPACE}
  KB_GKE_SMOKE_SERVICE           Kubernetes service name. Default: ${DEFAULT_SERVICE}
  KB_GKE_SMOKE_SERVICE_PORT      Remote service port. Default: ${DEFAULT_SERVICE_PORT}
  KB_GKE_SMOKE_PORT              Preferred local port for port-forward. Default: ${DEFAULT_LOCAL_PORT}
  KB_GKE_SMOKE_HOST              Local bind host for port-forward. Default: ${DEFAULT_HOST}
  KB_GKE_SMOKE_ADMIN_EMAIL       Super-admin email used for cleanup. Default: ${DEFAULT_ADMIN_EMAIL}
  KB_GKE_SMOKE_ADMIN_OPEN_ID     OpenID used for the cleanup session. Default: ${DEFAULT_ADMIN_OPEN_ID}
  KB_GKE_SMOKE_STREAM_PREFIX     Prefix used for the provisioned test stream. Default: ${STREAM_PREFIX}
  KB_GKE_SMOKE_NAME_PREFIX       Name prefix used for smoke-created streams. Default: ${STREAM_NAME_PREFIX}
  KB_GKE_SMOKE_KEEP_PORT_FORWARD Keep the port-forward alive after the run. Default: false
  KB_GKE_SMOKE_SKIP_CLEANUP      Skip deleting the provisioned smoke stream after the run. Default: false
`);
}

function log(message: string) {
  console.log(`[kb-gke-hvsi-smoke] ${message}`);
}

function trimLogLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function tailLogs(logs: string[], count = 20): string {
  return logs.slice(-count).join("\n");
}

function isSmokeStream(stream: { id: string; name?: string | null }): boolean {
  return (
    stream.id.startsWith(`${STREAM_PREFIX}-`) ||
    Boolean(stream.name?.startsWith(STREAM_NAME_PREFIX))
  );
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
      const response = await fetchWithTimeout(
        `${baseUrl}/health`,
        undefined,
        2_000
      );
      if (response.ok) {
        return;
      }
    } catch {
      // Retry until deadline.
    }

    await sleep(500);
  }

  throw new Error(`Timed out waiting for ${baseUrl}/health`);
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

function createClient(baseUrl: string, cookie: string) {
  return createTRPCProxyClient<AppRouter>({
    links: [
      httpBatchLink({
        url: `${baseUrl}/api/trpc`,
        transformer: superjson,
        headers() {
          return {
            cookie,
          };
        },
      }),
    ],
  });
}

async function createAdminClient(baseUrl: string) {
  const login = await loginViaIap(
    baseUrl,
    DEFAULT_ADMIN_EMAIL,
    DEFAULT_ADMIN_OPEN_ID
  );
  return createClient(baseUrl, login.cookie);
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
    `Expected login redirect, got HTTP ${response.status}`
  );

  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookie, "Expected IAP login to issue a session cookie");

  return {
    cookie,
    location: response.headers.get("location") ?? null,
  };
}

async function expectTrpcCode(promise: Promise<unknown>, expectedCode: string) {
  try {
    await promise;
    assert.fail(`Expected TRPC error ${expectedCode}`);
  } catch (error) {
    if (!(error instanceof TRPCClientError)) {
      throw error;
    }

    assert.equal(error.data?.code, expectedCode, error.message);
    return error;
  }
}

async function cleanupSmokeStreams(
  baseUrl: string,
  targetStreamIds?: string[]
): Promise<string[]> {
  const adminClient = await createAdminClient(baseUrl);
  const streams = await adminClient.admin.listValueStreams.query();
  const streamIds = Array.from(
    new Set(
      targetStreamIds && targetStreamIds.length > 0
        ? streams
            .filter(
              stream =>
                targetStreamIds.includes(stream.id) && isSmokeStream(stream)
            )
            .map(stream => stream.id)
        : streams.filter(isSmokeStream).map(stream => stream.id)
    )
  );

  const deleted: string[] = [];
  for (const streamId of streamIds) {
    log(`Cleaning up smoke stream ${streamId}`);
    await adminClient.admin.deleteValueStream.mutate({ id: streamId });
    deleted.push(streamId);
  }

  return deleted;
}

async function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    printHelp();
    return;
  }

  const cleanupExisting = process.argv.includes("--cleanup-existing");

  const seed = Date.now();
  const email = DEFAULT_ADMIN_EMAIL;
  const openId = DEFAULT_ADMIN_OPEN_ID;
  let portForward: PortForwardHandle | null = null;
  let cleanupTargetStreamId: string | null = null;
  let cleanupDeletedIds: string[] = [];

  try {
    if (!DEFAULT_BASE_URL) {
      portForward = await startPortForward();
    }

    const effectiveBaseUrl = portForward?.baseUrl ?? DEFAULT_BASE_URL;

    log(`Using base URL ${effectiveBaseUrl}`);
    await waitForHealth(effectiveBaseUrl);

    if (cleanupExisting) {
      cleanupDeletedIds = await cleanupSmokeStreams(effectiveBaseUrl);
      console.log(
        JSON.stringify(
          {
            status: "passed",
            mode: "cleanup-existing",
            deletedCount: cleanupDeletedIds.length,
            deletedStreamIds: cleanupDeletedIds,
            usedPortForward: !DEFAULT_BASE_URL,
            namespace: DEFAULT_NAMESPACE,
            service: DEFAULT_SERVICE,
          },
          null,
          2
        )
      );
      return;
    }

    log("Logging in via IAP headers");
    const login = await loginViaIap(effectiveBaseUrl, email, openId);
    assert.ok(
      typeof login.location === "string" && login.location.startsWith("/"),
      `Expected login redirect to a first-party route, got ${String(login.location)}`
    );

    const client = createClient(effectiveBaseUrl, login.cookie);

    log("Checking initial role");
    const currentUser = await client.auth.me.query();
    assert.ok(currentUser, "Expected an authenticated user after IAP login");
    assert.ok(
      currentUser.role === "admin" || currentUser.role === "manager",
      "Expected an admin or manager account for KB provisioning"
    );

    log("Provisioning a new knowledge base");
    const stream = await client.admin.provisionKnowledgeBase.mutate({
      name: `HVSI GKE Smoke ${seed}`,
      description: "Post-deploy hermetic value stream isolation smoke test",
      icon: "x",
    });

    assert.ok(stream.id, "Expected provisioned stream id");
    cleanupTargetStreamId = stream.id;

    const provisioner = await client.auth.me.query();
    assert.ok(provisioner, "Expected authenticated user after provisioning");
    assert.equal(provisioner.role, currentUser.role);
    assert.ok(
      provisioner.valueStreams?.includes(stream.id),
      "Expected the creator to be assigned to the provisioned stream"
    );

    log("Verifying omitted stream selection fails closed");
    await expectTrpcCode(
      client.knowledge.launchReadiness.query({}),
      "BAD_REQUEST"
    );

    if (currentUser.role !== "admin") {
      log("Verifying unassigned stream access is forbidden");
      await expectTrpcCode(
        client.knowledge.launchReadiness.query({
          valueStreamId: `unassigned-${seed}`,
        }),
        "FORBIDDEN"
      );
    }

    log("Checking scoped launch readiness");
    const readiness = await client.knowledge.launchReadiness.query({
      valueStreamId: stream.id,
    });
    assert.equal(typeof readiness.ready, "boolean");
    assert.equal(typeof readiness.score, "number");
    assert.equal(typeof readiness.summary, "string");

    log("Creating a scoped release candidate");
    const release = await client.knowledge.createRelease.mutate({
      valueStreamId: stream.id,
      label: `Candidate ${seed}`,
      notes: "Post-deploy HVSI smoke release",
    });

    const releases = await client.knowledge.listReleases.query({
      valueStreamId: stream.id,
    });
    assert.ok(
      releases.some(item => item.id === release.id),
      "Expected the created release to appear in listReleases"
    );

    console.log(
      JSON.stringify(
        {
          status: "passed",
          baseUrl: effectiveBaseUrl,
          email,
          userId: provisioner.id,
          roleBefore: currentUser.role,
          roleAfter: provisioner.role,
          streamId: stream.id,
          releaseId: release.id,
          releaseStatus: release.status,
          readinessReady: readiness.ready,
          readinessScore: readiness.score,
          readinessSummary: readiness.summary,
          cleanupPlanned: !SKIP_CLEANUP,
          usedPortForward: !DEFAULT_BASE_URL,
          namespace: DEFAULT_NAMESPACE,
          service: DEFAULT_SERVICE,
        },
        null,
        2
      )
    );
  } finally {
    const effectiveBaseUrl = portForward?.baseUrl ?? DEFAULT_BASE_URL;
    if (
      !cleanupExisting &&
      !SKIP_CLEANUP &&
      cleanupTargetStreamId &&
      effectiveBaseUrl
    ) {
      try {
        cleanupDeletedIds = await cleanupSmokeStreams(effectiveBaseUrl, [
          cleanupTargetStreamId,
        ]);
        if (cleanupDeletedIds.length > 0) {
          log(`Cleanup complete: ${cleanupDeletedIds.join(", ")}`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(
          `[kb-gke-hvsi-smoke] Cleanup failed for ${cleanupTargetStreamId}: ${message}`
        );
        process.exitCode = 1;
      }
    }

    await stopPortForward(portForward);
  }
}

main().catch(error => {
  console.error("[kb-gke-hvsi-smoke] Failed");
  console.error(error);
  process.exitCode = 1;
});
