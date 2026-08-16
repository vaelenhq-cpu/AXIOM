from fastapi import APIRouter, Depends, Query

from app.api.dependencies import authenticated_user
from app.schemas.booking import BookingCreate
from app.services.booking import BookingService


router = APIRouter(
    prefix="/api/bookings",
    tags=["Bookings"],
    dependencies=[
        Depends(authenticated_user),
    ],
)


@router.get("")
async def list_bookings(
    limit: int = Query(
        default=50,
        ge=1,
        le=500,
    ),
):
    return BookingService().list_recent(
        limit=limit
    )


@router.get("/code/{booking_code}")
async def get_booking_by_code(
    booking_code: str,
):
    return BookingService().get_by_code(
        booking_code
    )


@router.get("/{booking_id}")
async def get_booking(
    booking_id: str,
):
    return BookingService().get(
        booking_id
    )


@router.post("")
async def create_booking(
    payload: BookingCreate,
):
    data = payload.model_dump()

    customer = data.pop("customer")
    services = data.pop("services")

    return BookingService().create(
        customer=customer,
        services=services,
        **data,
    )


from app.schemas.platform import BookingStatusUpdate
from app.services.booking_workflow import BookingWorkflowService


@router.patch("/{booking_id}/status")
async def change_booking_status(
    booking_id: str,
    payload: BookingStatusUpdate,
):
    return (
        BookingWorkflowService()
        .change_status(
            booking_id,
            payload.status,
        )
    )
