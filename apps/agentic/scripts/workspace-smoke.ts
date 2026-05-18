import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Locator, type Page } from "playwright";

const BASE_URL = (
  process.env.AGENTIC_BASE_URL ?? "http://127.0.0.1:9001"
).replace(/\/$/, "");
const HEADLESS = process.env.AGENTIC_WORKSPACE_SMOKE_HEADLESS !== "false";
const BROWSER_CHANNEL =
  process.env.AGENTIC_WORKSPACE_SMOKE_BROWSER_CHANNEL ??
  process.env.KB_UI_E2E_BROWSER_CHANNEL ??
  "chrome";
const TIMEOUT_MS = Number(
  process.env.AGENTIC_WORKSPACE_SMOKE_TIMEOUT_MS ?? 60_000
);
const EXISTING_STREAM_ID =
  process.env.AGENTIC_WORKSPACE_SMOKE_STREAM_ID?.trim();
const SCREENSHOT_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../.dev/workspace-smoke-failure.png"
);

function log(message: string) {
  console.log(`[workspace-smoke] ${message}`);
}

async function waitForVisible(locator: Locator, timeout = TIMEOUT_MS) {
  await locator.first().waitFor({ state: "visible", timeout });
  return locator.first();
}

async function waitForAnyVisible(
  page: Page,
  candidates: { label: string; locator: Locator }[],
  timeout = TIMEOUT_MS
) {
  const deadline = Date.now() + timeout;
  let lastError: unknown = null;

  while (Date.now() < deadline) {
    for (const candidate of candidates) {
      try {
        if (
          (await candidate.locator.count()) > 0 &&
          (await candidate.locator.first().isVisible())
        ) {
          return candidate;
        }
      } catch (error) {
        lastError = error;
      }
    }

    await page.waitForTimeout(250);
  }

  throw new Error(
    `Timed out waiting for one of: ${candidates
      .map(candidate => candidate.label)
      .join(
        ", "
      )}${lastError instanceof Error ? ` (${lastError.message})` : ""}`
  );
}

function buildDevLoginUrl(redirect: string) {
  const params = new URLSearchParams({
    role: "admin",
    redirect,
  });
  return `${BASE_URL}/api/dev-login?${params.toString()}`;
}

async function devLogin(page: Page, redirect: string) {
  log(`Signing in through dev login for ${redirect}`);
  await page.goto(buildDevLoginUrl(redirect), {
    waitUntil: "networkidle",
    timeout: TIMEOUT_MS,
  });
}

async function createDomain(page: Page) {
  const suffix = Date.now();
  const streamName = `Workspace Smoke ${suffix}`;
  const streamDescription =
    "Smoke-test domain for verifying the Agentic chat and knowledge workspaces.";

  await devLogin(page, "/knowledge/create");
  await waitForVisible(page.getByTestId("kb-create-name"));

  log(`Creating domain "${streamName}"`);
  await page.getByTestId("kb-create-name").fill(streamName);
  await page.getByTestId("kb-create-description").fill(streamDescription);
  await page.getByTestId("kb-create-submit").click();

  await waitForVisible(page.getByTestId("kb-create-open"));
  await page.getByTestId("kb-create-open").click();
  await page.waitForURL(/\/knowledge\?stream=/, { timeout: TIMEOUT_MS });

  const streamId = new URL(page.url()).searchParams.get("stream");
  assert.ok(streamId, "Expected created domain URL to include stream");

  return {
    streamId,
    streamName,
  };
}

async function openDomain(page: Page) {
  if (EXISTING_STREAM_ID) {
    await devLogin(
      page,
      `/knowledge?stream=${encodeURIComponent(EXISTING_STREAM_ID)}`
    );
    return {
      streamId: EXISTING_STREAM_ID,
      streamName: EXISTING_STREAM_ID,
    };
  }

  return createDomain(page);
}

async function verifyKnowledgeWorkspace(page: Page, streamId: string) {
  log(`Checking Knowledge workspace for ${streamId}`);
  await page.goto(
    `${BASE_URL}/knowledge?stream=${encodeURIComponent(streamId)}`,
    {
      waitUntil: "domcontentloaded",
      timeout: TIMEOUT_MS,
    }
  );

  await waitForAnyVisible(page, [
    {
      label: "Knowledge sidebar",
      locator: page.getByLabel("Knowledge Domains Home"),
    },
    {
      label: "onboarding start",
      locator: page.getByTestId("kb-onboarding-get-started"),
    },
    {
      label: "domain guide start",
      locator: page.getByTestId("kb-guide-start"),
    },
    {
      label: "Knowledge heading",
      locator: page.getByText("Knowledge Domains"),
    },
  ]);

  assert.match(page.url(), /\/knowledge/, "Expected Knowledge workspace URL");
  assert.ok(
    !page.url().includes("/login"),
    "Knowledge workspace redirected to login"
  );
}

async function verifyChatWorkspace(page: Page, streamId: string) {
  log(`Checking Chat workspace for ${streamId}`);
  await page.goto(`${BASE_URL}/chat?scope=${encodeURIComponent(streamId)}`, {
    waitUntil: "domcontentloaded",
    timeout: TIMEOUT_MS,
  });

  await waitForVisible(page.getByRole("application", { name: "HKI Agent" }));
  await waitForVisible(page.getByRole("main", { name: "Chat" }));

  const input = await waitForVisible(page.getByLabel("Message input"));
  const prompt = `Smoke check ${new Date().toISOString()}`;
  await input.fill(prompt);
  assert.equal(await input.inputValue(), prompt);

  const sendButton = await waitForVisible(
    page.getByRole("button", { name: "Send message" })
  );
  assert.equal(
    await sendButton.isDisabled(),
    false,
    "Send button should be enabled after entering a prompt"
  );

  const knowledgeLink = page.getByLabel("Open Knowledge Domains").first();
  await waitForVisible(knowledgeLink);
  const href = await knowledgeLink.getAttribute("href");
  assert.ok(
    href?.includes(encodeURIComponent(streamId)),
    `Expected Knowledge navigation to preserve stream ${streamId}; got ${href}`
  );
}

async function run() {
  const browser = await chromium.launch({
    ...(BROWSER_CHANNEL ? { channel: BROWSER_CHANNEL } : {}),
    headless: HEADLESS,
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);

  try {
    const domain = await openDomain(page);
    await verifyKnowledgeWorkspace(page, domain.streamId);
    await verifyChatWorkspace(page, domain.streamId);

    console.log(
      JSON.stringify(
        {
          status: "passed",
          baseUrl: BASE_URL,
          streamId: domain.streamId,
          streamName: domain.streamName,
        },
        null,
        2
      )
    );
  } catch (error) {
    log(`Failure captured. Screenshot: ${SCREENSHOT_PATH}`);
    await mkdir(path.dirname(SCREENSHOT_PATH), { recursive: true });
    await page
      .screenshot({ path: SCREENSHOT_PATH, fullPage: true })
      .catch(() => {});
    throw error;
  } finally {
    await context.close();
    await browser.close();
  }
}

run().catch(error => {
  console.error("[workspace-smoke] Failed");
  console.error(error);
  process.exit(1);
});
