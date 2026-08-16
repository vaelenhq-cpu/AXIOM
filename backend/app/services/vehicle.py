from typing import Any, Dict, Optional

from app.core.ids import generate_id
from app.repositories.vehicle import VehicleRepository


class VehicleService:
    def __init__(self, connection=None):
        self.repo = VehicleRepository(connection)

    def create(
        self,
        *,
        plate: str,
        brand: Optional[str] = None,
        model: Optional[str] = None,
        model_year: Optional[int] = None,
        vehicle_class: Optional[str] = None,
        capacity: int = 1,
        notes: Optional[str] = None,
    ) -> Dict[str, Any]:

        plate = plate.strip().upper()

        if not plate:
            raise ValueError("Vehicle plate is required")

        if capacity <= 0:
            raise ValueError(
                "Vehicle capacity must be greater than zero"
            )

        return self.repo.insert({
            "id": generate_id("vehicle"),
            "plate": plate,
            "brand": brand,
            "model": model,
            "model_year": model_year,
            "vehicle_class": vehicle_class,
            "capacity": capacity,
            "status": "available",
            "active": 1,
            "notes": notes,
        })

    def set_status(
        self,
        vehicle_id: str,
        status: str,
    ):
        if status not in {
            "available",
            "busy",
            "maintenance",
            "inactive",
        }:
            raise ValueError("Invalid vehicle status")

        return self.repo.update(
            vehicle_id,
            {
                "status": status,
            },
        )

    def get(self, vehicle_id: str):
        vehicle = self.repo.get_by_id(vehicle_id)

        if vehicle is None:
            raise LookupError("Vehicle not found")

        return vehicle

    def list(self, limit: int = 100, offset: int = 0):
        return self.repo.list(
            limit=limit,
            offset=offset,
        )

    def list_available(self):
        return self.repo.list_available()
