"""
Auth views:
  GET  /auth/dev?role=admin      → dev-only quick auth (DEBUG=True only)
"""
import time

import jwt as pyjwt
from django.conf import settings
from django.http import HttpRequest, HttpResponse, HttpResponseRedirect
from django.views import View


# ── Helpers ───────────────────────────────────────────────────────────────────

def _sign_token(username: str, role: str) -> str:
    secret = settings.CONFIG.get("jwtSecret", "")
    now = int(time.time())
    return pyjwt.encode(
        {"username": username, "role": role, "iat": now, "exp": now + 12 * 3600},
        secret,
        algorithm="HS256",
    )


def _client_redirect_base() -> str:
    cfg = settings.CONFIG
    base_path = settings.BASE_PATH
    client_origin = cfg.get("clientOrigin", "") or ""
    server_origin = cfg.get("serverOrigin", "") or ""
    same_origin = client_origin and server_origin and client_origin == server_origin
    origin = "" if same_origin else client_origin.rstrip("/")
    return f"{origin}{base_path}"


# ── Views ─────────────────────────────────────────────────────────────────────

class DevAuthView(View):
    """Quick auth without Google — only available when DEBUG=True."""

    def get(self, request: HttpRequest) -> HttpResponse:
        if not settings.DEBUG:
            return HttpResponse("Kun tilgjengelig i DEBUG-modus.", status=403)

        role = "admin" if request.GET.get("role") == "admin" else "viewer"
        username = request.GET.get("user", "dev-user")
        token = _sign_token(username, role)
        base = _client_redirect_base()
        return HttpResponseRedirect(
            f"{base}/callback?token={token}&role={role}"
        )
