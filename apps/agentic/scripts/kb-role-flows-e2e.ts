import assert from "node:assert/strict";
import { chromium, type Browser, type Page } from "playwright";

const BASE_URL = process.env.AGENTIC_BASE_URL ?? "http://127.0.0.1:9001";
const TARGET_STREAM_ID = process.env.KB_UI_E2E_STREAM_ID?.trim() || "";
const BROWSER_BINARY = process.env.KB_UI_E2E_BROWSER_BINARY?.trim() || "";
const HEADLESS = process.env.KB_UI_E2E_HEADLESS !== "false";
const BROWSER_CHANNEL = process.env.KB_UI_E2E_BROWSER_CHANNEL ?? "chrome";
const TIMEOUT_MS = Number(process.env.KB_UI_E2E_TIMEOUT_MS ?? 120_000);
const MAX_GUIDE_SECTIONS = Number(
  process.env.KB_UI_E2E_MAX_GUIDE_SECTIONS ?? 12
);
const CASE_FILTER = new Set(
  (process.env.KB_ROLE_SMOKE_CASES ?? "")
    .split(",")
    .map(value => value.trim())
    .filter(Boolean)
);

type SmokeCase = {
  label: string;
  login: Record<string, string>;
  expectedPath: string;
  expectedUrlIncludes?: string[];
  waitForText: string[];
  requiredText: string[];
  requiredAnyText?: string[];
  forbiddenText: string[];
  beforeAssert?: (page: Page) => Promise<void>;
};

function log(message: string) {
  console.log(`[kb-role-e2e] ${message}`);
}

function buildDevLoginUrl(params: Record<string, string>) {
  const url = new URL(`${BASE_URL}/api/dev-login`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

async function waitForBodyText(page: Page, markers: string[]) {
  const startedAt = Date.now();
  let lastText = "";

  while (Date.now() - startedAt < TIMEOUT_MS) {
    lastText = normalizeText((await page.locator("body").innerText()) || "");

    if (lastText.includes("Something went wrong")) {
      throw new Error(`Runtime error rendered in browser:\n${lastText}`);
    }

    if (markers.every(marker => lastText.includes(marker))) {
      return lastText;
    }

    await page.waitForTimeout(500);
  }

  return lastText;
}

async function clickByText(page: Page, text: string | RegExp) {
  const locator = page.getByText(text, { exact: false }).first();
  await locator.waitFor({ state: "visible", timeout: TIMEOUT_MS });
  await locator.click();
}

async function waitForKnowledgeLoaderToClear(page: Page) {
  await page
    .getByText(/Preparing your workspace/i)
    .first()
    .waitFor({ state: "hidden", timeout: TIMEOUT_MS })
    .catch(() => undefined);
}

async function waitForTabContentLoaderToClear(page: Page) {
  await page
    .getByText(/^Loading view$/i)
    .first()
    .waitFor({ state: "hidden", timeout: TIMEOUT_MS })
    .catch(() => undefined);
}

async function advanceGuideToAttestation(page: Page) {
  const attestCheckbox = page
    .locator('[data-testid="kb-guide-attest-checkbox"]')
    .first();
  const nextButton = page.locator('[data-testid="kb-guide-next"]').first();
  let completedSections = 0;

  while (completedSections < MAX_GUIDE_SECTIONS) {
    if (await attestCheckbox.isVisible().catch(() => false)) {
      return;
    }

    await nextButton.waitFor({ state: "visible", timeout: TIMEOUT_MS });
    const previousLabel = await nextButton.textContent();
    await nextButton.click({ force: true });

    await page.waitForFunction(
      previousText => {
        const attest = document.querySelector(
          '[data-testid="kb-guide-attest-checkbox"]'
        );
        if (attest instanceof HTMLElement && attest.offsetParent !== null) {
          return true;
        }

        const next = document.querySelector('[data-testid="kb-guide-next"]');
        return next instanceof HTMLElement && next.textContent !== previousText;
      },
      previousLabel,
      { timeout: TIMEOUT_MS }
    );

    completedSections += 1;
  }

  throw new Error(
    `Guide attestation was not reached after ${MAX_GUIDE_SECTIONS} sections`
  );
}

async function login(browser: Browser, params: Record<string, string>) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(buildDevLoginUrl(params), {
    waitUntil: "domcontentloaded",
    timeout: TIMEOUT_MS,
  });
  await page.waitForTimeout(1200);
  return { context, page };
}

async function provisionWorkspace(browser: Browser) {
  const unique = `provision-${Date.now()}`;
  const { context, page } = await login(browser, {
    role: "manager",
    openId: `dev-${unique}`,
    email: `${unique}@hki.com`,
    redirect: "/knowledge/create",
  });

  try {
    log("Provisioning a smoke workspace");
    await page
      .locator('[data-testid="kb-create-name"]')
      .fill(`KB Role Smoke ${Date.now()}`);
    await page
      .locator('[data-testid="kb-create-description"]')
      .fill("Workspace used to validate KB role flows in local smoke tests.");
    await page.locator('[data-testid="kb-create-submit"]').click();
    await page.locator('[data-testid="kb-create-open"]').waitFor({
      timeout: TIMEOUT_MS,
    });
    await page.locator('[data-testid="kb-create-open"]').click();
    await page.waitForURL(/\/knowledge\?stream=/, { timeout: TIMEOUT_MS });

    const streamId = new URL(page.url()).searchParams.get("stream");
    assert.ok(
      streamId,
      "Provisioned knowledge base did not expose a stream id"
    );
    return streamId;
  } finally {
    await context.close();
  }
}

async function resolveSmokeStreamId(browser: Browser) {
  if (TARGET_STREAM_ID) {
    log(`Using provided stream ${TARGET_STREAM_ID}`);
    return TARGET_STREAM_ID;
  }

  return provisionWorkspace(browser);
}

async function runCase(browser: Browser, testCase: SmokeCase) {
  const unique = `${testCase.label}-${Date.now()}`;
  const loginParams = Object.fromEntries(
    Object.entries(testCase.login).map(([key, value]) => [
      key,
      value
        .replace("__UNIQUE__", unique)
        .replace("__EMAIL__", `${unique}@hki.com`),
    ])
  );

  const { context, page } = await login(browser, loginParams);

  try {
    log(`Logging in as ${testCase.label}`);

    if (testCase.beforeAssert) {
      await testCase.beforeAssert(page);
    }

    const text = await waitForBodyText(page, testCase.waitForText);
    const excerpt = text.slice(0, 1200);
    const currentUrl = page.url();
    const location = new URL(currentUrl).pathname;

    assert.equal(
      location,
      testCase.expectedPath,
      `${testCase.label}: expected path ${testCase.expectedPath} but got ${location}\n\n${excerpt}`
    );

    for (const expectedUrlFragment of testCase.expectedUrlIncludes ?? []) {
      assert.ok(
        currentUrl.includes(expectedUrlFragment),
        `${testCase.label}: expected URL to include "${expectedUrlFragment}" but got ${currentUrl}\n\n${excerpt}`
      );
    }

    for (const marker of testCase.requiredText) {
      assert.ok(
        text.includes(marker),
        `${testCase.label}: expected visible text to include \"${marker}\"\n\n${excerpt}`
      );
    }

    if (testCase.requiredAnyText?.length) {
      assert.ok(
        testCase.requiredAnyText.some(marker => text.includes(marker)),
        `${testCase.label}: expected visible text to include one of ${testCase.requiredAnyText
          .map(marker => `\"${marker}\"`)
          .join(", ")}\n\n${excerpt}`
      );
    }

    for (const marker of testCase.forbiddenText) {
      assert.ok(
        !text.includes(marker),
        `${testCase.label}: expected visible text to exclude \"${marker}\"\n\n${excerpt}`
      );
    }

    return {
      label: testCase.label,
      path: location,
      expectedUrlIncludes: testCase.expectedUrlIncludes,
      waitForText: testCase.waitForText,
      requiredText: testCase.requiredText,
      requiredAnyText: testCase.requiredAnyText,
      forbiddenText: testCase.forbiddenText,
    };
  } finally {
    await context.close();
  }
}

async function run() {
  const browser = await chromium.launch(
    BROWSER_BINARY
      ? {
          executablePath: BROWSER_BINARY,
          headless: HEADLESS,
        }
      : {
          channel: BROWSER_CHANNEL,
          headless: HEADLESS,
        }
  );

  try {
    const streamId = await resolveSmokeStreamId(browser);
    const streamRedirect = `/knowledge?stream=${encodeURIComponent(streamId)}`;
    const streamIngestRedirect = `${streamRedirect}&tab=ingest`;
    const cases: SmokeCase[] = [
      {
        label: "viewer",
        login: {
          role: "viewer",
          openId: "dev-__UNIQUE__",
          email: "__EMAIL__",
          valueStreams: streamId,
          redirect: streamRedirect,
        },
        expectedPath: "/welcome",
        waitForText: ["Request Access", "Join with Invite Code"],
        requiredText: ["Request Access", "Join with Invite Code"],
        requiredAnyText: ["Knowledge Base", "Curate trusted content"],
        forbiddenText: [
          "No workspaces available",
          "Create workspace",
          "Open Agent",
        ],
      },
      {
        label: "operator-can-add",
        login: {
          role: "operator",
          openId: "dev-__UNIQUE__",
          email: "__EMAIL__",
          valueStreams: streamId,
          redirect: streamIngestRedirect,
        },
        expectedPath: "/knowledge",
        waitForText: ["Upload queue"],
        requiredText: ["Upload queue"],
        requiredAnyText: [
          "Drag files here",
          "Document settings",
          "Ingest is disabled for this deployment",
          "No ingest methods are currently enabled",
        ],
        forbiddenText: [
          "No workspaces available",
          "Create workspace",
          "Review & Publish",
          "Users & Access",
          "Read Playbook",
          "View Playbook",
          "Enterprise Hub",
        ],
        beforeAssert: async page => {
          await waitForKnowledgeLoaderToClear(page);
          await clickByText(page, /^Add$/i);
          await page
            .locator('[data-testid="kb-ingest-method-file"]')
            .waitFor({ state: "visible", timeout: TIMEOUT_MS });
        },
      },
      {
        label: "manager-kb-admin",
        login: {
          role: "manager",
          openId: "dev-__UNIQUE__",
          email: "__EMAIL__",
          valueStreams: streamId,
          redirect: streamRedirect,
        },
        expectedPath: "/knowledge",
        waitForText: ["Add", "Review & Publish"],
        requiredText: ["Add", "Review & Publish"],
        forbiddenText: ["Enterprise Hub"],
      },
      {
        label: "manager-first-run",
        login: {
          role: "manager",
          openId: "dev-__UNIQUE__",
          email: "__EMAIL__",
          valueStreams: streamId,
          redirect: streamRedirect,
        },
        expectedPath: "/knowledge",
        waitForText: ["Add", "Review & Publish"],
        requiredText: ["Add", "Review & Publish"],
        requiredAnyText: [
          "Read Playbook",
          "Read playbook",
          "Welcome to your Knowledge Base",
          "Start here",
          "Short guide to read",
          "This is where you teach your AI agent what it needs to know.",
        ],
        forbiddenText: ["Something went wrong", "No workspaces available"],
        beforeAssert: async page => {
          await waitForTabContentLoaderToClear(page);
        },
      },
      {
        label: "manager-attested",
        login: {
          role: "manager",
          openId: "dev-__UNIQUE__",
          email: "__EMAIL__",
          valueStreams: streamId,
          redirect: streamRedirect,
        },
        expectedPath: "/knowledge",
        waitForText: ["View Playbook"],
        requiredText: ["View Playbook"],
        requiredAnyText: [
          "Validate",
          "Test Answers",
          "Guided setup",
          "Start tour",
          "Resume tour",
        ],
        forbiddenText: [
          "Something went wrong",
          "No workspaces available",
          "Read Playbook",
          "Read playbook",
        ],
        beforeAssert: async page => {
          await clickByText(page, /Read Playbook/i);
          await page.locator('[data-testid="kb-guide-start"]').click();
          await advanceGuideToAttestation(page);
          await page
            .locator('[data-testid="kb-guide-attest-checkbox"]')
            .click();
          await page.locator('[data-testid="kb-guide-attest-submit"]').click();
          await waitForBodyText(page, ["View Playbook"]);
        },
      },
      {
        label: "manager-admin-redirect",
        login: {
          role: "manager",
          openId: "dev-__UNIQUE__",
          email: "__EMAIL__",
          valueStreams: streamId,
          redirect: "/admin",
        },
        expectedPath: "/knowledge",
        expectedUrlIncludes: [`stream=${encodeURIComponent(streamId)}`],
        waitForText: ["Add", "Review & Publish"],
        requiredText: ["Add", "Review & Publish"],
        forbiddenText: ["Enterprise Hub"],
      },
      {
        label: "admin-first-run",
        login: {
          role: "admin",
          openId: "dev-__UNIQUE__",
          email: "__EMAIL__",
          redirect: streamRedirect,
        },
        expectedPath: "/knowledge",
        waitForText: ["Add", "Review & Publish"],
        requiredText: ["Add", "Review & Publish"],
        requiredAnyText: [
          "Read Playbook",
          "Read playbook",
          "Welcome to your Knowledge Base",
          "Start here",
          "Short guide to read",
          "This is where you teach your AI agent what it needs to know.",
        ],
        forbiddenText: ["Something went wrong", "No workspaces available"],
        beforeAssert: async page => {
          await waitForTabContentLoaderToClear(page);
        },
      },
    ];

    const activeCases = CASE_FILTER.size
      ? cases.filter(testCase => CASE_FILTER.has(testCase.label))
      : cases;

    assert.ok(activeCases.length > 0, "No KB role smoke cases selected");

    const results = [];
    const failures: Array<{ label: string; message: string }> = [];

    for (const testCase of activeCases) {
      try {
        results.push(await runCase(browser, testCase));
        log(`${testCase.label} flow passed`);
      } catch (error) {
        const message =
          error instanceof Error
            ? (error.stack ?? error.message)
            : String(error);
        failures.push({ label: testCase.label, message });
        console.error(`[kb-role-e2e] ${testCase.label} failed`);
        console.error(message);
      }
    }

    if (failures.length > 0) {
      console.log(
        JSON.stringify(
          {
            status: "failed",
            streamId,
            baseUrl: BASE_URL,
            browserBinary: BROWSER_BINARY || undefined,
            browserChannel: BROWSER_BINARY ? undefined : BROWSER_CHANNEL,
            selectedCases: activeCases.map(testCase => testCase.label),
            results,
            failures,
          },
          null,
          2
        )
      );
      process.exit(1);
    }

    console.log(
      JSON.stringify(
        {
          status: "passed",
          streamId,
          baseUrl: BASE_URL,
          browserBinary: BROWSER_BINARY || undefined,
          browserChannel: BROWSER_BINARY ? undefined : BROWSER_CHANNEL,
          selectedCases: activeCases.map(testCase => testCase.label),
          results,
        },
        null,
        2
      )
    );
  } finally {
    await browser.close();
  }
}

run().catch(error => {
  console.error("[kb-role-e2e] Failed");
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
});
