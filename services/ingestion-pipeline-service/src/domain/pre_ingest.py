"""
Pre-Ingestion Analysis — AI-powered content validation before indexing.

Runs the 4-stage pipeline as analysis only (no actual ingestion):
    1. Validate  — completeness, quality, readability, PII scan
    2. Interpret  — document type, department, tags, entities, summary
    3. Decide    — relevance to value stream, recommendation
    4. (Ingest is skipped — that happens after user confirms)

Stage 1 uses heuristic scorers from quality_gates.py.
Stages 2-3 use Gemini for AI-powered interpretation and decision.
When Gemini is unavailable, stages 2-3 fall back to heuristics.
"""

from __future__ import annotations

import dataclasses
import json
import re
import typing
import urllib.parse

import httpx
import shared.http_client

import src.core.config
import src.core.logging
import src.domain.quality_gates

# ═══════════════════════════════════════════════════════════════════════════════
# Data Models
# ═══════════════════════════════════════════════════════════════════════════════


@dataclasses.dataclass
class PIIJudgeResult:
    """Result from a single PII detection judge."""

    judge: str  # e.g. "regex", "gemini"
    pii_detected: bool
    categories: list[str]
    details: list[str]  # Human-readable findings
    confidence: float  # 0.0–1.0 (regex=1.0, gemini varies)


@dataclasses.dataclass
class ValidateResult:
    """Stage 1: Content validation results."""

    quality_score: float  # 0–100
    completeness: float  # 0–25
    specificity: float  # 0–25
    accuracy_signals: float  # 0–25
    actionability: float  # 0–25
    word_count: int
    sentence_count: int
    readability_grade: str  # e.g. "Standard (8th grade)"
    reading_ease: float  # 0–100
    pii_detected: bool
    pii_categories: list[str]
    issues: list[str]  # Human-readable warnings
    contact_info_detected: bool = False
    contact_info_categories: list[str] = dataclasses.field(default_factory=list)
    pii_judges: list[PIIJudgeResult] = dataclasses.field(default_factory=list)
    # Toxicity / safety
    toxicity_flagged: bool = False
    toxicity_categories: list[str] = dataclasses.field(default_factory=list)
    toxicity_severity: str = "none"  # "none", "warning", "critical"
    # Content fingerprint for exact-match deduplication
    content_hash: str = ""

    @property
    def passed(self) -> bool:
        return self.quality_score >= 40 and not self.pii_detected and not self.toxicity_flagged


@dataclasses.dataclass
class ExtractedMetadata:
    """Auto-detected metadata extracted from document content."""

    source_id: str = ""  # e.g. "KB2020475"
    source_system: str = ""  # e.g. "ServiceNow"
    source_url: str = ""  # e.g. "https://hkicarts.service-now.com/kb?..."
    article_id: str = ""  # e.g. sys_id "5dd7186297a6655018ea3dc71153af66"
    detected_title: str = ""  # Title extracted from content (not filename)
    environment: str = ""  # e.g. "US Pharmacy"
    system_name: str = ""  # e.g. "Enterprise Pharmacy System (EPS)"
    author: str = ""  # Author if found
    publish_date: str = ""  # Date if found
    version: str = ""  # Version if found
    sections_found: list[str] = dataclasses.field(default_factory=list)
    # e.g. ["Issue", "Resolution", "Cause"]


@dataclasses.dataclass
class InterpretResult:
    """Stage 2: AI interpretation results."""

    detected_type: str  # e.g. "SOP", "Policy", "FAQ"
    department: str  # e.g. "Warehouse Operations"
    tags: list[str]  # e.g. ["receiving", "inventory", "WMS"]
    entities: list[str]  # Key entities found
    summary: str  # 2-3 sentence summary
    language: str  # e.g. "English"
    confidence: float  # 0.0–1.0
    extracted_metadata: ExtractedMetadata = dataclasses.field(default_factory=ExtractedMetadata)

    @property
    def passed(self) -> bool:
        return self.confidence >= 0.3


@dataclasses.dataclass
class DuplicateMatch:
    """A potential duplicate found in the existing knowledge base."""

    document_id: str
    title: str
    similarity: float  # 0.0–1.0
    chunk_preview: str  # First ~120 chars of matching chunk
    match_type: str = "similar"  # "exact" (hash match) or "similar" (vector match)


@dataclasses.dataclass
class ContradictionMatch:
    """A likely contradiction against an existing knowledge-base document."""

    document_id: str
    title: str
    candidate_claim: str
    conflicting_claim: str
    chunk_preview: str
    confidence: float  # 0.0–1.0
    rationale: str = ""


@dataclasses.dataclass
class DecideResult:
    """Stage 3: AI decision on whether to ingest."""

    recommendation: typing.Literal["ingest", "review", "reject"]
    relevance_score: float  # 0.0–1.0 relevance to value stream
    reasoning: str  # Why this decision was made
    value_stream_match: bool  # Does it match the value stream?
    duplicates: list[DuplicateMatch] = dataclasses.field(default_factory=list)
    contradictions: list[ContradictionMatch] = dataclasses.field(default_factory=list)

    @property
    def passed(self) -> bool:
        return self.recommendation != "reject"


@dataclasses.dataclass
class PreIngestAnalysis:
    """Complete pre-ingestion analysis across all stages."""

    validate: ValidateResult
    interpret: InterpretResult
    decide: DecideResult
    overall_pass: bool
    overall_confidence: float  # 0.0–1.0

    def to_dict(self) -> dict:
        v: dict[str, typing.Any] = dataclasses.asdict(self.validate)
        v["passed"] = self.validate.passed
        i: dict[str, typing.Any] = dataclasses.asdict(self.interpret)
        i["passed"] = self.interpret.passed
        d: dict[str, typing.Any] = dataclasses.asdict(self.decide)
        d["passed"] = self.decide.passed
        d["duplicates"] = [dataclasses.asdict(dup) for dup in self.decide.duplicates]
        return {
            "validate": v,
            "interpret": i,
            "decide": d,
            "overall_pass": self.overall_pass,
            "overall_confidence": round(self.overall_confidence, 2),
        }


# ═══════════════════════════════════════════════════════════════════════════════
# Stage 1: Validate
# ═══════════════════════════════════════════════════════════════════════════════


def _run_validate_sync(text: str, title: str = "") -> ValidateResult:
    """Run synchronous heuristic quality gates (regex PII + toxicity + fingerprint)."""
    report = src.domain.quality_gates.score_quality(text, title)
    pii = report.pii_scan

    regex_judge = PIIJudgeResult(
        judge="regex",
        pii_detected=pii.pii_detected,
        categories=pii.categories_found,
        details=[f"{m.category}: {m.match}" for m in pii.matches],
        confidence=1.0,
    )
    sensitive_categories, contact_categories = (
        src.domain.quality_gates.split_pii_categories(pii.categories_found)
    )

    # Toxicity / safety scan
    tox = src.domain.quality_gates.scan_toxicity(text)

    # Content fingerprint for exact-match deduplication
    fingerprint = src.domain.quality_gates.content_hash(text)

    issues: list[str] = []
    if report.overall_score < 40:
        issues.append("Content quality is very low — may be incomplete or too vague")
    if report.readability.word_count < 30:
        issues.append("Content is too short for meaningful knowledge extraction")
    if sensitive_categories:
        issues.append(f"Sensitive personal data detected: {', '.join(sensitive_categories)}")
    if report.readability.flesch_kincaid_grade > 16:
        issues.append("Content is extremely difficult to read — consider simplifying")
    if report.completeness.score < 10:
        issues.append("Content lacks structure — add headings or sections")
    if tox.flagged:
        issues.append(f"Safety concern: {tox.summary}")

    return ValidateResult(
        quality_score=report.overall_score,
        completeness=report.completeness.score,
        specificity=report.specificity.score,
        accuracy_signals=report.accuracy_signals.score,
        actionability=report.actionability.score,
        word_count=report.readability.word_count,
        sentence_count=report.readability.sentence_count,
        readability_grade=report.readability.grade_label,
        reading_ease=report.readability.flesch_reading_ease,
        pii_detected=bool(sensitive_categories),
        pii_categories=sensitive_categories,
        contact_info_detected=bool(contact_categories),
        contact_info_categories=contact_categories,
        issues=issues,
        pii_judges=[regex_judge],
        toxicity_flagged=tox.flagged,
        toxicity_categories=tox.categories_found,
        toxicity_severity=tox.severity,
        content_hash=fingerprint,
    )


# ── Gemini PII Judge ──────────────────────────────────────────────────────────

_PII_JUDGE_PROMPT = """\
You are a PII (Personally Identifiable Information) detection specialist.
Analyze the following document for ANY personally identifiable information.

You must detect PII that regex patterns CANNOT catch, including:
- **Person Names** in sensitive contexts (patient names, employee names with personal data)
- **Physical Addresses** (street addresses, mailing addresses)
- **Biometric / Health Data** (diagnoses, prescriptions, lab results tied to individuals)
- **Financial Identifiers** beyond card numbers (account numbers, routing numbers, tax IDs)
- **Government IDs** beyond SSN (passport numbers, driver license numbers, visa numbers)
- **Contextual PII** — information that identifies a person when combined
    ("the 42-year-old diabetic patient in room 302")

Do NOT flag:
- Generic role titles ("the manager", "the pharmacist")
- Company names or public business info
- Public contact info (published support emails, public phone numbers)
- Fictional or example data clearly marked as such

Title: {title}

--- CONTENT (first 3000 chars) ---
{content_preview}
--- END ---

Respond in EXACTLY this format:
PII_FOUND: <yes | no>
CONFIDENCE: <0.0 to 1.0>
CATEGORIES: <comma-separated list of PII categories found, or "none">
FINDINGS:
- <one finding per line, category: brief description (no actual PII values)>

Analysis:"""


def _parse_pii_judge_response(raw: str) -> PIIJudgeResult:
    """Parse the Gemini PII judge response."""
    lines: list[str] = raw.strip().split("\n")
    fields: dict[str, str] = {}
    findings: list[str] = []
    in_findings = False

    for line in lines:
        stripped: str = line.strip()
        if stripped.startswith("- ") and in_findings:
            findings.append(stripped[2:].strip())
            continue
        if ":" in stripped:
            key, _, value = stripped.partition(":")
            key_upper: str = key.strip().upper()
            if key_upper == "FINDINGS":
                in_findings = True
                continue
            fields[key_upper] = value.strip()
            in_findings = False

    pii_found: bool = fields.get("PII_FOUND", "no").lower().startswith("yes")

    try:
        confidence = float(fields.get("CONFIDENCE", "0.5").split()[0])
        confidence: float = max(0.0, min(1.0, confidence))
    except (ValueError, IndexError):
        confidence = 0.5

    cats_raw: str = fields.get("CATEGORIES", "none")
    categories: list[str] = (
        [c.strip() for c in cats_raw.split(",") if c.strip().lower() != "none"]
        if pii_found
        else []
    )

    return PIIJudgeResult(
        judge="gemini",
        pii_detected=pii_found,
        categories=categories,
        details=findings,
        confidence=confidence,
    )


async def _run_gemini_pii_judge(text: str, title: str = "") -> PIIJudgeResult | None:
    """Run Gemini as a contextual PII judge. Returns None if unavailable."""
    if not src.core.config.settings.GEMINI_ENABLED:
        return None

    try:
        from src.adapters.gemini_client import _call_gemini

        prompt: str = _PII_JUDGE_PROMPT.format(
            title=title or "Untitled",
            content_preview=text[:3000],
        )
        raw = await _call_gemini(prompt)
        if raw:
            return _parse_pii_judge_response(raw)
    except Exception as exc:
        src.core.logging.logger.warning(
            "Gemini PII judge failed (non-blocking)",
            extra={"error": str(exc)},
        )

    return None


def _merge_pii_judges(judges: list[PIIJudgeResult]) -> tuple[bool, list[str]]:
    """Merge results from multiple PII judges. Union of all findings."""
    all_categories: set[str] = set()
    any_detected = False
    for j in judges:
        if j.pii_detected:
            any_detected = True
            all_categories.update(j.categories)
    return any_detected, sorted(all_categories)


async def _run_validate(text: str, title: str = "") -> ValidateResult:
    """Run quality gates + multi-judge PII detection."""
    # Synchronous: regex PII + quality heuristics
    result: ValidateResult = _run_validate_sync(text, title)

    # Async: Gemini PII judge (runs in parallel intent, non-blocking)
    gemini_pii: PIIJudgeResult | None = await _run_gemini_pii_judge(text, title)
    if gemini_pii:
        result.pii_judges.append(gemini_pii)

    # Merge all judges
    merged_detected, merged_categories = _merge_pii_judges(result.pii_judges)
    sensitive_categories, contact_categories = (
        src.domain.quality_gates.split_pii_categories(merged_categories)
    )
    if merged_detected and not result.pii_detected and sensitive_categories:
        # Gemini found sensitive PII that regex missed
        result.issues.append(
            f"Contextual sensitive data detected by AI judge: {', '.join(sensitive_categories)}"
        )

    result.pii_detected = bool(sensitive_categories)
    result.pii_categories = sensitive_categories
    result.contact_info_detected = bool(contact_categories)
    result.contact_info_categories = contact_categories

    return result


# ═══════════════════════════════════════════════════════════════════════════════
# Metadata Extraction (regex-based, runs before Gemini interpretation)
# ═══════════════════════════════════════════════════════════════════════════════

# Patterns for common document metadata fields
_VERSION_RE: re.Pattern[str] = re.compile(
    r"\b(?:Version|Rev(?:ision)?):?\s*([\d]+(?:\.[\d]+)*)",
    re.IGNORECASE,
)
_DATE_RE: re.Pattern[str] = re.compile(
    r"\b(?:Date|Published|Updated|Last\s+(?:Updated|Modified)):?\s*"
    r"(\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4}|\w+\s+\d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2})",
    re.IGNORECASE,
)
_SECTION_HEADINGS: list[str] = [
    "Issue",
    "Environment",
    "Cause",
    "Resolution",
    "Steps",
    "Workaround",
    "Summary",
    "Background",
    "Purpose",
    "Scope",
    "Prerequisites",
    "Procedure",
    "Notes",
    "References",
]
_SECTION_HEADINGS_BY_LOWER: dict[str, str] = {
    heading.lower(): heading for heading in _SECTION_HEADINGS
}
_SYSTEM_NAME_KEYWORDS: set[str] = {"system", "software", "platform", "application", "tool"}


def _extract_kb_number(value: str) -> str:
    match: re.Match[str] | None = re.search(r"\bKB\d{5,10}\b", value, re.IGNORECASE)
    return match.group(0).upper() if match else ""


def _extract_article_id(lines: list[str]) -> str:
    for line in lines:
        lowered: str = line.lower()
        if "article" not in lowered or "id" not in lowered:
            continue

        match: re.Match[str] | None = re.search(r"\b[0-9a-f]{32}\b", line, re.IGNORECASE)
        if match:
            return match.group(0)

    return ""


def _normalize_section_heading(line: str) -> str:
    return line.strip().rstrip(":").lower()


def _canonical_section_heading(line: str) -> str:
    return _SECTION_HEADINGS_BY_LOWER.get(_normalize_section_heading(line), "")


def _extract_label_remainder(line: str, label: str) -> str | None:
    stripped: str = line.strip()
    if not stripped:
        return None

    label_length: int = len(label)
    if stripped[:label_length].lower() != label.lower():
        return None

    if len(stripped) == label_length:
        return ""

    delimiter: str = stripped[label_length]
    if delimiter not in {":", " ", "\t", "-"}:
        return None

    return stripped[label_length:].lstrip(" \t:-")


def _first_nonempty_line(lines: list[str], start_index: int) -> str:
    for line in lines[start_index:]:
        stripped: str = line.strip()
        if stripped:
            return stripped
    return ""


def _extract_labeled_value(lines: list[str], labels: tuple[str, ...]) -> str:
    for index, line in enumerate(lines):
        for label in labels:
            remainder: str | None = _extract_label_remainder(line, label)
            if remainder is None:
                continue
            if remainder:
                return remainder
            return _first_nonempty_line(lines, index + 1)
    return ""


def _extract_section_lines(lines: list[str], heading: str) -> list[str]:
    collected: list[str] = []
    capturing = False

    for line in lines:
        stripped: str = line.strip()
        if not capturing:
            remainder: str | None = _extract_label_remainder(line, heading)
            if remainder is None:
                continue
            capturing = True
            if remainder:
                collected.append(remainder)
            continue

        if not stripped:
            if collected:
                break
            continue

        if _canonical_section_heading(stripped):
            break

        collected.append(stripped)

    return collected


def _classify_source_system(url: str) -> str:
    host: str = (urllib.parse.urlparse(url).hostname or "").lower()
    lower_url: str = url.lower()

    if host == "service-now.com" or host.endswith(".service-now.com"):
        return "ServiceNow"
    if (
        host == "atlassian.net"
        or host.endswith(".atlassian.net")
        or "confluence" in host
        or "confluence" in lower_url
    ):
        return "Confluence"
    if host == "sharepoint.com" or host.endswith(".sharepoint.com") or "sharepoint" in host:
        return "SharePoint"

    return ""


def _extract_source_url(text: str) -> tuple[str, str]:
    for raw_token in text.split():
        candidate: str = raw_token.strip("()[]{}<>\"'.,;")
        parsed: urllib.parse.ParseResult = urllib.parse.urlparse(candidate)
        if parsed.scheme not in {"http", "https"} or not parsed.hostname:
            continue

        source_system: str = _classify_source_system(candidate)
        if source_system:
            return candidate, source_system

    return "", ""


def _extract_system_name(section_lines: list[str]) -> str:
    for line in section_lines:
        candidate: str = line.strip().lstrip("-*\t ").split(".", 1)[0].strip()
        if not candidate or not candidate[0].isupper():
            continue

        tokens: set[str] = {
            token.strip("():,;[]{}").lower() for token in candidate.split() if token.strip()
        }
        if tokens & _SYSTEM_NAME_KEYWORDS:
            return candidate[:120]

    return ""


def _extract_section_headings(lines: list[str]) -> list[str]:
    found: set[str] = {
        heading
        for line in lines
        if (heading := _canonical_section_heading(line))
    }
    return sorted(found)


def _extract_metadata_from_text(text: str, filename: str = "") -> ExtractedMetadata:
    """Extract structured metadata from document text using bounded scans."""
    meta = ExtractedMetadata()
    lines: list[str] = text.splitlines()

    # KB number (ServiceNow)
    meta.source_id = _extract_kb_number(text)
    if meta.source_id:
        meta.source_system = "ServiceNow"

    # Article ID (ServiceNow sys_id)
    meta.article_id = _extract_article_id(lines)

    # Fallback: extract KB number from filename (e.g. "Copy of KB2020475.pdf")
    if not meta.source_id and filename:
        meta.source_id = _extract_kb_number(filename)
        if meta.source_id:
            meta.source_system = "ServiceNow"

    # Source URL
    meta.source_url, detected_source_system = _extract_source_url(text)
    if meta.source_url and not meta.source_system:
        meta.source_system = detected_source_system

    # Environment
    environment_lines: list[str] = _extract_section_lines(lines, "Environment")
    if environment_lines:
        meta.environment = environment_lines[0].strip()[:120]

    # Detected title: first substantive line after metadata headers
    lines: list[str] = text.strip().split("\n")
    skip_prefixes = ("kb number:", "article id:", "source:", "http")
    title_candidate: str = ""
    for line in lines:
        stripped: str = line.strip()
        if not stripped:
            continue
        if any(stripped.lower().startswith(p) for p in skip_prefixes):
            continue
        if len(stripped) > 5 and len(stripped) < 200:
            title_candidate: str = stripped
            break
    meta.detected_title = title_candidate

    # System name: look near "Environment" section for system references
    if environment_lines:
        meta.system_name = _extract_system_name(environment_lines)

    # Author, version, date
    author: str = _extract_labeled_value(lines, ("Author", "Created by", "Written by"))
    if author:
        meta.author = author[:80]
    m: re.Match[str] | None = _VERSION_RE.search(text)
    if m:
        meta.version = m.group(1)
    m: re.Match[str] | None = _DATE_RE.search(text)
    if m:
        meta.publish_date = m.group(1).strip()

    # Section headings found
    meta.sections_found = _extract_section_headings(lines)

    return meta


# ═══════════════════════════════════════════════════════════════════════════════
# Stage 2: Interpret (Gemini-powered with heuristic fallback)
# ═══════════════════════════════════════════════════════════════════════════════

_INTERPRET_PROMPT = (
    "You are a document classification assistant for an enterprise knowledge base.\n"
    "Analyze the following content and extract structured metadata.\n"
    "\n"
    "Respond in EXACTLY this format (one field per line, no extra text):\n"
    "TYPE: <document type: SOP, Policy, FAQ, Runbook, Memo, Report, Guide, "
    "Training, Meeting Notes, General>\n"
    "DEPARTMENT: <department name or \"General\" if unclear>\n"
    "TAGS: <comma-separated list of 3-8 relevant tags>\n"
    "ENTITIES: <comma-separated list of key entities, systems, or proper nouns mentioned>\n"
    "SUMMARY: <2-3 sentence summary of what this document covers>\n"
    "LANGUAGE: <language of the document>\n"
    "CONFIDENCE: <0.0 to 1.0 — how confident you are in this classification>\n"
    "\n"
    "Title: {title}\n"
    "\n"
    "--- CONTENT (first 3000 chars) ---\n"
    "{content_preview}\n"
    "--- END ---\n"
    "\n"
    "Classification:"
)


def _parse_interpret_response(raw: str) -> InterpretResult:
    """Parse the structured Gemini response into an InterpretResult."""
    lines: list[str] = raw.strip().split("\n")
    fields: dict[str, str] = {}
    for line in lines:
        if ":" in line:
            key, _, value = line.partition(":")
            fields[key.strip().upper()] = value.strip()

    tags_raw: str = fields.get("TAGS", "")
    tags: list[str] = [t.strip() for t in tags_raw.split(",") if t.strip()]

    entities_raw: str = fields.get("ENTITIES", "")
    entities: list[str] = [e.strip() for e in entities_raw.split(",") if e.strip()]

    try:
        confidence = float(fields.get("CONFIDENCE", "0.5").split()[0])
        confidence: float = max(0.0, min(1.0, confidence))
    except (ValueError, IndexError):
        confidence = 0.5

    return InterpretResult(
        detected_type=fields.get("TYPE", "General"),
        department=fields.get("DEPARTMENT", "General"),
        tags=tags[:10],
        entities=entities[:10],
        summary=fields.get("SUMMARY", ""),
        language=fields.get("LANGUAGE", "English"),
        confidence=confidence,
    )


def _heuristic_interpret(text: str, title: str = "") -> InterpretResult:
    """Fallback interpretation when Gemini is unavailable."""
    words: str = text.lower()

    # Type detection
    doc_type = "General"
    type_signals: dict[str, list[str]] = {
        "SOP": [
            r"\bsop\b",
            r"\bstandard operating procedure\b",
            r"\bprocedure\b.*\bpurpose\b",
        ],
        "Policy": [r"\bpolicy\b", r"\bcompliance\b", r"\beffective date\b"],
        "FAQ": [r"\bfaq\b", r"\bfrequently asked\b", r"\bq:\s", r"\ba:\s"],
        "Runbook": [r"\brunbook\b", r"\bincident\b.*\bresponse\b", r"\btroubleshoot"],
        "Guide": [r"\bguide\b", r"\bhow to\b", r"\bstep[\s-]by[\s-]step\b"],
        "Training": [r"\btraining\b", r"\blearning objective\b", r"\bmodule\b"],
        "Meeting Notes": [r"\bmeeting notes\b", r"\battendees\b", r"\bagenda\b", r"\bminutes\b"],
    }
    for t, patterns in type_signals.items():
        if any(re.search(p, words) for p in patterns):
            doc_type: str = t
            break

    # Department detection
    department = "General"
    dept_signals: dict[str, list[str]] = {
        "Warehouse Operations": [
            r"\bwarehouse\b",
            r"\breceiving\b",
            r"\bshipping\b",
            r"\binventory\b",
        ],
        "IT / Technology": [
            r"\bsoftware\b",
            r"\bdeploy\b",
            r"\bapi\b",
            r"\bdatabase\b",
        ],
        "Human Resources": [
            r"\bhr\b",
            r"\bonboarding\b",
            r"\bbenefits\b",
            r"\bpayroll\b",
        ],
        "Finance": [
            r"\bfinance\b",
            r"\baccounting\b",
            r"\bbudget\b",
            r"\binvoice\b",
        ],
        "Marketing": [r"\bmarketing\b", r"\bcampaign\b", r"\bbrand\b"],
        "Customer Service": [r"\bcustomer service\b", r"\bsupport\b", r"\bticket\b"],
        "Legal": [r"\blegal\b", r"\bcontract\b", r"\bcompliance\b", r"\bregulation\b"],
    }
    for d, patterns in dept_signals.items():
        if any(re.search(p, words) for p in patterns):
            department: str = d
            break

    # Tag extraction (keyword frequency)
    all_words: list[str] = re.findall(r"\b[a-z]{4,}\b", words)
    word_freq: dict[str, int] = {}
    stopwords: set[str] = {
        "this",
        "that",
        "with",
        "from",
        "have",
        "been",
        "will",
        "your",
        "they",
        "them",
        "their",
        "each",
        "which",
        "when",
        "what",
        "where",
        "about",
        "into",
        "more",
        "some",
        "than",
        "then",
        "very",
        "also",
        "just",
        "only",
        "should",
        "would",
        "could",
        "after",
        "before",
        "other",
        "these",
        "those",
        "such",
        "over",
        "under",
    }
    for w in all_words:
        if w not in stopwords:
            word_freq[w] = word_freq.get(w, 0) + 1
    tags: list[str] = sorted(
        word_freq,
        key=lambda w: word_freq[w],
        reverse=True,
    )[:8]

    # Summary (first 2 sentences)
    sentences: list[str] = re.split(r"[.!?]+", text[:500])
    sentences = [s.strip() for s in sentences if len(s.strip()) > 20]
    summary: str = ". ".join(sentences[:2]) + "." if sentences else "No summary available."

    return InterpretResult(
        detected_type=doc_type,
        department=department,
        tags=tags,
        entities=[],
        summary=summary[:300],
        language="English",
        confidence=0.4,
    )


async def _run_interpret(text: str, title: str = "", filename: str = "") -> InterpretResult:
    """Run AI interpretation, with heuristic fallback, then attach regex metadata."""
    result: InterpretResult
    if not src.core.config.settings.GEMINI_ENABLED:
        result = _heuristic_interpret(text, title)
    else:
        try:
            from src.adapters.gemini_client import _call_gemini

            prompt: str = _INTERPRET_PROMPT.format(
                title=title or "Untitled",
                content_preview=text[:3000],
            )
            raw = await _call_gemini(prompt)
            result = _parse_interpret_response(raw) if raw else _heuristic_interpret(text, title)
        except Exception as exc:
            src.core.logging.logger.warning(
                "Gemini interpret failed, using heuristic fallback",
                extra={"error": str(exc)},
            )
            result = _heuristic_interpret(text, title)

    # Attach regex-based metadata extraction (always runs, reliable)
    result.extracted_metadata = _extract_metadata_from_text(text, filename)

    # If regex found a better title than the filename, promote it
    if result.extracted_metadata.detected_title and (not title or title == filename):
        result.extracted_metadata.detected_title = result.extracted_metadata.detected_title

    return result


# ═══════════════════════════════════════════════════════════════════════════════
# Duplicate Detection (vector similarity search)
# ═══════════════════════════════════════════════════════════════════════════════

_DUPLICATE_SIMILARITY_THRESHOLD = 0.85
_CLAIM_KEYWORDS = (
    "must",
    "should",
    "required",
    "require",
    "never",
    "always",
    "minimum",
    "maximum",
    "at least",
    "at most",
    "within",
    "before",
    "after",
    "only",
    "cannot",
    "can't",
    "do not",
    "don't",
    "prohibited",
    "forbidden",
)
_NEGATION_TERMS = (
    " no ",
    " not ",
    " never ",
    " cannot ",
    " can't ",
    " prohibited ",
    " forbidden ",
    " do not ",
    " don't ",
)
_CLAIM_STOPWORDS: set[str] = {
    "about",
    "after",
    "before",
    "from",
    "into",
    "must",
    "should",
    "that",
    "their",
    "there",
    "these",
    "they",
    "this",
    "with",
    "within",
    "will",
}


def _normalize_excerpt(value: str, limit: int = 220) -> str:
    return re.sub(r"\s+", " ", value or "").strip()[:limit]


async def _search_existing_documents(
    text: str,
    auth_token: str = "",
    limit: int = 5,
) -> list[dict[str, typing.Any]]:
    headers: dict[str, str] = {"Content-Type": "application/json"}
    if auth_token:
        headers["Authorization"] = f"Bearer {auth_token}"

    query: str = text[:500].strip()
    if len(query) < 20:
        return []

    try:
        async with shared.http_client.create_service_client(
            "pipeline-review-intel",
            timeout=5.0,
        ) as client:
            resp: httpx.Response = await client.post(
                f"{src.core.config.settings.KNOWLEDGE_API_URL}/v1/search",
                json={"query": query, "limit": limit, "mode": "vector"},
                headers=headers,
            )
            if resp.status_code != 200:
                return []

            data = resp.json()
    except Exception as exc:
        src.core.logging.logger.warning(
            "Review intelligence search failed (non-blocking)",
            extra={"error": str(exc)},
        )
        return []

    results = data.get("results", [])
    return results if isinstance(results, list) else []


async def _check_duplicates(
    text: str,
    auth_token: str = "",
    fingerprint: str = "",
    search_results: list[dict[str, typing.Any]] | None = None,
) -> list[DuplicateMatch]:
    """
    Query the vector store for existing documents similar to this content.

    Uses two strategies:
    1. **Exact hash match** — if any returned document's metadata contains
       the same content_hash, it's flagged as an exact duplicate (1.0 similarity).
    2. **Vector similarity** — documents with ≥0.85 cosine similarity are
       flagged as near-duplicates.
    """
    try:
        results: list[dict[str, typing.Any]] = search_results or await _search_existing_documents(
            text,
            auth_token,
        )

        duplicates: list[DuplicateMatch] = []
        seen_doc_ids: set[str] = set()

        for r in results:
            doc_id = r.get("document_id", "")
            if doc_id in seen_doc_ids:
                continue

            score = r.get("score", 0.0)
            title = r.get("title", "Untitled")
            preview = r.get("content", "")[:120]

            # Check for exact content hash match in document metadata
            doc_meta = r.get("metadata", {}) or {}
            custom = doc_meta.get("custom", {}) or {}
            stored_hash = custom.get("content_hash", "")

            if fingerprint and stored_hash and fingerprint == stored_hash:
                seen_doc_ids.add(doc_id)
                duplicates.insert(
                    0,
                    DuplicateMatch(
                        document_id=doc_id,
                        title=title,
                        similarity=1.0,
                        chunk_preview=preview,
                        match_type="exact",
                    ),
                )
            elif score >= _DUPLICATE_SIMILARITY_THRESHOLD:
                seen_doc_ids.add(doc_id)
                duplicates.append(
                    DuplicateMatch(
                        document_id=doc_id,
                        title=title,
                        similarity=round(score, 3),
                        chunk_preview=preview,
                        match_type="similar",
                    ),
                )

        return duplicates
    except Exception as exc:
        src.core.logging.logger.warning(
            "Duplicate check failed (non-blocking)",
            extra={"error": str(exc)},
        )
        return []


def _extract_candidate_claims(text: str, limit: int = 5) -> list[str]:
    normalized: str = re.sub(r"\s+", " ", text or "").strip()
    if not normalized:
        return []

    sentences: list[str] = re.split(r"(?<=[.!?])\s+", normalized)
    claims: list[str] = []
    seen: set[str] = set()

    for sentence in sentences:
        clean: str = re.sub(r"^[\-\*\d\)\.\s]+", "", sentence).strip()
        if len(clean) < 24:
            continue
        lower: str = f" {clean.lower()} "
        has_claim_signal: bool = any(keyword in lower for keyword in _CLAIM_KEYWORDS) or bool(
            re.search(
                r"\b\d+(?:\.\d+)?(?:\s?(?:%|mg|g|kg|lb|lbs|hours?|hrs?|days?|weeks?|months?|years?|minutes?|mins?))?\b",
                lower,
            )
        )
        if not has_claim_signal:
            continue
        key: str = clean.lower()
        if key in seen:
            continue
        seen.add(key)
        claims.append(clean[:220])
        if len(claims) >= limit:
            return claims

    if claims:
        return claims

    fallback: list[str] = []
    for sentence in sentences:
        clean: str = re.sub(r"^[\-\*\d\)\.\s]+", "", sentence).strip()
        if len(clean) < 24:
            continue
        fallback.append(clean[:220])
        if len(fallback) >= min(limit, 3):
            break
    return fallback


def _claim_tokens(text: str) -> set[str]:
    return {
        token
        for token in re.findall(r"\b[a-z]{3,}\b", (text or "").lower())
        if token not in _CLAIM_STOPWORDS
    }


def _extract_numeric_tokens(text: str) -> set[str]:
    return {
        match.group(0).lower().replace(" ", "")
        for match in re.finditer(
            r"\b\d+(?:\.\d+)?(?:\s?(?:%|mg|g|kg|lb|lbs|hours?|hrs?|days?|weeks?|months?|years?|minutes?|mins?))?\b",
            (text or "").lower(),
        )
    }


def _has_negation_mismatch(candidate_claim: str, conflicting_claim: str) -> bool:
    candidate: str = f" {candidate_claim.lower()} "
    conflicting: str = f" {conflicting_claim.lower()} "
    candidate_negated: bool = any(term in candidate for term in _NEGATION_TERMS)
    conflicting_negated: bool = any(term in conflicting for term in _NEGATION_TERMS)
    return candidate_negated != conflicting_negated


def _heuristic_contradictions(
    candidate_claims: list[str],
    search_results: list[dict[str, typing.Any]],
) -> list[ContradictionMatch]:
    matches: list[ContradictionMatch] = []
    seen: set[tuple[str, str, str]] = set()

    for result in search_results[:5]:
        document_id: str = str(result.get("document_id", "") or "").strip()
        title: str = str(result.get("title", "Untitled") or "Untitled").strip() or "Untitled"
        preview: str = _normalize_excerpt(str(result.get("content", "") or ""), 260)
        if not document_id or not preview:
            continue

        conflict_claims: list[str] = _extract_candidate_claims(preview, limit=2) or [preview]
        for candidate_claim in candidate_claims:
            candidate_tokens: set[str] = _claim_tokens(candidate_claim)
            candidate_numbers: set[str] = _extract_numeric_tokens(candidate_claim)
            if len(candidate_tokens) < 3:
                continue

            for conflicting_claim in conflict_claims:
                conflicting_tokens: set[str] = _claim_tokens(conflicting_claim)
                if len(conflicting_tokens) < 3:
                    continue

                overlap: float = len(candidate_tokens & conflicting_tokens) / max(
                    min(len(candidate_tokens), len(conflicting_tokens)),
                    1,
                )
                conflicting_numbers: set[str] = _extract_numeric_tokens(conflicting_claim)
                numeric_conflict = bool(
                    candidate_numbers
                    and conflicting_numbers
                    and candidate_numbers != conflicting_numbers
                )
                negation_conflict: bool = overlap >= 0.5 and _has_negation_mismatch(
                    candidate_claim,
                    conflicting_claim,
                )

                if overlap < 0.45 or (not numeric_conflict and not negation_conflict):
                    continue

                key: tuple[str, str, str] = (
                    document_id,
                    candidate_claim.lower(),
                    conflicting_claim.lower(),
                )
                if key in seen:
                    continue
                seen.add(key)

                confidence: float = 0.55 + min(overlap, 0.5) * 0.4
                if numeric_conflict:
                    confidence += 0.15
                rationale: str = (
                    "Conflicting numeric guidance detected."
                    if numeric_conflict
                    else "Opposite policy language detected."
                )
                matches.append(
                    ContradictionMatch(
                        document_id=document_id,
                        title=title,
                        candidate_claim=candidate_claim[:220],
                        conflicting_claim=conflicting_claim[:220],
                        chunk_preview=preview,
                        confidence=round(min(confidence, 0.95), 2),
                        rationale=rationale,
                    )
                )

    matches.sort(key=lambda item: item.confidence, reverse=True)
    return matches[:3]


_CONTRADICTION_PROMPT = """\
You are reviewing a candidate knowledge-base document against existing stream-scoped
knowledge snippets.

Find only likely contradictions where the candidate claim and an existing snippet
appear to address the same topic but disagree materially.

Ignore duplicates, paraphrases, scope expansions, or details that can coexist.

Return JSON only as an array. Each object must contain:
- document_id
- title
- candidate_claim
- conflicting_claim
- confidence
- rationale

Candidate title: {title}
Candidate claims:
{candidate_claims}

Existing snippets:
{existing_snippets}
"""


def _strip_code_fences(raw: str) -> str:
    clean: str = raw.strip()
    if clean.startswith("```"):
        clean: str = re.sub(r"^```(?:json)?\s*", "", clean)
        clean: str = re.sub(r"\s*```$", "", clean)
    return clean.strip()


def _parse_contradiction_response(raw: str) -> list[ContradictionMatch]:
    try:
        parsed = json.loads(_strip_code_fences(raw))
    except json.JSONDecodeError:
        return []

    if not isinstance(parsed, list):
        return []

    matches: list[ContradictionMatch] = []
    for item in parsed[:3]:
        if not isinstance(item, dict):
            continue
        document_id: str = str(item.get("document_id", "") or "").strip()
        title: str = str(item.get("title", "Untitled") or "Untitled").strip() or "Untitled"
        candidate_claim: str = _normalize_excerpt(
            str(item.get("candidate_claim", "") or ""),
            220,
        )
        conflicting_claim: str = _normalize_excerpt(
            str(item.get("conflicting_claim", "") or ""),
            220,
        )
        rationale: str = _normalize_excerpt(str(item.get("rationale", "") or ""), 220)
        chunk_preview: str = _normalize_excerpt(
            str(item.get("chunk_preview", "") or conflicting_claim),
            260,
        )
        if not document_id or not candidate_claim or not conflicting_claim:
            continue

        try:
            confidence = float(item.get("confidence", 0.5))
        except (TypeError, ValueError):
            confidence = 0.5

        matches.append(
            ContradictionMatch(
                document_id=document_id,
                title=title,
                candidate_claim=candidate_claim,
                conflicting_claim=conflicting_claim,
                chunk_preview=chunk_preview,
                confidence=round(max(0.0, min(confidence, 1.0)), 2),
                rationale=rationale,
            )
        )

    return matches


async def _check_contradictions(
    text: str,
    title: str = "",
    auth_token: str = "",
    search_results: list[dict[str, typing.Any]] | None = None,
) -> list[ContradictionMatch]:
    results: list[dict[str, typing.Any]] = search_results or await _search_existing_documents(
        text,
        auth_token,
    )
    if not results:
        return []

    candidate_claims: list[str] = _extract_candidate_claims(text)
    if not candidate_claims:
        return []

    heuristic_matches: list[ContradictionMatch] = _heuristic_contradictions(
        candidate_claims,
        results,
    )
    if not src.core.config.settings.GEMINI_ENABLED:
        return heuristic_matches

    try:
        from src.adapters.gemini_client import _call_gemini

        snippets: str = "\n".join(
            f"- {str(item.get('document_id', '') or '').strip()} | "
            f"{str(item.get('title', 'Untitled') or 'Untitled').strip() or 'Untitled'} | "
            f"{_normalize_excerpt(str(item.get('content', '') or ''), 220)}"
            for item in results[:5]
            if _normalize_excerpt(str(item.get("content", "") or ""), 220)
        )
        prompt: str = _CONTRADICTION_PROMPT.format(
            title=title or "Untitled",
            candidate_claims="\n".join(f"- {claim}" for claim in candidate_claims),
            existing_snippets=snippets or "- none",
        )
        raw = await _call_gemini(prompt)
        parsed: list[ContradictionMatch] = _parse_contradiction_response(raw or "")
        return parsed or heuristic_matches
    except Exception as exc:
        src.core.logging.logger.warning(
            "Contradiction check failed, using heuristic fallback",
            extra={"error": str(exc)},
        )
        return heuristic_matches


# ═══════════════════════════════════════════════════════════════════════════════
# Stage 3: Decide (Gemini-powered with heuristic fallback)
# ═══════════════════════════════════════════════════════════════════════════════

_DECIDE_PROMPT = """\
You are a knowledge base curator for an enterprise AI system.

A user wants to ingest the following content into a knowledge base.
The knowledge base serves a specific value stream (business domain).

Value stream: {value_stream_description}
Document type: {doc_type}
Department: {department}
Quality score: {quality_score}/100
PII detected: {pii_detected}
PII categories: {pii_categories}

--- CONTENT SUMMARY ---
{summary}
--- END ---

Based on this analysis, should this content be ingested?

Respond in EXACTLY this format:
RECOMMENDATION: <ingest | review | reject>
RELEVANCE: <0.0 to 1.0 — how relevant to the value stream>
REASONING: <1-2 sentences explaining your decision>

Rules:
- "ingest" = clearly relevant, good quality, safe to index automatically
- "review" = potentially relevant but needs human review
    (quality concerns, unclear fit, or sensitive personal data that may need redaction)
- "reject" = clearly irrelevant to the value stream, a duplicate,
    or unsafe / critically sensitive content that should not be indexed as-is

Decision:"""


def _parse_decide_response(raw: str, value_stream: str) -> DecideResult:
    """Parse the structured Gemini decision response."""
    lines: list[str] = raw.strip().split("\n")
    fields: dict[str, str] = {}
    for line in lines:
        if ":" in line:
            key, _, value = line.partition(":")
            fields[key.strip().upper()] = value.strip()

    rec: str = fields.get("RECOMMENDATION", "review").lower()
    if rec not in ("ingest", "review", "reject"):
        rec = "review"

    try:
        relevance = float(fields.get("RELEVANCE", "0.5").split()[0])
        relevance: float = max(0.0, min(1.0, relevance))
    except (ValueError, IndexError):
        relevance = 0.5

    return DecideResult(
        recommendation=rec,  # type: ignore[arg-type]
        relevance_score=relevance,
        reasoning=fields.get("REASONING", "Unable to determine — manual review recommended."),
        value_stream_match=relevance >= 0.5 and bool(value_stream),
    )


def _heuristic_decide(
    validate: ValidateResult,
    interpret: InterpretResult,
    value_stream_description: str,
    duplicates: list[DuplicateMatch] | None = None,
    contradictions: list[ContradictionMatch] | None = None,
) -> DecideResult:
    """Fallback decision when Gemini is unavailable."""
    dupes: list[DuplicateMatch] = duplicates or []
    contradiction_matches: list[ContradictionMatch] = contradictions or []

    critical_pii = sorted(
        set(validate.pii_categories) & src.domain.quality_gates.CRITICAL_PII_CATEGORIES
    )
    if critical_pii:
        cats: str = ", ".join(critical_pii)
        return DecideResult(
            recommendation="reject",
            relevance_score=0.0,
            reasoning=(
                f"Content contains critical sensitive data ({cats}). "
                "Remove or redact it before ingesting."
            ),
            value_stream_match=False,
            duplicates=dupes,
            contradictions=contradiction_matches,
        )

    # Non-critical sensitive PII = review, not auto reject
    if validate.pii_detected:
        cats: str = ", ".join(validate.pii_categories)
        return DecideResult(
            recommendation="review",
            relevance_score=0.35,
            reasoning=(
                f"Sensitive personal data was found ({cats}). "
                "Review or redact it before adding this content."
            ),
            value_stream_match=False,
            duplicates=dupes,
            contradictions=contradiction_matches,
        )

    # Toxicity / safety = auto reject
    if validate.toxicity_flagged:
        cats: str = ", ".join(validate.toxicity_categories)
        return DecideResult(
            recommendation="reject",
            relevance_score=0.0,
            reasoning=(
                f"Content flagged for safety concerns ({cats}). "
                "This content cannot be added to the knowledge base."
            ),
            value_stream_match=False,
            duplicates=dupes,
            contradictions=contradiction_matches,
        )

    # Very low quality = reject
    if validate.quality_score < 25:
        return DecideResult(
            recommendation="reject",
            relevance_score=0.2,
            reasoning=(
                "Content quality is too low for reliable knowledge extraction. Add more detail."
            ),
            value_stream_match=False,
            duplicates=dupes,
            contradictions=contradiction_matches,
        )

    # Check value stream relevance (keyword overlap)
    relevance = 0.5  # default if no value stream
    if value_stream_description:
        vs_words: set[str] = set(
            re.findall(r"\b[a-z]{4,}\b", value_stream_description.lower())
        )
        tag_words: set[str] = set(w.lower() for w in interpret.tags)
        dept_words: set[str] = set(
            re.findall(r"\b[a-z]{4,}\b", interpret.department.lower())
        )
        overlap: int = len(vs_words & (tag_words | dept_words))
        relevance: float = min(0.3 + overlap * 0.15, 1.0)

    # Exact duplicate (content hash match) = auto reject
    exact_dupes: list[DuplicateMatch] = [d for d in dupes if d.match_type == "exact"]
    if exact_dupes:
        best: DuplicateMatch = exact_dupes[0]
        return DecideResult(
            recommendation="reject",
            relevance_score=0.0,
            reasoning=(
                f'This exact content already exists: "{best.title}". '
                "The document is a duplicate and cannot be added again."
            ),
            value_stream_match=False,
            duplicates=dupes,
            contradictions=contradiction_matches,
        )

    # High-similarity duplicates → flag for review
    if dupes:
        best: DuplicateMatch = max(dupes, key=lambda d: d.similarity)
        return DecideResult(
            recommendation="review",
            relevance_score=relevance,
            reasoning=(
                f"Similar content already exists: "
                f'"{best.title}" ({best.similarity:.0%} match). '
                f"Review to avoid redundancy."
            ),
            value_stream_match=relevance >= 0.5,
            duplicates=dupes,
            contradictions=contradiction_matches,
        )

    if contradiction_matches:
        best: ContradictionMatch = max(contradiction_matches, key=lambda match: match.confidence)
        if best.confidence >= 0.85:
            return DecideResult(
                recommendation="reject",
                relevance_score=relevance,
                reasoning=(
                    f'High-confidence contradiction found with "{best.title}" (confidence {best.confidence:.0%}). '
                    f'Direct policy conflict: {best.rationale or "The candidate document directly contradicts an existing record."}'
                ),
                value_stream_match=relevance >= 0.5,
                duplicates=dupes,
                contradictions=contradiction_matches,
            )
        else:
            return DecideResult(
                recommendation="review",
                relevance_score=relevance,
                reasoning=(
                    f'Potential contradiction found with "{best.title}". '
                    "Send this through human review before it is published."
                ),
                value_stream_match=relevance >= 0.5,
                duplicates=dupes,
                contradictions=contradiction_matches,
            )

    qs: float = validate.quality_score
    if qs >= 70 and relevance >= 0.5:
        return DecideResult(
            recommendation="ingest",
            relevance_score=relevance,
            reasoning=(f"Good quality ({qs}/100) and relevant. Safe for automatic ingestion."),
            value_stream_match=relevance >= 0.5,
            duplicates=dupes,
            contradictions=contradiction_matches,
        )

    return DecideResult(
        recommendation="review",
        relevance_score=relevance,
        reasoning=(f"Quality ({qs}/100) or relevance ({relevance:.0%}) needs human review."),
        value_stream_match=relevance >= 0.5,
        duplicates=dupes,
        contradictions=contradiction_matches,
    )


async def _run_decide(
    validate: ValidateResult,
    interpret: InterpretResult,
    value_stream_description: str,
    duplicates: list[DuplicateMatch] | None = None,
    contradictions: list[ContradictionMatch] | None = None,
) -> DecideResult:
    """Run AI decision, with heuristic fallback."""
    dupes: list[DuplicateMatch] = duplicates or []
    contradiction_matches: list[ContradictionMatch] = contradictions or []
    if not src.core.config.settings.GEMINI_ENABLED:
        return _heuristic_decide(
            validate,
            interpret,
            value_stream_description,
            dupes,
            contradiction_matches,
        )

    try:
        from src.adapters.gemini_client import _call_gemini

        prompt: str = _DECIDE_PROMPT.format(
            value_stream_description=value_stream_description
            or "General knowledge base (no specific domain)",
            doc_type=interpret.detected_type,
            department=interpret.department,
            quality_score=validate.quality_score,
            pii_detected="Yes" if validate.pii_detected else "No",
            pii_categories=", ".join(validate.pii_categories) or "none",
            summary=interpret.summary[:500],
        )
        raw = await _call_gemini(prompt)
        if raw:
            result: DecideResult = _parse_decide_response(raw, value_stream_description)
            result.duplicates = dupes
            result.contradictions = contradiction_matches
            # Exact hash duplicates always reject, regardless of Gemini decision
            exact_dupes: list[DuplicateMatch] = [d for d in dupes if d.match_type == "exact"]
            if exact_dupes:
                best: DuplicateMatch = exact_dupes[0]
                result.recommendation = "reject"
                result.reasoning = (
                    f'This exact content already exists: "{best.title}". '
                    "The document is a duplicate and cannot be added again."
                )
            # If Gemini said ingest but we found similar dupes, downgrade to review
            elif dupes and result.recommendation == "ingest":
                best: DuplicateMatch = max(dupes, key=lambda d: d.similarity)
                result.recommendation = "review"
                result.reasoning += (
                    f' Note: similar content found — "{best.title}" ({best.similarity:.0%} match).'
                )
            elif contradiction_matches:
                best: ContradictionMatch = max(
                    contradiction_matches,
                    key=lambda match: match.confidence,
                )
                if best.confidence >= 0.85:
                    result.recommendation = "reject"
                    result.reasoning = (
                        f'High-confidence contradiction found with "{best.title}" (confidence {best.confidence:.0%}). '
                        f'Direct policy conflict: {best.rationale or "The candidate document directly contradicts an existing record."}'
                    )
                elif result.recommendation == "ingest":
                    result.recommendation = "review"
                    result.reasoning += (
                        f' Note: potential contradiction found with "{best.title}". '
                        "Human review is required before publish."
                    )
            return result
    except Exception as exc:
        src.core.logging.logger.warning(
            "Gemini decide failed, using heuristic fallback",
            extra={"error": str(exc)},
        )

    return _heuristic_decide(
        validate,
        interpret,
        value_stream_description,
        dupes,
        contradiction_matches,
    )


# ═══════════════════════════════════════════════════════════════════════════════
# Public API
# ═══════════════════════════════════════════════════════════════════════════════


async def analyze_content(
    text: str,
    title: str = "",
    value_stream_description: str = "",
    auth_token: str = "",
    filename: str = "",
) -> PreIngestAnalysis:
    """
    Run the full pre-ingestion analysis pipeline.

    Args:
        text: Content to analyze.
        title: Optional document title.
        value_stream_description: Description of the target value stream
            for relevance scoring.
        filename: Original filename for metadata extraction patterns.

    Returns:
        PreIngestAnalysis with results from all 3 stages.
    """
    # Stage 1: Validate (regex + Gemini PII judges)
    validate: ValidateResult = await _run_validate(text, title)

    # Stage 2: Interpret (async — Gemini or heuristic) + metadata extraction
    interpret: InterpretResult = await _run_interpret(text, title, filename)

    search_results: list[dict[str, typing.Any]] = await _search_existing_documents(
        text,
        auth_token,
    )

    # Stage 2.5: Duplicate check (non-blocking vector similarity + hash match)
    duplicates: list[DuplicateMatch] = await _check_duplicates(
        text,
        auth_token,
        validate.content_hash,
        search_results,
    )

    contradictions: list[ContradictionMatch] = await _check_contradictions(
        text,
        title,
        auth_token,
        search_results,
    )

    # Stage 3: Decide (async — Gemini or heuristic)
    decide: DecideResult = await _run_decide(
        validate,
        interpret,
        value_stream_description,
        duplicates,
        contradictions,
    )

    # Overall assessment
    overall_pass: bool = validate.passed and interpret.passed and decide.passed
    overall_confidence: float = (
        (validate.quality_score / 100) * 0.3
        + interpret.confidence * 0.3
        + decide.relevance_score * 0.4
    )

    return PreIngestAnalysis(
        validate=validate,
        interpret=interpret,
        decide=decide,
        overall_pass=overall_pass,
        overall_confidence=round(overall_confidence, 2),
    )
