"""
Management command to remove all dummy and demonstration data from the system.
Truncates all application data tables while preserving Django migrations and schema.
"""

import shutil
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import connection


class Command(BaseCommand):
    help = "Removes all dummy data across all application modules."

    def add_arguments(self, parser):
        parser.add_argument(
            "--yes",
            action="store_true",
            help="Confirm deletion without interactive prompt.",
        )

    def handle(self, *args, **options):
        auto_yes = options.get("yes", False)

        if not auto_yes:
            confirm = input(
                "Are you sure you want to remove ALL dummy data from the database? (y/N): "
            )
            if confirm.lower() != "y":
                self.stdout.write(self.style.WARNING("Aborted by user."))
                return

        self.stdout.write(self.style.MIGRATE_HEADING("=== Removing All Dummy Data ==="))

        with connection.cursor() as cursor:
            excluded = {
                "django_migrations",
                "django_content_type",
                "auth_permission",
                "sqlite_sequence",
            }
            if connection.vendor == "postgresql":
                # Query all application tables excluding internal django metadata
                cursor.execute("SELECT tablename FROM pg_tables WHERE schemaname = 'public';")
                tables = [row[0] for row in cursor.fetchall() if row[0] not in excluded]

                if tables:
                    truncate_sql = f'TRUNCATE TABLE {", ".join(f"{t}" for t in tables)} CASCADE;'
                    cursor.execute(truncate_sql)
                    self.stdout.write(
                        self.style.SUCCESS(
                            f"Successfully truncated {len(tables)} application tables."
                        )
                    )
            elif connection.vendor == "sqlite":
                tables = [t for t in connection.introspection.table_names() if t not in excluded]
                if tables:
                    cursor.execute("PRAGMA foreign_keys = OFF;")
                    for t in tables:
                        cursor.execute(f'DELETE FROM "{t}";')
                    cursor.execute("PRAGMA foreign_keys = ON;")
                    self.stdout.write(
                        self.style.SUCCESS(
                            f"Successfully cleared {len(tables)} application tables."
                        )
                    )

        # Clear uploaded media files if any exist
        media_root = Path(settings.MEDIA_ROOT)
        if media_root.exists():
            for item in media_root.iterdir():
                if item.name != ".gitkeep":
                    if item.is_dir():
                        shutil.rmtree(item, ignore_errors=True)
                    else:
                        item.unlink(missing_ok=True)
            self.stdout.write(self.style.SUCCESS("Media uploads directory cleared."))

        self.stdout.write(
            self.style.SUCCESS(
                "\nAll dummy data has been successfully removed!\n"
                "The database is now 100% clean and ready for your real data."
            )
        )
