import asyncio
import time
from typing import Generic, TypeVar

T = TypeVar("T")


class TTLPool(Generic[T]):
    """Per-key cache with expiry and a lock per key, so concurrent requests
    for a cold key don't trigger duplicate upstream calls."""

    def __init__(self, ttl_seconds: float):
        self.ttl = ttl_seconds
        self._store: dict[str, tuple[T, float]] = {}
        self._locks: dict[str, asyncio.Lock] = {}

    def lock_for(self, key: str) -> asyncio.Lock:
        if key not in self._locks:
            self._locks[key] = asyncio.Lock()
        return self._locks[key]

    def get(self, key: str) -> T | None:
        entry = self._store.get(key)
        if entry is None:
            return None
        value, expires_at = entry
        if time.time() > expires_at:
            del self._store[key]
            return None
        return value

    def set(self, key: str, value: T) -> None:
        self._store[key] = (value, time.time() + self.ttl)
