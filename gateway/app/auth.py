from datetime import UTC, datetime
from uuid import UUID, uuid4

import httpx
import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session as OrmSession

from gateway.app.config import Settings
from gateway.app.dependencies import get_settings
from gateway.db.database import get_db
from gateway.db.models import User


router = APIRouter(prefix="/v1/auth", tags=["auth"])
bearer_scheme = HTTPBearer(auto_error=False)


class GitHubTokenRequest(BaseModel):
    access_token: str = Field(min_length=1, max_length=4096)


class RefreshTokenRequest(BaseModel):
    refresh_token: str = Field(min_length=1, max_length=8192)


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class UserIdentity(BaseModel):
    id: UUID
    auth_provider: str
    external_id: str
    plan_tier: str


def _unauthorized() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or missing authentication credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )


def _decode_token(token: str, settings: Settings, expected_type: str) -> dict[str, object]:
    try:
        claims = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=["HS256"],
            issuer=settings.jwt_issuer,
            options={"require": ["exp", "iat", "iss", "sub", "token_type"]},
        )
    except jwt.InvalidTokenError as exc:
        raise _unauthorized() from exc
    if claims.get("token_type") != expected_type:
        raise _unauthorized()
    return claims


def _create_token(user_id: UUID, settings: Settings, token_type: str, lifetime: int) -> str:
    issued_at = int(datetime.now(UTC).timestamp())
    claims = {
        "sub": str(user_id),
        "iss": settings.jwt_issuer,
        "iat": issued_at,
        "exp": issued_at + lifetime,
        "token_type": token_type,
        "jti": str(uuid4()),
    }
    return jwt.encode(claims, settings.jwt_secret, algorithm="HS256")


def create_token_pair(user_id: UUID, settings: Settings) -> TokenPair:
    return TokenPair(
        access_token=_create_token(user_id, settings, "access", settings.access_token_ttl_seconds),
        refresh_token=_create_token(user_id, settings, "refresh", settings.refresh_token_ttl_seconds),
        expires_in=settings.access_token_ttl_seconds,
    )


def verify_github_access_token(access_token: str, settings: Settings) -> tuple[str, str]:
    try:
        with httpx.Client(timeout=10.0) as client:
            response = client.get(
                f"{settings.github_api_base_url}/user",
                headers={
                    "Accept": "application/vnd.github+json",
                    "Authorization": f"Bearer {access_token}",
                    "X-GitHub-Api-Version": "2022-11-28",
                },
            )
    except httpx.RequestError as exc:
        raise HTTPException(status_code=503, detail="GitHub identity service is unavailable") from exc

    if response.status_code == 401 or response.status_code == 403:
        raise _unauthorized()
    if response.status_code != 200:
        raise HTTPException(status_code=502, detail="GitHub identity verification failed")

    try:
        github_user = response.json()
    except ValueError as exc:
        raise HTTPException(status_code=502, detail="GitHub returned an invalid identity response") from exc

    github_id = github_user.get("id") if isinstance(github_user, dict) else None
    login = github_user.get("login") if isinstance(github_user, dict) else None
    if not isinstance(github_id, (int, str)) or isinstance(github_id, bool) or not login:
        raise HTTPException(status_code=502, detail="GitHub returned an incomplete identity response")
    return str(github_id), str(login)


def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: OrmSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> User:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise _unauthorized()

    claims = _decode_token(credentials.credentials, settings, "access")
    try:
        user_id = UUID(str(claims["sub"]))
    except (KeyError, ValueError) as exc:
        raise _unauthorized() from exc

    user = db.get(User, user_id)
    if user is None:
        raise _unauthorized()
    request.state.user_id = str(user.id)
    return user


@router.post("/github", response_model=TokenPair)
def exchange_github_token(
    payload: GitHubTokenRequest,
    db: OrmSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> TokenPair:
    external_id, _login = verify_github_access_token(payload.access_token, settings)
    user = db.scalar(
        select(User).where(User.auth_provider == "github", User.external_id == external_id)
    )
    if user is None:
        user = User(auth_provider="github", external_id=external_id, plan_tier="free")
        db.add(user)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            user = db.scalar(
                select(User).where(User.auth_provider == "github", User.external_id == external_id)
            )
            if user is None:
                raise

    return create_token_pair(user.id, settings)


@router.post("/refresh", response_model=TokenPair)
def refresh_tokens(
    payload: RefreshTokenRequest,
    db: OrmSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> TokenPair:
    claims = _decode_token(payload.refresh_token, settings, "refresh")
    try:
        user_id = UUID(str(claims["sub"]))
    except (KeyError, ValueError) as exc:
        raise _unauthorized() from exc

    if db.get(User, user_id) is None:
        raise _unauthorized()
    return create_token_pair(user_id, settings)


@router.get("/me", response_model=UserIdentity)
def get_identity(user: User = Depends(get_current_user)) -> UserIdentity:
    return UserIdentity(
        id=user.id,
        auth_provider=user.auth_provider,
        external_id=user.external_id,
        plan_tier=user.plan_tier,
    )