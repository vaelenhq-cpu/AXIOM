from app.core.tenant import get_tenant
from app.security.exceptions import PermissionDenied


ROLE_LEVELS = {
    "viewer": 10,
    "operator": 20,
    "tour_manager": 30,
    "dispatcher": 30,
    "finance": 30,
    "admin": 80,
    "owner": 100,
}


def require_roles(*allowed_roles: str) -> None:
    tenant = get_tenant()

    if tenant.role not in allowed_roles:
        raise PermissionDenied(
            f"Role '{tenant.role}' is not allowed"
        )


def require_minimum_role(required_role: str) -> None:
    tenant = get_tenant()

    current = ROLE_LEVELS.get(
        tenant.role or "",
        0,
    )

    required = ROLE_LEVELS.get(
        required_role,
        0,
    )

    if current < required:
        raise PermissionDenied(
            f"Minimum role required: {required_role}"
        )
