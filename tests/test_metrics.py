from __future__ import annotations

import os
from collections.abc import Generator
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

os.environ.setdefault("MAST_JWT_SECRET", "test-only-secret-with-at-least-32-bytes")

from gateway.app.auth import get_current_user
from gateway.app.config import Settings
from gateway.app.main import create_app
from gateway.app.dependencies import get_settings
from gateway.db.base import Base
from gateway.db.database import get_db
from gateway.db.models import Interaction, Session, User


@pytest.fixture
def metrics_client() -> Generator[dict[str, object], None, None]:
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    user = User(auth_provider="github", external_id="metrics-user", plan_tier="free")
    with session_factory() as db:
        db.add(user)
        db.commit()
        user_id = user.id

    settings = Settings(jwt_secret="test-only-secret-with-at-least-32-bytes")
    app = create_app(settings)

    def override_db():
        db = session_factory()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_settings] = lambda: settings
    app.dependency_overrides[get_current_user] = lambda: session_factory().get(User, user_id)
    with TestClient(app) as client:
        yield {"client": client, "session_factory": session_factory, "user_id": user_id}
    engine.dispose()


def add_interaction(session_factory, user_id, **values) -> Interaction:
    with session_factory() as db:
        session = Session(user_id=user_id)
        db.add(session)
        db.flush()
        fields = {
            "error_category": "shape_mismatch",
            "kc_ids": ["KC_00"],
            "latency_ms": 10.0,
            "quota_outcome": "allowed",
            **values,
        }
        interaction = Interaction(
            session_id=session.id,
            **fields,
        )
        db.add(interaction)
        db.commit()
        db.refresh(interaction)
        return interaction


def test_metrics_aggregate_stored_rows_with_known_inputs(metrics_client):
    factory = metrics_client["session_factory"]
    user_id = metrics_client["user_id"]
    add_interaction(
        factory,
        user_id,
        hint_depth=0,
        predicted_hints_needed=2.0,
        resolved=True,
        constitutional_triggered=True,
        latency_ms=10.0,
    )
    add_interaction(
        factory,
        user_id,
        hint_depth=1,
        predicted_hints_needed=2.0,
        resolved=False,
        constitutional_triggered=False,
        latency_ms=30.0,
    )
    add_interaction(
        factory,
        user_id,
        error_category="quota_blocked",
        resolved=None,
        quota_outcome="blocked",
        latency_ms=0.0,
    )

    response = metrics_client["client"].get("/v1/metrics?window_days=30")

    assert response.status_code == 200
    assert response.json() == {
        "window_days": 30,
        "sample_count": 2,
        "truncated": False,
        "lvm": 0.75,
        "lvm_sample_count": 2,
        "resolution_rate": 0.5,
        "resolution_sample_count": 2,
        "constitutional_trigger_rate": 0.5,
        "latency_ms": {"average": 20.0, "p50": 10.0, "p95": 30.0},
        "quota_outcomes": {"allowed": 2, "blocked": 1},
    }


def test_metrics_empty_data_reports_null_rates_and_zero_counts(metrics_client):
    response = metrics_client["client"].get("/v1/metrics")

    assert response.status_code == 200
    result = response.json()
    assert result["sample_count"] == 0
    assert result["lvm"] is None
    assert result["lvm_sample_count"] == 0
    assert result["resolution_rate"] is None
    assert result["resolution_sample_count"] == 0
    assert result["constitutional_trigger_rate"] is None
    assert result["latency_ms"] == {"average": None, "p50": None, "p95": None}
    assert result["quota_outcomes"] == {"allowed": 0, "blocked": 0}


def test_metrics_requires_authentication_and_bounds_window(metrics_client):
    unauthenticated_app = create_app(Settings(jwt_secret="test-only-secret-with-at-least-32-bytes"))
    with TestClient(unauthenticated_app) as unauthenticated:
        denied = unauthenticated.get("/v1/metrics")
    too_wide = metrics_client["client"].get("/v1/metrics?window_days=91")

    assert denied.status_code == 401
    assert too_wide.status_code == 422


def test_metrics_are_scoped_to_authenticated_user(metrics_client):
    factory = metrics_client["session_factory"]
    add_interaction(factory, metrics_client["user_id"], resolved=True, hint_depth=0)
    other = User(auth_provider="github", external_id=f"other-{uuid4()}", plan_tier="free")
    with factory() as db:
        db.add(other)
        db.commit()
        other_id = other.id
    add_interaction(factory, other_id, resolved=False, hint_depth=0)

    response = metrics_client["client"].get("/v1/metrics")

    assert response.status_code == 200
    assert response.json()["sample_count"] == 1
    assert response.json()["resolution_rate"] == 1.0
