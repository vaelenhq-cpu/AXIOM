from fastapi import APIRouter, Depends, Query

from app.api.dependencies import authenticated_user

from app.schemas.integration import (
    ExternalBookingIngest,
    IntegrationCreate,
    IntegrationStatusUpdate,
)

from app.services.integration import IntegrationService


router = APIRouter(
    prefix="/api/integrations",
    tags=["Integrations"],
    dependencies=[
        Depends(authenticated_user),
    ],
)


@router.get("")
async def list_integrations(
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
):
    return IntegrationService().list(
        limit=limit,
        offset=offset,
    )


@router.post("")
async def create_integration(
    payload: IntegrationCreate,
):
    return IntegrationService().create(
        **payload.model_dump()
    )


@router.get("/{integration_id}")
async def get_integration(
    integration_id: str,
):
    return IntegrationService().get(
        integration_id
    )


@router.patch("/{integration_id}/status")
async def update_status(
    integration_id: str,
    payload: IntegrationStatusUpdate,
):
    return IntegrationService().set_status(
        integration_id,
        payload.status,
    )


@router.post("/{integration_id}/external-bookings")
async def ingest_external_booking(
    integration_id: str,
    payload: ExternalBookingIngest,
):
    return IntegrationService().ingest_external_booking(
        integration_id=integration_id,
        external_booking_id=payload.external_booking_id,
        payload=payload.payload,
    )
