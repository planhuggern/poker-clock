from django.apps import AppConfig


class ClockConfig(AppConfig):
    name = "clock"
    default_auto_field = "django.db.models.BigAutoField"

    def ready(self) -> None:
        import os
        import sys
        argv = sys.argv

        # Skip during management commands that don't run the server
        _skip = {"migrate", "makemigrations", "test", "shell", "check", "collectstatic", "showmigrations"}
        if len(argv) > 1 and argv[1] in _skip:
            return

        # Under 'manage.py runserver' Django forks a reloader child with RUN_MAIN=true;
        # only boot there to avoid double init.
        if "runserver" in argv and os.environ.get("RUN_MAIN") != "true":
            return

        from django.db.models.signals import post_migrate
        
        def _on_post_migrate(sender, **kwargs):
            try:
                _boot()
            except Exception as exc:
                print(f"[boot] skipping state init: {exc}")
        post_migrate.connect(_on_post_migrate, sender=self)


def _boot() -> None:
    from .models import Tournament
    from . import state as gs
    from .tick import start_tick_thread

    try:
        # Ensure at least one tournament exists
        if not Tournament.objects.exists():
            # Try to seed from the legacy AppState singleton
            from .models import AppState
            saved = AppState.load()
            Tournament.objects.create(
                id=1,
                name=(saved or {}).get("tournament", {}).get("name", "Pokerturnering"),
                status=Tournament.STATUS_RUNNING if (saved or {}).get("running") else Tournament.STATUS_PENDING,
                state_json=saved or {},
            )

        # Load every non-finished tournament into memory and start tick threads
        active = Tournament.objects.exclude(status=Tournament.STATUS_FINISHED)
        for t in active:
            gs.init_state(t.state_json or None, tournament_id=t.id)
            start_tick_thread(tournament_id=t.id)
    except Exception as exc:
        # DB may not be ready yet (e.g. first migrate run or test collection)
        print(f"[boot] skipping state init: {exc}")
