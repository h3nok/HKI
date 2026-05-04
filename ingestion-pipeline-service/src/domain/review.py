"""
Knowledge Manager Workflow — review, approve, and publish lifecycle.

Implements a governance layer where ingested documents pass through
a review workflow before becoming searchable. Supports auto-approve
rules for trusted sources and explicit human review for new content.

Architecture Blueprint alignment:
    "Enterprise knowledge needs to follow a knowledge management
     lifecycle — transforming human-aligned content into AI-aligned
     assets through systematic curation, metadata enrichment,
     normalization and context-overlap reduction."

Lifecycle:
    DRAFT → PENDING_REVIEW → APPROVED → PUBLISHED
                           → REJECTED → (re-submit as DRAFT)
                           → REVISION_REQUESTED → DRAFT

Components:
    ReviewStatus         — lifecycle state enum
    ReviewRequest        — a review submission with decision + comments
    AssignReviewRequest  — ownership assignment for the next step
    ReminderRequest      — a recorded follow-up reminder
    ReviewPolicy         — auto-approve rules engine
    ReviewRecord         — persistent record of a document's review state
    ReviewStore          — Protocol for persistence
    ReviewWorkflow       — orchestrates the lifecycle transitions
"""

from __future__ import annotations

import datetime
import enum
import typing
import uuid

import pydantic

# ═══════════════════════════════════════════════════════════════════════════════
# Domain Models
# ═══════════════════════════════════════════════════════════════════════════════


class ReviewStatus(enum.StrEnum):
    """Lifecycle state of a document in the review workflow."""

    DRAFT = "draft"
    PENDING_REVIEW = "pending_review"
    APPROVED = "approved"
    PUBLISHED = "published"
    REJECTED = "rejected"
    REVISION_REQUESTED = "revision_requested"
    ARCHIVED = "archived"


class ReviewDecision(enum.StrEnum):
    """Decision a reviewer can make."""

    APPROVE = "approve"
    REJECT = "reject"
    REQUEST_REVISION = "request_revision"


class ReviewRecord(pydantic.BaseModel):
    """
    Tracks the review state of a document through its lifecycle.

    One record per document. Updated on each state transition.
    """

    id: str = pydantic.Field(default_factory=lambda: str(uuid.uuid4()))
    org_id: str = "default"
    document_id: str  # Vector store document ID
    stream_id: str | None = None  # Legacy rows may be null; new submissions must set a stream
    source_ref: str = ""  # Stable source identifier
    title: str = ""
    status: ReviewStatus = ReviewStatus.DRAFT
    submitted_by: str = ""  # User who submitted for review
    reviewed_by: str = ""  # User who reviewed
    assigned_to: str = ""  # Owner for the next step
    assigned_by: str = ""  # User who assigned the owner
    department: str = ""
    document_type: str = "general"
    tags: list[str] = pydantic.Field(default_factory=list)
    # Review trail
    comments: list[ReviewComment] = pydantic.Field(default_factory=list)
    auto_approved: bool = False
    auto_approve_rule: str = ""  # which policy rule triggered auto-approval
    # Quality signal — populated by the pipeline at submit time
    quality_report: dict | None = None  # score_quality().to_dict()
    trust_score: float | None = None  # overall_score 0.0–100.0
    review_intelligence: dict | None = None  # duplicate / contradiction signals
    # Timestamps
    created_at: datetime.datetime = pydantic.Field(
        default_factory=lambda: datetime.datetime.now(datetime.UTC)
    )
    updated_at: datetime.datetime = pydantic.Field(
        default_factory=lambda: datetime.datetime.now(datetime.UTC)
    )
    submitted_at: datetime.datetime | None = None
    reviewed_at: datetime.datetime | None = None
    assigned_at: datetime.datetime | None = None
    last_reminded_at: datetime.datetime | None = None
    published_at: datetime.datetime | None = None
    archived_at: datetime.datetime | None = None


class ReviewComment(pydantic.BaseModel):
    """A comment in the review trail."""

    id: str = pydantic.Field(default_factory=lambda: str(uuid.uuid4()))
    author: str
    decision: ReviewDecision | None = None
    text: str = ""
    created_at: datetime.datetime = pydantic.Field(
        default_factory=lambda: datetime.datetime.now(datetime.UTC)
    )


class SubmitRequest(pydantic.BaseModel):
    """Request to submit a document for review."""

    document_id: str
    stream_id: str = pydantic.Field(min_length=1)
    source_ref: str = ""
    title: str = ""
    department: str = ""
    document_type: str = "general"
    tags: list[str] = pydantic.Field(default_factory=list)
    submitted_by: str = ""
    quality_report: dict | None = None  # score_quality().to_dict() — from pipeline
    trust_score: float | None = None  # overall quality score 0.0–100.0
    review_intelligence: dict | None = None


class ReviewRequest(pydantic.BaseModel):
    """Request to review a pending document."""

    record_id: str
    reviewer: str
    decision: ReviewDecision
    comment: str = ""


class AssignReviewRequest(pydantic.BaseModel):
    """Assign ownership for the next review step."""

    record_id: str
    assignee: str
    assigned_by: str = ""
    note: str = ""


class ReminderRequest(pydantic.BaseModel):
    """Record a reminder/follow-up on an assigned review item."""

    record_id: str
    reminded_by: str = ""
    message: str = ""


# ═══════════════════════════════════════════════════════════════════════════════
# Review Policy — auto-approve rules
# ═══════════════════════════════════════════════════════════════════════════════


class AutoApproveRule(pydantic.BaseModel):
    """A single auto-approve rule. All conditions must match (AND logic)."""

    name: str
    departments: list[str] = pydantic.Field(default_factory=list)
    document_types: list[str] = pydantic.Field(default_factory=list)
    tags: list[str] = pydantic.Field(default_factory=list)
    source_ref_patterns: list[str] = pydantic.Field(default_factory=list)
    is_reingestion: bool = False  # Auto-approve re-ingestion of same source
    min_trust_score: float = 0.0  # Minimum quality score required (0–100)


class ReviewPolicy:
    """
    Evaluates whether a document can be auto-approved.

    Rules are evaluated in order. The first matching rule triggers
    auto-approval. If no rules match, the document requires manual review.

    Usage:
        policy = ReviewPolicy(rules=[
            AutoApproveRule(
                name="trusted-departments",
                departments=["IT", "Engineering"],
            ),
            AutoApproveRule(
                name="reingestion",
                is_reingestion=True,
            ),
        ])
        if policy.should_auto_approve(record, is_reingestion=True):
            # skip review, go straight to APPROVED
    """

    def __init__(self, rules: list[AutoApproveRule] | None = None) -> None:
        self._rules: list[AutoApproveRule] = rules or []

    def should_auto_approve(
        self,
        record: ReviewRecord,
        is_reingestion: bool = False,
    ) -> tuple[bool, str]:
        """
        Check if a record qualifies for auto-approval.

        Returns (should_approve, rule_name).
        """
        for rule in self._rules:
            if self._matches(rule, record, is_reingestion):
                return True, rule.name
        return False, ""

    @staticmethod
    def _matches(
        rule: AutoApproveRule,
        record: ReviewRecord,
        is_reingestion: bool,
    ) -> bool:
        """Check if all conditions in a rule are satisfied."""
        if rule.is_reingestion and not is_reingestion:
            return False
        if rule.is_reingestion and is_reingestion:
            return True

        if rule.min_trust_score > 0 and (
            record.trust_score is None or record.trust_score < rule.min_trust_score
        ):
            return False

        if rule.departments and record.department not in rule.departments:
            return False
        if rule.document_types and record.document_type not in rule.document_types:
            return False
        if rule.tags and not any(tag in record.tags for tag in rule.tags):
            return False
        if rule.source_ref_patterns:
            import re

            matched: bool = any(
                re.search(pattern, record.source_ref) for pattern in rule.source_ref_patterns
            )
            if not matched:
                return False

        return True


# ═══════════════════════════════════════════════════════════════════════════════
# Store Protocol
# ═══════════════════════════════════════════════════════════════════════════════


class ReviewStore(typing.Protocol):
    """Persistence interface for review records."""

    async def save(self, record: ReviewRecord) -> None: ...

    async def get(self, record_id: str) -> ReviewRecord | None: ...

    async def get_by_document(
        self,
        document_id: str,
    ) -> ReviewRecord | None: ...

    async def list_pending(
        self,
        org_id: str,
        limit: int = 50,
    ) -> list[ReviewRecord]: ...

    async def list_by_status(
        self,
        org_id: str,
        status: ReviewStatus,
        limit: int = 50,
    ) -> list[ReviewRecord]: ...


# ═══════════════════════════════════════════════════════════════════════════════
# In-Memory Store (development fallback)
# ═══════════════════════════════════════════════════════════════════════════════


class InMemoryReviewStore:
    """
    In-memory review store for local development.

    Production: replace with AlloyDB-backed store.
    """

    def __init__(self) -> None:
        self._records: dict[str, ReviewRecord] = {}
        self._by_doc: dict[str, str] = {}  # document_id → record_id

    async def save(self, record: ReviewRecord) -> None:
        record.updated_at = datetime.datetime.now(datetime.UTC)
        self._records[record.id] = record
        self._by_doc[record.document_id] = record.id

    async def get(self, record_id: str) -> ReviewRecord | None:
        return self._records.get(record_id)

    async def get_by_document(
        self,
        document_id: str,
    ) -> ReviewRecord | None:
        rid: str | None = self._by_doc.get(document_id)
        if rid is None:
            return None
        return self._records.get(rid)

    async def list_pending(
        self,
        org_id: str,
        limit: int = 50,
    ) -> list[ReviewRecord]:
        return self._list_filtered(
            org_id,
            ReviewStatus.PENDING_REVIEW,
            limit,
        )

    async def list_by_status(
        self,
        org_id: str,
        status: ReviewStatus,
        limit: int = 50,
    ) -> list[ReviewRecord]:
        return self._list_filtered(org_id, status, limit)

    def _list_filtered(
        self,
        org_id: str,
        status: ReviewStatus,
        limit: int,
    ) -> list[ReviewRecord]:
        records: list[ReviewRecord] = [
            record
            for record in self._records.values()
            if record.org_id == org_id and record.status == status
        ]
        records.sort(key=lambda r: r.updated_at, reverse=True)

        deduped: list[ReviewRecord] = []
        seen_docs: set[str] = set()
        for record in records:
            if record.document_id in seen_docs:
                continue
            seen_docs.add(record.document_id)
            deduped.append(record)
            if len(deduped) >= limit:
                break

        return deduped

    async def hvsi_audit(self) -> dict[str, int]:
        return {
            "reviews_missing_stream": sum(
                1
                for record in self._records.values()
                if not str(record.stream_id or "").strip()
            )
        }


# ═══════════════════════════════════════════════════════════════════════════════
# Valid state transitions
# ═══════════════════════════════════════════════════════════════════════════════


_TRANSITIONS: dict[ReviewStatus, set[ReviewStatus]] = {
    ReviewStatus.DRAFT: {ReviewStatus.PENDING_REVIEW},
    ReviewStatus.PENDING_REVIEW: {
        ReviewStatus.APPROVED,
        ReviewStatus.REJECTED,
        ReviewStatus.REVISION_REQUESTED,
    },
    ReviewStatus.APPROVED: {ReviewStatus.PUBLISHED},
    ReviewStatus.REJECTED: {ReviewStatus.DRAFT},
    ReviewStatus.REVISION_REQUESTED: {ReviewStatus.DRAFT},
    ReviewStatus.PUBLISHED: {ReviewStatus.ARCHIVED},
    ReviewStatus.ARCHIVED: set(),  # terminal state
}


def _can_transition(current: ReviewStatus, target: ReviewStatus) -> bool:
    return target in _TRANSITIONS.get(current, set())


_ASSIGNABLE_STATUSES: set[ReviewStatus] = {
    ReviewStatus.PENDING_REVIEW,
    ReviewStatus.APPROVED,
    ReviewStatus.REJECTED,
    ReviewStatus.REVISION_REQUESTED,
}


# ═══════════════════════════════════════════════════════════════════════════════
# Review Workflow — orchestrates lifecycle transitions
# ═══════════════════════════════════════════════════════════════════════════════


class ReviewWorkflow:
    """
    Orchestrates document review lifecycle transitions.

    All state changes go through this class to enforce valid transitions,
    apply auto-approve policies, and maintain the audit trail.

    Usage:
        store = InMemoryReviewStore()
        policy = ReviewPolicy(rules=[...])
        workflow = ReviewWorkflow(store=store, policy=policy)

        record = await workflow.submit(SubmitRequest(...))
        record = await workflow.review(ReviewRequest(...))
        record = await workflow.publish(record.id)
    """

    def __init__(
        self,
        store: ReviewStore,
        policy: ReviewPolicy | None = None,
    ) -> None:
        self._store: ReviewStore = store
        self._policy: ReviewPolicy = policy or ReviewPolicy()

    async def submit(
        self,
        request: SubmitRequest,
        org_id: str = "default",
        is_reingestion: bool = False,
    ) -> ReviewRecord:
        """
        Submit a document for review.

        Creates a ReviewRecord and transitions to PENDING_REVIEW.
        If auto-approve policy matches, skips straight to APPROVED.
        """
        now: datetime.datetime = datetime.datetime.now(datetime.UTC)
        existing: ReviewRecord | None = await self._store.get_by_document(request.document_id)

        if existing is not None:
            record: ReviewRecord = existing.model_copy(deep=True)
            record.org_id = org_id
            record.stream_id = request.stream_id
            record.source_ref = request.source_ref
            record.title = request.title
            record.status = ReviewStatus.DRAFT
            record.submitted_by = request.submitted_by
            record.reviewed_by = ""
            record.assigned_to = ""
            record.assigned_by = ""
            record.department = request.department
            record.document_type = request.document_type
            record.tags = request.tags
            record.auto_approved = False
            record.auto_approve_rule = ""
            record.quality_report = request.quality_report
            record.trust_score = request.trust_score
            record.review_intelligence = request.review_intelligence
            record.submitted_at = now
            record.reviewed_at = None
            record.assigned_at = None
            record.last_reminded_at = None
            record.published_at = None
            record.archived_at = None
            record.comments.append(
                ReviewComment(
                    author=request.submitted_by or "system",
                    text="Resubmitted into the review workflow.",
                )
            )
        else:
            record = ReviewRecord(
                org_id=org_id,
                document_id=request.document_id,
                stream_id=request.stream_id,
                source_ref=request.source_ref,
                title=request.title,
                status=ReviewStatus.DRAFT,
                submitted_by=request.submitted_by,
                department=request.department,
                document_type=request.document_type,
                tags=request.tags,
                submitted_at=now,
                quality_report=request.quality_report,
                trust_score=request.trust_score,
                review_intelligence=request.review_intelligence,
            )

        # Check auto-approve
        should_approve, rule_name = self._policy.should_auto_approve(
            record,
            is_reingestion=is_reingestion,
        )

        if should_approve:
            record.status = ReviewStatus.APPROVED
            record.auto_approved = True
            record.auto_approve_rule = rule_name
            record.reviewed_at = now
            record.comments.append(
                ReviewComment(
                    author="system",
                    decision=ReviewDecision.APPROVE,
                    text=f"Auto-approved by rule: {rule_name}",
                )
            )
        else:
            record.status = ReviewStatus.PENDING_REVIEW

        await self._store.save(record)
        return record

    async def review(self, request: ReviewRequest) -> ReviewRecord:
        """
        Apply a review decision to a pending document.

        Valid transitions from PENDING_REVIEW:
            APPROVE → APPROVED
            REJECT → REJECTED
            REQUEST_REVISION → REVISION_REQUESTED
        """
        record: ReviewRecord | None = await self._store.get(request.record_id)
        if record is None:
            raise ValueError(f"Review record {request.record_id} not found")

        decision_to_status: dict[ReviewDecision, ReviewStatus] = {
            ReviewDecision.APPROVE: ReviewStatus.APPROVED,
            ReviewDecision.REJECT: ReviewStatus.REJECTED,
            ReviewDecision.REQUEST_REVISION: ReviewStatus.REVISION_REQUESTED,
        }
        target: ReviewStatus = decision_to_status[request.decision]

        if not _can_transition(record.status, target):
            raise ValueError(f"Cannot transition from {record.status.value} to {target.value}")

        record.status = target
        record.reviewed_by = request.reviewer
        record.reviewed_at = datetime.datetime.now(datetime.UTC)
        record.comments.append(
            ReviewComment(
                author=request.reviewer,
                decision=request.decision,
                text=request.comment,
            )
        )

        await self._store.save(record)
        return record

    async def assign(self, request: AssignReviewRequest) -> ReviewRecord:
        """Assign ownership for the next step in the review lifecycle."""
        record: ReviewRecord | None = await self._store.get(request.record_id)
        if record is None:
            raise ValueError(f"Review record {request.record_id} not found")

        assignee: str = request.assignee.strip()
        if not assignee:
            raise ValueError("Assignee is required")
        if record.status not in _ASSIGNABLE_STATUSES:
            raise ValueError(f"Cannot assign ownership while item is {record.status.value}")

        now: datetime.datetime = datetime.datetime.now(datetime.UTC)
        actor: str = request.assigned_by.strip() or "system"
        note: str = request.note.strip()

        record.assigned_to = assignee
        record.assigned_by = actor
        record.assigned_at = now
        record.comments.append(
            ReviewComment(
                author=actor,
                text=f"Assigned to {assignee}.{f' {note}' if note else ''}",
            )
        )

        await self._store.save(record)
        return record

    async def claim(self, record_id: str, claimer: str) -> ReviewRecord:
        """Let a reviewer claim ownership of the next step."""
        record: ReviewRecord | None = await self._store.get(record_id)
        if record is None:
            raise ValueError(f"Review record {record_id} not found")

        actor: str = claimer.strip()
        if not actor:
            raise ValueError("Claimer is required")
        if record.status not in _ASSIGNABLE_STATUSES:
            raise ValueError(f"Cannot claim ownership while item is {record.status.value}")

        now: datetime.datetime = datetime.datetime.now(datetime.UTC)
        record.assigned_to = actor
        record.assigned_by = actor
        record.assigned_at = now
        record.comments.append(
            ReviewComment(
                author=actor,
                text="Claimed ownership for the next step.",
            )
        )

        await self._store.save(record)
        return record

    async def remind(self, request: ReminderRequest) -> ReviewRecord:
        """Record a follow-up reminder for the current assignee."""
        record: ReviewRecord | None = await self._store.get(request.record_id)
        if record is None:
            raise ValueError(f"Review record {request.record_id} not found")

        actor: str = request.reminded_by.strip()
        if not actor:
            raise ValueError("Reminder actor is required")
        if record.status not in _ASSIGNABLE_STATUSES:
            raise ValueError(f"Cannot record a reminder while item is {record.status.value}")
        if not record.assigned_to:
            raise ValueError("Cannot record a reminder for an unassigned item")

        target: str = record.assigned_to
        message: str = request.message.strip()
        record.last_reminded_at = datetime.datetime.now(datetime.UTC)
        record.comments.append(
            ReviewComment(
                author=actor,
                text=(
                    f"Recorded a follow-up reminder for {target}.{f' {message}' if message else ''}"
                ),
            )
        )

        await self._store.save(record)
        return record

    async def publish(self, record_id: str) -> ReviewRecord:
        """Transition an approved document to PUBLISHED (searchable)."""
        record: ReviewRecord | None = await self._store.get(record_id)
        if record is None:
            raise ValueError(f"Review record {record_id} not found")

        if not _can_transition(record.status, ReviewStatus.PUBLISHED):
            raise ValueError(f"Cannot publish from {record.status.value} — must be APPROVED first")

        record.status = ReviewStatus.PUBLISHED
        record.published_at = datetime.datetime.now(datetime.UTC)
        await self._store.save(record)
        return record

    async def resubmit(self, record_id: str) -> ReviewRecord:
        """
        Resubmit a rejected or revision-requested document.

        Transitions back to DRAFT, then immediately to PENDING_REVIEW.
        """
        record: ReviewRecord | None = await self._store.get(record_id)
        if record is None:
            raise ValueError(f"Review record {record_id} not found")

        if not _can_transition(record.status, ReviewStatus.DRAFT):
            raise ValueError(f"Cannot resubmit from {record.status.value}")

        record.status = ReviewStatus.PENDING_REVIEW
        record.submitted_at = datetime.datetime.now(datetime.UTC)
        record.reviewed_by = ""
        record.reviewed_at = None
        record.assigned_to = ""
        record.assigned_by = ""
        record.assigned_at = None
        record.last_reminded_at = None
        record.comments.append(
            ReviewComment(
                author="system",
                text="Resubmitted for a new review cycle.",
            )
        )
        await self._store.save(record)
        return record

    async def archive(self, record_id: str) -> ReviewRecord:
        """Retire a published document by transitioning it to ARCHIVED."""
        record: ReviewRecord | None = await self._store.get(record_id)
        if record is None:
            raise ValueError(f"Review record {record_id} not found")

        if not _can_transition(record.status, ReviewStatus.ARCHIVED):
            raise ValueError(f"Cannot archive from {record.status.value} — must be PUBLISHED first")

        record.status = ReviewStatus.ARCHIVED
        record.archived_at = datetime.datetime.now(datetime.UTC)
        await self._store.save(record)
        return record

    async def get_pending(
        self,
        org_id: str,
        limit: int = 50,
    ) -> list[ReviewRecord]:
        """List documents awaiting review."""
        return await self._store.list_pending(org_id, limit)

    async def get_by_status(
        self,
        org_id: str,
        status: ReviewStatus,
        limit: int = 50,
    ) -> list[ReviewRecord]:
        """List documents in a specific review state."""
        return await self._store.list_by_status(org_id, status, limit)
