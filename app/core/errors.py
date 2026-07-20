from flask import jsonify


class AppError(Exception):
    status_code = 400
    error_code = "app_error"

    def __init__(self, message: str, status_code: int | None = None, error_code: str | None = None, payload: dict | None = None):
        super().__init__(message)
        self.message = message
        if status_code is not None:
            self.status_code = status_code
        if error_code is not None:
            self.error_code = error_code
        self.payload = payload or {}

    def to_dict(self) -> dict:
        return {"error": self.error_code, "message": self.message, **self.payload}


class ForbiddenError(AppError):
    status_code = 403
    error_code = "forbidden"

    def __init__(self, message: str = "You do not have permission to perform this action"):
        super().__init__(message)


class NotFoundError(AppError):
    status_code = 404
    error_code = "not_found"

    def __init__(self, message: str = "Resource not found"):
        super().__init__(message)


class ValidationAppError(AppError):
    status_code = 422
    error_code = "validation_error"


class ConflictError(AppError):
    status_code = 409
    error_code = "conflict"


class GuardViolationError(AppError):
    status_code = 409
    error_code = "guard_violation"


class UnauthorizedError(AppError):
    status_code = 401
    error_code = "unauthorized"

    def __init__(self, message: str = "Authentication required or invalid credentials"):
        super().__init__(message)


def register_error_handlers(app):
    @app.errorhandler(AppError)
    def handle_app_error(err: AppError):
        response = jsonify(err.to_dict())
        response.status_code = err.status_code
        return response

    @app.errorhandler(404)
    def handle_404(err):
        return jsonify({"error": "not_found", "message": "Resource not found"}), 404

    @app.errorhandler(500)
    def handle_500(err):
        return jsonify({"error": "internal_error", "message": "An unexpected error occurred"}), 500
