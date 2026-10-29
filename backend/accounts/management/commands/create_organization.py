"""
Management command to create a new tenant organization and invite the first ORG_ADMIN.
Usage:
python manage.py create_organization --name "Alpha Constructions" --admin-email admin@alpha.test
"""

from django.core.management.base import BaseCommand, CommandError

from accounts.services import create_organization


class Command(BaseCommand):
    help = (
        "Creates a tenant organization, default chart of accounts, and first ORG_ADMIN invitation."
    )

    def add_arguments(self, parser):
        parser.add_argument("--name", type=str, required=True, help="Organization name")
        parser.add_argument(
            "--admin-email", type=str, required=True, help="Email address of the initial ORG_ADMIN"
        )

    def handle(self, *args, **options):
        name = options["name"].strip()
        admin_email = options["admin_email"].strip()

        try:
            org, invitation, raw_token = create_organization(name=name, admin_email=admin_email)
            self.stdout.write(
                self.style.SUCCESS(
                    f"Organization '{org.name}' (ID: {org.id}) created successfully."
                )
            )
            self.stdout.write(
                self.style.SUCCESS("Default chart of accounts initialized (13 accounts).")
            )
            self.stdout.write(
                self.style.SUCCESS(
                    f"Invitation created for '{invitation.email}' (Role: {invitation.role})."
                )
            )
            self.stdout.write(self.style.WARNING(f"Invitation token: {raw_token}"))
        except Exception as exc:
            raise CommandError(f"Failed to create organization: {str(exc)}")
