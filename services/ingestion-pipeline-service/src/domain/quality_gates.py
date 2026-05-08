"""
Quality Gates — Automated validation before human review.

Runs automatically when a document enters DRAFT status. Results are
attached to the review record for the human reviewer.

Gates:
    1. Duplicate Detection — embedding similarity against existing docs
    2. Quality Score — completeness, specificity, actionability, readability
    3. PII / Sensitive Scan — regex-based detection of SSN, credit cards, PHI
    4. Readability Analysis — Flesch-Kincaid grade level
    5. Coverage Impact — how many unanswered queries this doc would address
    6. Toxicity / Safety Scan — harmful, dangerous, or policy-violating content
"""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass, field

# ═══════════════════════════════════════════════════════════════════════════════
# PII Detection (regex-based, no external deps)
# ═══════════════════════════════════════════════════════════════════════════════

PII_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("SSN", re.compile(r"\b\d{3}-\d{2}-\d{4}\b")),
    (
        "Credit Card",
        re.compile(
            r"\b(?:4\d{3}|5[1-5]\d{2}|3[47]\d{2}|6(?:011|5\d{2}))"
            r"[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b"
        ),
    ),
    ("Phone (US)", re.compile(r"\b(?:\+1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b")),
    ("Email", re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b")),
    (
        "Date of Birth",
        re.compile(
            r"\b(?:DOB|Date of Birth|Born)[:\s]+\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4}\b",
            re.IGNORECASE,
        ),
    ),
    (
        "Medical Record",
        re.compile(
            # Require a hard delimiter (: # =) and an identifier containing at
            # least one digit.  This avoids false positives on instructional KB
            # text like "Medical Record Number validation" while still catching
            # real PII such as "MRN: ABC12345" or "Patient ID: P00193821".
            r"\b(?:MRN|Medical Record(?:\s*(?:Number|No|#|ID))?|Patient ID)"
            r"\s*[:#=]\s*[\w-]*\d[\w-]*",
            re.IGNORECASE,
        ),
    ),
]

CONTACT_INFO_PII_CATEGORIES = frozenset({"Phone (US)", "Email"})


@dataclass
class PIIMatch:
    """A single PII detection result."""

    category: str
    match: str
    position: int  # character offset


@dataclass
class PIIScanResult:
    """Result of scanning a document for PII."""

    pii_detected: bool
    matches: list[PIIMatch] = field(default_factory=list)
    categories_found: list[str] = field(default_factory=list)

    @property
    def summary(self) -> str:
        if not self.pii_detected:
            return "No PII detected"
        cats = ", ".join(sorted(set(self.categories_found)))
        return f"PII detected: {cats} ({len(self.matches)} match(es))"


def scan_pii(text: str) -> PIIScanResult:
    """Scan text for personally identifiable information."""
    matches: list[PIIMatch] = []
    for category, pattern in PII_PATTERNS:
        for m in pattern.finditer(text):
            # Redact the actual match for safety
            redacted = m.group()[:4] + "..." if len(m.group()) > 4 else "***"
            matches.append(
                PIIMatch(
                    category=category,
                    match=redacted,
                    position=m.start(),
                )
            )

    categories = sorted(set(m.category for m in matches))
    return PIIScanResult(
        pii_detected=len(matches) > 0,
        matches=matches,
        categories_found=categories,
    )


def split_pii_categories(categories: list[str]) -> tuple[list[str], list[str]]:
    """Split detected PII into sensitive vs routine contact info buckets."""
    normalized = sorted({category for category in categories if category})
    sensitive = [category for category in normalized if category not in CONTACT_INFO_PII_CATEGORIES]
    contact = [category for category in normalized if category in CONTACT_INFO_PII_CATEGORIES]
    return sensitive, contact


# PII categories considered critical — ingestion should be blocked unless redacted
CRITICAL_PII_CATEGORIES = frozenset({"SSN", "Credit Card", "Medical Record"})

# Replacement tokens per PII category
_REDACT_TOKEN: dict[str, str] = {
    "SSN": "[SSN-REDACTED]",
    "Credit Card": "[CC-REDACTED]",
    "Phone (US)": "[PHONE-REDACTED]",
    "Email": "[EMAIL-REDACTED]",
    "Date of Birth": "[DOB-REDACTED]",
    "Medical Record": "[MRN-REDACTED]",
}


@dataclass
class RedactResult:
    """Result of redacting PII from text."""

    redacted_text: str
    original_length: int
    redacted_length: int
    redactions_applied: int
    categories_redacted: list[str]


def redact_pii(text: str, categories: list[str] | None = None) -> RedactResult:
    """
    Replace detected PII in *text* with safe placeholder tokens.

    Args:
        text: The source text to redact.
        categories: Optional whitelist — only redact these PII categories.
                    If ``None``, redact ALL detected PII.

    Returns:
        A ``RedactResult`` with the cleaned text and redaction metadata.
    """
    allowed = set(categories) if categories else None
    result_text = text
    count = 0
    cats_redacted: set[str] = set()

    # Process in reverse position order so earlier replacements don't shift offsets
    all_hits: list[tuple[str, re.Match[str]]] = []
    for category, pattern in PII_PATTERNS:
        if allowed and category not in allowed:
            continue
        for m in pattern.finditer(text):
            all_hits.append((category, m))

    # Sort by start position descending
    all_hits.sort(key=lambda h: h[1].start(), reverse=True)

    for category, m in all_hits:
        token = _REDACT_TOKEN.get(category, "[PII-REDACTED]")
        result_text = result_text[: m.start()] + token + result_text[m.end() :]
        count += 1
        cats_redacted.add(category)

    return RedactResult(
        redacted_text=result_text,
        original_length=len(text),
        redacted_length=len(result_text),
        redactions_applied=count,
        categories_redacted=sorted(cats_redacted),
    )


def has_critical_pii(scan: PIIScanResult) -> bool:
    """Return True if the scan found any critical PII (SSN, CC, MRN)."""
    return bool(set(scan.categories_found) & CRITICAL_PII_CATEGORIES)


# ═══════════════════════════════════════════════════════════════════════════════
# Readability Analysis (Flesch-Kincaid, no external deps)
# ═══════════════════════════════════════════════════════════════════════════════


def _count_syllables(word: str) -> int:
    """Approximate syllable count using vowel groups."""
    word = word.lower().strip(".,;:!?\"'()-")
    if not word:
        return 0
    vowels = "aeiouy"
    count = 0
    prev_vowel = False
    for ch in word:
        is_vowel = ch in vowels
        if is_vowel and not prev_vowel:
            count += 1
        prev_vowel = is_vowel
    # Silent 'e'
    if word.endswith("e") and count > 1:
        count -= 1
    return max(count, 1)


@dataclass
class ReadabilityResult:
    """Readability metrics for a document."""

    flesch_kincaid_grade: float
    flesch_reading_ease: float
    word_count: int
    sentence_count: int
    avg_words_per_sentence: float
    avg_syllables_per_word: float

    @property
    def grade_label(self) -> str:
        g = self.flesch_kincaid_grade
        if g <= 6:
            return "Easy (6th grade)"
        if g <= 8:
            return "Standard (8th grade)"
        if g <= 12:
            return "Moderate (high school)"
        if g <= 16:
            return "Difficult (college)"
        return "Very Difficult (graduate)"


def analyze_readability(text: str) -> ReadabilityResult:
    """Compute Flesch-Kincaid readability metrics."""
    # Split sentences (rough)
    sentences = re.split(r"[.!?]+", text)
    sentences = [s.strip() for s in sentences if s.strip()]
    sentence_count = max(len(sentences), 1)

    # Split words
    words = re.findall(r"\b[a-zA-Z]+\b", text)
    word_count = max(len(words), 1)

    # Count syllables
    total_syllables = sum(_count_syllables(w) for w in words)

    avg_words = word_count / sentence_count
    avg_syllables = total_syllables / word_count

    # Flesch-Kincaid Grade Level
    fk_grade = 0.39 * avg_words + 11.8 * avg_syllables - 15.59

    # Flesch Reading Ease
    fk_ease = 206.835 - 1.015 * avg_words - 84.6 * avg_syllables

    return ReadabilityResult(
        flesch_kincaid_grade=round(max(fk_grade, 0), 1),
        flesch_reading_ease=round(max(min(fk_ease, 100), 0), 1),
        word_count=word_count,
        sentence_count=sentence_count,
        avg_words_per_sentence=round(avg_words, 1),
        avg_syllables_per_word=round(avg_syllables, 2),
    )


# ═══════════════════════════════════════════════════════════════════════════════
# Quality Score (heuristic — Gemini-powered scoring is a future enhancement)
# ═══════════════════════════════════════════════════════════════════════════════


@dataclass
class QualityDimension:
    """A single quality dimension score (0–25)."""

    name: str
    score: float  # 0–25
    details: str


@dataclass
class QualityReport:
    """Comprehensive quality assessment of a document."""

    overall_score: float  # 0–100
    completeness: QualityDimension
    specificity: QualityDimension
    accuracy_signals: QualityDimension
    actionability: QualityDimension
    readability: ReadabilityResult
    pii_scan: PIIScanResult
    auto_approve_eligible: bool

    def to_dict(self) -> dict:
        return {
            "overall_score": round(self.overall_score, 1),
            "completeness": {
                "score": self.completeness.score,
                "details": self.completeness.details,
            },
            "specificity": {
                "score": self.specificity.score,
                "details": self.specificity.details,
            },
            "accuracy_signals": {
                "score": self.accuracy_signals.score,
                "details": self.accuracy_signals.details,
            },
            "actionability": {
                "score": self.actionability.score,
                "details": self.actionability.details,
            },
            "readability": {
                "flesch_kincaid_grade": self.readability.flesch_kincaid_grade,
                "flesch_reading_ease": self.readability.flesch_reading_ease,
                "grade_label": self.readability.grade_label,
                "word_count": self.readability.word_count,
                "sentence_count": self.readability.sentence_count,
            },
            "pii_scan": {
                "pii_detected": self.pii_scan.pii_detected,
                "categories_found": self.pii_scan.categories_found,
                "match_count": len(self.pii_scan.matches),
                "summary": self.pii_scan.summary,
            },
            "auto_approve_eligible": self.auto_approve_eligible,
        }


def score_quality(text: str, title: str = "") -> QualityReport:
    """
    Score document quality across four dimensions (0–25 each, 100 total).

    This is a heuristic scorer. A future enhancement will use Gemini
    for claim-by-claim accuracy evaluation.
    """
    readability = analyze_readability(text)
    pii = scan_pii(text)

    # ── Completeness (0–25) ─────────────────────────────────────────
    # Based on word count and structural indicators
    wc = readability.word_count
    if wc >= 500:
        comp_score = 25.0
        comp_detail = f"Good length ({wc} words)"
    elif wc >= 200:
        comp_score = 20.0
        comp_detail = f"Adequate length ({wc} words)"
    elif wc >= 50:
        comp_score = 12.0
        comp_detail = f"Short document ({wc} words)"
    else:
        comp_score = 5.0
        comp_detail = f"Very short ({wc} words) — may be incomplete"

    # Bonus for having headings/sections
    heading_count = len(re.findall(r"^#{1,3}\s|\n#{1,3}\s|^[A-Z][A-Z\s]{3,}$", text, re.MULTILINE))
    if heading_count >= 3:
        comp_score = min(comp_score + 3, 25)
        comp_detail += f"; {heading_count} sections detected"

    completeness = QualityDimension("Completeness", round(comp_score, 1), comp_detail)

    # ── Specificity (0–25) ──────────────────────────────────────────
    # Numbers, dates, proper nouns, specific details
    numbers = len(re.findall(r"\b\d+(?:\.\d+)?%?\b", text))
    date_pat = (
        r"\b\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4}\b"
        r"|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{1,2}"
    )
    dates = len(re.findall(date_pat, text))
    spec_score = min(10 + numbers * 0.5 + dates * 2, 25)
    spec_detail = f"{numbers} numeric references, {dates} date references"
    specificity = QualityDimension("Specificity", round(spec_score, 1), spec_detail)

    # ── Accuracy Signals (0–25) ─────────────────────────────────────
    # Citations, references, source mentions
    citations = len(re.findall(r"\[\d+\]|\((?:see|ref|source|per)\s", text, re.IGNORECASE))
    urls = len(re.findall(r"https?://\S+", text))
    acc_score = min(15 + citations * 3 + urls * 2, 25)
    if pii.pii_detected:
        acc_score = max(acc_score - 5, 0)
    acc_detail = f"{citations} citations, {urls} URLs"
    if pii.pii_detected:
        acc_detail += "; PII flag reduces score"
    accuracy = QualityDimension("Accuracy Signals", round(acc_score, 1), acc_detail)

    # ── Actionability (0–25) ────────────────────────────────────────
    # Action verbs, numbered steps, imperatives
    steps = len(re.findall(r"^\s*\d+[\.\)]\s", text, re.MULTILINE))
    bullets = len(re.findall(r"^\s*[-*•]\s", text, re.MULTILINE))
    action_verbs = len(
        re.findall(
            r"\b(?:must|should|shall|ensure|verify|check|complete|submit|follow|use|apply)\b",
            text,
            re.IGNORECASE,
        )
    )
    act_score = min(10 + steps * 2 + bullets * 0.5 + action_verbs * 0.5, 25)
    act_detail = f"{steps} numbered steps, {bullets} bullet points, {action_verbs} action verbs"
    actionability = QualityDimension("Actionability", round(act_score, 1), act_detail)

    overall = completeness.score + specificity.score + accuracy.score + actionability.score
    auto_approve = overall >= 90 and not pii.pii_detected

    return QualityReport(
        overall_score=round(overall, 1),
        completeness=completeness,
        specificity=specificity,
        accuracy_signals=accuracy,
        actionability=actionability,
        readability=readability,
        pii_scan=pii,
        auto_approve_eligible=auto_approve,
    )


# ═══════════════════════════════════════════════════════════════════════════════
# Toxicity / Safety Scan (regex + keyword, no external deps)
# ═══════════════════════════════════════════════════════════════════════════════

# Categories and their signal patterns.  Each pattern is tested against the
# lowercased document text.  Matches are counted; a *single* match in a
# CRITICAL category is enough to flag.  Non-critical categories require
# multiple distinct matches to reduce false positives on legitimate policy
# documents that mention these topics in passing.

_TOXICITY_CATEGORIES: list[tuple[str, bool, list[re.Pattern[str]]]] = [
    # (category_name, is_critical, patterns)
    (
        "Dangerous Instructions",
        True,
        [
            re.compile(p, re.IGNORECASE)
            for p in [
                r"\bhow to (?:make|build|create|assemble) "
                r"(?:a )?(?:bomb|explosive|weapon|poison)\b",
                r"\bstep[- ]by[- ]step (?:guide|instructions?) "
                r"(?:to|for) (?:harm|kill|attack|hack)\b",
                r"\binstructions? (?:to|for) (?:self[- ]harm|suicide)\b",
                r"\bsynthesize (?:drugs?|meth|fentanyl|ricin|sarin)\b",
            ]
        ],
    ),
    (
        "Hate Speech",
        True,
        [
            re.compile(p, re.IGNORECASE)
            for p in [
                r"\b(?:kill|exterminate|eliminate) (?:all )?"
                r"(?:jews|muslims|christians|blacks|whites|"
                r"asians|gays|immigrants)\b",
                r"\b(?:racial|ethnic) (?:cleansing|superiority|purity)\b",
                r"\bwhite (?:supremac|power|nationalist)\b",
                r"\bnazi (?:ideology|propaganda|movement)\b",
            ]
        ],
    ),
    (
        "Violence / Threats",
        False,
        [
            re.compile(p, re.IGNORECASE)
            for p in [
                r"\bi (?:will|want to|am going to) (?:kill|murder|hurt|attack|shoot|stab)\b",
                r"\bthreat(?:en(?:ing|ed)?|s?) to (?:kill|harm|hurt|attack|bomb|shoot)\b",
                r"\bdeserves? to (?:die|be killed|be hurt|suffer)\b",
            ]
        ],
    ),
    (
        "Self-Harm",
        True,
        [
            re.compile(p, re.IGNORECASE)
            for p in [
                r"\bhow to (?:commit suicide|end (?:your|my) life|cut yourself)\b",
                r"\bbest (?:ways?|methods?) to (?:kill yourself|die|self[- ]harm)\b",
                r"\bsuicide (?:methods?|techniques?|instructions?)\b",
            ]
        ],
    ),
    (
        "Harmful Advice",
        False,
        [
            re.compile(p, re.IGNORECASE)
            for p in [
                r"\bdo(?:n't|nt) (?:call|go to|visit) "
                r"(?:a |the )?(?:doctor|hospital|emergency|911)\b",
                r"\bstop taking (?:your |all )?(?:medication|medicine|insulin|prescription)\b",
                r"\bvaccines? (?:cause|are (?:causing|responsible for)) (?:autism|death|cancer)\b",
                r"\bdrink(?:ing)? bleach\b",
                r"\bignore (?:safety|warning|evacuation|medical)\b",
            ]
        ],
    ),
]

# Non-critical categories need this many distinct pattern matches to flag
_NON_CRITICAL_THRESHOLD = 2


@dataclass
class ToxicityMatch:
    """A single toxicity signal found in the content."""

    category: str
    pattern_preview: str  # First 80 chars of the matched span
    position: int  # Character offset
    is_critical: bool


@dataclass
class ToxicityScanResult:
    """Result of scanning a document for toxic/unsafe content."""

    flagged: bool
    matches: list[ToxicityMatch] = field(default_factory=list)
    categories_found: list[str] = field(default_factory=list)
    severity: str = "none"  # "none", "warning", "critical"

    @property
    def summary(self) -> str:
        if not self.flagged:
            return "No safety concerns detected"
        cats = ", ".join(sorted(set(self.categories_found)))
        return f"Safety concern: {cats} ({len(self.matches)} signal(s), severity: {self.severity})"


def scan_toxicity(text: str) -> ToxicityScanResult:
    """
    Scan text for toxic, harmful, or unsafe content.

    Uses multi-pattern matching across safety categories.  Critical
    categories (dangerous instructions, hate speech, self-harm) flag on
    a single match.  Non-critical categories (violence mentions, harmful
    advice) require multiple distinct matches to reduce false positives
    on legitimate policy/safety documents.
    """
    lower = text.lower()
    matches: list[ToxicityMatch] = []
    cat_counts: dict[str, int] = {}

    for category, is_critical, patterns in _TOXICITY_CATEGORIES:
        for pattern in patterns:
            for m in pattern.finditer(lower):
                matches.append(
                    ToxicityMatch(
                        category=category,
                        pattern_preview=text[m.start() : m.start() + 80],
                        position=m.start(),
                        is_critical=is_critical,
                    )
                )
                cat_counts[category] = cat_counts.get(category, 0) + 1

    # Determine which categories actually flag
    flagged_cats: list[str] = []
    for category, is_critical, _ in _TOXICITY_CATEGORIES:
        count = cat_counts.get(category, 0)
        if count == 0:
            continue
        if is_critical or count >= _NON_CRITICAL_THRESHOLD:
            flagged_cats.append(category)

    if not flagged_cats:
        return ToxicityScanResult(flagged=False)

    has_critical = any(m.is_critical for m in matches if m.category in flagged_cats)
    return ToxicityScanResult(
        flagged=True,
        matches=[m for m in matches if m.category in flagged_cats],
        categories_found=sorted(set(flagged_cats)),
        severity="critical" if has_critical else "warning",
    )


# ═══════════════════════════════════════════════════════════════════════════════
# Content Fingerprint — fast SHA-256 for exact-match deduplication
# ═══════════════════════════════════════════════════════════════════════════════


def content_hash(text: str) -> str:
    """
    Compute a deterministic SHA-256 hash of normalized content.

    Normalization: lowercase, collapse whitespace, strip zero-width chars.
    Two documents with the same content_hash are considered exact duplicates.
    """
    normalized = re.sub(r"\s+", " ", text.strip()).lower()
    normalized = re.sub(r"[\u200b\u200c\u200d\ufeff]", "", normalized)
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()
