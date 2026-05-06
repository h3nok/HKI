/**
 * question-quality — Normalization and fallback logic for chat suggestions.
 *
 * Keeps follow-up/sample prompts readable, relevant, and demo-ready.
 */

const MIN_QUESTION_LENGTH = 12;
const MAX_QUESTION_LENGTH = 180;

function normalizeSpacing(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function stripListPrefix(value: string): string {
  return value.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "");
}

function stripWrappingQuotes(value: string): string {
  return value.replace(/^["'`]+|["'`]+$/g, "");
}

function canonicalKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function looksMeaningful(value: string): boolean {
  if (
    value.length < MIN_QUESTION_LENGTH ||
    value.length > MAX_QUESTION_LENGTH
  ) {
    return false;
  }
  if (/\b(lorem ipsum|todo|tbd|example question)\b/i.test(value)) {
    return false;
  }
  if (/[{}<>[\]]/.test(value)) {
    return false;
  }
  return value.split(" ").length >= 4;
}

export function normalizeQuestion(raw: string): string | null {
  const trimmed = normalizeSpacing(stripWrappingQuotes(stripListPrefix(raw)));
  if (!looksMeaningful(trimmed)) return null;
  const withQuestionMark = /[?!.]$/.test(trimmed) ? trimmed : `${trimmed}?`;
  return withQuestionMark;
}

export function dedupeQuestions(rawQuestions: string[], max = 6): string[] {
  const seen = new Set<string>();
  const clean: string[] = [];
  for (const raw of rawQuestions) {
    const normalized = normalizeQuestion(raw);
    if (!normalized) continue;
    const key = canonicalKey(normalized);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    clean.push(normalized);
    if (clean.length >= max) break;
  }
  return clean;
}

export function buildLeadershipFallbackQuestions(
  scopeName?: string,
  scopeDescription?: string | null
): string[] {
  const scope = normalizeSpacing(scopeName || "our organization");
  const description = normalizeSpacing(scopeDescription || "");

  const scoped = [
    `What are the most important things my team should know about ${scope} right now?`,
    `Give me a plain-language summary of the latest ${scope} updates I can share with my team.`,
    `What does our internal knowledge say about best practices in ${scope}?`,
    `Help me prepare talking points on ${scope} for an upcoming leadership meeting.`,
    `What questions are people asking most about ${scope}, and what are the answers?`,
    `Are there any gaps or risks in our ${scope} knowledge I should be aware of?`,
  ];

  if (!scopeName || scopeName.toLowerCase() === "global") {
    return [
      "What's the most important thing I should know from our knowledge domains today?",
      "Summarize our internal guidelines on a topic I can ask about.",
      "Help me find information about a process or policy I'm looking for.",
      "What are the common questions employees ask, and what are the answers?",
      "Draft a brief I can share with my team based on our internal documents.",
      "What knowledge do we have that could help me make a better decision right now?",
    ];
  }

  if (description) {
    scoped.splice(
      1,
      0,
      `Within ${scope}, what day-to-day decisions depend most on current policy, SOPs, or guidance?`
    );
  }

  return scoped;
}

export function toSuggestionLabel(question: string, maxChars = 92): string {
  const clean = normalizeSpacing(question);
  if (clean.length <= maxChars) return clean;
  return `${clean.slice(0, Math.max(16, maxChars - 1)).trimEnd()}…`;
}
