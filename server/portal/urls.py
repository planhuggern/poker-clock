"""
URL-konfigurasjon for portalen.

Slik legger du til en ny app:
  1. Legg til Django-appen i INSTALLED_APPS i settings.py
  2. Kall register_spa() her: *register_spa("min-app", "min_app.urls")
  3. Bygg React til server/public/min-app/  (VITE_BASE_PATH=/min-app/)

register_spa(base, api_module) gir:
  - /  <base>/auth/...  →  API (views i api_module)
  - /  <base>/ws/...    →  WebSocket (håndteres av ASGI-lagret, ikke Django URL)
  - /  <base>/*         →  React SPA (server/public/<base>/index.html)
"""
from pathlib import Path

from django.conf import settings
from django.http import FileResponse, HttpRequest, HttpResponse
from django.urls import include, path, re_path


def _spa_view(app_name: str):
    """Returnerer en Django-view som server index.html for en gitt SPA-app."""
    def view(request: HttpRequest) -> HttpResponse:
        index = Path(settings.BASE_DIR) / "public" / app_name / "index.html"
        if index.exists():
            return FileResponse(open(index, "rb"), content_type="text/html")
        return HttpResponse(f"SPA not found: public/{app_name}/index.html", status=404)
    view.__name__ = f"spa__{app_name.replace('-', '_')}"
    return view


def register_spa(base: str, api_module: str) -> list:
    """
    Registrer en fullstack-app under /<base>/.

    base        – URL-prefix (uten slash), f.eks. "poker-clock"
    api_module  – Python-module-path til appens urls.py, f.eks. "clock.urls"

    Returnerer en liste over URL-mønstre klar til å brettes inn i urlpatterns.
    """
    spa = _spa_view(base)
    return [
        # API-ruter fra appen (auth, admin-endepunkter o.l.)
        path(f"{base}/", include(api_module)),
        # SPA catch-all: alt annet under /<base>/ som ikke er /auth/ eller /ws/
        re_path(rf"^{base}/(?!auth/|ws/).*$", spa),
        # Uten trailing slash (browser kan be om /poker-clock uten slash)
        re_path(rf"^{base}$", spa),
    ]


# BASE_PATH fra settings (satt via BASE_PATH-env eller config["basePath"]).
# Matcher Traefik-regelen og VITE_BASE_PATH i frontend.
_base = settings.BASE_PATH.strip("/")

if _base:
    # Prod / sub-path hosting: poker-clock montert under /<base>/
    urlpatterns = [
        *register_spa(_base, "clock.urls"),
        # Slik legger du til neste app:
        # *register_spa("min-app", "min_app.urls"),
    ]
else:
    # Dev / root hosting: clock-API tilgjengelig uten prefix (React kjører på :8081)
    from clock.urls import urlpatterns as _clock_urls  # noqa: E402
    urlpatterns = list(_clock_urls)
