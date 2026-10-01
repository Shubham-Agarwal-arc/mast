import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    jwt_secret: str
    jwt_issuer: str = "mast-gateway"
    access_token_ttl_seconds: int = 900
    refresh_token_ttl_seconds: int = 2_592_000
    github_api_base_url: str = "https://api.github.com"
    llm_provider: str = "anthropic"
    anthropic_api_key: str | None = None
    anthropic_model: str = "claude-sonnet-4-5"
    openai_api_key: str | None = None
    openai_model: str = "gpt-4o"
    chat_quota_limit: int | None = None
    chat_quota_window_seconds: int = 86_400
    free_chat_quota_limit: int = 20
    stripe_secret_key: str | None = None
    stripe_webhook_secret: str | None = None
    stripe_free_price_id: str = "price_free_placeholder"
    stripe_pro_price_id: str = "price_pro_placeholder"
    stripe_success_url: str = "https://mast.example.com/billing/success"
    stripe_cancel_url: str = "https://mast.example.com/billing/cancel"

    @classmethod
    def from_env(cls) -> "Settings":
        secret = os.getenv("MAST_JWT_SECRET", "")
        if len(secret.encode("utf-8")) < 32:
            raise RuntimeError("MAST_JWT_SECRET must contain at least 32 bytes")

        access_ttl = int(os.getenv("MAST_ACCESS_TOKEN_TTL_SECONDS", "900"))
        refresh_ttl = int(os.getenv("MAST_REFRESH_TOKEN_TTL_SECONDS", "2592000"))
        if access_ttl <= 0 or refresh_ttl <= 0:
            raise RuntimeError("JWT token lifetimes must be positive integers")
        llm_provider = os.getenv("MAST_LLM_PROVIDER", "anthropic").strip().lower()
        if llm_provider not in {"anthropic", "openai"}:
            raise RuntimeError("MAST_LLM_PROVIDER must be either 'anthropic' or 'openai'")
        quota_limit_value = os.getenv("MAST_CHAT_QUOTA_LIMIT")
        quota_limit = int(quota_limit_value) if quota_limit_value else None
        quota_window = int(os.getenv("MAST_CHAT_QUOTA_WINDOW_SECONDS", "86400"))
        if quota_limit is not None and quota_limit <= 0:
            raise RuntimeError("MAST_CHAT_QUOTA_LIMIT must be positive when configured")
        if quota_window <= 0:
            raise RuntimeError("MAST_CHAT_QUOTA_WINDOW_SECONDS must be positive")
        free_quota = int(os.getenv("MAST_FREE_CHAT_QUOTA_LIMIT", "20"))
        if free_quota <= 0:
            raise RuntimeError("MAST_FREE_CHAT_QUOTA_LIMIT must be positive")

        return cls(
            jwt_secret=secret,
            jwt_issuer=os.getenv("MAST_JWT_ISSUER", "mast-gateway"),
            access_token_ttl_seconds=access_ttl,
            refresh_token_ttl_seconds=refresh_ttl,
            github_api_base_url=os.getenv("GITHUB_API_BASE_URL", "https://api.github.com").rstrip("/"),
            llm_provider=llm_provider,
            anthropic_api_key=os.getenv("ANTHROPIC_API_KEY") or None,
            anthropic_model=os.getenv("MAST_ANTHROPIC_MODEL", "claude-sonnet-4-5"),
            openai_api_key=os.getenv("OPENAI_API_KEY") or None,
            openai_model=os.getenv("MAST_OPENAI_MODEL", "gpt-4o"),
            chat_quota_limit=quota_limit,
            chat_quota_window_seconds=quota_window,
            free_chat_quota_limit=free_quota,
            stripe_secret_key=os.getenv("STRIPE_SECRET_KEY") or None,
            stripe_webhook_secret=os.getenv("STRIPE_WEBHOOK_SECRET") or None,
            stripe_free_price_id=os.getenv("STRIPE_FREE_PRICE_ID", "price_free_placeholder"),
            stripe_pro_price_id=os.getenv("STRIPE_PRO_PRICE_ID", "price_pro_placeholder"),
            stripe_success_url=os.getenv("STRIPE_SUCCESS_URL", "https://mast.example.com/billing/success"),
            stripe_cancel_url=os.getenv("STRIPE_CANCEL_URL", "https://mast.example.com/billing/cancel"),
        )