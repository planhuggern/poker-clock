from django.urls import re_path
from .consumers import ClockConsumer

websocket_urlpatterns = [
    re_path(r"^(?:.+/)?ws/clock/$", ClockConsumer.as_asgi()),
]
