import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Locator, type Page } from "playwright";

const BASE_URL = process.env.AGENTIC_BASE_URL ?? "http://127.0.0.1:9001";
const HEADLESS = process.env.KB_UI_E2E_HEADLESS !== "false";
const BROWSER_CHANNEL = process.env.KB_UI_E2E_BROWSER_CHANNEL ?? "chrome";
const TIMEOUT_MS = Number(process.env.KB_UI_E2E_TIMEOUT_MS ?? 120_000);
const MAX_GUIDE_SECTIONS = Number(
  process.env.KB_UI_E2E_MAX_GUIDE_SECTIONS ?? 12
);
const SCREENSHOT_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../.dev/kb-ui-e2e-failure.png"
);

function log(message: string) {
  console.log(`[kb-ui-e2e] ${message}`);
}

async function waitForVisible(locator: Locator, timeout = TIMEOUT_MS) {
  await locator.first().waitFor({ state: "visible", timeout });
  return locator.first();
}

async function fill(locator: Locator, value: string) {
  const input = await waitForVisible(locator);
  await input.fill(value);
}

async function click(
  locator: Locator,
  timeout = TIMEOUT_MS,
  options?: { force?: boolean }
) {
  const button = await waitForVisible(locator, timeout);
  await button.click({ force: options?.force });
}

async function expectInputValue(locator: Locator, expected: string) {
  const input = await waitForVisible(locator);
  const actual = await input.inputValue();
  assert.equal(
    actual,
    expected,
    `Expected input value "${expected}" but found "${actual}"`
  );
}

async function expectText(page: Page, text: string | RegExp) {
  const locator =
    typeof text === "string" ? page.getByText(text) : page.getByText(text);
  await waitForVisible(locator);
}

async function expectNotVisible(page: Page, text: string | RegExp) {
  const locator =
    typeof text === "string" ? page.getByText(text) : page.getByText(text);
  const count = await locator.count();
  if (count === 0) return;
  assert.equal(
    await locator.first().isVisible(),
    false,
    `Did not expect "${String(text)}" to be visible`
  );
}

async function completeGuide(page: Page) {
  log("Completing mandatory setup guide");
  const guideStart = page.getByTestId("kb-guide-start");
  const welcomeStart = page.getByTestId("kb-onboarding-get-started");

  await waitForVisible(
    page.locator(
      '[data-testid="kb-guide-start"], [data-testid="kb-onboarding-get-started"]'
    )
  );

  if (!(await guideStart.isVisible().catch(() => false))) {
    if (await welcomeStart.isVisible().catch(() => false)) {
      await click(welcomeStart, TIMEOUT_MS);
    }
  }

  await click(guideStart, TIMEOUT_MS);

  const attestCheckbox = page.getByTestId("kb-guide-attest-checkbox");
  const nextButton = page.getByTestId("kb-guide-next");
  let completedSections = 0;

  while (completedSections < MAX_GUIDE_SECTIONS) {
    if (await attestCheckbox.isVisible()) {
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
    log(`Guide section ${completedSections} acknowledged`);
  }

  if (!(await attestCheckbox.isVisible())) {
    throw new Error(
      `Guide attestation was not reached after ${MAX_GUIDE_SECTIONS} sections`
    );
  }

  await attestCheckbox.check();
  await click(page.getByTestId("kb-guide-attest-submit"));
  await page.waitForLoadState("networkidle");
}

async function openIngestTab(page: Page) {
  log("Switching to Add Content tab");
  await page.evaluate(() => {
    window.sessionStorage.setItem("knowledge-active-tab", "ingest");
  });
  await page.reload();
  await waitForVisible(page.locator('[data-tour="ingest-upload"]'));
}

async function addSampleContent(
  page: Page,
  sampleName: string,
  sampleText: string
) {
  const fileName = `${sampleName}.md`;
  const filePayload = {
    name: fileName,
    mimeType: "text/markdown",
    buffer: Buffer.from(sampleText),
  };

  const directFileInput = page.locator('input[type="file"]');
  if ((await directFileInput.count()) > 0) {
    await directFileInput.first().setInputFiles(filePayload);
    await expectText(page, fileName);
    return "file" as const;
  }

  const textMethod = page.getByTestId("kb-ingest-method-text");
  if ((await textMethod.count()) > 0 && (await textMethod.isEnabled())) {
    await click(textMethod);
    await fill(page.getByTestId("kb-ingest-textarea"), sampleText);
    return "text" as const;
  }

  const fileMethod = page.getByTestId("kb-ingest-method-file");
  if ((await fileMethod.count()) > 0 && (await fileMethod.isEnabled())) {
    await click(fileMethod);

    await page.locator('input[type="file"]').setInputFiles({
      ...filePayload,
    });
    await expectText(page, fileName);
    return "file" as const;
  }

  const textarea = page.getByTestId("kb-ingest-textarea");
  if ((await textarea.count()) > 0) {
    await fill(textarea, sampleText);
    return "text" as const;
  }

  throw new Error("No enabled ingest method is available for kb-ui-e2e");
}

async function openLibraryAfterIngest(
  page: Page,
  documentTitle: string,
  requireRestrictedAccess = false
) {
  await page.waitForFunction(
    () => {
      const hasPostIngestAction = [
        "kb-ingest-open-library",
        "kb-ingest-open-review",
        "kb-ingest-open-document",
      ].some(testId => document.querySelector(`[data-testid="${testId}"]`));
      const hasBrowseKnowledge = Array.from(
        document.querySelectorAll("button")
      ).some(button => /Browse Knowledge/i.test(button.textContent ?? ""));
      return hasPostIngestAction || hasBrowseKnowledge;
    },
    { timeout: TIMEOUT_MS }
  );

  const securitySummary = page.getByTestId("kb-ingest-security-summary");
  if (await securitySummary.isVisible()) {
    await expectText(page, "Security and access");
    if (requireRestrictedAccess) {
      await expectText(page, "department:legal");
    }
  }

  const openLibrary = page.getByTestId("kb-ingest-open-library");
  if (await openLibrary.isVisible().catch(() => false)) {
    log("Opening the library from the post-ingest success state");
    await click(openLibrary, TIMEOUT_MS);
    await waitForVisible(page.getByTestId("kb-library-workflow-banner"));
    await expectText(page, documentTitle);
    if (requireRestrictedAccess) {
      await expectText(page, "Privileged");
    }
    return;
  }

  const browseKnowledge = page.getByRole("button", {
    name: /^Browse Knowledge$/i,
  });
  if (!(await browseKnowledge.isVisible())) {
    throw new Error(
      "No library continuation action was available after ingest"
    );
  }

  log("Opening the library from the post-ingest success banner");
  await click(browseKnowledge, TIMEOUT_MS);
  await waitForVisible(page.getByTestId("kb-library-workflow-banner"));
  await expectText(page, documentTitle);
  if (requireRestrictedAccess) {
    await expectText(page, "Privileged");
  }
}

async function followWorkflowFromLibrary(page: Page) {
  log("Checking guided handoff from Library");
  await click(page.getByTestId("kb-library-workflow-primary"), TIMEOUT_MS);

  await page.waitForFunction(
    () =>
      Boolean(
        document.querySelector('[data-testid="kb-validate-workflow-banner"]')
      ) ||
      Boolean(
        document.querySelector('[data-testid="kb-govern-workflow-banner"]')
      ) ||
      Boolean(document.querySelector('[data-tour="activity-feed"]')),
    { timeout: TIMEOUT_MS }
  );

  const validateBanner = page.getByTestId("kb-validate-workflow-banner");
  if (await validateBanner.isVisible()) {
    log("Checking guided handoff from Validate to Govern");
    await waitForVisible(validateBanner);
    await click(page.getByTestId("kb-validate-workflow-primary"), TIMEOUT_MS);
    await waitForVisible(page.getByTestId("kb-govern-workflow-banner"));
  }

  const governBanner = page.getByTestId("kb-govern-workflow-banner");
  if (await governBanner.isVisible()) {
    await waitForVisible(governBanner);
    return;
  }

  await waitForVisible(page.locator('[data-tour="activity-feed"]'));
  await expectText(page, /Pipeline Jobs|Alert History/i);
}

async function run() {
  const browser = await chromium.launch({
    channel: BROWSER_CHANNEL,
    headless: HEADLESS,
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1200 },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);

  const streamName = `Legal KB E2E ${Date.now()}`;
  const streamDescription =
    "Privileged legal policies and intake guidance for UI validation.";
  const sampleText = [
    "Vendor dispute intake procedure",
    "",
    "Email legal-ops@hki.com when a contract dispute needs legal review.",
    "Call 425-555-0199 for same-day escalation support.",
    "Use this procedure to triage incoming matters, assign counsel, and confirm the source documents before any response leaves the team.",
  ].join("\n");

  try {
    log(`Logging in through dev bypass at ${BASE_URL}`);
    await page.goto(`${BASE_URL}/api/dev-login`, {
      waitUntil: "networkidle",
      timeout: TIMEOUT_MS,
    });

    log("Opening knowledge base creation flow");
    await page.goto(`${BASE_URL}/knowledge/create`, {
      waitUntil: "networkidle",
      timeout: TIMEOUT_MS,
    });
    await fill(page.getByTestId("kb-create-name"), streamName);
    await fill(page.getByTestId("kb-create-description"), streamDescription);
    await click(page.getByTestId("kb-create-submit"));

    log(`Provisioned value stream "${streamName}"`);
    await click(page.getByTestId("kb-create-open"), TIMEOUT_MS);
    await page.waitForURL(/\/knowledge\?stream=/, { timeout: TIMEOUT_MS });

    const streamId = new URL(page.url()).searchParams.get("stream");
    assert.ok(streamId, "Expected stream ID in the knowledge page URL");
    log(`Opened value stream ${streamId}`);

    await completeGuide(page);
    await openIngestTab(page);

    log("Entering privileged legal content through the ingest flow");
    const ingestMethod = await addSampleContent(page, streamName, sampleText);
    await fill(page.getByPlaceholder("e.g. Q2 Return Policy"), streamName);
    await fill(page.getByPlaceholder("e.g. Operations"), "Legal");

    const legalOnlyPreset = page.getByTestId("kb-ingest-preset-legal-only");
    const accessTab = page.getByRole("button", { name: /^Access$/i });
    let usesRestrictedAccess = await legalOnlyPreset
      .isVisible()
      .catch(() => false);
    if (!usesRestrictedAccess) {
      const accessTabVisible = await accessTab.isVisible().catch(() => false);
      if (accessTabVisible) {
        await click(accessTab);
        await waitForVisible(legalOnlyPreset, TIMEOUT_MS);
        usesRestrictedAccess = true;
      }
    }

    if (usesRestrictedAccess) {
      await click(page.getByTestId("kb-ingest-preset-legal-only"));
      await expectInputValue(
        page.getByTestId("kb-ingest-allowed-groups"),
        "department:legal"
      );
    }

    log("Running pre-ingest analysis");
    if (ingestMethod === "text") {
      await click(page.getByTestId("kb-ingest-continue-to-check"), TIMEOUT_MS);
    } else {
      await click(
        page.getByRole("button", { name: /^Check all$/i }),
        TIMEOUT_MS
      );
    }

    await waitForVisible(
      page.getByTestId("kb-ingest-routine-contact-card"),
      TIMEOUT_MS
    );
    await expectText(page, "Routine contact details found");
    await expectText(page, "Phone (US)");
    await expectText(page, "Email");
    if (usesRestrictedAccess) {
      await expectText(page, "Privileged");
      await expectText(page, "department:legal");
    }
    await expectText(page, "Not found");
    await expectNotVisible(
      page,
      /Sensitive personal information was found and must be removed/i
    );

    log("Submitting the document to the knowledge base");
    await click(page.getByTestId("kb-ingest-submit"), TIMEOUT_MS);

    await openLibraryAfterIngest(page, streamName, usesRestrictedAccess);
    await followWorkflowFromLibrary(page);
    log("UI e2e completed successfully");

    console.log(
      JSON.stringify(
        {
          status: "passed",
          streamId,
          streamName,
          baseUrl: BASE_URL,
        },
        null,
        2
      )
    );
  } catch (error) {
    log(`Failure captured. Screenshot: ${SCREENSHOT_PATH}`);
    await mkdir(path.dirname(SCREENSHOT_PATH), { recursive: true });
    await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true });
    throw error;
  } finally {
    await context.close();
    await browser.close();
  }
}

run().catch(error => {
  console.error("[kb-ui-e2e] Failed");
  console.error(error);
  process.exit(1);
});
