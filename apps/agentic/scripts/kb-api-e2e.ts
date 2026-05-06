import assert from "node:assert/strict";

import {
  createTRPCProxyClient,
  httpBatchLink,
  TRPCClientError,
} from "@trpc/client";
import superjson from "superjson";

import type { AppRouter } from "../server/routers";

const BASE_URL = process.env.AGENTIC_BASE_URL ?? "http://127.0.0.1:9001";

function log(message: string) {
  console.log(`[kb-api-e2e] ${message}`);
}

function buildDevLoginUrl(params: Record<string, string>) {
  const url = new URL(`${BASE_URL}/api/dev-login`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url;
}

async function login(params: Record<string, string>) {
  const response = await fetch(buildDevLoginUrl(params), {
    redirect: "manual",
  });

  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookie, "Expected dev login to issue a session cookie");
  return cookie;
}

function createClient(cookie: string) {
  return createTRPCProxyClient<AppRouter>({
    transformer: superjson,
    links: [
      httpBatchLink({
        url: `${BASE_URL}/api/trpc`,
        headers() {
          return { cookie };
        },
      }),
    ],
  });
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

async function main() {
  const seed = Date.now();

  log("Checking BFF health");
  const health = await fetch(`${BASE_URL}/api/health`).catch(() => null);
  assert.ok(health?.ok, "Agentic BFF is not reachable on :9001");

  log("Logging in as a viewer to verify provisioning is blocked");
  const viewerCookie = await login({
    role: "viewer",
    openId: `dev-viewer-${seed}`,
    email: `dev-viewer-${seed}@hki.com`,
    orgId: "kb-e2e-org-a",
    redirect: "/chat",
  });
  const viewerClient = createClient(viewerCookie);

  const initialViewer = await viewerClient.auth.me.query();
  assert.equal(initialViewer?.role, "viewer");

  log("Ensuring viewers cannot provision a knowledge base");
  await expectTrpcCode(
    viewerClient.admin.provisionKnowledgeBase.mutate({
      name: `KB API E2E ${seed}`,
      description: "Live self-service provisioning and isolation verification.",
      icon: "🧪",
    }),
    "FORBIDDEN"
  );

  log("Logging in as a manager for self-service provisioning");
  const managerCookie = await login({
    role: "manager",
    openId: `dev-manager-${seed}`,
    email: `dev-manager-${seed}@hki.com`,
    orgId: "kb-e2e-org-a",
    redirect: "/chat",
  });
  const managerClient = createClient(managerCookie);

  const initialManager = await managerClient.auth.me.query();
  assert.equal(initialManager?.role, "manager");

  log("Provisioning a knowledge base as a manager");
  const stream = await managerClient.admin.provisionKnowledgeBase.mutate({
    name: `KB API E2E ${seed}`,
    description: "Live self-service provisioning and isolation verification.",
    icon: "🧪",
  });

  const unchangedManager = await managerClient.auth.me.query();
  assert.equal(unchangedManager?.role, "manager");
  assert.ok(
    unchangedManager?.valueStreams?.includes(stream.id),
    "Expected provisioned stream to be assigned to the creator"
  );

  log("Creating a release candidate for org A");
  const releaseA = await managerClient.knowledge.createRelease.mutate({
    valueStreamId: stream.id,
    label: `Candidate ${seed}`,
    notes: "Live E2E release candidate",
  });
  assert.equal(releaseA.valueStreamId, stream.id);

  const releasesA = await managerClient.knowledge.listReleases.query({
    valueStreamId: stream.id,
  });
  assert.ok(
    releasesA.some(release => release.id === releaseA.id),
    "Expected org A to see its new release"
  );

  log("Verifying launch gates block promotion when readiness is incomplete");
  await expectTrpcCode(
    managerClient.knowledge.promoteRelease.mutate({ releaseId: releaseA.id }),
    "BAD_REQUEST"
  );

  log("Verifying candidate rollback does not bypass launch gates");
  await expectTrpcCode(
    managerClient.knowledge.rollbackRelease.mutate({ releaseId: releaseA.id }),
    "BAD_REQUEST"
  );

  log("Logging in as a second-org manager scoped to the same stream id");
  const otherCookie = await login({
    role: "manager",
    openId: `dev-manager-${seed}`,
    email: `dev-manager-${seed}@hki.com`,
    orgId: "kb-e2e-org-b",
    valueStreams: stream.id,
    redirect: "/chat",
  });
  const otherClient = createClient(otherCookie);

  const otherOrgReleasesBefore = await otherClient.knowledge.listReleases.query(
    {
      valueStreamId: stream.id,
    }
  );
  assert.equal(
    otherOrgReleasesBefore.length,
    0,
    "Expected org B not to see org A releases"
  );

  log("Creating an org B release candidate to verify tenant partitioning");
  const releaseB = await otherClient.knowledge.createRelease.mutate({
    valueStreamId: stream.id,
    label: `Org B Candidate ${seed}`,
    notes: "Org B isolation check",
  });

  const otherOrgReleasesAfter = await otherClient.knowledge.listReleases.query({
    valueStreamId: stream.id,
  });
  assert.deepEqual(
    otherOrgReleasesAfter.map(release => release.id),
    [releaseB.id],
    "Expected org B to see only its own releases"
  );

  const orgAReleasesAgain = await managerClient.knowledge.listReleases.query({
    valueStreamId: stream.id,
  });
  assert.ok(
    orgAReleasesAgain.some(release => release.id === releaseA.id),
    "Expected org A release to remain visible to org A"
  );
  assert.ok(
    !orgAReleasesAgain.some(release => release.id === releaseB.id),
    "Expected org A not to see org B release"
  );

  log("Verifying managers cannot query unassigned streams live");
  await expectTrpcCode(
    otherClient.knowledge.launchReadiness.query({ valueStreamId: "optical" }),
    "FORBIDDEN"
  );

  console.log(
    JSON.stringify(
      {
        status: "passed",
        baseUrl: BASE_URL,
        streamId: stream.id,
        orgAReleaseId: releaseA.id,
        orgBReleaseId: releaseB.id,
      },
      null,
      2
    )
  );
}

main().catch(error => {
  console.error("[kb-api-e2e] Failed");
  console.error(error);
  process.exit(1);
});
