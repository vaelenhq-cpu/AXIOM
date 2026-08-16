from .booking import BookingCreate
from .common import APIModel


class PublicBookingCreate(APIModel):
    request_id: str
    booking: BookingCreate
