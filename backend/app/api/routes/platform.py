from fastapi import (
    APIRouter,
    Depends,
)

from app.api.dependencies import (
    authenticated_user,
)

from app.schemas.platform import (
    APIKeyCreate,
    DomainCreate,
    DomainStatusUpdate,
    DriverAccountCreate,
    PublicBookingKeyCreate,
)

from app.services.platform import (
    PlatformService,
)


router = APIRouter(
    prefix="/api/platform",
    tags=["Platform"],
    dependencies=[
        Depends(authenticated_user),
    ],
)


@router.get("/domains")
async def domains():
    return PlatformService().list_domains()


@router.post("/domains")
async def create_domain(
    payload: DomainCreate,
):
    return PlatformService().create_domain(
        **payload.model_dump()
    )


@router.patch(
    "/domains/{domain_id}/status"
)
async def domain_status(
    domain_id: str,
    payload: DomainStatusUpdate,
):
    return (
        PlatformService()
        .set_domain_status(
            domain_id,
            payload.status,
        )
    )


@router.post(
    "/domains/{domain_id}/verify"
)
async def verify_domain(
    domain_id: str,
):
    return PlatformService().verify_domain(
        domain_id
    )


@router.get("/booking-keys")
async def booking_keys():
    return (
        PlatformService()
        .list_public_booking_keys()
    )


@router.post("/booking-keys")
async def create_booking_key(
    payload: PublicBookingKeyCreate,
):
    return (
        PlatformService()
        .create_public_booking_key(
            **payload.model_dump()
        )
    )


@router.delete(
    "/booking-keys/{key_id}"
)
async def revoke_booking_key(
    key_id: str,
):
    return (
        PlatformService()
        .revoke_public_booking_key(
            key_id
        )
    )


@router.post("/api-keys")
async def create_api_key(
    payload: APIKeyCreate,
):
    return (
        PlatformService()
        .create_api_key(
            **payload.model_dump()
        )
    )


@router.post("/driver-accounts")
async def create_driver_account(
    payload: DriverAccountCreate,
):
    return (
        PlatformService()
        .create_driver_account(
            **payload.model_dump()
        )
    )
