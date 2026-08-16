from typing import Any, Dict, Optional

from app.core.ids import generate_id
from app.repositories.driver import DriverRepository


class DriverService:
    def __init__(self, connection=None):
        self.repo = DriverRepository(connection)

    def create(
        self,
        *,
        first_name: str,
        last_name: Optional[str] = None,
        phone: Optional[str] = None,
        email: Optional[str] = None,
        license_number: Optional[str] = None,
        license_class: Optional[str] = None,
        notes: Optional[str] = None,
    ) -> Dict[str, Any]:

        if not first_name.strip():
            raise ValueError("Driver first_name is required")

        return self.repo.insert({
            "id": generate_id("driver"),
            "first_name": first_name.strip(),
            "last_name": last_name.strip() if last_name else None,
            "phone": phone,
            "email": email.strip().lower() if email else None,
            "license_number": license_number,
            "license_class": license_class,
            "status": "available",
            "active": 1,
            "notes": notes,
        })

    def set_status(
        self,
        driver_id: str,
        status: str,
    ):
        if status not in {
            "available",
            "busy",
            "off_duty",
            "inactive",
        }:
            raise ValueError("Invalid driver status")

        return self.repo.update(
            driver_id,
            {
                "status": status,
            },
        )

    def get(self, driver_id: str):
        driver = self.repo.get_by_id(driver_id)

        if driver is None:
            raise LookupError("Driver not found")

        return driver

    def list(self, limit: int = 100, offset: int = 0):
        return self.repo.list(
            limit=limit,
            offset=offset,
        )

    def list_available(self):
        return self.repo.list_available()
