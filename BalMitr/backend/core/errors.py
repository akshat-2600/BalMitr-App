"""Unified error format for the entire BalMitr API:
{"error": {"code": "...", "message": "readable text", "details": {...}}}
"""
from rest_framework.views import exception_handler


def _first_message(data):
    if isinstance(data, dict):
        return _first_message(next(iter(data.values()), "Invalid request"))
    if isinstance(data, list):
        return _first_message(data[0]) if data else "Invalid request"
    return str(data)


def api_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is None:
        return None
    details = response.data
    code = {
        400: "validation_error",
        401: "not_logged_in",
        403: "not_allowed",
        404: "not_found",
    }.get(response.status_code, "error")
    message = (
        details["detail"]
        if isinstance(details, dict) and "detail" in details
        else _first_message(details)
    )
    response.data = {
        "error": {
            "code": code,
            "message": str(message),
            "details": details,
        }
    }
    return response
