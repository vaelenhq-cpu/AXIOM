from typing import AsyncGenerator

from fastapi import Security
from fastapi.security import (
    HTTPAuthorizationCredentials,
    HTTPBearer,
)

from app.core.tenant import (
    clear_tenant,
    set_tenant,
)

from app.security.exceptions import (
    InvalidCredentials,
)

from app.services.auth import AuthService


bearer_scheme = HTTPBearer(
    auto_error=False,
)


async def authenticated_user(
    credentials: HTTPAuthorizationCredentials = Security(
        bearer_scheme
    ),
) -> AsyncGenerator[dict, None]:

    if credentials is None:
        raise InvalidCredentials(
            "Authentication token is required"
        )

    if credentials.scheme.lower() != "bearer":
        raise InvalidCredentials(
            "Bearer authentication is required"
        )

    identity = (
        AuthService()
        .authenticate_token(
            credentials.credentials
        )
    )

    set_tenant(
        company_id=identity["company_id"],
        user_id=identity["user_id"],
        role=identity["role"],
    )

    try:
        yield identity

    finally:
        clear_tenant()
