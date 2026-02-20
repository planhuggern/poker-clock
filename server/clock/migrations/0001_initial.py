from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="AppState",
            fields=[
                ("id", models.IntegerField(default=1, primary_key=True, serialize=False)),
                ("data", models.JSONField()),
                ("updated_at", models.BigIntegerField()),
            ],
            options={
                "db_table": "app_state",
            },
        ),
    ]
