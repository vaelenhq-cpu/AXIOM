from fastapi import APIRouter, Depends, Query

from app.api.dependencies import authenticated_user
from app.schemas.resources import DriverCreate
from app.services.driver import DriverService


router = APIRouter(
    prefix="/api/drivers",
    tags=["Drivers"],
    dependencies=[
        Depends(authenticated_user),
    ],
)


@router.get("")
async def list_drivers(
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
):
    return DriverService().list(
        limit=limit,
        offset=offset,
    )


@router.get("/available")
async def available_drivers():
    return DriverService().list_available()


@router.get("/{driver_id}")
async def get_driver(driver_id: str):
    return DriverService().get(
        driver_id
    )


@router.post("")
async def create_driver(
    payload: DriverCreate,
):
    return DriverService().create(
        **payload.model_dump()
    )


@router.patch("/{driver_id}/status")
async def update_driver_status(
    driver_id: str,
    status: str,
):
    return DriverService().set_status(
        driver_id,
        status,
    )
