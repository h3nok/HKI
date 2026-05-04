import assert from "node:assert/strict";
import { chromium } from "playwright";

const BASE_URL =
  process.env.AGENTIC_BASE_URL?.trim() ||
  "https://agentic.cilabs.np.cc-hki.com";
const STREAM_ID = process.env.AGENTIC_SMOKE_STREAM_ID?.trim() || "innovations";
const EMAIL =
  process.env.AGENTIC_SMOKE_EMAIL?.trim().toLowerCase() ||
  "hghebrechristos@hki.com";
const OPEN_ID =
  process.env.AGENTIC_SMOKE_OPEN_ID?.trim() || "kb-browser-smoke-admin";

function log(message) {
  console.log(`[agentic-live-ui-smoke] ${message}`);
}

async function login() {
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
    `Expected redirect from login, got ${response.status}`,
  );

  const cookieHeader = response.headers.get("set-cookie");
  assert.ok(cookieHeader, "Expected login to return a session cookie");

  const [nameValue] = cookieHeader.split(";");
  const eqIndex = nameValue.indexOf("=");
  assert.ok(eqIndex > 0, "Malformed set-cookie header");

  return {
    name: nameValue.slice(0, eqIndex),
    value: nameValue.slice(eqIndex + 1),
    location: response.headers.get("location") ?? null,
  };
}

async function expectNoFatalUi(page) {
  const body = await page.locator("body").innerText();
  for (const marker of [
    "Something went wrong",
    "Knowledge Workspace Unavailable",
    "Knowledge Base requires one value stream",
    "Application error",
  ]) {
    assert.ok(!body.includes(marker), `Unexpected UI marker: ${marker}`);
  }
}

async function bodyExcerpt(page, max = 1200) {
  const body = await page.locator("body").innerText();
  return body.slice(0, max);
}

const session = await login();
log(`Login redirect target: ${session.location}`);

const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1200 },
});

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
page.setDefaultTimeout(60_000);

try {
  log(`Opening knowledge workspace for stream ${STREAM_ID}`);
  await page.goto(
    `${BASE_URL}/knowledge?stream=${encodeURIComponent(STREAM_ID)}`,
    {
      waitUntil: "domcontentloaded",
      timeout: 120_000,
    },
  );
  await page.getByRole("button", { name: "Add Knowledge" }).first().waitFor({
    state: "visible",
  });
  await expectNoFatalUi(page);
  assert.match(await page.title(), /Knowledge Base/i);

  log("Opening Add Knowledge tab");
  await page.getByRole("button", { name: "Add Knowledge" }).first().click();
  await page
    .locator('[data-tour="ingest-upload"]')
    .waitFor({ state: "visible" });
  await expectNoFatalUi(page);

  log("Opening Test Answers tab");
  await page.getByRole("button", { name: "Test Answers" }).first().click();
  await page
    .locator('[data-tour="validate-input"]')
    .waitFor({ state: "visible" });
  await expectNoFatalUi(page);

  log("Opening Activity tab");
  await page.getByRole("button", { name: "Activity" }).first().click();
  await page
    .locator('[data-tour="activity-feed"]')
    .waitFor({ state: "visible" });
  await expectNoFatalUi(page);

  log("Opening admin feature controls");
  await page.goto(`${BASE_URL}/admin/settings`, {
    waitUntil: "domcontentloaded",
    timeout: 120_000,
  });
  try {
    await page.waitForFunction(
      () => {
        const text = document.body?.innerText || "";
        return (
          /Enterprise Hub/i.test(text) &&
          /Settings/i.test(text) &&
          (/Release Controls/i.test(text) ||
            /Live release controls/i.test(text)) &&
          /Rollout Health/i.test(text)
        );
      },
      { timeout: 60_000 },
    );
  } catch (error) {
    throw new Error(
      `Admin feature controls did not render at ${page.url()}\n\n${await bodyExcerpt(page)}`,
    );
  }
  await expectNoFatalUi(page);

  console.log(
    JSON.stringify(
      {
        status: "passed",
        baseUrl: BASE_URL,
        knowledgeStream: STREAM_ID,
        finalPath: new URL(page.url()).pathname,
        loginRedirect: session.location,
        checks: [
          "knowledge-shell",
          "knowledge-ingest-tab",
          "knowledge-validate-tab",
          "knowledge-activity-tab",
          "admin-feature-controls",
        ],
      },
      null,
      2,
    ),
  );
} finally {
  await context.close();
  await browser.close();
}
