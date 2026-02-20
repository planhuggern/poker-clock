"""
Main URL configuration.

All routes are prefixed with BASE_PATH (e.g. "" or "pokerklokke").
The React SPA is served via WhiteNoise from server/public/ in production.
"""
import os
from pathlib import Path

from django.conf import settings
from django.http import FileResponse, HttpRequest, HttpResponse
from django.urls import include, path, re_path
from django.views.static import serve


def _spa_index(request: HttpRequest) -> HttpResponse:
    index = Path(settings.BASE_DIR) / "public" / "index.html"
    if index.exists():
        return FileResponse(open(index, "rb"), content_type="text/html")
    return HttpResponse("Not found", status=404)


def _build_patterns():
    from clock.urls import urlpatterns as clock_urls

    base = settings.BASE_PATH.lstrip("/")  # e.g. "" or "pokerklokke"

    prefix = f"{base}/" if base else ""

    patterns = [
        path(f"{prefix}", include(clock_urls)),
    ]

    # Serve React SPA + static assets in production
    if os.environ.get("DJANGO_SERVE_SPA", "true").lower() == "true":
        public_dir = Path(settings.BASE_DIR) / "public"
        if public_dir.exists():
            # Static assets (JS, CSS, sounds, etc.)
            static_prefix = f"{prefix}".rstrip("/")
            patterns += [
                # SPA catch-all (don't catch /auth or /ws)
                re_path(
                    rf"^{prefix}(?!auth|ws/).*$",
                    _spa_index,
                ),
            ]

    return patterns


urlpatterns = _build_patterns()
