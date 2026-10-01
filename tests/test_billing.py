import json
import os
from collections.abc import Generator
from pathlib import Path
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session as OrmSession
from sqlalchemy.orm import sessionmaker

os.environ.setdefault("MAST_JWT_SECRET", "test-only-secret-with-at-least-32-bytes")

from gateway.app.auth import get_current_user
from gateway.app.billing import get_stripe_client
from gateway.app.chat import get_constitutional_verifier, get_socratic_chain
from gateway.app.config import Settings
from gateway.app.dependencies import get_settings
from gateway.app.main import create_app
from gateway.app.quota import enforce_chat_quota
from gateway.db.base import Base
from gateway.db.database import get_db
from gateway.db.models import Subscription, User
from langchain_core.runnables import RunnableLambda


class FakeStripe:
    def __init__(self, event):
        self.event = event
        self.checkout_kwargs = None
        self.constructed = None

    def create_checkout_session(self, **kwargs):
        self.checkout_kwargs = kwargs
        return {"id": "cs_test_123", "url": "https://checkout.example.test/cs_test_123"}

    def construct_event(self, payload, signature, secret):
        self.constructed = (payload, signature, secret)
        return self.event


@pytest.fixture
def billing_client(tmp_path: Path) -> Generator[dict, None, None]:
    database_path = tmp_path / "billing.sqlite"
    engine = create_engine(f"sqlite:///{database_path}")
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    user = User(auth_provider="github", external_id="billing-user", plan_tier="free")
    with session_factory() as session:
        session.add(user)
        session.commit()
        session.refresh(user)
        user_id = user.id

    settings = Settings(
        jwt_secret="test-only-secret-with-at-least-32-bytes",
        stripe_secret_key="sk_test_mock_only",
        stripe_webhook_secret="whsec_mock_only",
        stripe_pro_price_id="price_pro_test",
        free_chat_quota_limit=1,
    )
    fake_stripe = FakeStripe({})
    app = create_app(settings)

    def override_db():
        session = session_factory()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_settings] = lambda: settings
    app.dependency_overrides[get_current_user] = lambda: session_factory().get(User, user_id)
    app.dependency_overrides[get_stripe_client] = lambda: fake_stripe
    with TestClient(app) as client:
        yield {
            "client": client,
            "session_factory": session_factory,
            "user_id": user_id,
            "settings": settings,
            "stripe": fake_stripe,
            "app": app,
        }
    engine.dispose()


def subscription_event(user_id, event_id="evt_123", event_type="customer.subscription.updated", status="active"):
    return {
        "id": event_id,
        "type": event_type,
        "data": {
            "object": {
                "id": "sub_123",
                "metadata": {"user_id": str(user_id), "tier": "pro"},
                "status": status,
                "current_period_end": 1_798_000_000,
            }
        },
    }


def test_checkout_is_authenticated_server_configured_and_does_not_expose_secrets(billing_client, caplog):
    client = billing_client["client"]
    stripe = billing_client["stripe"]

    with caplog.at_level("INFO"):
        response = client.post("/v1/billing/checkout", json={"tier": "pro"})

    assert response.status_code == 200
    assert response.json() == {
        "checkout_url": "https://checkout.example.test/cs_test_123",
        "session_id": "cs_test_123",
    }
    assert stripe.checkout_kwargs["line_items"] == [{"price": "price_pro_test", "quantity": 1}]
    assert stripe.checkout_kwargs["metadata"]["user_id"] == str(billing_client["user_id"])
    assert "sk_test_mock_only" not in response.text
    assert "sk_test_mock_only" not in caplog.text


def test_webhook_verifies_signature_updates_subscription_and_is_idempotent(billing_client):
    client = billing_client["client"]
    stripe = billing_client["stripe"]
    event = subscription_event(billing_client["user_id"])
    stripe.event = event

    first = client.post(
        "/v1/billing/webhook",
        content=json.dumps(event).encode(),
        headers={"Stripe-Signature": "sig_test"},
    )
    second = client.post(
        "/v1/billing/webhook",
        content=json.dumps(event).encode(),
        headers={"Stripe-Signature": "sig_test"},
    )

    assert first.json() == {"status": "processed"}
    assert second.json() == {"status": "already_processed"}
    assert stripe.constructed[1:] == ("sig_test", "whsec_mock_only")
    with billing_client["session_factory"]() as session:
        user = session.get(User, billing_client["user_id"])
        subscription = session.scalar(select(Subscription).where(Subscription.user_id == user.id))
        assert user.plan_tier == "pro"
        assert subscription.tier == "pro"
        assert subscription.status == "active"
        assert subscription.last_event_id == "evt_123"


def test_cancellation_returns_user_to_free_policy(billing_client):
    client = billing_client["client"]
    stripe = billing_client["stripe"]
    active = subscription_event(billing_client["user_id"], event_id="evt_active")
    canceled = subscription_event(
        billing_client["user_id"],
        event_id="evt_canceled",
        event_type="customer.subscription.deleted",
        status="canceled",
    )
    stripe.event = active
    assert client.post("/v1/billing/webhook", content=b"active", headers={"Stripe-Signature": "sig"}).status_code == 200
    stripe.event = canceled
    assert client.post("/v1/billing/webhook", content=b"canceled", headers={"Stripe-Signature": "sig"}).status_code == 200

    with billing_client["session_factory"]() as session:
        user = session.get(User, billing_client["user_id"])
        assert user.plan_tier == "free"


def test_invalid_webhook_signature_is_safe(billing_client, caplog):
    stripe = billing_client["stripe"]
    stripe.construct_event = lambda *_args: (_ for _ in ()).throw(RuntimeError("secret provider detail"))

    with caplog.at_level("INFO"):
        response = billing_client["client"].post(
            "/v1/billing/webhook", content=b"bad", headers={"Stripe-Signature": "bad"}
        )

    assert response.status_code == 400
    assert response.json() == {"detail": "Invalid billing webhook"}
    assert "secret provider detail" not in response.text
    assert "secret provider detail" not in caplog.text
    assert "whsec_mock_only" not in caplog.text


def test_free_quota_blocks_then_active_pro_subscription_lifts_quota(billing_client):
    settings = billing_client["settings"]
    app = billing_client["app"]
    app.dependency_overrides[get_socratic_chain] = lambda: RunnableLambda(lambda _values: "What do you notice?")
    app.dependency_overrides[get_constitutional_verifier] = lambda: RunnableLambda(lambda _values: "SOCRATIC")
    request = {
        "message": "shape error",
        "error_text": "ValueError: shape mismatch",
        "error_category": "shape_mismatch",
        "mastery_by_kc": {},
        "retrieved_context": [],
        "hint_depth": 0,
    }

    first = billing_client["client"].post("/v1/chat", json=request)
    blocked = billing_client["client"].post("/v1/chat", json=request)
    assert first.status_code == 200
    assert blocked.status_code == 429
    assert blocked.headers["x-mast-upgrade-required"] == "true"
    assert blocked.json() == {"detail": "Chat quota exceeded"}

    with billing_client["session_factory"]() as session:
        session.add(Subscription(
            user_id=billing_client["user_id"],
            tier="pro",
            status="active",
            provider_ref="sub_pro",
        ))
        session.commit()

    lifted = billing_client["client"].post("/v1/chat", json=request)
    assert lifted.status_code == 200
    assert "x-mast-upgrade-required" not in lifted.headers
