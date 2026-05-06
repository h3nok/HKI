type BugReportContext = {
  area?: string;
  role?: string | null;
  stream?: string | null;
  path?: string;
};

const DEFAULT_ISSUES_URL =
  "https://github.com/hki/innovationlab-monorepo/issues/new";

function getIssuesUrlBase() {
  return import.meta.env.VITE_SUPPORT_ISSUES_URL || DEFAULT_ISSUES_URL;
}

export function createBugReportUrl(context: BugReportContext = {}) {
  const url = new URL(getIssuesUrlBase());
  const currentPath =
    context.path ||
    (typeof window !== "undefined"
      ? `${window.location.pathname}${window.location.search}`
      : "Unknown");
  const currentUrl =
    typeof window !== "undefined" ? window.location.href : "Unknown";
  const browser =
    typeof navigator !== "undefined" ? navigator.userAgent : "Unknown";
  const area = context.area || "Agentic Platform";

  const body = [
    "## Summary",
    "",
    "## Location",
    `- Surface: ${area}`,
    `- Path: ${currentPath}`,
    `- URL: ${currentUrl}`,
    `- Role: ${context.role || "Unknown"}`,
    context.stream ? `- Stream: ${context.stream}` : null,
    `- Browser: ${browser}`,
    "",
    "## What Happened",
    "",
    "## Steps To Reproduce",
    "1. ",
    "2. ",
    "3. ",
    "",
    "## Expected Behavior",
    "",
    "## Additional Context",
    "",
  ]
    .filter(Boolean)
    .join("\n");

  url.searchParams.set("title", `[Agentic] ${area}: `);
  url.searchParams.set("body", body);
  return url.toString();
}

export function openBugReport(context: BugReportContext = {}) {
  if (typeof window === "undefined") return;

  window.open(createBugReportUrl(context), "_blank", "noopener,noreferrer");
}
