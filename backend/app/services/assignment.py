from typing import Optional

from app.core.ids import generate_id
from app.core.tenant import get_user_id
from app.repositories.assignment import AssignmentRepository
from app.repositories.driver import DriverRepository
from app.repositories.vehicle import VehicleRepository
from app.repositories.operation import OperationRepository


class AssignmentService:
    def __init__(self, connection=None):
        self.assignment_repo = AssignmentRepository(connection)
        self.driver_repo = DriverRepository(connection)
        self.vehicle_repo = VehicleRepository(connection)
        self.operation_repo = OperationRepository(connection)

    def assign(
        self,
        *,
        operation_id: str,
        driver_id: Optional[str] = None,
        vehicle_id: Optional[str] = None,
    ):
        operation = self.operation_repo.get_by_id(operation_id)

        if operation is None:
            raise LookupError("Operation not found")

        if driver_id:
            driver = self.driver_repo.get_by_id(driver_id)

            if driver is None:
                raise LookupError("Driver not found")

            if not driver["active"]:
                raise ValueError("Driver is inactive")

        if vehicle_id:
            vehicle = self.vehicle_repo.get_by_id(vehicle_id)

            if vehicle is None:
                raise LookupError("Vehicle not found")

            if not vehicle["active"]:
                raise ValueError("Vehicle is inactive")

        if not driver_id and not vehicle_id:
            raise ValueError(
                "At least one driver or vehicle must be assigned"
            )

        assignment = self.assignment_repo.insert({
            "id": generate_id("assignment"),
            "operation_id": operation_id,
            "driver_id": driver_id,
            "vehicle_id": vehicle_id,
            "status": "assigned",
            "assigned_by": get_user_id(),
        })

        if operation["status"] in {
            "not_planned",
            "waiting_assignment",
        }:
            self.operation_repo.update(
                operation_id,
                {
                    "status": "assigned",
                },
            )

        return assignment
