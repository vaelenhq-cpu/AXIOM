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

from app.services.driver_auth import (
    DriverAuthService,
)


driver_bearer = HTTPBearer(
    auto_error=False,
)


async def authenticated_driver(
    credentials: HTTPAuthorizationCredentials = Security(
        driver_bearer
    ),
) -> AsyncGenerator[dict, None]:

    if credentials is None:
        raise InvalidCredentials(
            "Driver authentication required"
        )

    identity = (
        DriverAuthService()
        .authenticate_token(
            credentials.credentials
        )
    )

    set_tenant(
        company_id=identity["company_id"],
    )

    try:
        yield identity

    finally:
        clear_tenant()
