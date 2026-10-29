import os

from rest_framework.exceptions import ValidationError

ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png"}
ALLOWED_DOCUMENT_EXTENSIONS = {".pdf"}


def validate_upload(file_obj, kinds=("image", "pdf"), max_mb=5):
    """
    Validate uploaded file extension and size.
    Raises ValidationError if invalid.
    """
    if not file_obj:
        return file_obj

    # 1. Validate file size
    max_bytes = max_mb * 1024 * 1024
    if file_obj.size > max_bytes:
        raise ValidationError(f"File size exceeds maximum allowed limit of {max_mb} MB.")

    # 2. Validate file extension
    ext = os.path.splitext(file_obj.name)[1].lower()
    allowed = set()
    if "image" in kinds:
        allowed.update(ALLOWED_IMAGE_EXTENSIONS)
    if "pdf" in kinds:
        allowed.update(ALLOWED_DOCUMENT_EXTENSIONS)

    if ext not in allowed:
        allowed_str = ", ".join(sorted(allowed))
        raise ValidationError(
            f"Unsupported file extension '{ext}'. Allowed extensions: {allowed_str}"
        )

    return file_obj
