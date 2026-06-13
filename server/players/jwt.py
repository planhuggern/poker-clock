"""
JWT helpers for players.Player identity tokens.

Uses settings.SECRET_KEY (Django's own secret) so no extra config key is needed.
Token payload intentionally uses `player_id` (UUID string) as subject, not username,
to keep it decoupled from the legacy clock.Player auth system.

Lifetimes:
  access  - 15 minutes  (short-lived, sent with every request)
  refresh - 30 days     (long-lived, used only to obtain a new access token)

# TODO: add server-side refresh token revocation (e.g. jti blocklist in DB/cache)
#       when logout or account recovery is implemented.
"""
import time
import uuid

import jwt as pyjwt
from django.conf import settings

ACCESS_LIFETIME_S  = 15 * 60          # 15 minutes
REFRESH_LIFETIME_S = 30 * 24 * 3600   # 30 days

_ALGORITHM = "HS256"


def _secret() -> str:
    return settings.SECRET_KEY


def sign_access_token(player_id: uuid.UUID) -> str:
    now = int(time.time())
    return pyjwt.encode(
        {
            "player_id": str(player_id),
            "token_type": "access",
            "iat": now,
            "exp": now + ACCESS_LIFETIME_S,
        },
        _secret(),
        algorithm=_ALGORITHM,
    )


def sign_refresh_token(player_id: uuid.UUID) -> str:
    now = int(time.time())
    return pyjwt.encode(
        {
            "player_id": str(player_id),
            "token_type": "refresh",
            "iat": now,
            "exp": now + REFRESH_LIFETIME_S,
        },
        _secret(),
        algorithm=_ALGORITHM,
    )


def decode_token(token: str) -> dict | None:
    """Decode and verify a player JWT.  Returns payload dict or None on any error."""
    try:
        return pyjwt.decode(token, _secret(), algorithms=[_ALGORITHM])
    except Exception:
        return None
