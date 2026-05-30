"""Tests for the Knowledge Manager Review Workflow."""

from __future__ import annotations

import pytest

import src.adapters.review_store
import src.domain.review

# ── Fixtures ──────────────────────────────────────────────────────────────


@pytest.fixture
def store() -> src.domain.review.InMemoryReviewStore:
    return src.domain.review.InMemoryReviewStore()


@pytest.fixture
def policy() -> src.domain.review.ReviewPolicy:
    return src.domain.review.ReviewPolicy(
        rules=[
            src.domain.review.AutoApproveRule(
                name="trusted-departments",
                departments=["IT", "Engineering"],
            ),
            src.domain.review.AutoApproveRule(
                name="reingestion",
                is_reingestion=True,
            ),
        ]
    )


@pytest.fixture
def workflow(store, policy) -> src.domain.review.ReviewWorkflow:
    return src.domain.review.ReviewWorkflow(store=store, policy=policy)


@pytest.fixture
def workflow_no_policy(store) -> src.domain.review.ReviewWorkflow:
    return src.domain.review.ReviewWorkflow(store=store, policy=src.domain.review.ReviewPolicy())


# ── Unit tests: state transitions ─────────────────────────────────────────


class TestStateTransitions:
    def test_draft_to_pending(self) -> None:
        assert src.domain.review._can_transition(src.domain.review.ReviewStatus.DRAFT, src.domain.review.ReviewStatus.PENDING_REVIEW)

    def test_pending_to_approved(self) -> None:
        assert src.domain.review._can_transition(src.domain.review.ReviewStatus.PENDING_REVIEW, src.domain.review.ReviewStatus.APPROVED)

    def test_pending_to_rejected(self) -> None:
        assert src.domain.review._can_transition(src.domain.review.ReviewStatus.PENDING_REVIEW, src.domain.review.ReviewStatus.REJECTED)

    def test_pending_to_revision_requested(self) -> None:
        assert src.domain.review._can_transition(
            src.domain.review.ReviewStatus.PENDING_REVIEW,
            src.domain.review.ReviewStatus.REVISION_REQUESTED,
        )

    def test_approved_to_published(self) -> None:
        assert src.domain.review._can_transition(src.domain.review.ReviewStatus.APPROVED, src.domain.review.ReviewStatus.PUBLISHED)

    def test_rejected_to_draft(self) -> None:
        assert src.domain.review._can_transition(src.domain.review.ReviewStatus.REJECTED, src.domain.review.ReviewStatus.DRAFT)

    def test_published_is_terminal(self) -> None:
        assert not src.domain.review._can_transition(src.domain.review.ReviewStatus.PUBLISHED, src.domain.review.ReviewStatus.DRAFT)
        assert not src.domain.review._can_transition(src.domain.review.ReviewStatus.PUBLISHED, src.domain.review.ReviewStatus.APPROVED)

    def test_invalid_transition(self) -> None:
        assert not src.domain.review._can_transition(src.domain.review.ReviewStatus.DRAFT, src.domain.review.ReviewStatus.PUBLISHED)
        assert not src.domain.review._can_transition(src.domain.review.ReviewStatus.DRAFT, src.domain.review.ReviewStatus.APPROVED)


# ── Store tests ───────────────────────────────────────────────────────────


class TestInMemoryReviewStore:
    @pytest.mark.asyncio
    async def test_save_and_get(self, store) -> None:
        record = src.domain.review.ReviewRecord(
            org_id="org1",
            document_id="doc-1",
            title="Test",
        )
        await store.save(record)
        retrieved = await store.get(record.id)
        assert retrieved is not None
        assert retrieved.document_id == "doc-1"

    @pytest.mark.asyncio
    async def test_get_by_document(self, store) -> None:
        record = src.domain.review.ReviewRecord(
            org_id="org1",
            document_id="doc-1",
        )
        await store.save(record)
        found = await store.get_by_document("doc-1")
        assert found is not None
        assert found.id == record.id

    @pytest.mark.asyncio
    async def test_get_by_document_missing(self, store) -> None:
        assert await store.get_by_document("nope") is None

    @pytest.mark.asyncio
    async def test_list_pending(self, store) -> None:
        for i in range(3):
            r = src.domain.review.ReviewRecord(
                org_id="org1",
                document_id=f"doc-{i}",
                status=src.domain.review.ReviewStatus.PENDING_REVIEW,
            )
            await store.save(r)
        # Add one non-pending
        r = src.domain.review.ReviewRecord(
            org_id="org1",
            document_id="doc-done",
            status=src.domain.review.ReviewStatus.PUBLISHED,
        )
        await store.save(r)

        pending = await store.list_pending("org1")
        assert len(pending) == 3

    @pytest.mark.asyncio
    async def test_list_by_status(self, store) -> None:
        r = src.domain.review.ReviewRecord(
            org_id="org1",
            document_id="doc-1",
            status=src.domain.review.ReviewStatus.APPROVED,
        )
        await store.save(r)
        results = await store.list_by_status("org1", src.domain.review.ReviewStatus.APPROVED)
        assert len(results) == 1

    @pytest.mark.asyncio
    async def test_list_pending_dedupes_by_document(self, store) -> None:
        first = src.domain.review.ReviewRecord(
            org_id="org1",
            document_id="doc-1",
            status=src.domain.review.ReviewStatus.PENDING_REVIEW,
        )
        second = src.domain.review.ReviewRecord(
            org_id="org1",
            document_id="doc-1",
            status=src.domain.review.ReviewStatus.PENDING_REVIEW,
        )
        await store.save(first)
        await store.save(second)

        pending = await store.list_pending("org1")
        assert len(pending) == 1
        assert pending[0].document_id == "doc-1"


class TestRedisReviewStoreDeserialize:
    def test_blank_optional_assignment_timestamps_deserialize_as_none(self) -> None:
        record = src.adapters.review_store.RedisReviewStore._deserialize(
            {
                "id": "review-1",
                "org_id": "org1",
                "document_id": "doc-1",
                "stream_id": "",
                "source_ref": "",
                "title": "Test",
                "status": "pending_review",
                "submitted_by": "",
                "reviewed_by": "",
                "assigned_to": "",
                "assigned_by": "",
                "department": "",
                "document_type": "general",
                "tags": "[]",
                "comments": "[]",
                "auto_approved": "false",
                "auto_approve_rule": "",
                "quality_report": "",
                "trust_score": "",
                "created_at": "2026-04-04T00:00:00+00:00",
                "updated_at": "2026-04-04T00:00:00+00:00",
                "submitted_at": "",
                "reviewed_at": "",
                "assigned_at": "",
                "last_reminded_at": "",
                "published_at": "",
                "archived_at": "",
            }
        )

        assert record.assigned_at is None
        assert record.last_reminded_at is None


class _FakePipeline:
    def __init__(self, hashes: dict[str, dict[str, str]]) -> None:
        self._hashes: dict[str, dict[str, str]] = hashes
        self._keys: list[str] = []

    def hgetall(self, key: str) -> "_FakePipeline":
        self._keys.append(key)
        return self

    async def execute(self) -> list[dict[str, str]]:
        return [self._hashes.get(key, {}) for key in self._keys]


class _FakeRedis:
    def __init__(self, ids: list[str], hashes: dict[str, dict[str, str]]) -> None:
        self._ids: list[str] = ids
        self._hashes: dict[str, dict[str, str]] = hashes
        self.zrem_calls: list[tuple[str, tuple[str, ...]]] = []

    async def zrange(self, _key: str, _start: int, _end: int) -> list[str]:
        return list(self._ids)

    def pipeline(self, transaction: bool = False) -> _FakePipeline:
        assert transaction is False
        return _FakePipeline(self._hashes)

    async def zrem(self, key: str, *members: str) -> int:
        self.zrem_calls.append((key, members))
        return len(members)


@pytest.mark.asyncio
async def test_redis_review_store_hvsi_audit_prunes_stale_index_entries() -> None:
    redis = _FakeRedis(
        ids=["stale-review", "legacy-review", "good-review"],
        hashes={
            "kp:review:legacy-review": {"stream_id": ""},
            "kp:review:good-review": {"stream_id": "pharmacy"},
        },
    )
    store: src.adapters.review_store.RedisReviewStore = object.__new__(src.adapters.review_store.RedisReviewStore)
    store._redis = redis

    issues: dict[str, int] = await src.adapters.review_store.RedisReviewStore.hvsi_audit(store)

    assert issues == {"reviews_missing_stream": 1}
    assert redis.zrem_calls == [("kp:review:index", ("stale-review",))]


# ── Policy tests ──────────────────────────────────────────────────────────


class TestReviewPolicy:
    def test_auto_approve_trusted_department(self, policy) -> None:
        record = src.domain.review.ReviewRecord(
            org_id="org1",
            document_id="doc-1",
            department="IT",
        )
        approved, rule = policy.should_auto_approve(record)
        assert approved
        assert rule == "trusted-departments"

    def test_no_auto_approve_untrusted_department(self, policy) -> None:
        record = src.domain.review.ReviewRecord(
            org_id="org1",
            document_id="doc-1",
            department="Marketing",
        )
        approved, _ = policy.should_auto_approve(record)
        assert not approved

    def test_auto_approve_reingestion(self, policy) -> None:
        record = src.domain.review.ReviewRecord(
            org_id="org1",
            document_id="doc-1",
            department="Marketing",
        )
        approved, rule = policy.should_auto_approve(record, is_reingestion=True)
        assert approved
        assert rule == "reingestion"

    def test_empty_policy_never_approves(self) -> None:
        empty_policy = src.domain.review.ReviewPolicy()
        record = src.domain.review.ReviewRecord(
            org_id="org1",
            document_id="doc-1",
            department="IT",
        )
        approved, _ = empty_policy.should_auto_approve(record)
        assert not approved

    def test_tag_matching(self) -> None:
        policy = src.domain.review.ReviewPolicy(
            rules=[
                src.domain.review.AutoApproveRule(name="tagged", tags=["auto-approve"]),
            ]
        )
        record = src.domain.review.ReviewRecord(
            org_id="org1",
            document_id="doc-1",
            tags=["auto-approve", "other"],
        )
        approved, _ = policy.should_auto_approve(record)
        assert approved

    def test_source_ref_pattern(self) -> None:
        policy = src.domain.review.ReviewPolicy(
            rules=[
                src.domain.review.AutoApproveRule(
                    name="sharepoint",
                    source_ref_patterns=[r"sharepoint\.hki\.com"],
                ),
            ]
        )
        record = src.domain.review.ReviewRecord(
            org_id="org1",
            document_id="doc-1",
            source_ref="https://sharepoint.hki.com/policies/returns",
        )
        approved, _ = policy.should_auto_approve(record)
        assert approved


# ── Workflow tests ────────────────────────────────────────────────────────


class TestReviewWorkflow:
    @pytest.mark.asyncio
    async def test_submit_goes_to_pending(self, workflow_no_policy) -> None:
        record = await workflow_no_policy.submit(
            src.domain.review.SubmitRequest(document_id="doc-1", stream_id="dev", title="Test Doc"),
            org_id="org1",
        )
        assert record.status == src.domain.review.ReviewStatus.PENDING_REVIEW
        assert record.submitted_at is not None

    @pytest.mark.asyncio
    async def test_submit_auto_approves_trusted(self, workflow) -> None:
        record = await workflow.submit(
            src.domain.review.SubmitRequest(
                document_id="doc-1",
                stream_id="dev",
                title="IT Doc",
                department="IT",
                submitted_by="admin",
            ),
            org_id="org1",
        )
        assert record.status == src.domain.review.ReviewStatus.APPROVED
        assert record.auto_approved is True
        assert len(record.comments) == 1
        assert "Auto-approved" in record.comments[0].text

    @pytest.mark.asyncio
    async def test_submit_auto_approves_reingestion(self, workflow) -> None:
        record = await workflow.submit(
            src.domain.review.SubmitRequest(
                document_id="doc-1",
                stream_id="dev",
                title="Re-ingest",
                department="Marketing",
            ),
            org_id="org1",
            is_reingestion=True,
        )
        assert record.status == src.domain.review.ReviewStatus.APPROVED
        assert record.auto_approved is True

    @pytest.mark.asyncio
    async def test_submit_reuses_existing_record_for_same_document(self, workflow_no_policy, store) -> None:
        original = await workflow_no_policy.submit(
            src.domain.review.SubmitRequest(document_id="doc-1", stream_id="dev", title="Original"),
            org_id="org1",
        )

        updated = await workflow_no_policy.submit(
            src.domain.review.SubmitRequest(
                document_id="doc-1",
                stream_id="dev",
                title="Updated",
                submitted_by="pipeline",
            ),
            org_id="org1",
        )

        assert updated.id == original.id
        assert updated.title == "Updated"
        assert updated.status == src.domain.review.ReviewStatus.PENDING_REVIEW
        assert any(
            comment.text == "Resubmitted into the review workflow." for comment in updated.comments
        )

        pending = await store.list_pending("org1")
        assert len(pending) == 1

    @pytest.mark.asyncio
    async def test_approve_review(self, workflow_no_policy, store) -> None:
        record = await workflow_no_policy.submit(
            src.domain.review.SubmitRequest(document_id="doc-1", stream_id="dev"),
            org_id="org1",
        )
        assert record.status == src.domain.review.ReviewStatus.PENDING_REVIEW

        reviewed = await workflow_no_policy.review(
            src.domain.review.ReviewRequest(
                record_id=record.id,
                reviewer="alice",
                decision=src.domain.review.ReviewDecision.APPROVE,
                comment="Looks good",
            )
        )
        assert reviewed.status == src.domain.review.ReviewStatus.APPROVED
        assert reviewed.reviewed_by == "alice"
        assert len(reviewed.comments) == 1

    @pytest.mark.asyncio
    async def test_reject_review(self, workflow_no_policy) -> None:
        record = await workflow_no_policy.submit(
            src.domain.review.SubmitRequest(document_id="doc-1", stream_id="dev"),
            org_id="org1",
        )
        rejected = await workflow_no_policy.review(
            src.domain.review.ReviewRequest(
                record_id=record.id,
                reviewer="bob",
                decision=src.domain.review.ReviewDecision.REJECT,
                comment="Needs work",
            )
        )
        assert rejected.status == src.domain.review.ReviewStatus.REJECTED

    @pytest.mark.asyncio
    async def test_request_revision(self, workflow_no_policy) -> None:
        record = await workflow_no_policy.submit(
            src.domain.review.SubmitRequest(document_id="doc-1", stream_id="dev"),
            org_id="org1",
        )
        revised = await workflow_no_policy.review(
            src.domain.review.ReviewRequest(
                record_id=record.id,
                reviewer="carol",
                decision=src.domain.review.ReviewDecision.REQUEST_REVISION,
                comment="Fix section 3",
            )
        )
        assert revised.status == src.domain.review.ReviewStatus.REVISION_REQUESTED

    @pytest.mark.asyncio
    async def test_remind_assigned_review(self, workflow_no_policy) -> None:
        record = await workflow_no_policy.submit(
            src.domain.review.SubmitRequest(document_id="doc-1", stream_id="dev"),
            org_id="org1",
        )
        await workflow_no_policy.assign(
            src.domain.review.AssignReviewRequest(
                record_id=record.id,
                assignee="alice",
                assigned_by="manager",
            )
        )

        reminded = await workflow_no_policy.remind(
            src.domain.review.ReminderRequest(
                record_id=record.id,
                reminded_by="manager",
                message="Please review today.",
            )
        )

        assert reminded.assigned_to == "alice"
        assert reminded.last_reminded_at is not None
        assert reminded.comments[-1].author == "manager"
        assert "Recorded a follow-up reminder for alice." in reminded.comments[-1].text
        assert "Please review today." in reminded.comments[-1].text

    @pytest.mark.asyncio
    async def test_remind_unassigned_review_raises(self, workflow_no_policy) -> None:
        record = await workflow_no_policy.submit(
            src.domain.review.SubmitRequest(document_id="doc-1", stream_id="dev"),
            org_id="org1",
        )

        with pytest.raises(ValueError, match="unassigned"):
            await workflow_no_policy.remind(
                src.domain.review.ReminderRequest(
                    record_id=record.id,
                    reminded_by="manager",
                )
            )

    @pytest.mark.asyncio
    async def test_publish_approved(self, workflow_no_policy) -> None:
        record = await workflow_no_policy.submit(
            src.domain.review.SubmitRequest(document_id="doc-1", stream_id="dev"),
            org_id="org1",
        )
        await workflow_no_policy.review(
            src.domain.review.ReviewRequest(
                record_id=record.id,
                reviewer="alice",
                decision=src.domain.review.ReviewDecision.APPROVE,
            )
        )
        published = await workflow_no_policy.publish(record.id)
        assert published.status == src.domain.review.ReviewStatus.PUBLISHED
        assert published.published_at is not None

    @pytest.mark.asyncio
    async def test_publish_non_approved_raises(self, workflow_no_policy) -> None:
        record = await workflow_no_policy.submit(
            src.domain.review.SubmitRequest(document_id="doc-1", stream_id="dev"),
            org_id="org1",
        )
        with pytest.raises(ValueError, match="must be APPROVED"):
            await workflow_no_policy.publish(record.id)

    @pytest.mark.asyncio
    async def test_resubmit_rejected(self, workflow_no_policy) -> None:
        record = await workflow_no_policy.submit(
            src.domain.review.SubmitRequest(document_id="doc-1", stream_id="dev"),
            org_id="org1",
        )
        await workflow_no_policy.review(
            src.domain.review.ReviewRequest(
                record_id=record.id,
                reviewer="bob",
                decision=src.domain.review.ReviewDecision.REJECT,
            )
        )
        resubmitted = await workflow_no_policy.resubmit(record.id)
        assert resubmitted.status == src.domain.review.ReviewStatus.PENDING_REVIEW

    @pytest.mark.asyncio
    async def test_review_nonexistent_raises(self, workflow_no_policy) -> None:
        with pytest.raises(ValueError, match="not found"):
            await workflow_no_policy.review(
                src.domain.review.ReviewRequest(
                    record_id="fake",
                    reviewer="x",
                    decision=src.domain.review.ReviewDecision.APPROVE,
                )
            )

    @pytest.mark.asyncio
    async def test_invalid_transition_raises(self, workflow_no_policy) -> None:
        record = await workflow_no_policy.submit(
            src.domain.review.SubmitRequest(document_id="doc-1", stream_id="dev"),
            org_id="org1",
        )
        await workflow_no_policy.review(
            src.domain.review.ReviewRequest(
                record_id=record.id,
                reviewer="alice",
                decision=src.domain.review.ReviewDecision.APPROVE,
            )
        )
        # Cannot approve again (now in APPROVED state)
        with pytest.raises(ValueError, match="Cannot transition"):
            await workflow_no_policy.review(
                src.domain.review.ReviewRequest(
                    record_id=record.id,
                    reviewer="bob",
                    decision=src.domain.review.ReviewDecision.APPROVE,
                )
            )

    @pytest.mark.asyncio
    async def test_get_pending(self, workflow_no_policy) -> None:
        for i in range(3):
            await workflow_no_policy.submit(
                src.domain.review.SubmitRequest(document_id=f"doc-{i}", stream_id="dev"),
                org_id="org1",
            )
        pending = await workflow_no_policy.get_pending("org1")
        assert len(pending) == 3

    @pytest.mark.asyncio
    async def test_full_lifecycle(self, workflow_no_policy) -> None:
        """Test the complete happy path: submit → review → publish."""
        # Submit
        record = await workflow_no_policy.submit(
            src.domain.review.SubmitRequest(
                document_id="doc-lifecycle",
                stream_id="dev",
                title="Lifecycle Test",
                submitted_by="author",
            ),
            org_id="org1",
        )
        assert record.status == src.domain.review.ReviewStatus.PENDING_REVIEW

        # Review: approve
        record = await workflow_no_policy.review(
            src.domain.review.ReviewRequest(
                record_id=record.id,
                reviewer="reviewer",
                decision=src.domain.review.ReviewDecision.APPROVE,
                comment="LGTM",
            )
        )
        assert record.status == src.domain.review.ReviewStatus.APPROVED

        # Publish
        record = await workflow_no_policy.publish(record.id)
        assert record.status == src.domain.review.ReviewStatus.PUBLISHED
        assert record.published_at is not None
