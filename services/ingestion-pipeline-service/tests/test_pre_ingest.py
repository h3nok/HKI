from __future__ import annotations

import src.domain.pre_ingest


class TestPreIngestValidation:
    def test_contact_info_is_non_blocking_in_validate_stage(self) -> None:
        validate: src.domain.pre_ingest.ValidateResult = src.domain.pre_ingest._run_validate_sync(
            (
                "Warehouse supervisors should reconcile inbound manifests daily, "
                "document shortages, and escalate damaged inventory to control. "
                "For receiving questions, call 555-123-4567 or email "
                "receiving@example.com."
            ),
            "Receiving checklist",
        )

        assert validate.contact_info_detected is True
        assert sorted(validate.contact_info_categories) == ["Email", "Phone (US)"]
        assert validate.pii_detected is False
        assert validate.pii_categories == []
        assert not any("Sensitive personal data" in issue for issue in validate.issues)

    def test_sensitive_pii_is_still_flagged(self) -> None:
        validate: src.domain.pre_ingest.ValidateResult = src.domain.pre_ingest._run_validate_sync(
            (
                "Employee onboarding note. SSN: 123-45-6789 must be verified "
                "before payroll is activated."
            ),
            "Onboarding note",
        )

        assert validate.pii_detected is True
        assert "SSN" in validate.pii_categories


class TestPreIngestDecisioning:
    def _interpret(self) -> src.domain.pre_ingest.InterpretResult:
        return src.domain.pre_ingest.InterpretResult(
            detected_type="Memo",
            department="Legal",
            tags=["legal", "compliance"],
            entities=[],
            summary="Legal intake guidance.",
            language="English",
            confidence=0.7,
        )

    def test_noncritical_sensitive_pii_requires_review_not_reject(self) -> None:
        validate: src.domain.pre_ingest.ValidateResult = src.domain.pre_ingest._run_validate_sync(
            (
                "Legal case intake note. DOB: 01/02/1990 is included for "
                "identity verification and should be reviewed before indexing."
            ),
            "Matter intake",
        )

        decision: src.domain.pre_ingest.DecideResult = src.domain.pre_ingest._heuristic_decide(
            validate,
            self._interpret(),
            "Legal operations and case management",
        )

        assert decision.recommendation == "review"
        assert "Sensitive personal data was found" in decision.reasoning

    def test_critical_pii_still_rejects(self) -> None:
        validate: src.domain.pre_ingest.ValidateResult = src.domain.pre_ingest._run_validate_sync(
            (
                "Client billing note. Credit card 4111 1111 1111 1111 was added "
                "to the file and must not be indexed."
            ),
            "Billing note",
        )

        decision: src.domain.pre_ingest.DecideResult = src.domain.pre_ingest._heuristic_decide(
            validate,
            self._interpret(),
            "Legal operations and case management",
        )

        assert decision.recommendation == "reject"
        assert "critical sensitive data" in decision.reasoning

    def test_detected_contradictions_force_review(self) -> None:
        validate: src.domain.pre_ingest.ValidateResult = src.domain.pre_ingest._run_validate_sync(
            "Pharmacy technicians must verify a hard stop before dispensing opioids.",
            "Dispensing control",
        )

        decision: src.domain.pre_ingest.DecideResult = src.domain.pre_ingest._heuristic_decide(
            validate,
            self._interpret(),
            "Pharmacy operations and dispensing controls",
            contradictions=[
                src.domain.pre_ingest.ContradictionMatch(
                    document_id="doc-existing",
                    title="Legacy opioid SOP",
                    candidate_claim="Technicians must verify a hard stop before dispensing opioids.",
                    conflicting_claim="Technicians may bypass the hard stop when a pharmacist is busy.",
                    chunk_preview="Legacy guidance says the hard stop can be bypassed.",
                    confidence=0.82,
                )
            ],
        )

        assert decision.recommendation == "review"
        assert "Potential contradiction" in decision.reasoning
        assert len(decision.contradictions) == 1

    def test_heuristic_contradictions_detect_numeric_conflict(self) -> None:
        claims: list[str] = src.domain.pre_ingest._extract_candidate_claims("Maximum metformin dose is 2000mg per day for adults.")
        contradictions: list[src.domain.pre_ingest.ContradictionMatch] = src.domain.pre_ingest._heuristic_contradictions(
            claims,
            [
                {
                    "document_id": "doc-123",
                    "title": "Metformin Dosing SOP",
                    "content": "Maximum metformin dose is 2550mg per day for adults.",
                }
            ],
        )

        assert len(contradictions) == 1
        assert contradictions[0].document_id == "doc-123"
        assert contradictions[0].confidence >= 0.7


class TestMetadataExtraction:
    def test_extracts_metadata_with_linear_scans(self) -> None:
        metadata: src.domain.pre_ingest.ExtractedMetadata = src.domain.pre_ingest._extract_metadata_from_text(
            (
                "KB Number: KB2020475\n"
                "Article ID: 5dd7186297a6655018ea3dc71153af66\n"
                "Pharmacy hard-stop guide\n"
                "https://hkicarts.service-now.com/kb?id=kb_article_view&sysparm_article=KB2020475\n"
                "Environment\n"
                "Enterprise Pharmacy System (EPS)\n"
                "Author: Jane Doe\n"
                "Version: 2.1\n"
                "Date: 2025-03-10\n"
                "Issue\n"
                "How to verify hard stops.\n"
                "Resolution\n"
                "Follow the dispensing checklist.\n"
            ),
            "Copy of KB2020475.pdf",
        )

        assert metadata.source_id == "KB2020475"
        assert metadata.source_system == "ServiceNow"
        assert metadata.article_id == "5dd7186297a6655018ea3dc71153af66"
        assert metadata.source_url.startswith("https://hkicarts.service-now.com/")
        assert metadata.environment == "Enterprise Pharmacy System (EPS)"
        assert metadata.system_name == "Enterprise Pharmacy System (EPS)"
        assert metadata.author == "Jane Doe"
        assert metadata.version == "2.1"
        assert metadata.publish_date == "2025-03-10"
        assert metadata.sections_found == ["Environment", "Issue", "Resolution"]
