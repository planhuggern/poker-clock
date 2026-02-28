"""
Django settings – portal (nøytral project-container).

Leser config.json for all konfigurasjon. Legg til en ny app i INSTALLED_APPS
og registrer den i urls.py med register_spa().
"""
import json
import os
from pathlib import Path
from urllib.parse import urlparse

BASE_DIR = Path(__file__).resolve().parent.parent


# ── Config ────────────────────────────────────────────────────────────────────

def _load_config() -> dict:
    for name in ("config.json", "config.example.json"):
        p = BASE_DIR / name
        if p.exists():
            return json.loads(p.read_text())
    return {}


CONFIG: dict = _load_config()


# ── Core ──────────────────────────────────────────────────────────────────────

# Separat fra jwtSecret — bruk config["djangoSecret"] eller generer en sterk
# random streng (python -c "import secrets; print(secrets.token_hex(50))")
SECRET_KEY = CONFIG.get("djangoSecret") or CONFIG.get("jwtSecret", "change-me-in-config-json")

DEBUG = os.environ.get("DEBUG", "false").lower() == "true"

# Base path for poker-clock-appen: sett via BASE_PATH-env eller config["basePath"].
# Må matche register_spa() i urls.py og Traefik-regelen.
# Eks: "/poker-clock" (ingen trailing slash)
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

# Utled ALLOWED_HOSTS fra serverOrigin + clientOrigin i config, med fallback til *
def _allowed_hosts() -> list[str]:
    if DEBUG:
        return ["*"]
    hosts = set()
    for key in ("serverOrigin", "clientOrigin"):
        origin = CONFIG.get(key, "")
        if origin:
            h = urlparse(origin).hostname
            if h:
                hosts.add(h)
    return list(hosts) or ["*"]


ALLOWED_HOSTS: list[str] = _allowed_hosts()

INSTALLED_APPS = [
    "daphne",                           # må ligge først for ASGI
    "django.contrib.contenttypes",
    "django.contrib.staticfiles",
    "corsheaders",
    "channels",
    # ── Apper ──
    "clock.apps.ClockConfig",           # poker-clock
    # "my_other_app.apps.MyOtherAppConfig",
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

ROOT_URLCONF = "portal.urls"
ASGI_APPLICATION = "portal.asgi.application"


# ── Database ──────────────────────────────────────────────────────────────────

_sqlite_file = os.environ.get("SQLITE_FILE") or CONFIG.get("sqlite_file", "./data/pokerclock.sqlite")
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


# ── Static files (WhiteNoise) ─────────────────────────────────────────────────
#
# Hver app bygger sin React-SPA til server/public/<app-name>/:
#   poker-clock  → server/public/poker-clock/index.html
#   my-other-app → server/public/my-other-app/index.html
#
# WhiteNoise serverer alt i public/ som statiske filer direkte.

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"
WHITENOISE_ROOT = BASE_DIR / "public"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
