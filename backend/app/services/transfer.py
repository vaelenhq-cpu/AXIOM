from typing import Any, Dict, Optional

from app.core.ids import generate_id
from app.repositories.transfer import TransferRepository


class TransferService:
    def __init__(self, connection=None):
        self.repo = TransferRepository(connection)

    def create(
        self,
        *,
        booking_service_id: str,
        pickup_location: str,
        dropoff_location: str,
        pickup_datetime: Optional[str] = None,
        flight_number: Optional[str] = None,
        flight_datetime: Optional[str] = None,
        pickup_sign: Optional[str] = None,
        pax: int = 1,
        luggage_count: int = 0,
        requested_vehicle_class: Optional[str] = None,
        special_request: Optional[str] = None,
    ) -> Dict[str, Any]:

        if not pickup_location.strip():
            raise ValueError("pickup_location is required")

        if not dropoff_location.strip():
            raise ValueError("dropoff_location is required")

        if pax <= 0:
            raise ValueError("pax must be greater than 0")

        return self.repo.insert({
            "id": generate_id("transfer"),
            "booking_service_id": booking_service_id,
            "pickup_location": pickup_location.strip(),
            "dropoff_location": dropoff_location.strip(),
            "pickup_datetime": pickup_datetime,
            "flight_number": flight_number,
            "flight_datetime": flight_datetime,
            "pickup_sign": pickup_sign,
            "pax": pax,
            "luggage_count": luggage_count,
            "requested_vehicle_class": requested_vehicle_class,
            "special_request": special_request,
        })
