"""
Django settings for poker-clock.
Reads config.json (same format as the old Node server).
"""
import json
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent


# ── Config ────────────────────────────────────────────────────────────────────

def _load_config() -> dict:
    for name in ("config.json", "config.example.json"):
        p = BASE_DIR / name
        if p.exists():
            return json.loads(p.read_text())
    return {}


CONFIG: dict = _load_config()


def _normalize_base_path(value: str) -> str:
    base = str(value or "").strip()
    if not base:
        return ""
    if not base.startswith("/"):
        base = f"/{base}"
    if len(base) > 1 and base.endswith("/"):
        base = base[:-1]
    return base


BASE_PATH: str = _normalize_base_path(
    os.environ.get("BASE_PATH") or CONFIG.get("basePath", "")
)

# ── Core ──────────────────────────────────────────────────────────────────────

SECRET_KEY = CONFIG.get("jwtSecret", "change-me-in-config-json")
DEBUG = os.environ.get("DEBUG", "false").lower() == "true"
ALLOWED_HOSTS = ["*"]

INSTALLED_APPS = [
    "daphne",                          # must be first for ASGI
    "django.contrib.contenttypes",
    "django.contrib.staticfiles",
    "corsheaders",
    "channels",
    "clock.apps.ClockConfig",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
]

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
            ]
        },
    }
]

ROOT_URLCONF = "poker_clock.urls"
ASGI_APPLICATION = "poker_clock.asgi.application"

# ── Database ──────────────────────────────────────────────────────────────────

_sqlite_file = os.environ.get("SQLITE_FILE") or CONFIG.get("sqlite_file", "./data/pokerclock.sqlite")
# Resolve relative path against BASE_DIR
_sqlite_path = Path(_sqlite_file)
if not _sqlite_path.is_absolute():
    _sqlite_path = BASE_DIR / _sqlite_path

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": _sqlite_path,
    }
}

# ── Channels ──────────────────────────────────────────────────────────────────

CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels.layers.InMemoryChannelLayer",
    }
}

# ── CORS ──────────────────────────────────────────────────────────────────────

if DEBUG:
    CORS_ALLOW_ALL_ORIGINS = True
else:
    _client_origin = CONFIG.get("clientOrigin", "")
    CORS_ALLOWED_ORIGINS = [_client_origin] if _client_origin else []
CORS_ALLOW_CREDENTIALS = True

# ── Static files (WhiteNoise serves React SPA in production) ─────────────────

STATIC_URL = f"{BASE_PATH}/static/" if BASE_PATH else "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"

# React build output: server/public/
WHITENOISE_ROOT = BASE_DIR / "public"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
