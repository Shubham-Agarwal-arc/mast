import logging
import os
from collections.abc import Generator
from pathlib import Path
from unittest.mock import Mock
from uuid import UUID

import pytest
import httpx
from httpx import Client as HttpxClient
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session as OrmSession
from sqlalchemy.orm import sessionmaker

os.environ.setdefault("MAST_JWT_SECRET", "test-only-secret-with-at-least-32-bytes")

from gateway.app import auth
from gateway.app.config import Settings
from gateway.app.dependencies import get_settings
from gateway.app.main import create_app
from gateway.app import middleware
from gateway.db.base import Base
from gateway.db.database import get_db
from gateway.db.models import User


@pytest.fixture
def gateway_client(tmp_path: Path) -> Generator[tuple[TestClient, sessionmaker[OrmSession]], None, None]:
    database_path = tmp_path / "gateway.sqlite"
    engine = create_engine(f"sqlite:///{database_path.as_posix()}")
    Base.metadata.create_all(engine)
    test_session_factory = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

    def override_get_db() -> Generator[OrmSession, None, None]:
        session = test_session_factory()
        try:
            yield session
        finally:
            session.close()

    settings = Settings(jwt_secret="test-only-secret-with-at-least-32-bytes")
    app = create_app(settings)
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_settings] = lambda: settings

    with TestClient(app) as client:
        yield client, test_session_factory

    engine.dispose()


def test_health_returns_ok_and_structured_request_log(gateway_client, monkeypatch) -> None:
    client, _ = gateway_client
    log_request = Mock()
    monkeypatch.setattr(middleware.request_logger, "info", log_request)

    response = client.get("/v1/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    assert UUID(response.headers["x-request-id"])
    log_request.assert_called_once()
    extra = log_request.call_args.kwargs["extra"]
    assert extra["request_id"] == response.headers["x-request-id"]
    assert extra["method"] == "GET"
    assert extra["path"] == "/v1/health"
    assert extra["status_code"] == 200
    assert isinstance(extra["latency_ms"], float)


def test_github_exchange_creates_user_and_issues_usable_tokens(gateway_client, monkeypatch) -> None:
    client, session_factory = gateway_client
    provided_github_token = "github-access-token-must-not-be-logged"
    monkeypatch.setattr(auth, "verify_github_access_token", lambda token, settings: ("987654", "learner"))

    response = client.post("/v1/auth/github", json={"access_token": provided_github_token})

    assert response.status_code == 200
    tokens = response.json()
    assert tokens["token_type"] == "bearer"
    assert tokens["expires_in"] == 900
    assert tokens["access_token"]
    assert tokens["refresh_token"]
    with session_factory() as session:
        user = session.scalar(select(User).where(User.auth_provider == "github", User.external_id == "987654"))
        assert user is not None
        assert user.plan_tier == "free"
        user_id = user.id

    identity = client.get("/v1/auth/me", headers={"Authorization": f"Bearer {tokens['access_token']}"})
    assert identity.status_code == 200
    assert identity.json() == {
        "id": str(user_id),
        "auth_provider": "github",
        "external_id": "987654",
        "plan_tier": "free",
    }

    refreshed = client.post("/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert refreshed.status_code == 200
    assert refreshed.json()["access_token"] != tokens["access_token"]


def test_github_exchange_is_idempotent_and_never_logs_provider_token(gateway_client, monkeypatch, caplog) -> None:
    client, session_factory = gateway_client
    provider_token = "sensitive-github-token-value"
    monkeypatch.setattr(auth, "verify_github_access_token", lambda token, settings: ("12345", "learner"))

    with caplog.at_level(logging.INFO):
        first = client.post("/v1/auth/github", json={"access_token": provider_token})
        second = client.post("/v1/auth/github", json={"access_token": provider_token})

    assert first.status_code == second.status_code == 200
    with session_factory() as session:
        count = session.scalar(select(func.count()).select_from(User))
    assert count == 1
    assert all(provider_token not in record.getMessage() for record in caplog.records)


def test_github_verification_uses_provider_identity_endpoint(monkeypatch) -> None:
    seen = {}

    def handle_request(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        seen["authorization"] = request.headers["Authorization"]
        return httpx.Response(200, json={"id": 24680, "login": "learner"})

    monkeypatch.setattr(
        auth.httpx,
        "Client",
        lambda timeout: HttpxClient(transport=httpx.MockTransport(handle_request), timeout=timeout),
    )
    settings = Settings(jwt_secret="test-only-secret-with-at-least-32-bytes", github_api_base_url="https://github.test")

    identity = auth.verify_github_access_token("github-token", settings)

    assert identity == ("24680", "learner")
    assert seen == {
        "url": "https://github.test/user",
        "authorization": "Bearer github-token",
    }


@pytest.mark.parametrize("headers", [{}, {"Authorization": "Bearer not-a-valid-jwt"}])
def test_identity_route_rejects_missing_or_invalid_access_token(gateway_client, headers) -> None:
    client, _ = gateway_client

    response = client.get("/v1/auth/me", headers=headers)

    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"