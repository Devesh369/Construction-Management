from datetime import datetime

from attendance.services import close_day_attendance
from django.core.management.base import BaseCommand, CommandError
from projects.models import Project


class Command(BaseCommand):
    help = "Close attendance for the specified date and mark active workers with no record as HOLIDAY or ABSENT."

    def add_arguments(self, parser):
        parser.add_argument("--date", type=str, required=True, help="Date in YYYY-MM-DD format")
        parser.add_argument("--project", type=int, required=False, help="Optional Project ID")

    def handle(self, *args, **options):
        date_str = options["date"]
        try:
            target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        except ValueError:
            raise CommandError("Invalid date format. Use YYYY-MM-DD.")

        project_id = options.get("project")
        if project_id:
            projects = Project.objects.filter(id=project_id, deleted_at__isnull=True)
            if not projects.exists():
                raise CommandError(f"Project with ID {project_id} not found.")
        else:
            projects = Project.objects.filter(deleted_at__isnull=True)

        total_closed = 0
        total_holidays = 0
        total_absents = 0

        for proj in projects:
            res = close_day_attendance(
                user=None,
                org=proj.organization,
                project_id=proj.id,
                date_val=target_date,
            )
            total_closed += res["closed_records"]
            total_holidays += res["holidays"]
            total_absents += res["absents"]

        self.stdout.write(
            self.style.SUCCESS(
                f"Mark absent completed for {target_date}: {total_closed} records processed "
                f"({total_holidays} holidays, {total_absents} absents)."
            )
        )
