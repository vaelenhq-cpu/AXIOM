import asyncio
import sqlite3
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import (
    CORSMiddleware,
)
from fastapi.responses import JSONResponse

from app.core.config import (
    get_cors_origins,
)

from app.middleware.rate_limit import (
    RateLimitMiddleware,
)
from app.middleware.rbac import (
    RBACMiddleware,
)

from app.security.exceptions import (
    AccountDisabled,
    AuthenticationError,
    InvalidCredentials,
    PermissionDenied,
    SessionExpired,
    SessionRevoked,
)

from app.api.routes.health import (
    router as health_router,
)
from app.api.routes.auth import (
    router as auth_router,
)
from app.api.routes.register import (
    router as register_router,
)
from app.api.routes.customers import (
    router as customers_router,
)
from app.api.routes.bookings import (
    router as bookings_router,
)
from app.api.routes.drivers import (
    router as drivers_router,
)
from app.api.routes.vehicles import (
    router as vehicles_router,
)
from app.api.routes.operations import (
    router as operations_router,
)
from app.api.routes.tours import (
    router as tours_router,
)
from app.api.routes.routes import (
    router as routes_router,
)
from app.api.routes.pricing import (
    router as pricing_router,
)
from app.api.routes.settings import (
    router as settings_router,
)
from app.api.routes.finance import (
    router as finance_router,
)
from app.api.routes.integrations import (
    router as integrations_router,
)
from app.api.routes.public_booking import (
    router as public_booking_router,
)
from app.api.routes.driver import (
    router as driver_router,
)
from app.api.routes.dashboard import (
    router as dashboard_router,
)
from app.api.routes.company import (
    router as company_router,
)

from app.api.routes.platform import (
    router as platform_router,
)

from app.api.routes.domain_provider import (
    router as domain_provider_router,
)

from app.api.routes.domain_provider_oauth import (
    router as domain_provider_oauth_router,
)



from app.workers.domain_verification import (
    DomainVerificationWorker,
)


async def domain_verification_loop():
    """
    Zamanı gelen domain doğrulamalarını
    periyodik olarak işler.
    """

    while True:
        try:
            await asyncio.to_thread(
                DomainVerificationWorker()
                .run_once
            )

        except asyncio.CancelledError:
            raise

        except Exception as exc:
            print(
                "[AXIOM DOMAIN WORKER]",
                type(exc).__name__,
                str(exc),
            )

        await asyncio.sleep(30)


@asynccontextmanager
async def lifespan(app: FastAPI):
    domain_task = asyncio.create_task(
        domain_verification_loop()
    )

    try:
        yield

    finally:
        domain_task.cancel()

        try:
            await domain_task
        except asyncio.CancelledError:
            pass


app = FastAPI(
    title="AXIOM API",
    lifespan=lifespan,
    version="0.1.0",
    description=(
        "AXIOM Tourism Operations Platform"
    ),
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_credentials=True,
    allow_methods=[
        "GET",
        "POST",
        "PUT",
        "PATCH",
        "DELETE",
        "OPTIONS",
    ],
    allow_headers=[
        "Authorization",
        "Content-Type",
        "Idempotency-Key",
        "X-API-Key",
        "X-AXIOM-Booking-Key",
    ],
)

app.add_middleware(
    RateLimitMiddleware
)

app.add_middleware(
    RBACMiddleware
)


def error_response(
    status_code,
    error,
    message,
):
    return JSONResponse(
        status_code=status_code,
        content={
            "success": False,
            "error": error,
            "message": message,
        },
    )


@app.exception_handler(
    InvalidCredentials
)
async def invalid_credentials(
    request,
    exc,
):
    return error_response(
        401,
        "invalid_credentials",
        str(exc),
    )


@app.exception_handler(
    SessionExpired
)
async def session_expired(
    request,
    exc,
):
    return error_response(
        401,
        "session_expired",
        str(exc),
    )


@app.exception_handler(
    SessionRevoked
)
async def session_revoked(
    request,
    exc,
):
    return error_response(
        401,
        "session_revoked",
        str(exc),
    )


@app.exception_handler(
    AccountDisabled
)
async def account_disabled(
    request,
    exc,
):
    return error_response(
        403,
        "account_disabled",
        str(exc),
    )


@app.exception_handler(
    PermissionDenied
)
async def permission_denied(
    request,
    exc,
):
    return error_response(
        403,
        "permission_denied",
        str(exc),
    )


@app.exception_handler(
    AuthenticationError
)
async def auth_error(
    request,
    exc,
):
    return error_response(
        401,
        "authentication_error",
        str(exc),
    )


@app.exception_handler(
    PermissionError
)
async def permission_error(
    request,
    exc,
):
    return error_response(
        403,
        "permission_denied",
        str(exc),
    )


@app.exception_handler(
    LookupError
)
async def lookup_error(
    request,
    exc,
):
    return error_response(
        404,
        "not_found",
        str(exc),
    )


@app.exception_handler(
    ValueError
)
async def value_error(
    request,
    exc,
):
    return error_response(
        400,
        "validation_error",
        str(exc),
    )


@app.exception_handler(
    sqlite3.IntegrityError
)
async def integrity_error(
    request,
    exc,
):
    return error_response(
        409,
        "database_conflict",
        "Operation conflicts "
        "with existing data",
    )


app.include_router(
    health_router
)
app.include_router(
    auth_router
)
app.include_router(
    register_router
)
app.include_router(
    customers_router
)
app.include_router(
    bookings_router
)
app.include_router(
    drivers_router
)
app.include_router(
    vehicles_router
)
app.include_router(
    operations_router
)
app.include_router(
    tours_router
)
app.include_router(
    routes_router
)
app.include_router(
    pricing_router
)
app.include_router(
    settings_router
)
app.include_router(
    finance_router
)
app.include_router(
    integrations_router
)
app.include_router(
    public_booking_router
)
app.include_router(
    driver_router
)
app.include_router(
    dashboard_router
)
app.include_router(
    platform_router
)

app.include_router(
    domain_provider_router
)

app.include_router(
    domain_provider_oauth_router
)


app.include_router(
    company_router
)
