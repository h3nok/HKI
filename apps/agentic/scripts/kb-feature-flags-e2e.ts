import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Locator, type Page } from "playwright";

const BASE_URL = process.env.AGENTIC_BASE_URL ?? "http://127.0.0.1:9001";
const HEADLESS = process.env.KB_FEATURE_FLAGS_E2E_HEADLESS !== "false";
const BROWSER_CHANNEL =
  process.env.KB_FEATURE_FLAGS_E2E_BROWSER_CHANNEL ?? "chrome";
const TIMEOUT_MS = Number(
  process.env.KB_FEATURE_FLAGS_E2E_TIMEOUT_MS ?? 120_000
);
const MAX_GUIDE_SECTIONS = Number(
  process.env.KB_FEATURE_FLAGS_E2E_MAX_GUIDE_SECTIONS ?? 12
);
const EXPLICIT_STREAM_ID =
  process.env.KB_FEATURE_FLAGS_E2E_STREAM_ID?.trim() ?? "";
const EMAIL =
  process.env.KB_FEATURE_FLAGS_E2E_EMAIL?.trim().toLowerCase() ||
  "hghebrechristos@hki.com";
const OPEN_ID =
  process.env.KB_FEATURE_FLAGS_E2E_OPEN_ID?.trim() ||
  "kb-feature-flags-e2e-admin";
const SCREENSHOT_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../.dev/kb-feature-flags-e2e-failure.png"
);

type FeatureMode = "default" | "enabled" | "disabled";

type FeatureScenario = {
  name: string;
  featureLabel: string;
  parentFeatureLabels?: string[];
  prepareDisabled?: (page: Page) => Promise<void>;
  prepareEnabled?: (page: Page) => Promise<void>;
  verifyDisabled: (page: Page, streamId: string) => Promise<void>;
  verifyEnabled: (page: Page, streamId: string) => Promise<void>;
};

const FEATURE_SCENARIOS: FeatureScenario[] = [
  {
    name: "KB Validate tab",
    featureLabel: "KB Validate tab",
    verifyDisabled: async (page, streamId) => {
      await verifyKnowledgeNavVisibility(page, streamId, "Test Answers", false);
    },
    verifyEnabled: async (page, streamId) => {
      await verifyKnowledgeNavVisibility(page, streamId, "Test Answers", true);
    },
  },
  {
    name: "Knowledge text paste",
    featureLabel: "Knowledge text paste",
    parentFeatureLabels: ["KB Add Knowledge tab"],
    verifyDisabled: async (page, streamId) => {
      await verifyIngestMethodEnabled(page, streamId, "text", false);
    },
    verifyEnabled: async (page, streamId) => {
      await verifyIngestMethodEnabled(page, streamId, "text", true);
    },
  },
  {
    name: "KB Library collections view",
    featureLabel: "KB Library collections view",
    parentFeatureLabels: ["KB Library tab"],
    verifyDisabled: async (page, streamId) => {
      await verifyLibrarySubviewVisibility(
        page,
        streamId,
        /Collections/i,
        false
      );
    },
    verifyEnabled: async (page, streamId) => {
      await verifyLibrarySubviewVisibility(
        page,
        streamId,
        /Collections/i,
        true
      );
    },
  },
  {
    name: "KB Govern users and access",
    featureLabel: "KB Govern users and access",
    parentFeatureLabels: ["KB Govern tab"],
    verifyDisabled: async (page, streamId) => {
      await verifyGovernSubviewVisibility(
        page,
        streamId,
        /Users\s*&\s*Access/i,
        false
      );
    },
    verifyEnabled: async (page, streamId) => {
      await verifyGovernSubviewVisibility(
        page,
        streamId,
        /Users\s*&\s*Access/i,
        true
      );
    },
  },
  {
    name: "KB Activity alert history",
    featureLabel: "KB Activity alert history",
    parentFeatureLabels: ["KB Activity tab"],
    verifyDisabled: async (page, streamId) => {
      await verifyActivitySubviewVisibility(
        page,
        streamId,
        /Alert History/i,
        false
      );
    },
    verifyEnabled: async (page, streamId) => {
      await verifyActivitySubviewVisibility(
        page,
        streamId,
        /Alert History/i,
        true
      );
    },
  },
  {
    name: "Chat activity panel",
    featureLabel: "Chat activity panel",
    prepareDisabled: async page => {
      await ensureDebugSessionActive(page);
    },
    prepareEnabled: async page => {
      await ensureDebugSessionActive(page);
    },
    verifyDisabled: async (page, streamId) => {
      await verifyChatActivityPanelVisibility(page, streamId, false);
    },
    verifyEnabled: async (page, streamId) => {
      await verifyChatActivityPanelVisibility(page, streamId, true);
    },
  },
];

const FEATURE_DEFAULT_ENABLED_BY_LABEL: Record<string, boolean> = {
  "KB Validate tab": true,
  "Knowledge text paste": true,
  "KB Add Knowledge tab": true,
  "KB Library collections view": true,
  "KB Library tab": true,
  "KB Govern users and access": true,
  "KB Govern tab": true,
  "KB Activity alert history": true,
  "KB Activity tab": true,
  "Chat activity panel": false,
};

function log(message: string) {
  console.log(`[kb-feature-flags-e2e] ${message}`);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isLocalBaseUrl(): boolean {
  const hostname = new URL(BASE_URL).hostname;
  return hostname === "127.0.0.1" || hostname === "localhost";
}

async function sleep(ms: number) {
  await new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForVisible(locator: Locator, timeout = TIMEOUT_MS) {
  await locator.first().waitFor({ state: "visible", timeout });
  return locator.first();
}

async function click(locator: Locator, timeout = TIMEOUT_MS) {
  const button = await waitForVisible(locator, timeout);
  await button.click();
}

async function fill(locator: Locator, value: string) {
  const input = await waitForVisible(locator);
  await input.fill(value);
}

async function isVisible(locator: Locator): Promise<boolean> {
  const count = await locator.count();
  if (count === 0) return false;

  try {
    return await locator.first().isVisible();
  } catch {
    return false;
  }
}

async function expectVisible(locator: Locator, message: string) {
  try {
    await waitForVisible(locator);
  } catch {
    assert.fail(message);
  }
}

async function expectNotVisible(locator: Locator, message: string) {
  const count = await locator.count();
  if (count === 0) return;

  assert.equal(await locator.first().isVisible(), false, message);
}

async function waitForCondition(
  condition: () => Promise<boolean>,
  message: string,
  timeout = TIMEOUT_MS
) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await condition()) return;
    await sleep(250);
  }

  throw new Error(message);
}

async function goto(page: Page, url: string) {
  await page.goto(url, {
    waitUntil: "networkidle",
    timeout: TIMEOUT_MS,
  });
}

async function loginWithIapHeaders() {
  const response = await fetch(`${BASE_URL}/api/auth/google/login`, {
    headers: {
      "x-goog-authenticated-user-email": `accounts.google.com:${EMAIL}`,
      "x-goog-authenticated-user-id": `accounts.google.com:${OPEN_ID}`,
      Accept: "text/html",
    },
    redirect: "manual",
  });

  assert.ok(
    response.status >= 300 && response.status < 400,
    `Expected redirect from remote login, got ${response.status}`
  );

  const cookieHeader = response.headers.get("set-cookie");
  assert.ok(cookieHeader, "Expected remote login to return a session cookie");

  const [nameValue] = cookieHeader.split(";");
  const eqIndex = nameValue.indexOf("=");
  assert.ok(eqIndex > 0, "Malformed set-cookie header from remote login");

  return {
    name: nameValue.slice(0, eqIndex),
    value: nameValue.slice(eqIndex + 1),
    location: response.headers.get("location") ?? null,
  };
}

async function createAuthenticatedPage() {
  const browser = await chromium.launch({
    channel: BROWSER_CHANNEL,
    headless: HEADLESS,
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1200 },
  });

  if (isLocalBaseUrl()) {
    const page = await context.newPage();
    log(`Logging in through dev bypass at ${BASE_URL}`);
    await goto(page, `${BASE_URL}/api/dev-login`);
    return { browser, context, page };
  }

  log(`Logging in through IAP headers at ${BASE_URL}`);
  const session = await loginWithIapHeaders();
  log(`Login redirect target: ${session.location}`);

  await context.addCookies([
    {
      name: session.name,
      value: session.value,
      domain: new URL(BASE_URL).hostname,
      path: "/",
      httpOnly: true,
      secure: BASE_URL.startsWith("https://"),
      sameSite: "None",
    },
  ]);

  const page = await context.newPage();
  return { browser, context, page };
}

async function completeGuide(page: Page) {
  log("Completing mandatory setup guide");
  await click(page.getByTestId("kb-guide-start"));

  const attestCheckbox = page.getByTestId("kb-guide-attest-checkbox");
  const nextButton = page.getByTestId("kb-guide-next");
  let completedSections = 0;

  while (completedSections < MAX_GUIDE_SECTIONS) {
    if (await isVisible(attestCheckbox)) {
      break;
    }

    const button = await waitForVisible(nextButton);
    const previousLabel = await button.textContent();

    await button.click({ force: true });
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

  if (!(await isVisible(attestCheckbox))) {
    throw new Error(
      `Guide attestation was not reached after ${MAX_GUIDE_SECTIONS} sections`
    );
  }

  await attestCheckbox.check();
  await click(page.getByTestId("kb-guide-attest-submit"));
  await page.waitForLoadState("networkidle");
}

async function ensureKnowledgeReady(page: Page) {
  await waitForCondition(async () => {
    if (await isVisible(page.getByTestId("kb-guide-start"))) {
      return true;
    }

    return isVisible(page.getByRole("button", { name: /^Overview$/i }));
  }, "Knowledge workspace did not load");

  if (await isVisible(page.getByTestId("kb-guide-start"))) {
    await completeGuide(page);
    await waitForVisible(page.getByRole("button", { name: /^Overview$/i }));
  }
}

async function provisionKnowledgeStream(page: Page): Promise<{
  streamId: string;
  streamName: string;
}> {
  if (EXPLICIT_STREAM_ID) {
    await goto(
      page,
      `${BASE_URL}/knowledge?stream=${encodeURIComponent(EXPLICIT_STREAM_ID)}`
    );
    await ensureKnowledgeReady(page);
    return {
      streamId: EXPLICIT_STREAM_ID,
      streamName: EXPLICIT_STREAM_ID,
    };
  }

  const streamName = `Feature Flags E2E ${Date.now()}`;
  const streamDescription =
    "Temporary stream for validating feature flag gating in the Knowledge and Chat workspaces.";

  log("Creating a dedicated knowledge stream for flag validation");
  await goto(page, `${BASE_URL}/knowledge/create`);
  await fill(page.getByTestId("kb-create-name"), streamName);
  await fill(page.getByTestId("kb-create-description"), streamDescription);
  await click(page.getByTestId("kb-create-submit"));
  await click(page.getByTestId("kb-create-open"), TIMEOUT_MS);
  await page.waitForURL(/\/knowledge\?stream=/, { timeout: TIMEOUT_MS });

  const streamId = new URL(page.url()).searchParams.get("stream");
  assert.ok(streamId, "Expected a stream id in the knowledge workspace URL");
  await ensureKnowledgeReady(page);

  return {
    streamId,
    streamName,
  };
}

async function openKnowledgeWorkspace(page: Page, streamId: string) {
  await goto(
    page,
    `${BASE_URL}/knowledge?stream=${encodeURIComponent(streamId)}`
  );
  await ensureKnowledgeReady(page);
}

function knowledgeNavLocator(page: Page, label: string) {
  const pattern =
    label === "Test Answers" || label === "Validate"
      ? /^(Test Answers|Validate)$/i
      : label === "Add Knowledge" || label === "Add"
        ? /^(Add Knowledge|Add)$/i
        : new RegExp(`^${escapeRegExp(label)}$`, "i");

  return page.getByRole("button", { name: pattern });
}

async function openKnowledgeNav(page: Page, streamId: string, label: string) {
  await openKnowledgeWorkspace(page, streamId);
  await click(knowledgeNavLocator(page, label));
}

async function verifyKnowledgeNavVisibility(
  page: Page,
  streamId: string,
  label: string,
  visible: boolean
) {
  await openKnowledgeWorkspace(page, streamId);
  const locator = knowledgeNavLocator(page, label);

  if (visible) {
    await expectVisible(locator, `Expected ${label} to be visible in KB nav`);
    return;
  }

  await expectNotVisible(locator, `Did not expect ${label} in KB nav`);
}

async function verifyIngestMethodEnabled(
  page: Page,
  streamId: string,
  method: "text" | "file" | "url" | "connect",
  enabled: boolean
) {
  await openKnowledgeNav(page, streamId, "Add Knowledge");

  const locator = page.getByTestId(`kb-ingest-method-${method}`);
  if (enabled) {
    await expectVisible(locator, `Expected ingest method ${method} to render`);
    assert.equal(
      await locator.isEnabled(),
      true,
      `Expected ingest method ${method} enabled=true`
    );
    return;
  }

  const count = await locator.count();
  if (count === 0) {
    return;
  }

  assert.equal(
    await locator.first().isEnabled(),
    false,
    `Expected ingest method ${method} enabled=false`
  );
}

async function verifyLibrarySubviewVisibility(
  page: Page,
  streamId: string,
  name: RegExp,
  visible: boolean
) {
  await openKnowledgeNav(page, streamId, "Library");
  const locator = page
    .getByRole("tablist", { name: /Library sub-views/i })
    .getByRole("tab", { name });

  if (visible) {
    await expectVisible(
      locator,
      `Expected library sub-view ${name} to be visible`
    );
    return;
  }

  await expectNotVisible(locator, `Did not expect library sub-view ${name}`);
}

async function verifyGovernSubviewVisibility(
  page: Page,
  streamId: string,
  name: RegExp,
  visible: boolean
) {
  await openKnowledgeNav(page, streamId, "Review & Publish");
  const locator = page
    .getByRole("tablist", { name: /Governance sections/i })
    .getByRole("tab", { name });

  if (visible) {
    await expectVisible(
      locator,
      `Expected govern sub-view ${name} to be visible`
    );
    return;
  }

  await expectNotVisible(locator, `Did not expect govern sub-view ${name}`);
}

async function verifyActivitySubviewVisibility(
  page: Page,
  streamId: string,
  name: RegExp,
  visible: boolean
) {
  await openKnowledgeNav(page, streamId, "Activity");
  const locator = page
    .getByRole("tablist", { name: /Activity sections/i })
    .getByRole("tab", { name });

  if (visible) {
    await expectVisible(
      locator,
      `Expected activity sub-view ${name} to be visible`
    );
    return;
  }

  await expectNotVisible(locator, `Did not expect activity sub-view ${name}`);
}

async function verifyChatActivityPanelVisibility(
  page: Page,
  streamId: string,
  visible: boolean
) {
  await goto(page, `${BASE_URL}/chat?scope=${encodeURIComponent(streamId)}`);
  await waitForCondition(async () => {
    if (await isVisible(page.getByLabel("Message input"))) return true;
    return isVisible(page.getByRole("link", { name: /Knowledge/i }));
  }, "Chat workspace did not load");

  const locator = page.getByLabel(/activity panel/i);

  if (visible) {
    await expectVisible(
      locator,
      "Expected the chat activity panel button to be visible"
    );
    return;
  }

  await expectNotVisible(
    locator,
    "Did not expect the chat activity panel button"
  );
}

async function openAdminSettings(page: Page) {
  await goto(page, `${BASE_URL}/admin/settings`);
  await waitForCondition(async () => {
    if (await isVisible(page.getByRole("heading", { name: /^Settings$/i }))) {
      return true;
    }
    if (
      await isVisible(page.getByRole("button", { name: /Open Feature Flags/i }))
    ) {
      return true;
    }
    return isVisible(page.getByRole("button", { name: /Debug tools/i }));
  }, "Admin settings page did not load");
}

async function openAdminInventory(page: Page) {
  await openAdminSettings(page);
  const searchInput = page.getByPlaceholder(/Search controls/i);
  if (await isVisible(searchInput)) {
    return;
  }

  const allFlagsTab = page.getByRole("tab", { name: /^All Flags/i });
  if (await isVisible(allFlagsTab)) {
    await click(allFlagsTab);
  } else {
    await click(page.getByRole("button", { name: /Open Feature Flags/i }));
  }
  await waitForVisible(searchInput);
}

async function openAdminDebug(page: Page) {
  await openAdminSettings(page);
  const debugTab = page.getByRole("tab", { name: /^Debug/i });
  if (await isVisible(debugTab)) {
    await click(debugTab);
  } else {
    await click(page.getByRole("button", { name: /Debug tools/i }));
  }
  await waitForVisible(page.getByRole("button", { name: /^15m session$/i }));
}

function featureRowButton(page: Page, label: string) {
  return page
    .locator("button[aria-expanded]")
    .filter({
      has: page.getByRole("heading", { name: label, exact: true }),
    })
    .first();
}

async function expandVisibleFeatureSections(page: Page) {
  const sectionButtons = page
    .locator("button[aria-expanded]")
    .filter({ hasText: /Open|Close/i });
  const count = await sectionButtons.count();

  for (let index = 0; index < count; index += 1) {
    const button = sectionButtons.nth(index);
    if ((await button.getAttribute("aria-expanded")) === "true") {
      continue;
    }
    await button.click();
  }
}

async function openFeatureOverrideControl(page: Page, label: string) {
  await openAdminInventory(page);
  await fill(page.getByPlaceholder(/Search controls/i), label);

  let rowButton = featureRowButton(page, label);
  if ((await rowButton.count()) === 0) {
    await expandVisibleFeatureSections(page);
    rowButton = featureRowButton(page, label);
  }

  await waitForVisible(rowButton);
  if ((await rowButton.getAttribute("aria-expanded")) !== "true") {
    await rowButton.click();
  }

  const group = page
    .locator(`[aria-label="Feature state for ${label}"]`)
    .first();
  await waitForVisible(group);
  return group;
}

function featureModeItem(group: Locator, label: string) {
  return group
    .locator('[data-slot="toggle-group-item"]')
    .filter({ hasText: new RegExp(`^${escapeRegExp(label)}$`) })
    .first();
}

async function readFeatureModeFromGroup(group: Locator): Promise<FeatureMode> {
  const buttons: Array<[FeatureMode, string]> = [
    ["default", "Default"],
    ["enabled", "On"],
    ["disabled", "Off"],
  ];

  for (const [mode, label] of buttons) {
    const button = featureModeItem(group, label);
    if ((await button.getAttribute("data-state")) === "on") {
      return mode;
    }
    if ((await button.getAttribute("aria-pressed")) === "true") {
      return mode;
    }
  }

  throw new Error("Unable to determine active feature mode");
}

async function readFeatureMode(
  page: Page,
  label: string
): Promise<FeatureMode> {
  const group = await openFeatureOverrideControl(page, label);
  return readFeatureModeFromGroup(group);
}

async function setFeatureMode(page: Page, label: string, mode: FeatureMode) {
  const group = await openFeatureOverrideControl(page, label);
  const currentMode = await readFeatureModeFromGroup(group);
  if (currentMode === mode) {
    return;
  }

  const targetLabel =
    mode === "default" ? "Default" : mode === "enabled" ? "On" : "Off";
  await click(featureModeItem(group, targetLabel));

  await waitForCondition(
    async () => (await readFeatureMode(page, label)) === mode,
    `Feature ${label} did not settle into ${mode}`
  );
}

function getFeatureDefaultEnabled(label: string): boolean {
  const value = FEATURE_DEFAULT_ENABLED_BY_LABEL[label];
  assert.notEqual(
    value,
    undefined,
    `Missing default-enabled metadata for feature ${label}`
  );
  return value;
}

function getModeForEffectiveState(
  label: string,
  enabled: boolean
): FeatureMode {
  const defaultEnabled = getFeatureDefaultEnabled(label);
  if (enabled === defaultEnabled) {
    return "default";
  }

  return enabled ? "enabled" : "disabled";
}

async function setFeatureEffectiveState(
  page: Page,
  label: string,
  enabled: boolean
) {
  await setFeatureMode(page, label, getModeForEffectiveState(label, enabled));
}

async function ensureFeatureModeTracked(
  page: Page,
  originalModes: Map<string, FeatureMode>,
  label: string
) {
  if (originalModes.has(label)) {
    return;
  }

  originalModes.set(label, await readFeatureMode(page, label));
}

async function ensureDebugSessionActive(page: Page) {
  await openAdminDebug(page);
  const endSessionButton = page.getByRole("button", { name: /^End session$/i });
  const endSession = await waitForVisible(endSessionButton);
  if (!(await endSession.isDisabled())) {
    return false;
  }

  log("Starting a 15 minute debug session for chat activity validation");
  await click(page.getByRole("button", { name: /^15m session$/i }));
  await waitForCondition(
    async () => !(await endSessionButton.first().isDisabled()),
    "Debug session did not activate"
  );
  return true;
}

async function stopDebugSessionIfActive(page: Page) {
  await openAdminDebug(page);
  const endSessionButton = page.getByRole("button", { name: /^End session$/i });
  const endSession = await waitForVisible(endSessionButton);
  if (await endSession.isDisabled()) {
    return;
  }

  log("Stopping the debug session started by the e2e run");
  await endSession.click();
  await waitForCondition(
    async () => await endSessionButton.first().isDisabled(),
    "Debug session did not clear"
  );
}

async function restoreFeatureModes(
  page: Page,
  originalModes: Map<string, FeatureMode>
) {
  if (originalModes.size === 0) {
    return;
  }

  log("Restoring original feature flag modes");
  for (const [label, mode] of Array.from(originalModes.entries()).reverse()) {
    await setFeatureMode(page, label, mode);
  }
}

async function runScenario(
  page: Page,
  scenario: FeatureScenario,
  streamId: string,
  originalModes: Map<string, FeatureMode>
) {
  log(`Running scenario: ${scenario.name}`);

  await ensureFeatureModeTracked(page, originalModes, scenario.featureLabel);
  for (const parentLabel of scenario.parentFeatureLabels ?? []) {
    await ensureFeatureModeTracked(page, originalModes, parentLabel);
    await setFeatureEffectiveState(page, parentLabel, true);
  }

  if (scenario.prepareDisabled) {
    await scenario.prepareDisabled(page);
  }
  await setFeatureEffectiveState(page, scenario.featureLabel, false);
  await scenario.verifyDisabled(page, streamId);

  if (scenario.prepareEnabled) {
    await scenario.prepareEnabled(page);
  }
  await setFeatureEffectiveState(page, scenario.featureLabel, true);
  await scenario.verifyEnabled(page, streamId);

  log(`Scenario passed: ${scenario.name}`);
}

async function run() {
  const { browser, context, page } = await createAuthenticatedPage();
  page.setDefaultTimeout(20_000);

  const originalModes = new Map<string, FeatureMode>();
  const completedScenarios: string[] = [];
  let startedDebugSession = false;
  let streamId = "";
  let streamName = "";
  let failure: unknown = null;

  try {
    const provisioned = await provisionKnowledgeStream(page);
    streamId = provisioned.streamId;
    streamName = provisioned.streamName;
    log(`Using stream ${streamId}`);

    await openAdminDebug(page);
    const endSessionButton = page.getByRole("button", {
      name: /^End session$/i,
    });
    if (
      await waitForVisible(endSessionButton).then(button => button.isDisabled())
    ) {
      startedDebugSession = await ensureDebugSessionActive(page);
    }

    for (const scenario of FEATURE_SCENARIOS) {
      await runScenario(page, scenario, streamId, originalModes);
      completedScenarios.push(scenario.name);
    }

    console.log(
      JSON.stringify(
        {
          status: "passed",
          baseUrl: BASE_URL,
          streamId,
          streamName,
          scenarios: completedScenarios,
        },
        null,
        2
      )
    );
  } catch (error) {
    failure = error;
    log(`Failure captured. Screenshot: ${SCREENSHOT_PATH}`);
    await mkdir(path.dirname(SCREENSHOT_PATH), { recursive: true });
    await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true });
  } finally {
    try {
      await restoreFeatureModes(page, originalModes);
      if (startedDebugSession) {
        await stopDebugSessionIfActive(page);
      }
    } catch (cleanupError) {
      if (!failure) {
        failure = cleanupError;
      } else {
        console.error("[kb-feature-flags-e2e] Cleanup failed");
        console.error(cleanupError);
      }
    }

    await context.close();
    await browser.close();
  }

  if (failure) {
    throw failure;
  }
}

run().catch(error => {
  console.error("[kb-feature-flags-e2e] Failed");
  console.error(error);
  process.exit(1);
});
