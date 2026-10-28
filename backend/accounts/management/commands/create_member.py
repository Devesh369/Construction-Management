"""
Management command to create additional team members with specific roles:
- ORG_ADMIN
- PROJECT_MANAGER
- SITE_ENGINEER
- SUPERVISOR
- ACCOUNTANT
Usage:
python manage.py create_member --email "user@example.com" --name "User Name" --role PROJECT_MANAGER --password "Pass@123"
Or run interactively:
python manage.py create_member
"""

import getpass

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from accounts.models import Organization, User
from core.roles import Role

VALID_ROLES = [r.value for r in Role]


class Command(BaseCommand):
    help = "Creates a team member user with a specific role."

    def add_arguments(self, parser):
        parser.add_argument("--email", type=str, help="User Work Email")
        parser.add_argument("--name", type=str, help="User Full Name")
        parser.add_argument("--role", type=str, help=f"Role ({', '.join(VALID_ROLES)})")
        parser.add_argument("--password", type=str, help="User Password")
        parser.add_argument(
            "--org", type=str, help="Organization Name (optional, defaults to primary org)"
        )

    def handle(self, *args, **options):
        email = options.get("email")
        name = options.get("name")
        role_str = options.get("role")
        password = options.get("password")
        org_name = options.get("org")

        # 1. Resolve Organization
        if org_name:
            org = Organization.objects.filter(name__iexact=org_name.strip()).first()
            if not org:
                raise CommandError(
                    f"Organization '{org_name}' not found. Please create admin first."
                )
        else:
            org = Organization.objects.first()
            if not org:
                raise CommandError(
                    "No organization found. Please run 'python manage.py create_admin' first."
                )

        # 2. Interactive prompts if needed
        if not name:
            name = input("Enter Member Full Name: ").strip()
            while not name:
                self.stdout.write(self.style.ERROR("Full Name is required."))
                name = input("Enter Member Full Name: ").strip()

        if not email:
            email = input("Enter Member Email: ").strip()
            while not email:
                self.stdout.write(self.style.ERROR("Email is required."))
                email = input("Enter Member Email: ").strip()

        email = email.lower().strip()

        if not role_str or role_str.upper() not in VALID_ROLES:
            self.stdout.write("\nAvailable Roles:")
            for idx, r in enumerate(VALID_ROLES, 1):
                self.stdout.write(f"  {idx}. {r}")
            choice = input(f"Select Role (1-{len(VALID_ROLES)}) or type role name: ").strip()
            if choice.isdigit() and 1 <= int(choice) <= len(VALID_ROLES):
                role_str = VALID_ROLES[int(choice) - 1]
            elif choice.upper() in VALID_ROLES:
                role_str = choice.upper()
            else:
                role_str = Role.PROJECT_MANAGER.value
                self.stdout.write(self.style.WARNING(f"Defaulting to {role_str}."))

        role = Role(role_str.upper())

        if not password:
            password = getpass.getpass("Enter Member Password (min 6 chars): ").strip()
            while len(password) < 6:
                self.stdout.write(self.style.ERROR("Password must be at least 6 characters long."))
                password = getpass.getpass("Enter Member Password (min 6 chars): ").strip()

        try:
            with transaction.atomic():
                user, created = User.objects.get_or_create(
                    email=email,
                    defaults={
                        "name": name,
                        "organization": org,
                        "role": role,
                        "is_staff": (role == Role.ORG_ADMIN),
                        "is_active": True,
                    },
                )
                if not created:
                    user.name = name
                    user.organization = org
                    user.role = role
                    user.is_staff = role == Role.ORG_ADMIN
                    user.is_active = True

                user.set_password(password)
                user.save()

            status_str = "created" if created else "updated"
            self.stdout.write(
                self.style.SUCCESS(
                    f"\nTeam member '{user.email}' ({user.name}) successfully {status_str} with role: {user.role}."
                )
            )
        except Exception as exc:
            raise CommandError(f"Failed to create team member: {str(exc)}")
