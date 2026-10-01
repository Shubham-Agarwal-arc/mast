from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session as OrmSession

from gateway.app.auth import get_current_user
from gateway.db.database import get_db
from gateway.db.models import Interaction, Session, User


router = APIRouter(prefix="/v1/metrics", tags=["metrics"])
MAX_METRIC_ROWS = 10_000


class RollingMetrics(BaseModel):
    window_days: int
    sample_count: int
    truncated: bool
    lvm: float | None
    lvm_sample_count: int
    resolution_rate: float | None
    resolution_sample_count: int
    constitutional_trigger_rate: float | None
    latency_ms: dict[str, float | None]
    quota_outcomes: dict[str, int]


@router.get("", response_model=RollingMetrics)
def get_rolling_metrics(
    window_days: int = Query(default=30, ge=1, le=90),
    current_user: User = Depends(get_current_user),
    db: OrmSession = Depends(get_db),
) -> RollingMetrics:
    cutoff = datetime.now(UTC) - timedelta(days=window_days)
    rows = list(
        db.scalars(
            select(Interaction)
            .join(Session, Interaction.session_id == Session.id)
            .where(Session.user_id == current_user.id, Interaction.created_at >= cutoff)
            .order_by(Interaction.created_at.desc())
            .limit(MAX_METRIC_ROWS + 1)
        )
    )
    truncated = len(rows) > MAX_METRIC_ROWS
    rows = rows[:MAX_METRIC_ROWS]
    interaction_rows = [row for row in rows if row.quota_outcome != "blocked"]

    lvm_values = [
        (row.hint_depth + 1) / row.predicted_hints_needed
        for row in interaction_rows
        if row.predicted_hints_needed is not None and row.predicted_hints_needed > 0
    ]
    resolved_values = [row.resolved for row in interaction_rows if row.resolved is not None]
    latencies = sorted(row.latency_ms for row in interaction_rows)

    def percentile(fraction: float) -> float | None:
        if not latencies:
            return None
        index = round((len(latencies) - 1) * fraction)
        return round(latencies[index], 2)

    return RollingMetrics(
        window_days=window_days,
        sample_count=len(interaction_rows),
        truncated=truncated,
        lvm=round(sum(lvm_values) / len(lvm_values), 4) if lvm_values else None,
        lvm_sample_count=len(lvm_values),
        resolution_rate=(sum(resolved_values) / len(resolved_values)) if resolved_values else None,
        resolution_sample_count=len(resolved_values),
        constitutional_trigger_rate=(
            sum(row.constitutional_triggered for row in interaction_rows) / len(interaction_rows)
            if interaction_rows
            else None
        ),
        latency_ms={
            "average": round(sum(latencies) / len(latencies), 2) if latencies else None,
            "p50": percentile(0.50),
            "p95": percentile(0.95),
        },
        quota_outcomes={
            "allowed": sum(row.quota_outcome == "allowed" for row in rows),
            "blocked": sum(row.quota_outcome == "blocked" for row in rows),
        },
    )