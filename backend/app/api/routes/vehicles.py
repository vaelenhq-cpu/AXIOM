from fastapi import APIRouter, Depends, Query

from app.api.dependencies import authenticated_user
from app.schemas.resources import VehicleCreate
from app.services.vehicle import VehicleService


router = APIRouter(
    prefix="/api/vehicles",
    tags=["Vehicles"],
    dependencies=[
        Depends(authenticated_user),
    ],
)


@router.get("")
async def list_vehicles(
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
):
    return VehicleService().list(
        limit=limit,
        offset=offset,
    )


@router.get("/available")
async def available_vehicles():
    return VehicleService().list_available()


@router.get("/{vehicle_id}")
async def get_vehicle(vehicle_id: str):
    return VehicleService().get(
        vehicle_id
    )


@router.post("")
async def create_vehicle(
    payload: VehicleCreate,
):
    return VehicleService().create(
        **payload.model_dump()
    )


@router.patch("/{vehicle_id}/status")
async def update_vehicle_status(
    vehicle_id: str,
    status: str,
):
    return VehicleService().set_status(
        vehicle_id,
        status,
    )
