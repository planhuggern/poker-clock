# Hand-written migration: Adds Tournament model, migrates TournamentEntry to FK architecture

import django.db.models.deletion
from django.db import migrations, models


def seed_default_tournament(apps, schema_editor):
    """
    Create Tournament id=1 seeded from AppState (if it exists), then
    set tournament_id=1 on every existing TournamentEntry so the column
    can be made NOT NULL in the next step.
    """
    Tournament = apps.get_model("clock", "Tournament")
    AppState   = apps.get_model("clock", "AppState")
    TournamentEntry = apps.get_model("clock", "TournamentEntry")

    # Load legacy state from AppState singleton
    state_json = {}
    status = "pending"
    name = "Pokerturnering"
    try:
        app_state = AppState.objects.get(pk=1)
        state_json = app_state.data or {}
        t_cfg = state_json.get("tournament") or {}
        name = t_cfg.get("name") or name
        if state_json.get("running"):
            status = "running"
    except Exception:
        pass

    # Always ensure tournament 1 exists
    tournament, _ = Tournament.objects.get_or_create(
        id=1,
        defaults={"name": name, "status": status, "state_json": state_json},
    )

    # Point orphaned entries to tournament 1
    TournamentEntry.objects.filter(tournament__isnull=True).update(tournament=tournament)


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("clock", "0002_player_tournamententry"),
    ]

    operations = [
        # 1 — Create Tournament table
        migrations.CreateModel(
            name="Tournament",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(default="Pokerturnering", max_length=255)),
                ("status", models.CharField(
                    choices=[("pending", "Venter"), ("running", "Pågår"), ("finished", "Avsluttet")],
                    default="pending",
                    max_length=20,
                )),
                ("state_json", models.JSONField(default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "db_table": "clock_tournament",
                "ordering": ["-created_at"],
            },
        ),

        # 2 — Add nullable tournament FK to TournamentEntry (required before data migration)
        migrations.AddField(
            model_name="tournamententry",
            name="tournament",
            field=models.ForeignKey(
                null=True,
                blank=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="entries",
                to="clock.tournament",
            ),
        ),

        # 3 — Data migration: seed tournament 1, back-fill entries
        migrations.RunPython(seed_default_tournament, reverse_code=noop_reverse),

        # 4 — Tighten tournament FK to NOT NULL
        migrations.AlterField(
            model_name="tournamententry",
            name="tournament",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="entries",
                to="clock.tournament",
            ),
        ),

        # 5 — Change player from OneToOneField → ForeignKey
        migrations.AlterField(
            model_name="tournamententry",
            name="player",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="entries",
                to="clock.player",
            ),
        ),

        # 6 — Enforce (player, tournament) uniqueness
        migrations.AlterUniqueTogether(
            name="tournamententry",
            unique_together={("player", "tournament")},
        ),
    ]
