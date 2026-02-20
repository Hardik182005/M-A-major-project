"""Simple in-memory rate limiter for auth endpoints."""
import time
from collections import defaultdict
from fastapi import HTTPException, Request

from app.config import settings


# key → list of timestamps
_attempts: dict[str, list[float]] = defaultdict(list)


def check_rate_limit(request: Request, key_suffix: str = ""):
    """
    Raises 429 if the client IP exceeds the rate limit for auth endpoints.
    Call at the start of login/register endpoints.
    """
    ip = request.client.host if request.client else "unknown"
    key = f"{ip}:{key_suffix}"
    now = time.time()
    window = settings.LOGIN_RATE_LIMIT_WINDOW
    max_attempts = settings.LOGIN_RATE_LIMIT_MAX

    # clean old entries
    _attempts[key] = [t for t in _attempts[key] if now - t < window]

    if len(_attempts[key]) >= max_attempts:
        raise HTTPException(
            status_code=429,
            detail=f"Too many attempts. Try again in {window // 60} minutes.",
        )

    _attempts[key].append(now)
