from django.utils import timezone
from rest_framework import serializers

from progress.models import DailyProgressReport, DPRStatus, MaterialUsage, SitePhoto, TaskProgress


class TaskProgressSerializer(serializers.ModelSerializer):
    class Meta:
        model = TaskProgress
        fields = ["id", "task_name", "percent_complete", "notes"]
        read_only_fields = ["id"]


class MaterialUsageSerializer(serializers.ModelSerializer):
    class Meta:
        model = MaterialUsage
        fields = ["id", "material_name", "quantity", "unit"]
        read_only_fields = ["id"]


class SitePhotoSerializer(serializers.ModelSerializer):
    class Meta:
        model = SitePhoto
        fields = ["id", "image", "caption"]
        read_only_fields = ["id"]


class DailyProgressReportSerializer(serializers.ModelSerializer):
    tasks = TaskProgressSerializer(many=True, required=True)
    materials = MaterialUsageSerializer(many=True, required=False, default=list)
    photos = SitePhotoSerializer(many=True, read_only=True)
    submitted_by_name = serializers.CharField(source="submitted_by.get_full_name", read_only=True)
    verified_by_name = serializers.CharField(source="verified_by.get_full_name", read_only=True)
    project_name = serializers.CharField(source="project.name", read_only=True)

    class Meta:
        model = DailyProgressReport
        fields = [
            "id",
            "project",
            "project_name",
            "report_date",
            "submitted_by",
            "submitted_by_name",
            "weather",
            "summary",
            "issues",
            "status",
            "verified_by",
            "verified_by_name",
            "verified_at",
            "rejection_reason",
            "tasks",
            "materials",
            "photos",
        ]
        read_only_fields = [
            "id",
            "status",
            "submitted_by",
            "verified_by",
            "verified_at",
            "rejection_reason",
            "photos",
        ]

    def validate_report_date(self, value):
        if value > timezone.localdate():
            raise serializers.ValidationError("DPR date may not be in the future.")
        return value

    def validate_tasks(self, value):
        if not value or len(value) < 1:
            raise serializers.ValidationError("At least one task entry is required.")
        return value

    def validate(self, attrs):
        project = attrs.get("project") or (self.instance.project if self.instance else None)
        report_date = attrs.get("report_date") or (
            self.instance.report_date if self.instance else None
        )

        if project and report_date:
            qs = DailyProgressReport.objects.filter(
                project=project,
                report_date=report_date,
                deleted_at__isnull=True,
            )
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError(
                    {"report_date": "A DPR for this project and date already exists."}
                )

        return attrs

    def create(self, validated_data):
        tasks_data = validated_data.pop("tasks", [])
        materials_data = validated_data.pop("materials", [])
        request = self.context.get("request")
        user = request.user if request else None
        org = validated_data.pop("organization", None) or (
            user.organization if user else validated_data["project"].organization
        )
        submitted_by = validated_data.pop("submitted_by", None) or user

        report = DailyProgressReport.objects.create(
            organization=org,
            submitted_by=submitted_by,
            status=DPRStatus.SUBMITTED,
            **validated_data,
        )

        for task_d in tasks_data:
            TaskProgress.objects.create(organization=org, report=report, **task_d)

        for mat_d in materials_data:
            MaterialUsage.objects.create(organization=org, report=report, **mat_d)

        return report

    def update(self, instance, validated_data):
        tasks_data = validated_data.pop("tasks", None)
        materials_data = validated_data.pop("materials", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        # If report was REJECTED, editing it sets status back to SUBMITTED
        if instance.status == DPRStatus.REJECTED:
            instance.status = DPRStatus.SUBMITTED
            instance.rejection_reason = ""

        instance.save()

        if tasks_data is not None:
            instance.tasks.all().delete()
            for task_d in tasks_data:
                TaskProgress.objects.create(
                    organization=instance.organization, report=instance, **task_d
                )

        if materials_data is not None:
            instance.materials.all().delete()
            for mat_d in materials_data:
                MaterialUsage.objects.create(
                    organization=instance.organization, report=instance, **mat_d
                )

        return instance


class RejectDPRSerializer(serializers.Serializer):
    reason = serializers.CharField(required=True, min_length=3)
