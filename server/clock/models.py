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
