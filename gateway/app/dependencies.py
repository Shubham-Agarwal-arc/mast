from fastapi import Request

from gateway.app.config import Settings


def get_settings(request: Request) -> Settings:
    return request.app.state.settings