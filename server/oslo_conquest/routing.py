from django.urls import re_path

from .consumers import OsloConquestConsumer

websocket_urlpatterns = [
    re_path(r"^(?:.+/)?ws/oslo-conquest/$", OsloConquestConsumer.as_asgi()),
]
