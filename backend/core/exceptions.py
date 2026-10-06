"""
Unified error handling and custom API exceptions.
Format: {"error": {"code": "...", "message": "...", "details": {...}}}
"""

from rest_framework import status
from rest_framework.exceptions import (
    APIException,
    AuthenticationFailed,
    NotAuthenticated,
    NotFound,
    PermissionDenied,
    ValidationError,
)
from rest_framework.response import Response
from rest_framework.views import exception_handler


class BusinessRuleError(APIException):
    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    default_code = "business_rule_violation"
    default_detail = "A business rule was violated."

    def __init__(self, message=None, code=None, details=None):
        if message:
            self.default_detail = message
        if code:
            self.default_code = code
        self.code = code or self.default_code
        self.details = details or {}
        super().__init__(detail=self.default_detail, code=self.default_code)


class RecordLockedError(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_code = "record_locked"
    default_detail = "This record is locked and cannot be modified."


class ConflictError(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_code = "conflict"
    default_detail = "The request conflicts with current server state."


class OutsideGeofenceError(APIException):
    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    default_code = "outside_geofence"
    default_detail = "Location is outside site geofence radius."

    def __init__(self, distance_m=None, radius_m=None):
        details = {}
        if distance_m is not None:
            details["distance_m"] = str(distance_m)
        if radius_m is not None:
            details["radius_m"] = str(radius_m)
        self.details = details
        super().__init__(detail=self.default_detail, code=self.default_code)


class UnbalancedEntryError(APIException):
    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    default_code = "unbalanced_entry"
    default_detail = "Total debits must equal total credits."


class NotFoundError(NotFound):
    default_code = "not_found"
    default_detail = "The requested resource was not found."


class AccountLockedError(APIException):
    status_code = status.HTTP_423_LOCKED
    default_code = "account_locked"
    default_detail = (
        "Account is locked due to multiple failed login attempts. Please try again later."
    )


def api_exception_handler(exc, context):
    """
    Standard DRF exception handler formatted as:
    {"error": {"code": "<code>", "message": "<message>", "details": {...}}}
    """
    response = exception_handler(exc, context)

    if response is None:
        # Unexpected server error (500)
        return Response(
            {
                "error": {
                    "code": "internal_server_error",
                    "message": "An internal server error occurred.",
                    "details": {"error": str(exc)},
                }
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    # Determine standard error code
    code = "error"
    if isinstance(exc, ValidationError):
        code = "validation_error"
    elif isinstance(exc, (NotAuthenticated, AuthenticationFailed)):
        code = "not_authenticated"
    elif isinstance(exc, PermissionDenied):
        code = "permission_denied"
    elif isinstance(exc, NotFound):
        code = "not_found"
    elif hasattr(exc, "get_codes") and isinstance(exc.get_codes(), str):
        code = exc.get_codes()
    elif hasattr(exc, "default_code"):
        code = getattr(exc, "default_code")

    message = "Request failed."
    details = {}

    if isinstance(response.data, dict):
        if "detail" in response.data:
            message = str(response.data["detail"])
            details = {k: v for k, v in response.data.items() if k != "detail"}
        else:
            message = "Validation failed."
            details = response.data
    elif isinstance(response.data, list):
        message = "Validation error."
        details = {"errors": response.data}
    else:
        message = str(response.data)

    # Include extra custom details if attached to the exception
    if hasattr(exc, "details") and getattr(exc, "details"):
        details.update(exc.details)

    response.data = {
        "error": {
            "code": code,
            "message": message,
            "details": details,
        }
    }
    return response
