const QUESTION_STOPWORDS = new Set([
  "about",
  "after",
  "also",
  "because",
  "before",
  "being",
  "between",
  "document",
  "documents",
  "employee",
  "employees",
  "from",
  "have",
  "into",
  "knowledge",
  "manager",
  "managers",
  "must",
  "need",
  "only",
  "provide",
  "provides",
  "should",
  "staff",
  "stream",
  "teams",
  "their",
  "them",
  "these",
  "this",
  "those",
  "through",
  "under",
  "users",
  "using",
  "what",
  "when",
  "where",
  "which",
  "with",
  "would",
]);

const GENERIC_SUBJECTS = new Set([
  "associate",
  "associates",
  "coworker",
  "coworkers",
  "employee",
  "employees",
  "member",
  "members",
  "staff",
  "team",
  "teams",
  "user",
  "users",
]);

function normalizeQuestionText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanQuestionSubject(fragment: string): string | null {
  const cleaned = normalizeQuestionText(fragment)
    .replace(/^(the|a|an)\s+/, "")
    .split(
      /\b(?:through|via|using|with|when|if|before|after|because|unless|until|during|while|within|without|to)\b/
    )[0]
    ?.trim();

  if (!cleaned || GENERIC_SUBJECTS.has(cleaned)) {
    return null;
  }

  const words = cleaned.split(" ").filter(Boolean);
  if (words.length === 0) return null;
  return words.slice(0, 6).join(" ");
}

function extractQuestionKeywords(value: string, limit: number = 6): string[] {
  return Array.from(
    new Set(
      normalizeQuestionText(value)
        .split(" ")
        .filter(word => word.length >= 4 && !QUESTION_STOPWORDS.has(word))
    )
  ).slice(0, limit);
}

function deriveQuestionSubject(content?: string | null): string | null {
  const sentences = String(content ?? "")
    .replace(/\s+/g, " ")
    .split(/[.!?]/)
    .map(sentence => sentence.trim())
    .filter(sentence => sentence.length >= 12)
    .slice(0, 4);

  for (const sentence of sentences) {
    const patterns: RegExp[] = [
      /\brequest(?:ed|s|ing)?\s+([a-z][a-z\s-]{2,80})/i,
      /\bverify\s+([a-z][a-z\s-]{2,80})/i,
      /\bescalat(?:e|es|ed|ing|ion)\s+([a-z][a-z\s-]{2,80})/i,
      /^([a-z][a-z\s-]{2,80})\s+(?:must|should|required|requires|need to|can|may)\b/i,
    ];

    for (const pattern of patterns) {
      const match = sentence.match(pattern);
      const candidate = cleanQuestionSubject(match?.[1] ?? "");
      if (candidate) {
        return candidate;
      }
    }
  }

  const keywords = extractQuestionKeywords(String(content ?? ""), 3);
  if (keywords.length === 0) return null;
  return keywords.slice(0, 2).join(" ");
}

function pushQuestion(questions: string[], candidate: string | null): void {
  const normalized = candidate?.trim().replace(/\s+/g, " ");
  if (!normalized) return;
  const withQuestionMark = normalized.endsWith("?")
    ? normalized
    : `${normalized}?`;
  const key = withQuestionMark.toLowerCase();
  if (questions.some(existing => existing.toLowerCase() === key)) return;
  questions.push(withQuestionMark);
}

export function sanitizeQuestionTitle(title?: string | null): string {
  let cleaned = String(title ?? "").trim();
  if (!cleaned) return "";

  cleaned = cleaned.replace(
    /\s+[—-]\s+(?:id=|sys_|kb_article_view|https?:\/\/|www\.).*$/i,
    ""
  );
  cleaned = cleaned.replace(
    /\b(?:id=kb_article_view&)?sys_kb_id=[a-f0-9]+\b/gi,
    ""
  );
  cleaned = cleaned.replace(/\b(?:https?:\/\/|www\.)\S+\b/gi, "");
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  return cleaned;
}

export function isLowSignalQuestionTitle(title?: string | null): boolean {
  const cleaned = sanitizeQuestionTitle(title);
  if (!cleaned) return true;
  if (/^kb\d{4,}$/i.test(cleaned)) return true;
  if (/^[a-f0-9-]{12,}$/i.test(cleaned)) return true;

  const tokens = normalizeQuestionText(cleaned).split(" ").filter(Boolean);
  if (tokens.length === 0) return true;

  return tokens.every(
    token => /^kb\d{4,}$/i.test(token) || /^[a-f0-9]{8,}$/i.test(token)
  );
}

export function isLowQualityQuestion(query: string): boolean {
  const normalized = query.trim().replace(/\s+/g, " ").toLowerCase();
  if (!normalized) return true;

  if (
    normalized.includes("sys_kb_id") ||
    normalized.includes("kb_article_view") ||
    normalized.includes("http://") ||
    normalized.includes("https://")
  ) {
    return true;
  }

  return (
    /^what guidance does .+ provide\??$/.test(normalized) ||
    /^when should (?:teams|employees|staff|users|associates) use .+\??$/.test(
      normalized
    ) ||
    /^what are the main steps described in .+\??$/.test(normalized) ||
    /^what requirements or rules does .+ define for .+\??$/.test(normalized) ||
    /^what information from .+ would help answer .+\??$/.test(normalized) ||
    /^which teams or roles are responsible according to .+\??$/.test(normalized)
  );
}

export function filterHighQualityQuestions(
  questions: string[],
  limit: number
): string[] {
  const filtered: string[] = [];

  for (const question of questions) {
    const trimmed = question.trim();
    if (!trimmed || isLowQualityQuestion(trimmed)) continue;
    pushQuestion(filtered, trimmed);
    if (filtered.length >= limit) break;
  }

  return filtered;
}

export function buildContextAwareQuestions(input: {
  title?: string | null;
  content?: string | null;
  count?: number;
  documentType?: string | null;
}): string[] {
  const count = input.count ?? 5;
  const normalizedContent = normalizeQuestionText(String(input.content ?? ""));
  const cleanTitle = sanitizeQuestionTitle(input.title);
  const hasUsableTitle = !isLowSignalQuestionTitle(cleanTitle);
  const policyContext = hasUsableTitle ? ` under ${cleanTitle}` : "";
  const processContext = hasUsableTitle ? ` in ${cleanTitle}` : "";
  const subject = deriveQuestionSubject(input.content);
  const procedureLike = /sop|procedure|workflow|runbook/i.test(
    String(input.documentType ?? "")
  );

  const questions: string[] = [];

  if (normalizedContent.includes("eligib")) {
    pushQuestion(
      questions,
      `How should staff verify eligibility${policyContext}`
    );
  }
  if (normalizedContent.includes("receipt")) {
    pushQuestion(questions, `When is a receipt required${policyContext}`);
  }
  if (normalizedContent.includes("approval")) {
    pushQuestion(
      questions,
      `When is ${normalizedContent.includes("manager") ? "manager " : ""}approval required${policyContext}`
    );
  }
  if (normalizedContent.includes("fraud")) {
    pushQuestion(
      questions,
      `When should staff escalate suspected fraud${policyContext}`
    );
  } else if (normalizedContent.includes("escalat")) {
    pushQuestion(
      questions,
      subject
        ? `When should staff escalate issues involving ${subject}${policyContext}`
        : `When should staff escalate an issue${policyContext}`
    );
  }
  if (
    normalizedContent.includes("exception") ||
    normalizedContent.includes("unless") ||
    normalizedContent.includes("except")
  ) {
    pushQuestion(
      questions,
      `What exceptions should teams watch for${policyContext}`
    );
  }

  if (subject) {
    if (
      procedureLike ||
      normalizedContent.includes("process") ||
      normalizedContent.includes("workflow") ||
      normalizedContent.includes("steps")
    ) {
      pushQuestion(
        questions,
        `What steps should staff follow for ${subject}${processContext}`
      );
    }
    pushQuestion(
      questions,
      `What requirements apply to ${subject}${policyContext}`
    );
    pushQuestion(
      questions,
      `What information should staff confirm before handling ${subject}${policyContext}`
    );
    pushQuestion(
      questions,
      `What mistakes should teams avoid when handling ${subject}${policyContext}`
    );
  }

  if (questions.length === 0 && hasUsableTitle) {
    pushQuestion(
      questions,
      procedureLike
        ? `What steps should staff follow in ${cleanTitle}`
        : `What key guidance should teams know from ${cleanTitle}`
    );
    pushQuestion(
      questions,
      procedureLike
        ? `What exceptions or escalation points apply in ${cleanTitle}`
        : `What exceptions or approval rules should teams watch for in ${cleanTitle}`
    );
  }

  if (questions.length === 0) {
    const keywords = extractQuestionKeywords(String(input.content ?? ""), 2);
    const focus = keywords.join(" ").trim();
    if (focus) {
      pushQuestion(questions, `What requirements apply to ${focus}`);
      pushQuestion(
        questions,
        `When should teams escalate issues involving ${focus}`
      );
      pushQuestion(
        questions,
        `What mistakes should teams avoid when handling ${focus}`
      );
    }
  }

  return questions.slice(0, count);
}
