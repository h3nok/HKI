"""
RAG Evaluation Suite — RAGAS-style scoring for retrieval-augmented generation.

Evaluates generated answers across four dimensions:
    Faithfulness   — Is the answer grounded in the provided context?
    Relevance      — Does the answer address the user's question?
    Context Recall — Did the retriever find the right chunks?
    Completeness   — Does the answer cover all aspects of the question?

Each dimension yields a 0.0–1.0 score plus a brief rationale.
Uses Gemini for LLM-as-judge evaluation when available,
falls back to heuristic scoring for local dev.

Architecture:
    Called after generate_answer() in the Test tab workflow.
    Stateless — all inputs passed in, no side effects.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from src.core.config import settings
from src.core.logging import logger


@dataclass
class DimensionScore:
    """Score for a single evaluation dimension."""

    name: str
    score: float  # 0.0–1.0
    rationale: str = ""


@dataclass
class RAGEvaluationResult:
    """Complete evaluation of a RAG response."""

    faithfulness: DimensionScore = field(
        default_factory=lambda: DimensionScore(name="faithfulness", score=0.0),
    )
    relevance: DimensionScore = field(
        default_factory=lambda: DimensionScore(name="relevance", score=0.0),
    )
    context_recall: DimensionScore = field(
        default_factory=lambda: DimensionScore(name="context_recall", score=0.0),
    )
    completeness: DimensionScore = field(
        default_factory=lambda: DimensionScore(name="completeness", score=0.0),
    )
    overall_score: float = 0.0
    grade: str = ""  # A / B / C / D / F

    def compute_overall(self) -> None:
        """Compute weighted overall score and letter grade."""
        weights = {
            "faithfulness": 0.35,
            "relevance": 0.30,
            "context_recall": 0.20,
            "completeness": 0.15,
        }
        self.overall_score = (
            self.faithfulness.score * weights["faithfulness"]
            + self.relevance.score * weights["relevance"]
            + self.context_recall.score * weights["context_recall"]
            + self.completeness.score * weights["completeness"]
        )
        if self.overall_score >= 0.9:
            self.grade = "A"
        elif self.overall_score >= 0.75:
            self.grade = "B"
        elif self.overall_score >= 0.6:
            self.grade = "C"
        elif self.overall_score >= 0.4:
            self.grade = "D"
        else:
            self.grade = "F"


# ═══════════════════════════════════════════════════════════════════════════════
# Heuristic evaluation (no LLM needed — always available)
# ═══════════════════════════════════════════════════════════════════════════════


def _heuristic_faithfulness(
    answer: str,
    chunks: list[dict],
) -> DimensionScore:
    """
    Estimate faithfulness by checking how many answer n-grams
    appear in the source chunks. Uses multi-level n-gram analysis
    (1-gram, 2-gram, 3-gram) with weighted combination for more
    robust scoring that handles paraphrased but faithful content.
    """
    if not answer or not chunks:
        return DimensionScore(
            name="faithfulness",
            score=0.0,
            rationale="No answer or no chunks provided.",
        )

    chunk_text = " ".join(c.get("content", "") for c in chunks).lower()
    answer_lower = answer.lower()

    # Remove common stop words for meaningful overlap detection
    stop_words = {
        "the",
        "a",
        "an",
        "is",
        "are",
        "was",
        "were",
        "be",
        "been",
        "and",
        "or",
        "but",
        "in",
        "on",
        "at",
        "to",
        "for",
        "of",
        "with",
        "by",
        "it",
        "its",
        "this",
        "that",
        "from",
        "as",
    }

    words = answer_lower.split()
    if len(words) < 3:
        # Very short answer — check if key words appear in chunks
        meaningful_words = [w for w in words if w not in stop_words and len(w) > 2]
        if not meaningful_words:
            return DimensionScore(
                name="faithfulness",
                score=0.5,
                rationale="Answer too short for n-gram analysis.",
            )
        matched = sum(1 for w in meaningful_words if w in chunk_text)
        score = matched / len(meaningful_words)
        return DimensionScore(
            name="faithfulness",
            score=round(min(1.0, score), 3),
            rationale="Short answer checked via keyword match.",
        )

    # Multi-level n-gram analysis
    def ngram_overlap(n: int) -> float:
        if len(words) < n:
            return 0.0
        ngrams = [" ".join(words[i : i + n]) for i in range(len(words) - n + 1)]
        if not ngrams:
            return 0.0
        matched = sum(1 for ng in ngrams if ng in chunk_text)
        return matched / len(ngrams)

    # Weighted: trigrams matter most (harder to match by accident)
    unigram_score = ngram_overlap(1)
    bigram_score = ngram_overlap(2)
    trigram_score = ngram_overlap(3)

    score = min(1.0, unigram_score * 0.2 + bigram_score * 0.35 + trigram_score * 0.45)

    # Penalty: check for substantial answer segments (5+ words) with zero chunk overlap
    sentences = re.split(r"[.!?]+", answer_lower)
    unsupported_sentences = 0
    total_sentences = 0
    for sent in sentences:
        sent = sent.strip()
        sent_words = [w for w in sent.split() if w not in stop_words]
        if len(sent_words) < 3:
            continue
        total_sentences += 1
        sent_bigrams = [" ".join(sent_words[i : i + 2]) for i in range(len(sent_words) - 1)]
        bigram_hits = sum(1 for bg in sent_bigrams if bg in chunk_text) if sent_bigrams else 0
        if sent_bigrams and bigram_hits / len(sent_bigrams) < 0.15:
            unsupported_sentences += 1

    if total_sentences > 0 and unsupported_sentences > 0:
        penalty = (unsupported_sentences / total_sentences) * 0.3
        score = max(0.0, score - penalty)

    if score >= 0.7:
        rationale = "Answer is well-grounded in the source material."
    elif score >= 0.4:
        rationale = "Answer is partially grounded — some claims lack source support."
    else:
        rationale = "Answer contains significant content not found in sources."

    return DimensionScore(name="faithfulness", score=round(score, 3), rationale=rationale)


def _heuristic_relevance(
    query: str,
    answer: str,
) -> DimensionScore:
    """
    Estimate relevance by keyword overlap between query and answer.
    """
    if not query or not answer:
        return DimensionScore(
            name="relevance",
            score=0.0,
            rationale="Missing query or answer.",
        )

    q_words = set(re.findall(r"\w{3,}", query.lower()))
    a_words = set(re.findall(r"\w{3,}", answer.lower()))

    if not q_words:
        return DimensionScore(
            name="relevance",
            score=0.5,
            rationale="Query too short for keyword analysis.",
        )

    overlap = len(q_words & a_words)
    score = min(1.0, overlap / len(q_words))

    # Boost if answer is substantial
    if len(answer.split()) > 20:
        score = min(1.0, score + 0.1)

    if score >= 0.7:
        rationale = "Answer directly addresses the question."
    elif score >= 0.4:
        rationale = "Answer partially addresses the question."
    else:
        rationale = "Answer may not be relevant to the question."

    return DimensionScore(name="relevance", score=round(score, 3), rationale=rationale)


def _heuristic_context_recall(
    query: str,
    chunks: list[dict],
) -> DimensionScore:
    """
    Estimate context recall by checking if the retrieved chunks
    cover the query terms.
    """
    if not query or not chunks:
        return DimensionScore(
            name="context_recall",
            score=0.0,
            rationale="Missing query or chunks.",
        )

    q_words = set(re.findall(r"\w{3,}", query.lower()))
    chunk_text = " ".join(c.get("content", "") for c in chunks).lower()
    c_words = set(re.findall(r"\w{3,}", chunk_text))

    if not q_words:
        return DimensionScore(
            name="context_recall",
            score=0.5,
            rationale="Query too short for analysis.",
        )

    coverage = len(q_words & c_words)
    score = min(1.0, coverage / len(q_words))

    # Factor in average retrieval score
    scores = [c.get("score", 0) for c in chunks if c.get("score")]
    if scores:
        avg_score = sum(scores) / len(scores)
        score = (score + avg_score) / 2

    if score >= 0.7:
        rationale = "Retrieved chunks cover the query well."
    elif score >= 0.4:
        rationale = "Some query aspects not covered by retrieved chunks."
    else:
        rationale = "Retrieved chunks poorly match the query."

    return DimensionScore(
        name="context_recall",
        score=round(score, 3),
        rationale=rationale,
    )


def _heuristic_completeness(
    query: str,
    answer: str,
) -> DimensionScore:
    """
    Estimate completeness by answer length relative to query complexity,
    keyword coverage, and structural thoroughness.
    """
    if not answer:
        return DimensionScore(
            name="completeness",
            score=0.0,
            rationale="No answer provided.",
        )

    q_words = query.split()
    a_words = answer.split()

    # Simple heuristic: longer, more complex questions need longer answers
    expected_length = max(20, len(q_words) * 5)
    length_ratio = min(1.0, len(a_words) / expected_length)

    # Check for multiple sentences (indicator of thoroughness)
    sentences = re.split(r"[.!?]+", answer)
    sentence_count = len([s for s in sentences if s.strip()])
    sentence_score = min(1.0, sentence_count / 3)

    # Query keyword coverage — does the answer address key query terms?
    stop_words = {
        "the",
        "a",
        "an",
        "is",
        "are",
        "was",
        "were",
        "what",
        "how",
        "does",
        "do",
        "can",
        "could",
        "would",
        "should",
        "and",
        "or",
        "but",
        "in",
        "on",
        "at",
        "to",
        "for",
        "of",
        "with",
        "by",
        "it",
        "its",
        "this",
        "that",
        "from",
        "as",
    }
    q_keywords = {w.lower() for w in q_words if w.lower() not in stop_words and len(w) > 2}
    a_text_lower = answer.lower()
    if q_keywords:
        keyword_coverage = sum(1 for kw in q_keywords if kw in a_text_lower) / len(q_keywords)
    else:
        keyword_coverage = 0.5

    score = length_ratio * 0.3 + sentence_score * 0.25 + keyword_coverage * 0.45

    if score >= 0.7:
        rationale = "Answer provides thorough coverage."
    elif score >= 0.4:
        rationale = "Answer covers basics but may miss details."
    else:
        rationale = "Answer is too brief for the question's scope."

    return DimensionScore(
        name="completeness",
        score=round(score, 3),
        rationale=rationale,
    )


# ═══════════════════════════════════════════════════════════════════════════════
# LLM-as-Judge evaluation (Gemini — production path)
# ═══════════════════════════════════════════════════════════════════════════════

_EVAL_PROMPT = """\
You are an expert evaluator for a Retrieval-Augmented Generation system. \
Score the following answer on four dimensions (0.0 to 1.0 each). \
Be strict and objective.

QUESTION: {query}

ANSWER: {answer}

CONTEXT CHUNKS:
{chunks_text}

Score each dimension and provide a 1-sentence rationale:

1. FAITHFULNESS (Is the answer grounded in the context? No hallucination?)
2. RELEVANCE (Does the answer address the question directly?)
3. CONTEXT_RECALL (Did the retrieved chunks contain the needed information?)
4. COMPLETENESS (Does the answer cover all aspects of the question?)

Format EXACTLY as:
FAITHFULNESS: <score> | <rationale>
RELEVANCE: <score> | <rationale>
CONTEXT_RECALL: <score> | <rationale>
COMPLETENESS: <score> | <rationale>"""


def _parse_llm_scores(raw: str) -> dict[str, DimensionScore]:
    """Parse structured LLM evaluation output."""
    results: dict[str, DimensionScore] = {}
    for dim in ("faithfulness", "relevance", "context_recall", "completeness"):
        pattern = rf"{dim.upper()}:\s*([\d.]+)\s*\|\s*(.+)"
        match = re.search(pattern, raw)
        if match:
            try:
                score = float(match.group(1))
                score = max(0.0, min(1.0, score))
            except ValueError:
                score = 0.5
            results[dim] = DimensionScore(
                name=dim,
                score=round(score, 3),
                rationale=match.group(2).strip(),
            )
    return results


async def _llm_evaluate(
    query: str,
    answer: str,
    chunks: list[dict],
) -> RAGEvaluationResult | None:
    """Use LLM as judge. Returns None if unavailable."""
    if not settings.LLM_ENABLED:
        return None

    try:
        from src.adapters.gemini_client import _call_llm, _get_semaphore
    except ImportError:
        return None

    chunks_text = "\n".join(
        f"[{i + 1}] {c.get('content', '')[:500]}" for i, c in enumerate(chunks[:8])
    )

    prompt = _EVAL_PROMPT.format(
        query=query,
        answer=answer,
        chunks_text=chunks_text,
    )

    try:
        async with _get_semaphore():
            raw = await _call_llm(prompt)
    except Exception as exc:
        logger.warning(
            "LLM evaluation failed, falling back to heuristics",
            extra={"error": str(exc)},
        )
        return None

    scores = _parse_llm_scores(raw)
    if len(scores) < 4:
        return None

    result = RAGEvaluationResult(
        faithfulness=scores["faithfulness"],
        relevance=scores["relevance"],
        context_recall=scores["context_recall"],
        completeness=scores["completeness"],
    )
    result.compute_overall()
    return result


# ═══════════════════════════════════════════════════════════════════════════════
# Public API
# ═══════════════════════════════════════════════════════════════════════════════


async def evaluate_rag(
    query: str,
    answer: str,
    chunks: list[dict],
    confidence: float = 0.0,
) -> RAGEvaluationResult:
    """
    Evaluate a RAG response using LLM-as-judge (preferred)
    or heuristic fallback.

    Args:
        query: User's original question.
        answer: Generated answer text.
        chunks: Retrieved context chunks.
        confidence: Self-reported confidence from generation.

    Returns:
        RAGEvaluationResult with scores for all four dimensions.
    """
    # Try LLM evaluation first
    llm_result = await _llm_evaluate(query, answer, chunks)
    if llm_result:
        return llm_result

    # Fallback: heuristic scoring
    result = RAGEvaluationResult(
        faithfulness=_heuristic_faithfulness(answer, chunks),
        relevance=_heuristic_relevance(query, answer),
        context_recall=_heuristic_context_recall(query, chunks),
        completeness=_heuristic_completeness(query, answer),
    )
    result.compute_overall()
    return result
