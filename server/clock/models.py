from django.db import models


class AppState(models.Model):
    """Singleton table (always id=1) — legacy, kept for bootstrap migration only."""

    id = models.IntegerField(primary_key=True, default=1)
    data = models.JSONField()
    updated_at = models.BigIntegerField()  # Unix ms

    class Meta:
        db_table = "app_state"

    def save(self, *args, **kwargs):
        self.id = 1
        super().save(*args, **kwargs)

    @classmethod
    def load(cls) -> dict | None:
        try:
            return cls.objects.get(pk=1).data
        except cls.DoesNotExist:
            return None
        except Exception:
            return None

    @classmethod
    def persist(cls, state: dict) -> None:
        import time
        cls.objects.update_or_create(
            pk=1,
            defaults={"data": state, "updated_at": int(time.time() * 1000)},
        )


class Tournament(models.Model):
    """A poker tournament with its own clock state and player registrations."""

    STATUS_PENDING  = "pending"
    STATUS_RUNNING  = "running"   # clock started (or paused) but not finished
    STATUS_FINISHED = "finished"

    STATUS_CHOICES = [
        (STATUS_PENDING,  "Venter"),
        (STATUS_RUNNING,  "Pågår"),
        (STATUS_FINISHED, "Avsluttet"),
    ]

    name       = models.CharField(max_length=255, default="Pokerturnering")
    status     = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    # Full serialised clock state (same schema as the old AppState.data dict)
    state_json = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "clock_tournament"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.name} ({self.status})"

    def is_active(self) -> bool:
        return self.status != self.STATUS_FINISHED

    def to_dict(self) -> dict:
        t_cfg = (self.state_json or {}).get("tournament") or {}
        return {
            "id":           self.id,
            "name":         self.name,
            "status":       self.status,
            "created_at":   self.created_at.isoformat(),
            "playerCount":  self.entries.filter(is_active=True).count(),
            "buyIn":        t_cfg.get("buyIn", 0),
            "startingStack": t_cfg.get("startingStack", 0),
        }


class Player(models.Model):
    """A user who has authenticated via OAuth and has a persistent profile."""

    username  = models.CharField(max_length=255, unique=True)
    nickname  = models.CharField(max_length=64, blank=True)
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "clock_player"
        ordering = ["joined_at"]

    def __str__(self) -> str:
        return self.nickname or self.username

    def effective_nickname(self) -> str:
        return self.nickname if self.nickname.strip() else self.username

    def active_entry(self):
        """Return the TournamentEntry for the player's current non-finished tournament, or None."""
        return (
            self.entries
            .select_related("tournament")
            .filter(is_active=True, tournament__status__in=[Tournament.STATUS_PENDING, Tournament.STATUS_RUNNING])
            .first()
        )

    def is_registered_in(self, tournament) -> bool:
        return self.entries.filter(tournament=tournament, is_active=True).exists()

    def to_dict(self, tournament=None) -> dict:
        return {
            "username":   self.username,
            "nickname":   self.effective_nickname(),
            "registered": self.is_registered_in(tournament) if tournament else bool(self.active_entry()),
        }


class TournamentEntry(models.Model):
    """A player registered in a specific tournament."""

    player     = models.ForeignKey(Player,     on_delete=models.CASCADE, related_name="entries")
    tournament = models.ForeignKey(Tournament, on_delete=models.CASCADE, related_name="entries")
    joined_at  = models.DateTimeField(auto_now_add=True)
    is_active  = models.BooleanField(default=True)   # False once busted

    class Meta:
        db_table = "clock_tournament_entry"
        unique_together = [("player", "tournament")]
        ordering = ["joined_at"]

    def __str__(self) -> str:
        return f"{self.player} @ {self.tournament}"

    def to_dict(self) -> dict:
        return {
            "username":  self.player.username,
            "nickname":  self.player.effective_nickname(),
            "is_active": self.is_active,
            "joined_at": self.joined_at.isoformat(),
        }
