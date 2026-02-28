from django.db import models


class AppState(models.Model):
    """Singleton table (always id=1) storing the full clock state as JSON."""

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
            # Table doesn't exist yet (e.g. first migrate run)
            return None

    @classmethod
    def persist(cls, state: dict) -> None:
        import time
        cls.objects.update_or_create(
            pk=1,
            defaults={"data": state, "updated_at": int(time.time() * 1000)},
        )


class Player(models.Model):
    """A user who has authenticated via OAuth and has a persistent profile."""

    username = models.CharField(max_length=255, unique=True)
    nickname = models.CharField(max_length=64, blank=True)
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "clock_player"
        ordering = ["joined_at"]

    def __str__(self) -> str:
        return self.nickname or self.username

    def effective_nickname(self) -> str:
        return self.nickname if self.nickname.strip() else self.username

    def is_registered(self) -> bool:
        try:
            return self.entries.is_active
        except Exception:
            return False

    def to_dict(self) -> dict:
        return {
            "username": self.username,
            "nickname": self.effective_nickname(),
            "registered": self.is_registered(),
        }


class TournamentEntry(models.Model):
    """Tracks which players are registered in the current tournament."""

    player = models.OneToOneField(Player, on_delete=models.CASCADE, related_name="entries")
    joined_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)  # False once busted

    class Meta:
        db_table = "clock_tournament_entry"
        ordering = ["joined_at"]

    def to_dict(self) -> dict:
        return {
            "username": self.player.username,
            "nickname": self.player.effective_nickname(),
            "is_active": self.is_active,
            "joined_at": self.joined_at.isoformat(),
        }
