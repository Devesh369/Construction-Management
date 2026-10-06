from rest_framework import serializers

from progress.models import DailyProgressReport, MaterialUsage, SitePhoto, TaskProgress


class TaskProgressSerializer(serializers.ModelSerializer):
    class Meta:
        model = TaskProgress
        fields = ["id", "task_name", "percent_complete", "notes"]


class MaterialUsageSerializer(serializers.ModelSerializer):
    class Meta:
        model = MaterialUsage
        fields = ["id", "material_name", "quantity", "unit"]


class SitePhotoSerializer(serializers.ModelSerializer):
    class Meta:
        model = SitePhoto
        fields = ["id", "image", "caption"]


class DailyProgressReportSerializer(serializers.ModelSerializer):
    tasks = TaskProgressSerializer(many=True, required=False)
    materials = MaterialUsageSerializer(many=True, required=False)
    photos = SitePhotoSerializer(many=True, read_only=True)
    submitted_by_name = serializers.CharField(source="submitted_by.name", read_only=True)

    class Meta:
        model = DailyProgressReport
        fields = [
            "id",
            "project",
            "report_date",
            "submitted_by",
            "submitted_by_name",
            "weather",
            "summary",
            "issues",
            "status",
            "verified_by",
            "verified_at",
            "rejection_reason",
            "tasks",
            "materials",
            "photos",
        ]
        read_only_fields = ["id", "status", "verified_by", "verified_at", "rejection_reason"]
