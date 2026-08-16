from fastapi import APIRouter, Header, Request

from app.schemas.public_booking import (
    PublicBookingCreate,
)

from app.services.public_booking import (
    PublicBookingService,
)


router = APIRouter(
    prefix="/public/booking",
    tags=["Public Booking"],
)


@router.post("")
def create_public_booking(
    payload: PublicBookingCreate,
    request: Request,
    x_axiom_booking_key: str = Header(...),
):
    return PublicBookingService().create_booking(
        public_key=x_axiom_booking_key,
        request_id=payload.request_id,
        booking_payload=payload.booking.model_dump(),
        origin=request.headers.get("origin"),
        ip_address=(
            request.client.host
            if request.client
            else None
        ),
        user_agent=request.headers.get(
            "user-agent"
        ),
    )
