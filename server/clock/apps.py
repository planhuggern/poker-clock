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

        _boot()


def _boot() -> None:
    from .models import AppState
    from . import state as gs
    from .tick import start_tick_thread

    saved = AppState.load()
    gs.init_state(saved)
    start_tick_thread()
