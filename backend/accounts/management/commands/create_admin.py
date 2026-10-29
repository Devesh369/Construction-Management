"""
Management command to create the primary Organization and initial Admin user.
Initializes default chart of accounts for ledger operations.
Usage:
python manage.py create_admin --org "My Company" --name "Admin Name" --email "admin@example.com" --password "Pass@123"
Or run interactively:
python manage.py create_admin
"""

import getpass

from core.roles import Role
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from ledger.services import create_default_chart_of_accounts

from accounts.models import Organization, User


class Command(BaseCommand):
    help = "Creates the primary organization and initial Super/Org Admin user."

    def add_arguments(self, parser):
        parser.add_argument("--org", type=str, help="Organization / Company Name")
        parser.add_argument("--name", type=str, help="Admin Full Name")
        parser.add_argument("--email", type=str, help="Admin Work Email")
        parser.add_argument("--password", type=str, help="Admin Password")

    def handle(self, *args, **options):
        org_name = options.get("org")
        name = options.get("name")
        email = options.get("email")
        password = options.get("password")

        # Interactive prompts if not passed via CLI flags
        if not org_name:
            org_name = input(
                "Enter Organization / Company Name (default: 'BuildSphere Construction'): "
            ).strip()
            if not org_name:
                org_name = "BuildSphere Construction"

        if not name:
            name = input("Enter Admin Full Name: ").strip()
            while not name:
                self.stdout.write(self.style.ERROR("Full Name is required."))
                name = input("Enter Admin Full Name: ").strip()

        if not email:
            email = input("Enter Admin Email: ").strip()
            while not email:
                self.stdout.write(self.style.ERROR("Email is required."))
                email = input("Enter Admin Email: ").strip()

        email = email.lower().strip()

        if not password:
            password = getpass.getpass("Enter Admin Password (min 6 chars): ").strip()
            while len(password) < 6:
                self.stdout.write(self.style.ERROR("Password must be at least 6 characters long."))
                password = getpass.getpass("Enter Admin Password (min 6 chars): ").strip()

        try:
            with transaction.atomic():
                # 1. Create Organization or get existing
                org, created = Organization.objects.get_or_create(
                    name=org_name,
                    defaults={
                        "contact_email": email,
                        "currency": "INR",
                    },
                )
                if created:
                    self.stdout.write(self.style.SUCCESS(f"Organization '{org.name}' created."))
                    # 2. Seed default chart of accounts
                    create_default_chart_of_accounts(org)
                    self.stdout.write(
                        self.style.SUCCESS(
                            "Default financial chart of accounts initialized (13 accounts)."
                        )
                    )
                else:
                    self.stdout.write(
                        self.style.WARNING(f"Using existing organization '{org.name}'.")
                    )

                # 3. Create or update Admin user
                user = User.objects.filter(email=email).first()
                if user:
                    user.organization = org
                    user.name = name
                    user.role = Role.ORG_ADMIN
                    user.is_staff = True
                    user.is_active = True
                    user.set_password(password)
                    user.save()
                    self.stdout.write(
                        self.style.SUCCESS(f"Updated existing user '{email}' as ORG_ADMIN.")
                    )
                else:
                    user = User.objects.create_user(
                        email=email,
                        password=password,
                        name=name,
                        organization=org,
                        role=Role.ORG_ADMIN,
                        is_staff=True,
                        is_active=True,
                    )
                    self.stdout.write(
                        self.style.SUCCESS(f"Admin user '{email}' created successfully.")
                    )

            self.stdout.write(
                self.style.SUCCESS(
                    "\n========================================\n"
                    "ADMIN SETUP COMPLETE!\n"
                    "========================================\n"
                    f"Organization: {org.name}\n"
                    f"Name:         {user.name}\n"
                    f"Email:        {user.email}\n"
                    f"Role:         {user.role} (Super / Org Admin)\n"
                    "========================================\n"
                    "You can now log in at http://localhost:3000\n"
                )
            )
        except Exception as exc:
            raise CommandError(f"Failed to create admin: {str(exc)}")
