"""
BigQuery event store — production analytics persistence.

Stores events in a BigQuery table for durable, queryable analytics.
Uses streaming inserts for low-latency writes and standard SQL for reads.

Required environment:
    GCP_PROJECT_ID  — GCP project
    BQ_DATASET      — BigQuery dataset  (default: ``analytics``)
    BQ_TABLE_EVENTS — events table name (default: ``agent_events``)

Required dependency:
    pip install google-cloud-bigquery
"""

from __future__ import annotations

import ast
import collections
import datetime
import json
import logging
import typing
import uuid

import src.adapters.database
import src.core.logging
import src.domain.entities

logger: logging.Logger = src.core.logging.logger.getChild("bigquery")


def _parse_payload(raw_payload: typing.Any) -> dict[str, typing.Any]:
    if isinstance(raw_payload, dict):
        return raw_payload
    if not isinstance(raw_payload, str) or not raw_payload.strip():
        return {}

    try:
        parsed = json.loads(raw_payload)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass

    try:
        parsed = ast.literal_eval(raw_payload)
        if isinstance(parsed, dict):
            return parsed
    except (SyntaxError, ValueError):
        pass

    return {}


def _coerce_datetime(value: typing.Any) -> datetime.datetime:
    if isinstance(value, datetime.datetime):
        if value.tzinfo is None:
            return value.replace(tzinfo=datetime.UTC)
        return value.astimezone(datetime.UTC)
    if isinstance(value, (int, float)):
        return datetime.datetime.fromtimestamp(float(value), tz=datetime.UTC)
    if isinstance(value, str) and value.strip():
        normalized: str = value.strip().replace("Z", "+00:00")
        try:
            parsed: datetime.datetime = datetime.datetime.fromisoformat(normalized)
        except ValueError:
            try:
                return datetime.datetime.fromtimestamp(float(normalized), tz=datetime.UTC)
            except ValueError:
                return datetime.datetime.now(datetime.UTC)
        if parsed.tzinfo is None:
            return parsed.replace(tzinfo=datetime.UTC)
        return parsed.astimezone(datetime.UTC)
    return datetime.datetime.now(datetime.UTC)


def _coerce_timestamp(value: typing.Any, *, fallback: typing.Any = None) -> float:
    if value is None:
        value = fallback
    return _coerce_datetime(value).timestamp()


def _payload_text(payload: dict[str, typing.Any], key: str, default: str = "") -> str:
    value = payload.get(key, default)
    if value is None:
        return default
    if isinstance(value, str):
        return value
    return str(value)


def _event_session_id(payload: dict[str, typing.Any], user_id: str) -> str:
    for key: str in ("session_id", "conversation_id", "conversationId"):
        candidate: str = _payload_text(payload, key)
        if candidate:
            return candidate
    return user_id


class BigQueryEventStore(src.adapters.database.EventStoreProtocol):
    """
    BigQuery-backed event store.

    Lazily initialises the BigQuery client on first write/read
    so the service can start even if credentials are missing (with
    a clear error at call time).
    """

    def __init__(
        self,
        *,
        project_id: str = "",
        dataset: str = "analytics",
        table: str = "agent_events",
    ) -> None:
        self._project: str = project_id
        self._dataset: str = dataset
        self._table: str = table
        self._client: typing.Any = None

    # ── lazy client ───────────────────────────────────────────────────────

    def _get_client(self):
        if self._client is None:
            try:
                from google.cloud import bigquery  # type: ignore[import-untyped]
            except ImportError as exc: ImportError:
                raise RuntimeError(
                    "google-cloud-bigquery is required for BigQuery backend. "
                    "Install with: pip install google-cloud-bigquery"
                ) from exc
            self._client = bigquery.Client(project=self._project or None)
        return self._client

    async def close(self) -> None:
        """Close the BigQuery client and release transport resources."""
        if self._client is not None:
            self._client.close()
            self._client = None
            logger.info("BigQuery client closed")

    @property
    def _fqn(self) -> str:
        """Fully-qualified table name: ``project.dataset.table``."""
        parts: list[str] = [
            part for part: str in (self._project, self._dataset, self._table) if part
        ]
        return ".".join(parts)

    # ── writes ────────────────────────────────────────────────────────────

    async def append(self, event: src.domain.entities.AgentEvent) -> None:
        client = self._get_client()
        created_at: datetime.datetime = datetime.datetime.fromtimestamp(
            event.timestamp,
            tz=datetime.UTC,
        )
        ingested_at: datetime.datetime = datetime.datetime.fromtimestamp(
            event.ingested_at,
            tz=datetime.UTC,
        )
        payload: dict[str, typing.Any] = dict(event.payload)
        payload.setdefault("org_id", event.org_id)
        payload.setdefault("service", event.service)
        payload.setdefault("scope", event.scope)
        payload.setdefault("timestamp", created_at.isoformat())
        payload.setdefault("ingested_at", ingested_at.isoformat())

        event_id: str = _payload_text(payload, "event_id") or str(uuid.uuid4())
        payload.setdefault("event_id", event_id)

        row: dict[str, typing.Any] = {
            "event_id": event_id,
            "event_type": event.event_type,
            "session_id": _event_session_id(payload, event.user_id),
            "user_id": event.user_id,
            "payload": json.dumps(payload, separators=(",", ":"), sort_keys=True),
            "created_at": created_at.isoformat(),
        }
        errors = client.insert_rows_json(self._fqn, [row])
        if errors:
            logger.error("BigQuery insert errors: %s", errors)
            raise RuntimeError(f"BigQuery streaming insert failed: {errors}")

    # ── reads ─────────────────────────────────────────────────────────────

    async def query(
        self,
        *,
        limit: int = 50,
        event_type: str | None = None,
        user_id: str | None = None,
        org_id: str | None = None,
        stream_id: str | None = None,
        service: str | None = None,
    ) -> list[src.domain.entities.AgentEvent]:
        client = self._get_client()

        conditions = []
        params: list[typing.Any] = []
        if event_type:
            conditions.append("event_type = @event_type")
            params.append(("event_type", "STRING", event_type))
        if user_id:
            conditions.append("user_id = @user_id")
            params.append(("user_id", "STRING", user_id))
        if org_id:
            conditions.append("COALESCE(JSON_VALUE(payload, '$.org_id'), 'default') = @org_id")
            params.append(("org_id", "STRING", org_id))
        if stream_id:
            conditions.append(
                "(JSON_VALUE(payload, '$.scope') = @stream_id OR JSON_VALUE(payload, '$.stream_id') = @stream_id)"
            )
            params.append(("stream_id", "STRING", stream_id))
        if service:
            conditions.append("JSON_VALUE(payload, '$.service') = @service")
            params.append(("service", "STRING", service))

        where: str = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        sql: str = (
            f"SELECT event_type, user_id, session_id, payload, created_at "
            f"FROM `{self._fqn}` {where} ORDER BY created_at DESC LIMIT @limit"
        )
        params.append(("limit", "INT64", limit))

        from google.cloud.bigquery import QueryJobConfig, ScalarQueryParameter

        job_config = QueryJobConfig(
            query_parameters=[ScalarQueryParameter(n, t, v) for n, t, v in params]
        )
        rows = client.query(sql, job_config=job_config).result()

        events: list[src.domain.entities.AgentEvent] = []
        for row in rows:
            payload: dict[str, typing.Any] = _parse_payload(row.get("payload"))
            created_at = row.get("created_at", datetime.datetime.now(datetime.UTC))
            events.append(
                src.domain.entities.AgentEvent(
                    event_type=row.get("event_type", "custom"),
                    user_id=row.get("user_id", ""),
                    org_id=_payload_text(payload, "org_id", "default"),
                    service=_payload_text(payload, "service"),
                    scope=(
                        _payload_text(payload, "scope")
                        or _payload_text(payload, "stream_id", "global")
                    ),
                    payload=payload,
                    timestamp=_coerce_timestamp(payload.get("timestamp"), fallback=created_at),
                    ingested_at=_coerce_timestamp(payload.get("ingested_at"), fallback=created_at),
                )
            )
        return events

    async def summarize(
        self,
        *,
        period_start: str = "",
        period_end: str = "",
        org_id: str | None = None,
        stream_id: str | None = None,
    ) -> src.domain.entities.UsageSummary:
        client = self._get_client()
        from google.cloud.bigquery import QueryJobConfig, ScalarQueryParameter

        conditions = []
        params: list[typing.Any] = []
        if period_start:
            conditions.append("created_at >= @start")
            params.append(("start", "TIMESTAMP", period_start))
        if period_end:
            conditions.append("created_at <= @end")
            params.append(("end", "TIMESTAMP", period_end))
        if org_id:
            conditions.append("COALESCE(JSON_VALUE(payload, '$.org_id'), 'default') = @org_id")
            params.append(("org_id", "STRING", org_id))

        parsed_payload = "payload"
        if stream_id:
            conditions.append(
                "COALESCE(NULLIF(JSON_VALUE(payload, '$.scope'), ''), "
                "NULLIF(JSON_VALUE(payload, '$.stream_id'), '')) = @stream_id"
            )
            params.append(("stream_id", "STRING", stream_id))

        where: str = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        totals_sql: str = f"""
            SELECT
                COUNT(*) AS total_events,
                COUNT(DISTINCT user_id) AS unique_users
            FROM `{self._fqn}` {where}
        """
        events_by_type_sql: str = f"""
            SELECT
                event_type,
                COUNT(*) AS type_count
            FROM `{self._fqn}` {where}
            GROUP BY event_type
        """
        events_by_service_sql: str = f"""
            SELECT
                COALESCE(JSON_VALUE(payload, '$.service'), '') AS service_name,
                COUNT(*) AS service_count
            FROM `{self._fqn}` {where}
            GROUP BY service_name
        """

        job_config = QueryJobConfig(
            query_parameters=[ScalarQueryParameter(n, t, v) for n, t, v in params]
        )
        totals_rows: list[typing.Any] = list(
            client.query(totals_sql, job_config=job_config).result()
        )
        by_type_rows: list[typing.Any] = list(
            client.query(events_by_type_sql, job_config=job_config).result()
        )
        by_service_rows: list[typing.Any] = list(
            client.query(events_by_service_sql, job_config=job_config).result()
        )

        type_counter: collections.Counter[str] = collections.Counter()
        svc_counter: collections.Counter[str] = collections.Counter()
        for row in by_type_rows:
            type_counter[row["event_type"]] += row["type_count"]
        for row in by_service_rows:
            service_name = row["service_name"]
            if service_name:
                svc_counter[service_name] += row["service_count"]

        totals = totals_rows[0] if totals_rows else {}
        total = int(totals.get("total_events", 0) or 0)
        unique = int(totals.get("unique_users", 0) or 0)

        search_tokens_expr: str = (
            f"SAFE_CAST(JSON_VALUE({parsed_payload}, '$.tokens_in_context') AS FLOAT64)"
        )
        search_chunks_expr: str = (
            f"SAFE_CAST(JSON_VALUE({parsed_payload}, '$.chunks_returned') AS FLOAT64)"
        )
        top_score_expr: str = f"SAFE_CAST(JSON_VALUE({parsed_payload}, '$.top_score') AS FLOAT64)"
        faithfulness_expr: str = (
            "SAFE_CAST(COALESCE("
            f"JSON_VALUE({parsed_payload}, '$.ragas.faithfulness'), "
            f"JSON_VALUE({parsed_payload}, '$.faithfulness'), "
            f"JSON_VALUE({parsed_payload}, '$.ragas_faithfulness')"
            ") AS FLOAT64)"
        )
        answer_relevancy_expr: str = (
            "SAFE_CAST(COALESCE("
            f"JSON_VALUE({parsed_payload}, '$.ragas.answer_relevancy'), "
            f"JSON_VALUE({parsed_payload}, '$.answer_relevancy'), "
            f"JSON_VALUE({parsed_payload}, '$.ragas_answer_relevancy'), "
            f"JSON_VALUE({parsed_payload}, '$.answer_relevance'), "
            f"JSON_VALUE({parsed_payload}, '$.answer_similarity')"
            ") AS FLOAT64)"
        )
        context_precision_expr: str = (
            "SAFE_CAST(COALESCE("
            f"JSON_VALUE({parsed_payload}, '$.ragas.context_precision'), "
            f"JSON_VALUE({parsed_payload}, '$.context_precision'), "
            f"JSON_VALUE({parsed_payload}, '$.ragas_context_precision')"
            ") AS FLOAT64)"
        )
        context_recall_expr: str = (
            "SAFE_CAST(COALESCE("
            f"JSON_VALUE({parsed_payload}, '$.ragas.context_recall'), "
            f"JSON_VALUE({parsed_payload}, '$.context_recall'), "
            f"JSON_VALUE({parsed_payload}, '$.ragas_context_recall')"
            ") AS FLOAT64)"
        )
        answer_correctness_expr: str = (
            "SAFE_CAST(COALESCE("
            f"JSON_VALUE({parsed_payload}, '$.ragas.answer_correctness'), "
            f"JSON_VALUE({parsed_payload}, '$.answer_correctness'), "
            f"JSON_VALUE({parsed_payload}, '$.ragas_answer_correctness')"
            ") AS FLOAT64)"
        )
        ragas_present_expr: str = (
            f"({faithfulness_expr} IS NOT NULL OR {answer_relevancy_expr} IS NOT NULL "
            f"OR {context_precision_expr} IS NOT NULL OR {context_recall_expr} IS NOT NULL "
            f"OR {answer_correctness_expr} IS NOT NULL)"
        )
        status_expr: str = f"LOWER(COALESCE(JSON_VALUE({parsed_payload}, '$.status'), ''))"
        processing_time_expr: str = (
            f"SAFE_CAST(JSON_VALUE({parsed_payload}, '$.processing_time_ms') AS FLOAT64)"
        )
        duration_expr: str = f"SAFE_CAST(JSON_VALUE({parsed_payload}, '$.duration_ms') AS FLOAT64)"
        chunk_count_expr: str = f"SAFE_CAST(JSON_VALUE({parsed_payload}, '$.chunk_count') AS INT64)"
        ragas_event_expr: str = "event_type IN ('kb.search', 'kb.evaluation')"
        eval_sample_count_expr: str = (
            "GREATEST(COALESCE("
            f"SAFE_CAST(JSON_VALUE({parsed_payload}, '$.ragas_sample_count') AS INT64), "
            f"SAFE_CAST(JSON_VALUE({parsed_payload}, '$.case_count') AS INT64), "
            "1), 1)"
        )
        eval_population_count_expr: str = (
            "GREATEST(COALESCE("
            f"SAFE_CAST(JSON_VALUE({parsed_payload}, '$.case_count') AS INT64), "
            f"SAFE_CAST(JSON_VALUE({parsed_payload}, '$.ragas_sample_count') AS INT64), "
            "1), 1)"
        )
        ragas_sample_weight_expr: str = (
            f"IF(event_type = 'kb.evaluation', {eval_sample_count_expr}, 1)"
        )
        ragas_population_weight_expr: str = (
            f"IF(event_type = 'kb.evaluation', {eval_population_count_expr}, 1)"
        )

        def _weighted_ragas_avg(metric_expr: str) -> str:
            return f"""
                ROUND(
                    COALESCE(
                        SAFE_DIVIDE(
                            SUM(
                                IF(
                                    {ragas_event_expr}
                                    AND {metric_expr} IS NOT NULL,
                                    {metric_expr} * {ragas_sample_weight_expr},
                                    0
                                )
                            ),
                            SUM(
                                IF(
                                    {ragas_event_expr}
                                    AND {metric_expr} IS NOT NULL,
                                    {ragas_sample_weight_expr},
                                    0
                                )
                            )
                        ),
                        0
                    ),
                    2
                )
            """

        metrics_sql: str = f"""
            SELECT
                ROUND(
                    COALESCE(AVG(IF(event_type = 'kb.search', {search_tokens_expr}, NULL)), 0),
                    2
                ) AS cmos,
                ROUND(
                    COALESCE(AVG(IF(event_type = 'kb.search', {search_chunks_expr}, NULL)), 0),
                    2
                ) AS avg_chunks_per_search,
                ROUND(
                    COALESCE(AVG(IF(event_type = 'kb.search', {top_score_expr}, NULL)), 0),
                    2
                ) AS avg_top_score,
                COUNTIF(event_type = 'kb.ingest') AS total_ingest_jobs,
                ROUND(
                    COALESCE(
                        SAFE_DIVIDE(
                            COUNTIF(
                                event_type = 'kb.ingest'
                                AND {status_expr} IN ('completed', 'indexed')
                            ),
                            COUNTIF(event_type = 'kb.ingest')
                        ),
                        0
                    ),
                    4
                ) AS ingest_success_rate,
                ROUND(
                    COALESCE(
                        AVG(
                            IF(
                                event_type = 'kb.ingest',
                                COALESCE({processing_time_expr}, {duration_expr}),
                                NULL
                            )
                        ),
                        0
                    ),
                    2
                ) AS avg_ingest_duration_ms,
                ROUND(
                    COALESCE(
                        APPROX_QUANTILES(
                            IF(
                                event_type = 'kb.ingest',
                                COALESCE({processing_time_expr}, {duration_expr}),
                                NULL
                            ),
                            100
                        )[OFFSET(95)],
                        0
                    ),
                    2
                ) AS p95_ingest_duration_ms,
                COALESCE(
                    SUM(
                        IF(
                            event_type = 'kb.ingest'
                            AND {status_expr} IN ('completed', 'indexed'),
                            COALESCE({chunk_count_expr}, 0),
                            0
                        )
                    ),
                    0
                ) AS total_chunks_indexed
                ,COALESCE(
                    SUM(
                        IF(
                            {ragas_event_expr}
                            AND {ragas_present_expr},
                            {ragas_sample_weight_expr},
                            0
                        )
                    ),
                    0
                ) AS ragas_sample_count
                ,ROUND(
                    COALESCE(
                        SAFE_DIVIDE(
                            SUM(
                                IF(
                                    {ragas_event_expr}
                                    AND {ragas_present_expr},
                                    {ragas_sample_weight_expr},
                                    0
                                )
                            ),
                            SUM(
                                IF(
                                    {ragas_event_expr},
                                    {ragas_population_weight_expr},
                                    0
                                )
                            )
                        ),
                        0
                    ),
                    4
                ) AS ragas_coverage_rate
                ,{_weighted_ragas_avg(faithfulness_expr)} AS avg_faithfulness
                ,{_weighted_ragas_avg(answer_relevancy_expr)} AS avg_answer_relevancy
                ,{_weighted_ragas_avg(context_precision_expr)} AS avg_context_precision
                ,{_weighted_ragas_avg(context_recall_expr)} AS avg_context_recall
                ,{_weighted_ragas_avg(answer_correctness_expr)} AS avg_answer_correctness
            FROM `{self._fqn}` {where}
        """
        metrics_rows: list[typing.Any] = list(
            client.query(metrics_sql, job_config=job_config).result()
        )
        metrics = metrics_rows[0] if metrics_rows else {}

        now: str = datetime.datetime.now(datetime.UTC).isoformat()
        return src.domain.entities.UsageSummary(
            period_start=period_start or now,
            period_end=period_end or now,
            total_events=total,
            unique_users=unique,
            events_by_type=dict(type_counter),
            events_by_service=dict(svc_counter),
            cmos=round(float(metrics.get("cmos", 0) or 0), 2),
            avg_chunks_per_search=round(float(metrics.get("avg_chunks_per_search", 0) or 0), 2),
            avg_top_score=round(float(metrics.get("avg_top_score", 0) or 0), 2),
            total_ingest_jobs=int(metrics.get("total_ingest_jobs", 0) or 0),
            ingest_success_rate=round(float(metrics.get("ingest_success_rate", 0) or 0), 4),
            avg_ingest_duration_ms=round(float(metrics.get("avg_ingest_duration_ms", 0) or 0), 2),
            p95_ingest_duration_ms=round(float(metrics.get("p95_ingest_duration_ms", 0) or 0), 2),
            total_chunks_indexed=int(metrics.get("total_chunks_indexed", 0) or 0),
            ragas_sample_count=int(metrics.get("ragas_sample_count", 0) or 0),
            ragas_coverage_rate=round(float(metrics.get("ragas_coverage_rate", 0) or 0), 4),
            avg_faithfulness=round(float(metrics.get("avg_faithfulness", 0) or 0), 2),
            avg_answer_relevancy=round(float(metrics.get("avg_answer_relevancy", 0) or 0), 2),
            avg_context_precision=round(float(metrics.get("avg_context_precision", 0) or 0), 2),
            avg_context_recall=round(float(metrics.get("avg_context_recall", 0) or 0), 2),
            avg_answer_correctness=round(float(metrics.get("avg_answer_correctness", 0) or 0), 2),
        )

    async def user_activity(self, user_id: str) -> src.domain.entities.UserActivity:
        client = self._get_client()
        from google.cloud.bigquery import QueryJobConfig, ScalarQueryParameter

        sql: str = f"""
            SELECT event_type, payload, created_at
            FROM `{self._fqn}`
            WHERE user_id = @uid
            ORDER BY created_at DESC
            LIMIT 10000
        """
        job_config = QueryJobConfig(
            query_parameters=[ScalarQueryParameter("uid", "STRING", user_id)]
        )
        rows: list[typing.Any] = list(client.query(sql, job_config=job_config).result())

        scopes: collections.Counter[str] = collections.Counter()
        messages = tools = searches = 0
        last_ts: str = ""
        org_id = "default"

        for row in rows:
            et = row.get("event_type", "")
            payload: dict[str, typing.Any] = _parse_payload(row.get("payload"))
            scope_key: str = _payload_text(payload, "scope") or _payload_text(
                payload,
                "stream_id",
                "global",
            )
            scopes[scope_key] += 1
            if et in ("chat.message", "chat.response"):
                messages += 1
            elif et == "tool.call":
                tools += 1
            elif et == "kb.search":
                searches += 1
            ts = row.get("created_at")
            if ts and (not last_ts or str(ts) > last_ts):
                last_ts = str(ts)
            payload_org_id: str = _payload_text(payload, "org_id")
            if payload_org_id:
                org_id: str = payload_org_id

        return src.domain.entities.UserActivity(
            user_id=user_id,
            org_id=org_id,
            total_messages=messages,
            total_tool_calls=tools,
            total_kb_searches=searches,
            last_active=last_ts,
            top_scopes=[s for s, _ in scopes.most_common(5)],
        )

    # ── health ────────────────────────────────────────────────────────────

    async def health_check(self) -> str:
        client = self._get_client()
        # Light-weight connectivity test
        list(client.query("SELECT 1").result())
        return "ok"
