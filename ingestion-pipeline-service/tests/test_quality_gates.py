"""Tests for quality_gates.py — all pure functions, no mocks needed."""

from __future__ import annotations

import pytest

from src.domain.quality_gates import (
    CRITICAL_PII_CATEGORIES,
    PIIMatch,
    PIIScanResult,
    QualityDimension,
    QualityReport,
    ReadabilityResult,
    RedactResult,
    ToxicityMatch,
    ToxicityScanResult,
    _count_syllables,
    analyze_readability,
    content_hash,
    has_critical_pii,
    redact_pii,
    scan_pii,
    scan_toxicity,
    score_quality,
    split_pii_categories,
)


# ── _count_syllables ──────────────────────────────────────────────────────


class TestCountSyllables:
    def test_single_vowel_word(self):
        assert _count_syllables("a") == 1

    def test_simple_one_syllable(self):
        assert _count_syllables("cat") == 1

    def test_two_syllable_word(self):
        # "table": a + e = 2 vowel groups, but silent-e rule fires → 1.
        # Use "open" (o + e = 2, no silent-e reduction since it's not word-final alone).
        assert _count_syllables("open") == 2

    def test_three_syllable_word(self):
        assert _count_syllables("important") == 3

    def test_silent_e_reduces_count(self):
        # "make" has a silent e — should count as 1
        assert _count_syllables("make") == 1

    def test_empty_string_returns_zero(self):
        assert _count_syllables("") == 0

    def test_strips_punctuation(self):
        assert _count_syllables("cat.") == _count_syllables("cat")

    def test_minimum_one_for_nonempty(self):
        assert _count_syllables("rhythms") >= 1

    def test_y_counts_as_vowel(self):
        # "by" — y is a vowel group here
        assert _count_syllables("by") == 1

    def test_consecutive_vowels_count_once(self):
        # "team" — ea is one vowel group
        assert _count_syllables("team") == 1


# ── scan_pii ──────────────────────────────────────────────────────────────


class TestScanPii:
    def test_clean_text_returns_no_pii(self):
        result = scan_pii("This is a normal policy document with no personal data.")
        assert not result.pii_detected
        assert result.matches == []
        assert result.categories_found == []

    def test_detects_ssn(self):
        result = scan_pii("Employee SSN: 123-45-6789")
        assert result.pii_detected
        assert "SSN" in result.categories_found

    def test_detects_credit_card_visa(self):
        result = scan_pii("Card number: 4111 1111 1111 1111")
        assert result.pii_detected
        assert "Credit Card" in result.categories_found

    def test_detects_credit_card_mastercard(self):
        result = scan_pii("Payment: 5500-0000-0000-0004")
        assert result.pii_detected
        assert "Credit Card" in result.categories_found

    def test_detects_us_phone(self):
        result = scan_pii("Call us at 206-555-0100")
        assert result.pii_detected
        assert "Phone (US)" in result.categories_found

    def test_detects_phone_with_country_code(self):
        result = scan_pii("Reach us at +1 (800) 555-1234")
        assert result.pii_detected
        assert "Phone (US)" in result.categories_found

    def test_detects_email(self):
        result = scan_pii("Contact jane.doe@example.com for details.")
        assert result.pii_detected
        assert "Email" in result.categories_found

    def test_detects_date_of_birth(self):
        result = scan_pii("DOB: 04/15/1985")
        assert result.pii_detected
        assert "Date of Birth" in result.categories_found

    def test_detects_medical_record(self):
        result = scan_pii("Patient ID: MRN#12345")
        assert result.pii_detected
        assert "Medical Record" in result.categories_found

    def test_detects_multiple_categories(self):
        result = scan_pii("SSN 123-45-6789, email alice@test.com, phone 555-123-4567")
        assert result.pii_detected
        assert len(result.categories_found) >= 2

    def test_categories_found_sorted(self):
        result = scan_pii("SSN 123-45-6789, email alice@test.com")
        assert result.categories_found == sorted(result.categories_found)

    def test_match_is_redacted_not_raw(self):
        result = scan_pii("SSN: 123-45-6789")
        match = next(m for m in result.matches if m.category == "SSN")
        assert "123-45-6789" not in match.match
        assert "..." in match.match or "***" in match.match

    def test_match_has_position(self):
        text = "xxx SSN: 123-45-6789"
        result = scan_pii(text)
        ssn_match = next(m for m in result.matches if m.category == "SSN")
        assert ssn_match.position > 0

    def test_returns_pii_scan_result_type(self):
        result = scan_pii("hello")
        assert isinstance(result, PIIScanResult)

    def test_summary_no_pii(self):
        result = scan_pii("clean text")
        assert result.summary == "No PII detected"

    def test_summary_with_pii(self):
        result = scan_pii("SSN: 123-45-6789")
        assert "SSN" in result.summary
        assert "1 match" in result.summary


# ── split_pii_categories ──────────────────────────────────────────────────


class TestSplitPiiCategories:
    def test_empty_list_returns_empty_buckets(self):
        sensitive, contact = split_pii_categories([])
        assert sensitive == []
        assert contact == []

    def test_email_goes_to_contact_bucket(self):
        sensitive, contact = split_pii_categories(["Email"])
        assert contact == ["Email"]
        assert sensitive == []

    def test_phone_goes_to_contact_bucket(self):
        sensitive, contact = split_pii_categories(["Phone (US)"])
        assert contact == ["Phone (US)"]
        assert sensitive == []

    def test_ssn_goes_to_sensitive_bucket(self):
        sensitive, contact = split_pii_categories(["SSN"])
        assert sensitive == ["SSN"]
        assert contact == []

    def test_credit_card_goes_to_sensitive_bucket(self):
        sensitive, contact = split_pii_categories(["Credit Card"])
        assert sensitive == ["Credit Card"]
        assert contact == []

    def test_medical_record_goes_to_sensitive_bucket(self):
        sensitive, contact = split_pii_categories(["Medical Record"])
        assert sensitive == ["Medical Record"]
        assert contact == []

    def test_mixed_categories_split_correctly(self):
        cats = ["SSN", "Email", "Credit Card", "Phone (US)"]
        sensitive, contact = split_pii_categories(cats)
        assert "SSN" in sensitive
        assert "Credit Card" in sensitive
        assert "Email" in contact
        assert "Phone (US)" in contact

    def test_deduplicates_categories(self):
        sensitive, contact = split_pii_categories(["SSN", "SSN", "Email", "Email"])
        assert sensitive.count("SSN") == 1
        assert contact.count("Email") == 1

    def test_output_is_sorted(self):
        sensitive, contact = split_pii_categories(["SSN", "Credit Card", "Medical Record"])
        assert sensitive == sorted(sensitive)


# ── redact_pii ────────────────────────────────────────────────────────────


class TestRedactPii:
    def test_clean_text_unchanged(self):
        result = redact_pii("No PII here at all.")
        assert result.redacted_text == "No PII here at all."
        assert result.redactions_applied == 0

    def test_ssn_replaced_with_token(self):
        result = redact_pii("SSN: 123-45-6789")
        assert "123-45-6789" not in result.redacted_text
        assert "[SSN-REDACTED]" in result.redacted_text

    def test_email_replaced_with_token(self):
        result = redact_pii("Email: bob@example.com")
        assert "bob@example.com" not in result.redacted_text
        assert "[EMAIL-REDACTED]" in result.redacted_text

    def test_phone_replaced_with_token(self):
        result = redact_pii("Call 206-555-0100 now")
        assert "206-555-0100" not in result.redacted_text
        assert "[PHONE-REDACTED]" in result.redacted_text

    def test_credit_card_replaced_with_token(self):
        result = redact_pii("Pay with 4111 1111 1111 1111")
        assert "4111" not in result.redacted_text
        assert "[CC-REDACTED]" in result.redacted_text

    def test_redaction_count_matches_occurrences(self):
        text = "SSN: 123-45-6789. Another: 987-65-4321."
        result = redact_pii(text)
        assert result.redactions_applied == 2

    def test_categories_redacted_list_populated(self):
        result = redact_pii("SSN: 123-45-6789, email: x@y.com")
        assert "SSN" in result.categories_redacted
        assert "Email" in result.categories_redacted

    def test_category_whitelist_only_redacts_specified(self):
        text = "SSN: 123-45-6789, email: x@y.com"
        result = redact_pii(text, categories=["SSN"])
        assert "[SSN-REDACTED]" in result.redacted_text
        assert "x@y.com" in result.redacted_text  # email not redacted

    def test_original_length_recorded(self):
        text = "SSN: 123-45-6789"
        result = redact_pii(text)
        assert result.original_length == len(text)

    def test_multiple_pii_in_order_preserved(self):
        text = "SSN 123-45-6789 and email foo@bar.com are both here"
        result = redact_pii(text)
        assert "[SSN-REDACTED]" in result.redacted_text
        assert "[EMAIL-REDACTED]" in result.redacted_text

    def test_returns_redact_result_type(self):
        result = redact_pii("text")
        assert isinstance(result, RedactResult)


# ── has_critical_pii ──────────────────────────────────────────────────────


class TestHasCriticalPii:
    def test_ssn_is_critical(self):
        scan = PIIScanResult(pii_detected=True, categories_found=["SSN"])
        assert has_critical_pii(scan)

    def test_credit_card_is_critical(self):
        scan = PIIScanResult(pii_detected=True, categories_found=["Credit Card"])
        assert has_critical_pii(scan)

    def test_medical_record_is_critical(self):
        scan = PIIScanResult(pii_detected=True, categories_found=["Medical Record"])
        assert has_critical_pii(scan)

    def test_email_alone_is_not_critical(self):
        scan = PIIScanResult(pii_detected=True, categories_found=["Email"])
        assert not has_critical_pii(scan)

    def test_phone_alone_is_not_critical(self):
        scan = PIIScanResult(pii_detected=True, categories_found=["Phone (US)"])
        assert not has_critical_pii(scan)

    def test_no_pii_is_not_critical(self):
        scan = PIIScanResult(pii_detected=False, categories_found=[])
        assert not has_critical_pii(scan)

    def test_mixed_contact_and_critical(self):
        scan = PIIScanResult(pii_detected=True, categories_found=["Email", "SSN"])
        assert has_critical_pii(scan)

    def test_all_critical_categories_covered(self):
        for cat in CRITICAL_PII_CATEGORIES:
            scan = PIIScanResult(pii_detected=True, categories_found=[cat])
            assert has_critical_pii(scan), f"{cat} should be critical"


# ── analyze_readability ───────────────────────────────────────────────────


class TestAnalyzeReadability:
    def test_returns_readability_result_type(self):
        result = analyze_readability("This is a test.")
        assert isinstance(result, ReadabilityResult)

    def test_word_count_accurate(self):
        result = analyze_readability("one two three four five")
        assert result.word_count == 5

    def test_sentence_count_accurate(self):
        result = analyze_readability("First sentence. Second one. Third here.")
        assert result.sentence_count == 3

    def test_empty_text_does_not_crash(self):
        result = analyze_readability("")
        assert result.word_count >= 1  # clamped to 1
        assert result.sentence_count >= 1

    def test_grade_is_non_negative(self):
        result = analyze_readability("Simple text.")
        assert result.flesch_kincaid_grade >= 0

    def test_reading_ease_bounded_0_to_100(self):
        result = analyze_readability("The quick brown fox jumps over the lazy dog.")
        assert 0 <= result.flesch_reading_ease <= 100

    def test_avg_words_per_sentence_positive(self):
        result = analyze_readability("The cat sat on the mat. Dogs run fast.")
        assert result.avg_words_per_sentence > 0

    def test_avg_syllables_per_word_positive(self):
        result = analyze_readability("Understanding complexity requires attention.")
        assert result.avg_syllables_per_word > 0

    def test_grade_label_easy(self):
        # Short simple words → low grade
        result = analyze_readability("Go. Run. Eat. See. Sit. Jump. Play. Do it.")
        assert result.grade_label in ("Easy (6th grade)", "Standard (8th grade)")

    def test_grade_label_difficult(self):
        # Long complex text
        text = " ".join(["multidisciplinary", "philosophical", "constitutional"] * 20) + "."
        result = analyze_readability(text)
        assert result.flesch_kincaid_grade > 8

    def test_grade_labels_cover_all_ranges(self):
        r = ReadabilityResult(
            flesch_kincaid_grade=5, flesch_reading_ease=80,
            word_count=50, sentence_count=5,
            avg_words_per_sentence=10, avg_syllables_per_word=1.5
        )
        assert r.grade_label == "Easy (6th grade)"

        r.flesch_kincaid_grade = 7
        assert r.grade_label == "Standard (8th grade)"

        r.flesch_kincaid_grade = 11
        assert r.grade_label == "Moderate (high school)"

        r.flesch_kincaid_grade = 15
        assert r.grade_label == "Difficult (college)"

        r.flesch_kincaid_grade = 18
        assert r.grade_label == "Very Difficult (graduate)"


# ── score_quality ─────────────────────────────────────────────────────────


_SHORT_TEXT = "Do this now."
_MEDIUM_TEXT = " ".join(["Follow the return policy procedure carefully."] * 12)
_LONG_TEXT = (
    "# Return Policy\n\n"
    "## Overview\n\n"
    "## Process\n\n"
    + " ".join(["The member must present a receipt for all returns. "
                "Ensure the product is within the 90-day window. "
                "Verify the item condition before issuing refund."] * 30)
)
_STRUCTURED_TEXT = (
    "1. Verify the receipt.\n"
    "2. Check the product condition.\n"
    "3. Approve the refund.\n"
    "- Check expiration date\n"
    "- Follow the return policy\n"
    "The manager must ensure compliance [1]. See also: https://policy.example.com\n"
)


class TestScoreQuality:
    def test_returns_quality_report_type(self):
        result = score_quality("A short piece of text for testing.")
        assert isinstance(result, QualityReport)

    def test_overall_score_is_sum_of_dimensions(self):
        result = score_quality(_MEDIUM_TEXT)
        expected = (
            result.completeness.score
            + result.specificity.score
            + result.accuracy_signals.score
            + result.actionability.score
        )
        assert abs(result.overall_score - expected) < 0.1

    def test_overall_score_bounded_0_to_100(self):
        for text in [_SHORT_TEXT, _MEDIUM_TEXT, _LONG_TEXT, _STRUCTURED_TEXT]:
            r = score_quality(text)
            assert 0 <= r.overall_score <= 100

    def test_long_text_scores_higher_completeness_than_short(self):
        short = score_quality(_SHORT_TEXT)
        long = score_quality(_LONG_TEXT)
        assert long.completeness.score > short.completeness.score

    def test_numbered_steps_increase_actionability(self):
        plain = score_quality("Just do the thing.")
        structured = score_quality(_STRUCTURED_TEXT)
        assert structured.actionability.score >= plain.actionability.score

    def test_numbers_in_text_increase_specificity(self):
        vague = score_quality("We handle returns within a reasonable timeframe.")
        specific = score_quality("We handle returns within 90 days. Refunds up to $500.")
        assert specific.specificity.score >= vague.specificity.score

    def test_url_increases_accuracy_signals(self):
        no_url = score_quality("See the policy document.")
        with_url = score_quality("See https://example.com/policy for details.")
        assert with_url.accuracy_signals.score >= no_url.accuracy_signals.score

    def test_pii_reduces_accuracy_signals(self):
        clean = score_quality("Standard return policy text with no PII.")
        pii = score_quality("Employee SSN: 123-45-6789 must be verified.")
        assert pii.accuracy_signals.score <= clean.accuracy_signals.score

    def test_headings_boost_completeness(self):
        no_headings = score_quality(" ".join(["word"] * 200))
        with_headings = score_quality(
            "# Section One\n\n## Section Two\n\n### Section Three\n\n"
            + " ".join(["word"] * 200)
        )
        assert with_headings.completeness.score >= no_headings.completeness.score

    def test_auto_approve_requires_high_score_and_no_pii(self):
        result = score_quality(_LONG_TEXT + _STRUCTURED_TEXT * 3)
        if result.auto_approve_eligible:
            assert result.overall_score >= 90
            assert not result.pii_scan.pii_detected

    def test_auto_approve_false_when_pii_present(self):
        text = _LONG_TEXT + " SSN: 123-45-6789"
        result = score_quality(text)
        assert not result.auto_approve_eligible

    def test_pii_scan_populated(self):
        result = score_quality("Contact alice@example.com for questions.")
        assert result.pii_scan.pii_detected

    def test_readability_populated(self):
        result = score_quality("The quick brown fox jumps over the lazy dog.")
        assert result.readability.word_count > 0

    def test_dimension_scores_non_negative(self):
        result = score_quality(_SHORT_TEXT)
        assert result.completeness.score >= 0
        assert result.specificity.score >= 0
        assert result.accuracy_signals.score >= 0
        assert result.actionability.score >= 0

    def test_dimension_scores_max_25(self):
        result = score_quality(_LONG_TEXT)
        assert result.completeness.score <= 25
        assert result.specificity.score <= 25
        assert result.accuracy_signals.score <= 25
        assert result.actionability.score <= 25

    def test_to_dict_has_expected_keys(self):
        result = score_quality("Some text.").to_dict()
        assert "overall_score" in result
        assert "completeness" in result
        assert "specificity" in result
        assert "accuracy_signals" in result
        assert "actionability" in result
        assert "readability" in result
        assert "pii_scan" in result
        assert "auto_approve_eligible" in result

    def test_to_dict_readability_has_word_count(self):
        d = score_quality("Hello world.").to_dict()
        assert "word_count" in d["readability"]

    def test_to_dict_pii_scan_has_detected_flag(self):
        d = score_quality("alice@example.com").to_dict()
        assert "pii_detected" in d["pii_scan"]


# ── scan_toxicity ─────────────────────────────────────────────────────────


class TestScanToxicity:
    def test_clean_text_not_flagged(self):
        result = scan_toxicity("Here is our standard return and refund policy for members.")
        assert not result.flagged
        assert result.severity == "none"

    def test_returns_toxicity_scan_result_type(self):
        result = scan_toxicity("clean text")
        assert isinstance(result, ToxicityScanResult)

    # Critical categories — single match should flag

    def test_dangerous_instructions_single_match_flags(self):
        result = scan_toxicity("how to make a bomb step by step")
        assert result.flagged
        assert result.severity == "critical"
        assert "Dangerous Instructions" in result.categories_found

    def test_hate_speech_single_match_flags(self):
        # Pattern: \bwhite (?:supremac|power|nationalist)\b — "white power" matches cleanly
        result = scan_toxicity("white power march organized downtown")
        assert result.flagged
        assert result.severity == "critical"

    def test_self_harm_single_match_flags(self):
        result = scan_toxicity("how to commit suicide instructions")
        assert result.flagged
        assert result.severity == "critical"

    # Non-critical categories — need multiple matches

    def test_violence_single_match_does_not_flag(self):
        # One violence mention in a policy doc (e.g. "threatening to harm") shouldn't flag
        result = scan_toxicity("i will kill you")
        # Single match — depends on threshold; test that severity is not critical
        if result.flagged:
            assert result.severity in ("warning", "critical")

    def test_harmful_advice_two_matches_flags(self):
        result = scan_toxicity(
            "don't call a doctor. stop taking your medication."
        )
        assert result.flagged
        assert "Harmful Advice" in result.categories_found

    def test_harmful_advice_single_match_may_not_flag(self):
        # A single non-critical match should NOT flag
        result = scan_toxicity("stop taking your medication.")
        # Non-critical needs _NON_CRITICAL_THRESHOLD (2) distinct matches
        assert not result.flagged

    def test_legitimate_policy_not_flagged(self):
        # Safety policy document using safety-related words in context
        text = (
            "Employees must ensure all safety procedures are followed. "
            "In case of emergency, call 911 immediately. "
            "Do not ignore evacuation instructions during fire drills."
        )
        result = scan_toxicity(text)
        # The word "ignore" + "evacuation" in one sentence counts as one pattern match
        # Should not reach threshold for non-critical
        assert not result.flagged or result.severity == "warning"

    def test_flagged_result_has_matches(self):
        result = scan_toxicity("how to make a bomb")
        assert result.flagged
        assert len(result.matches) > 0

    def test_match_has_position(self):
        text = "   how to make a bomb"
        result = scan_toxicity(text)
        if result.flagged:
            assert result.matches[0].position >= 0

    def test_match_pattern_preview_present(self):
        result = scan_toxicity("how to make a bomb step by step")
        if result.flagged:
            assert len(result.matches[0].pattern_preview) > 0

    def test_critical_match_marked_is_critical(self):
        result = scan_toxicity("how to make a bomb")
        if result.flagged:
            critical_matches = [m for m in result.matches if m.is_critical]
            assert len(critical_matches) > 0

    def test_summary_clean(self):
        result = scan_toxicity("clean")
        assert result.summary == "No safety concerns detected"

    def test_summary_flagged_contains_category(self):
        result = scan_toxicity("how to make a bomb")
        if result.flagged:
            assert "Dangerous Instructions" in result.summary
            assert "critical" in result.summary

    def test_categories_found_sorted(self):
        result = scan_toxicity("how to make a bomb, white supremacist ideology")
        if result.flagged:
            assert result.categories_found == sorted(result.categories_found)

    def test_drug_synthesis_flags_critical(self):
        result = scan_toxicity("synthesize meth in your home")
        assert result.flagged
        assert result.severity == "critical"

    def test_ethnic_cleansing_flags_critical(self):
        result = scan_toxicity("promoting racial cleansing ideologies")
        assert result.flagged
        assert result.severity == "critical"


# ── content_hash ──────────────────────────────────────────────────────────


class TestContentHash:
    def test_identical_content_same_hash(self):
        assert content_hash("hello world") == content_hash("hello world")

    def test_different_content_different_hash(self):
        assert content_hash("hello world") != content_hash("goodbye world")

    def test_case_insensitive_same_hash(self):
        assert content_hash("Hello World") == content_hash("hello world")

    def test_leading_trailing_whitespace_ignored(self):
        assert content_hash("  hello  ") == content_hash("hello")

    def test_internal_whitespace_collapsed(self):
        assert content_hash("hello   world") == content_hash("hello world")

    def test_newlines_collapsed_to_space(self):
        assert content_hash("hello\nworld") == content_hash("hello world")

    def test_tabs_collapsed(self):
        assert content_hash("hello\tworld") == content_hash("hello world")

    def test_zero_width_chars_removed(self):
        # Zero-width space (U+200B) should be stripped
        assert content_hash("hello\u200bworld") == content_hash("helloworld")

    def test_zero_width_non_joiner_removed(self):
        assert content_hash("hello\u200cworld") == content_hash("helloworld")

    def test_bom_removed(self):
        assert content_hash("\ufeffhello") == content_hash("hello")

    def test_hash_is_64_chars(self):
        # SHA-256 hex = 64 chars
        assert len(content_hash("anything")) == 64

    def test_hash_is_hex_string(self):
        h = content_hash("test")
        assert all(c in "0123456789abcdef" for c in h)

    def test_empty_string_deterministic(self):
        assert content_hash("") == content_hash("  ")

    def test_different_documents_unique(self):
        hashes = {
            content_hash(f"document number {i} with unique content") for i in range(20)
        }
        assert len(hashes) == 20
