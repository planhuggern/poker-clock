import uuid
from django.db import models


class Player(models.Model):
    """
    Identity record for a player — guest or future authenticated user.

    Uses a UUID primary key so records are safe to expose in tokens/URLs
    without leaking sequential IDs.  The is_guest flag and last_seen_at
    field are the hooks for future guest-auth and session-recovery flows.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    display_name = models.CharField(max_length=100)
    is_guest = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_seen_at = models.DateTimeField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "players_player"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.display_name
