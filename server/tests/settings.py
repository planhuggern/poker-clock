"""
Minimal Django settings used only during testing.
State-module tests don't touch the DB, so we use an in-memory SQLite.
"""
SECRET_KEY = "test-secret-key"
DEBUG = True
INSTALLED_APPS = [
    "django.contrib.contenttypes",
    "django.contrib.auth",
    "channels",
    "clock",
]
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    }
}
CHANNEL_LAYERS = {"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}
BASE_PATH = ""
USE_TZ = True
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
ROOT_URLCONF = "clock.urls"

# Mimics the real config.json structure so auth helpers work during tests
CONFIG: dict = {
    "jwtSecret": "test-jwt-secret",
    "adminEmails": ["admin@example.com"],
}
