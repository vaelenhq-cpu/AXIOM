from fastapi import APIRouter, Depends

from app.api.dependencies import authenticated_user
from app.schemas.domain_provider import (
    DomainProviderConnectionCreate,
    DomainProviderConnectionUpdate,
)
from app.services.domain_provider import (
    DomainProviderService,
)


router = APIRouter(
    prefix="/api/domain-providers",
    tags=["Domain Providers"],
    dependencies=[
        Depends(authenticated_user),
    ],
)


@router.get("")
async def list_connections():
    return (
        DomainProviderService()
        .list_connections()
    )


@router.post("")
async def create_connection(
    payload: DomainProviderConnectionCreate,
):
    return (
        DomainProviderService()
        .create_connection(
            payload.model_dump()
        )
    )


@router.patch("/{connection_id}")
async def update_connection(
    connection_id: str,
    payload: DomainProviderConnectionUpdate,
):
    return (
        DomainProviderService()
        .update_connection(
            connection_id,
            payload.model_dump(
                exclude_unset=True
            ),
        )
    )


@router.get("/domains/{domain_id}/zone")
async def get_domain_zone(
    domain_id: str,
):
    return (
        DomainProviderService()
        .get_zone_for_domain(
            domain_id
        )
    )


@router.post("/{connection_id}/verify")
async def verify_provider_connection(
    connection_id: str,
):
    return (
        DomainProviderService()
        .verify_connection(
            connection_id
        )
    )


@router.post(
    "/{connection_id}/domains/{domain_id}/provision"
)
async def provision_domain(
    connection_id: str,
    domain_id: str,
):
    return (
        DomainProviderService()
        .provision_domain(
            domain_id,
            connection_id,
        )
    )
