"""
ASGI-konfigurasjon for portalen.

For å legge til WebSocket-støtte i en ny app:
  1. Lag routing.py i den nye Django-appen med websocket_urlpatterns
  2. Importer og legg til her: *new_app_ws_patterns
"""
import os

import django
from channels.routing import ProtocolTypeRouter, URLRouter
from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "portal.settings")
django.setup()

# Importer etter django.setup()
from clock.routing import websocket_urlpatterns as clock_ws  # noqa: E402
# from my_other_app.routing import websocket_urlpatterns as other_ws  # noqa: E402

websocket_urlpatterns = [
    *clock_ws,
    # *other_ws,
]

application = ProtocolTypeRouter(
    {
        "http": get_asgi_application(),
        "websocket": URLRouter(websocket_urlpatterns),
    }
)
