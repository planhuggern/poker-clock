"""
Auth views:
  GET  /auth/google              → redirect to Google OAuth
  GET  /auth/google/callback     → exchange code, sign JWT, redirect to client
  GET  /auth/dev?role=admin      → dev-only quick auth (DEBUG=True only)
"""
import time
from urllib.parse import urlencode

import jwt as pyjwt
import requests
from django.conf import settings
from django.http import HttpRequest, HttpResponse, HttpResponseRedirect
from django.views import View


# ── Helpers ───────────────────────────────────────────────────────────────────

def _sign_token(username: str, role: str) -> str:
    secret = settings.CONFIG.get("jwtSecret", "")
    return pyjwt.encode(
        {"username": username, "role": role, "iat": int(time.time()), "exp": int(time.time()) + 12 * 3600},
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


def _role_for_email(email: str) -> str:
    admins = [e.lower() for e in settings.CONFIG.get("adminEmails", [])]
    return "admin" if email.lower() in admins else "viewer"


def _google_config() -> dict:
    return settings.CONFIG.get("google", {})


def _google_enabled() -> bool:
    g = _google_config()
    return bool(g.get("clientID") and g.get("clientSecret") and g.get("callbackURL"))


# ── Views ─────────────────────────────────────────────────────────────────────

class GoogleLoginView(View):
    def get(self, request: HttpRequest) -> HttpResponse:
        if not _google_enabled():
            return HttpResponse("Google OAuth er ikke konfigurert.", status=501)

        g = _google_config()
        params = urlencode(
            {
                "client_id": g["clientID"],
                "redirect_uri": g["callbackURL"],
                "response_type": "code",
                "scope": "openid email profile",
                "prompt": "select_account",
            }
        )
        return HttpResponseRedirect(
            f"https://accounts.google.com/o/oauth2/v2/auth?{params}"
        )


class GoogleCallbackView(View):
    def get(self, request: HttpRequest) -> HttpResponse:
        if not _google_enabled():
            return HttpResponse("Google OAuth er ikke konfigurert.", status=501)

        code = request.GET.get("code")
        if not code:
            return HttpResponseRedirect(f"{_client_redirect_base()}/?login=fail")

        g = _google_config()

        # Exchange code for tokens
        try:
            token_resp = requests.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "code": code,
                    "client_id": g["clientID"],
                    "client_secret": g["clientSecret"],
                    "redirect_uri": g["callbackURL"],
                    "grant_type": "authorization_code",
                },
                timeout=10,
            )
            token_resp.raise_for_status()
            access_token = token_resp.json()["access_token"]
        except Exception as exc:
            print(f"[auth] token exchange failed: {exc}")
            return HttpResponseRedirect(f"{_client_redirect_base()}/?login=fail")

        # Fetch user info
        try:
            user_resp = requests.get(
                "https://www.googleapis.com/oauth2/v2/userinfo",
                headers={"Authorization": f"Bearer {access_token}"},
                timeout=10,
            )
            user_resp.raise_for_status()
            email = user_resp.json().get("email", "").lower()
        except Exception as exc:
            print(f"[auth] userinfo failed: {exc}")
            return HttpResponseRedirect(f"{_client_redirect_base()}/?login=fail")

        role = _role_for_email(email)
        token = _sign_token(email or "google-user", role)
        base = _client_redirect_base()
        return HttpResponseRedirect(
            f"{base}/callback?token={token}&role={role}"
        )


class DevAuthView(View):
    """Quick auth without Google — only available when DEBUG=True."""

    def get(self, request: HttpRequest) -> HttpResponse:
        if not settings.DEBUG:
            return HttpResponse("Kun tilgjengelig i DEBUG-modus.", status=403)

        role = "admin" if request.GET.get("role") == "admin" else "viewer"
        username = request.GET.get("user", "dev-user")
        token = _sign_token(username, role)
        base_path = settings.BASE_PATH
        return HttpResponseRedirect(
            f"{base_path}/callback?token={token}&role={role}"
        )
