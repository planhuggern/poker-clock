import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('clock', '0004_tournament_admin'),
        ('players', '0001_initial'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='tournament',
            name='admin',
        ),
        migrations.AddField(
            model_name='tournament',
            name='host',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='hosted_tournaments',
                to='players.player',
            ),
        ),
    ]
