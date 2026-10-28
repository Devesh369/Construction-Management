from django.db import migrations

TRIGGER_SQL = """
-- Function to block updates and deletes on immutable tables
CREATE OR REPLACE FUNCTION prevent_immutable_record_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Modifications and deletions are strictly prohibited on immutable table %', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

-- Trigger on ledger_journalentry
DROP TRIGGER IF EXISTS trg_journalentry_immutable ON ledger_journalentry;
CREATE TRIGGER trg_journalentry_immutable
BEFORE UPDATE OR DELETE ON ledger_journalentry
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_record_modification();

-- Trigger on ledger_journalline
DROP TRIGGER IF EXISTS trg_journalline_immutable ON ledger_journalline;
CREATE TRIGGER trg_journalline_immutable
BEFORE UPDATE OR DELETE ON ledger_journalline
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_record_modification();

-- Trigger on audit_auditlog
DROP TRIGGER IF EXISTS trg_auditlog_immutable ON audit_auditlog;
CREATE TRIGGER trg_auditlog_immutable
BEFORE UPDATE OR DELETE ON audit_auditlog
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_record_modification();
"""

REVERSE_SQL = """
DROP TRIGGER IF EXISTS trg_journalentry_immutable ON ledger_journalentry;
DROP TRIGGER IF EXISTS trg_journalline_immutable ON ledger_journalline;
DROP TRIGGER IF EXISTS trg_auditlog_immutable ON audit_auditlog;
DROP FUNCTION IF EXISTS prevent_immutable_record_modification();
"""


def apply_triggers(apps, schema_editor):
    if schema_editor.connection.vendor == "postgresql":
        with schema_editor.connection.cursor() as cursor:
            cursor.execute(TRIGGER_SQL)


def reverse_triggers(apps, schema_editor):
    if schema_editor.connection.vendor == "postgresql":
        with schema_editor.connection.cursor() as cursor:
            cursor.execute(REVERSE_SQL)


class Migration(migrations.Migration):

    dependencies = [
        ("ledger", "0002_alter_account_options_alter_journalline_options"),
        ("audit", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(
            code=apply_triggers,
            reverse_code=reverse_triggers,
        ),
    ]
