from __future__ import annotations

from dataclasses import dataclass
from threading import Lock
from time import monotonic
from typing import Callable

from fastapi import Request


@dataclass(frozen=True)
class QuotaDecision:
    allowed: bool
    used: int
    limit: int | None
    retry_after_seconds: int


class ChatQuotaCounter:
    def __init__(
        self,
        window_seconds: int,
        clock: Callable[[], float] = monotonic,
    ) -> None:
        if window_seconds <= 0:
            raise ValueError("Quota window must be positive")
        self._window_seconds = window_seconds
        self._clock = clock
        self._lock = Lock()
        self._windows: dict[str, tuple[int, float]] = {}

    def consume(self, user_id: str, limit: int | None) -> QuotaDecision:
        if limit is not None and limit <= 0:
            raise ValueError("Quota limit must be positive when configured")

        now = self._clock()
        with self._lock:
            used, reset_at = self._windows.get(user_id, (0, now + self._window_seconds))
            if now >= reset_at:
                used = 0
                reset_at = now + self._window_seconds

            retry_after = max(1, int(reset_at - now + 0.999))
            if limit is not None and used >= limit:
                self._windows[user_id] = (used, reset_at)
                return QuotaDecision(False, used, limit, retry_after)

            used += 1
            self._windows[user_id] = (used, reset_at)
            return QuotaDecision(True, used, limit, retry_after)


def get_chat_quota_counter(request: Request) -> ChatQuotaCounter:
    return request.app.state.chat_quota_counter