from fastapi import APIRouter, Depends

from app.api.dependencies import authenticated_user
from app.schemas.settings import SettingsUpdate
from app.services.settings import SettingsService


router = APIRouter(
    prefix="/api/settings",
    tags=["Settings"],
    dependencies=[
        Depends(authenticated_user),
    ],
)


@router.get("")
async def get_settings():
    return SettingsService().get()


@router.patch("")
async def update_settings(
    payload: SettingsUpdate,
):
    data = payload.model_dump(
        exclude_unset=True
    )

    for field in (
        "auto_confirm_bookings",
        "auto_create_operations",
        "require_driver_acceptance",
    ):
        if field in data:
            data[field] = (
                1 if data[field] else 0
            )

    return SettingsService().update(
        data
    )
