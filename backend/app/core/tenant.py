from dataclasses import dataclass
from contextvars import ContextVar
from typing import Optional


@dataclass(frozen=True)
class TenantContext:
    company_id: str
    user_id: Optional[str] = None
    role: Optional[str] = None


_current_tenant: ContextVar[
    Optional[TenantContext]
] = ContextVar(
    "axiom_current_tenant",
    default=None,
)


def set_tenant(
    company_id: str,
    user_id: Optional[str] = None,
    role: Optional[str] = None,
) -> None:
    if not company_id:
        raise ValueError(
            "company_id is required"
        )

    _current_tenant.set(
        TenantContext(
            company_id=company_id,
            user_id=user_id,
            role=role,
        )
    )


def clear_tenant() -> None:
    _current_tenant.set(None)


def get_tenant() -> TenantContext:
    tenant = _current_tenant.get()

    if tenant is None:
        raise RuntimeError(
            "AXIOM tenant context is not initialized"
        )

    return tenant


def get_company_id() -> str:
    return get_tenant().company_id


def get_user_id() -> Optional[str]:
    return get_tenant().user_id


def reset_tenant(token=None) -> None:
    clear_tenant()
