from django.urls import re_path
from .consumers import ClockConsumer

websocket_urlpatterns = [
    # Per-tournament WebSocket (preferred)
    re_path(r"^(?:.+/)?ws/clock/(?P<tournament_id>[0-9]+)/$", ClockConsumer.as_asgi()),
    # Legacy fallback → tournament 1
    re_path(r"^(?:.+/)?ws/clock/$", ClockConsumer.as_asgi()),
]
