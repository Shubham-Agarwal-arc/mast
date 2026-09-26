from fastapi import FastAPI

from gateway.app.auth import router as auth_router
from gateway.app.chat import router as chat_router
from gateway.app.config import Settings
from gateway.app.logging_config import configure_logging
from gateway.app.middleware import RequestLoggingMiddleware


def create_app(settings: Settings | None = None) -> FastAPI:
    configure_logging()
    app = FastAPI(title="MAST Gateway", version="0.1.0")
    app.state.settings = settings or Settings.from_env()
    app.add_middleware(RequestLoggingMiddleware)
    app.include_router(auth_router)
    app.include_router(chat_router)

    @app.get("/v1/health", tags=["health"])
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()