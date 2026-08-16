from typing import Any, Dict, Optional

from app.core.ids import generate_id

from app.repositories.tour import (
    TourProductRepository,
    TourDepartureRepository,
    TourBookingRepository,
)


class TourService:
    def __init__(self, connection=None):
        self.product_repo = TourProductRepository(connection)
        self.departure_repo = TourDepartureRepository(connection)
        self.booking_repo = TourBookingRepository(connection)

    def create_product(
        self,
        *,
        name: str,
        code: Optional[str] = None,
        description: Optional[str] = None,
        duration_minutes: Optional[int] = None,
        default_capacity: Optional[int] = None,
    ) -> Dict[str, Any]:

        if not name.strip():
            raise ValueError("Tour name is required")

        return self.product_repo.insert({
            "id": generate_id("tour_product"),
            "code": code.strip() if code else None,
            "name": name.strip(),
            "description": description,
            "duration_minutes": duration_minutes,
            "default_capacity": default_capacity,
            "active": 1,
        })

    def create_departure(
        self,
        *,
        tour_product_id: str,
        departure_date: str,
        departure_time: Optional[str] = None,
        capacity: Optional[int] = None,
        meeting_point: Optional[str] = None,
    ) -> Dict[str, Any]:

        product = self.product_repo.get_by_id(tour_product_id)

        if product is None:
            raise LookupError("Tour product not found")

        if capacity is None:
            capacity = product.get("default_capacity")

        return self.departure_repo.insert({
            "id": generate_id("tour_departure"),
            "tour_product_id": tour_product_id,
            "departure_date": departure_date,
            "departure_time": departure_time,
            "capacity": capacity,
            "meeting_point": meeting_point,
            "status": "scheduled",
        })

    def attach_booking(
        self,
        *,
        booking_service_id: str,
        tour_departure_id: str,
        adult_count: int = 0,
        child_count: int = 0,
        infant_count: int = 0,
        pickup_required: bool = False,
        pickup_location: Optional[str] = None,
        notes: Optional[str] = None,
    ) -> Dict[str, Any]:

        departure = self.departure_repo.get_by_id(
            tour_departure_id
        )

        if departure is None:
            raise LookupError("Tour departure not found")

        total_pax = (
            adult_count
            + child_count
            + infant_count
        )

        if total_pax <= 0:
            raise ValueError(
                "Tour booking must contain at least one passenger"
            )

        return self.booking_repo.insert({
            "id": generate_id("tour_booking"),
            "booking_service_id": booking_service_id,
            "tour_departure_id": tour_departure_id,
            "adult_count": adult_count,
            "child_count": child_count,
            "infant_count": infant_count,
            "pickup_required": 1 if pickup_required else 0,
            "pickup_location": pickup_location,
            "notes": notes,
        })

    def list_products(
        self,
        limit: int = 100,
        offset: int = 0,
    ):
        return self.product_repo.list(
            limit=limit,
            offset=offset,
        )

    def get_product(
        self,
        tour_product_id: str,
    ):
        product = self.product_repo.get_by_id(
            tour_product_id
        )

        if product is None:
            raise LookupError("Tour product not found")

        return product

    def list_departures(
        self,
        limit: int = 100,
        offset: int = 0,
    ):
        return self.departure_repo.list(
            limit=limit,
            offset=offset,
        )

    def get_departure(
        self,
        departure_id: str,
    ):
        departure = self.departure_repo.get_by_id(
            departure_id
        )

        if departure is None:
            raise LookupError(
                "Tour departure not found"
            )

        return departure

    def departures_by_date(
        self,
        departure_date: str,
    ):
        return self.departure_repo.list_by_date(
            departure_date
        )
