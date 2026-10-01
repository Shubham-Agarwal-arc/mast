from __future__ import annotations

from datetime import UTC, datetime
from typing import Any, Mapping, Protocol
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session as OrmSession

from gateway.app.auth import get_current_user
from gateway.app.config import Settings
from gateway.app.dependencies import get_settings
from gateway.db.database import get_db
from gateway.db.models import Subscription, User


router = APIRouter(prefix="/v1/billing", tags=["billing"])


class StripeClient(Protocol):
    def create_checkout_session(self, **kwargs: Any) -> Mapping[str, Any]: ...

    def construct_event(self, payload: bytes, signature: str, secret: str) -> Mapping[str, Any]: ...


class StripeConfigurationError(RuntimeError):
    pass


class CheckoutRequest(BaseModel):
    tier: str = Field(default="pro", pattern="^pro$")


class CheckoutResponse(BaseModel):
    checkout_url: str = Field(min_length=1, max_length=2_000)
    session_id: str = Field(min_length=1, max_length=255)


def _stripe_client(settings: Settings) -> StripeClient:
    if not settings.stripe_secret_key or not settings.stripe_webhook_secret:
        raise StripeConfigurationError("Stripe is not configured on the server")
    try:
        import stripe
    except ImportError as exc:
        raise StripeConfigurationError("Stripe is not configured on the server") from exc

    class StripeSdkClient:
        def create_checkout_session(self, **kwargs: Any) -> Mapping[str, Any]:
            return stripe.checkout.Session.create(api_key=settings.stripe_secret_key, **kwargs)

        def construct_event(self, payload: bytes, signature: str, secret: str) -> Mapping[str, Any]:
            return stripe.Webhook.construct_event(payload, signature, secret)

    return StripeSdkClient()


def get_stripe_client(request: Request, settings: Settings = Depends(get_settings)) -> StripeClient:
    client = getattr(request.app.state, "stripe_client", None)
    if client is None:
        try:
            client = _stripe_client(settings)
        except StripeConfigurationError as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Billing is temporarily unavailable",
            ) from exc
        request.app.state.stripe_client = client
    return client


def _timestamp(value: object) -> datetime | None:
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        return None
    return datetime.fromtimestamp(value, tz=UTC)


def _metadata(value: object) -> Mapping[str, str]:
    if not isinstance(value, Mapping):
        return {}
    return {str(key): str(item) for key, item in value.items() if item is not None}


def _subscription_object(event: Mapping[str, Any]) -> Mapping[str, Any]:
    data = event.get("data")
    if not isinstance(data, Mapping):
        return {}
    value = data.get("object")
    return value if isinstance(value, Mapping) else {}


def _event_user_id(event_object: Mapping[str, Any]) -> UUID | None:
    metadata = _metadata(event_object.get("metadata"))
    value = metadata.get("user_id")
    if not value:
        return None
    try:
        return UUID(value)
    except ValueError:
        return None


def _event_tier(event_object: Mapping[str, Any], settings: Settings) -> str:
    metadata = _metadata(event_object.get("metadata"))
    if metadata.get("tier") == "pro":
        return "pro"
    items = event_object.get("items")
    if isinstance(items, Mapping):
        data = items.get("data")
        if isinstance(data, list) and data and isinstance(data[0], Mapping):
            price = data[0].get("price")
            if isinstance(price, Mapping) and price.get("id") == settings.stripe_pro_price_id:
                return "pro"
    return "free"


def _event_status(event_type: str, event_object: Mapping[str, Any]) -> str:
    if event_type == "customer.subscription.deleted":
        return "canceled"
    value = event_object.get("status")
    return str(value) if isinstance(value, str) and value else "active"


def _event_provider_ref(event_object: Mapping[str, Any]) -> str | None:
    value = event_object.get("subscription") or event_object.get("id")
    return str(value) if isinstance(value, str) and value else None


def apply_subscription_event(
    db: OrmSession,
    event: Mapping[str, Any],
    settings: Settings,
) -> str:
    event_id = event.get("id")
    event_type = event.get("type")
    if not isinstance(event_id, str) or not event_id or not isinstance(event_type, str):
        raise ValueError("Invalid Stripe event")

    processed = db.scalar(select(Subscription).where(Subscription.last_event_id == event_id))
    if processed is not None:
        return "already_processed"

    event_object = _subscription_object(event)
    user_id = _event_user_id(event_object)
    if user_id is None:
        raise ValueError("Stripe event is missing a valid user")
    user = db.get(User, user_id)
    if user is None:
        raise ValueError("Stripe event references an unknown user")

    provider_ref = _event_provider_ref(event_object)
    subscription = db.scalar(select(Subscription).where(Subscription.user_id == user.id))
    if subscription is None:
        subscription = Subscription(user_id=user.id, tier="free", status="inactive")
        db.add(subscription)
    elif provider_ref and subscription.provider_ref not in (None, provider_ref):
        conflict = db.scalar(select(Subscription).where(Subscription.provider_ref == provider_ref))
        if conflict is not None and conflict.user_id != user.id:
            raise ValueError("Stripe subscription belongs to another user")

    subscription.tier = _event_tier(event_object, settings)
    subscription.status = _event_status(event_type, event_object)
    subscription.provider_ref = provider_ref or subscription.provider_ref
    subscription.renews_at = _timestamp(event_object.get("current_period_end"))
    subscription.last_event_id = event_id
    user.plan_tier = "pro" if subscription.tier == "pro" and subscription.status in {"active", "trialing"} else "free"
    db.commit()
    return "processed"


@router.post("/checkout", response_model=CheckoutResponse)
def create_checkout(
    payload: CheckoutRequest,
    current_user: User = Depends(get_current_user),
    db: OrmSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    stripe: StripeClient = Depends(get_stripe_client),
) -> CheckoutResponse:
    subscription = db.scalar(select(Subscription).where(Subscription.user_id == current_user.id))
    if subscription and subscription.tier == "pro" and subscription.status in {"active", "trialing"}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="MAST Pro is already active")
    try:
        session = stripe.create_checkout_session(
            mode="subscription",
            line_items=[{"price": settings.stripe_pro_price_id, "quantity": 1}],
            success_url=settings.stripe_success_url,
            cancel_url=settings.stripe_cancel_url,
            client_reference_id=str(current_user.id),
            metadata={"user_id": str(current_user.id), "tier": payload.tier},
        )
    except Exception:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Billing checkout failed") from None
    url = session.get("url")
    session_id = session.get("id")
    if not isinstance(url, str) or not url or not isinstance(session_id, str) or not session_id:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Billing checkout failed")
    return CheckoutResponse(checkout_url=url, session_id=session_id)


@router.post("/webhook")
async def receive_webhook(
    request: Request,
    db: OrmSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    stripe: StripeClient = Depends(get_stripe_client),
) -> dict[str, str]:
    signature = request.headers.get("Stripe-Signature")
    if not signature or not settings.stripe_webhook_secret:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid billing webhook")
    try:
        event = stripe.construct_event(await request.body(), signature, settings.stripe_webhook_secret)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid billing webhook") from None
    try:
        result = apply_subscription_event(db, event, settings)
    except ValueError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid billing webhook") from None
    return {"status": result}
