from starlette.middleware.base import (
    BaseHTTPMiddleware,
)
from starlette.responses import JSONResponse

from app.services.auth import AuthService


class RBACMiddleware(
    BaseHTTPMiddleware
):
    RULES = [
        (
            "/api/settings",
            {
                "owner",
                "admin",
            },
        ),
        (
            "/api/finance",
            {
                "owner",
                "admin",
                "finance",
            },
        ),
        (
            "/api/integrations",
            {
                "owner",
                "admin",
            },
        ),
        (
            "/api/platform",
            {
                "owner",
                "admin",
            },
        ),
        (
            "/api/pricing",
            {
                "owner",
                "admin",
            },
        ),
        (
            "/api/routes",
            {
                "owner",
                "admin",
                "operator",
                "dispatcher",
            },
        ),
        (
            "/api/tours",
            {
                "owner",
                "admin",
                "operator",
                "tour_manager",
            },
        ),
        (
            "/api/drivers",
            {
                "owner",
                "admin",
                "dispatcher",
            },
        ),
        (
            "/api/vehicles",
            {
                "owner",
                "admin",
                "dispatcher",
            },
        ),
        (
            "/api/operations",
            {
                "owner",
                "admin",
                "operator",
                "dispatcher",
            },
        ),
        (
            "/api/bookings",
            {
                "owner",
                "admin",
                "operator",
            },
        ),
    ]

    async def dispatch(
        self,
        request,
        call_next,
    ):
        if request.method in {
            "GET",
            "HEAD",
            "OPTIONS",
        }:
            return await call_next(
                request
            )

        path = request.url.path

        if path in {
            "/api/auth/login",
        }:
            return await call_next(
                request
            )

        allowed = None

        for prefix, roles in self.RULES:
            if path.startswith(prefix):
                allowed = roles
                break

        if allowed is None:
            return await call_next(
                request
            )

        header = request.headers.get(
            "authorization",
            "",
        )

        if not header.lower().startswith(
            "bearer "
        ):
            return await call_next(
                request
            )

        token = header.split(
            " ",
            1,
        )[1].strip()

        try:
            identity = (
                AuthService()
                .authenticate_token(token)
            )
        except Exception:
            return await call_next(
                request
            )

        if identity["role"] not in allowed:
            return JSONResponse(
                status_code=403,
                content={
                    "success": False,
                    "error":
                        "permission_denied",
                    "message":
                        "Role is not allowed "
                        "for this operation",
                },
            )

        return await call_next(
            request
        )
