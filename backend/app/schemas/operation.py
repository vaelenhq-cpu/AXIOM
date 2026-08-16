from typing import Literal, Optional

from .common import APIModel


class OperationStatusUpdate(APIModel):
    status: Literal[
        "not_planned",
        "waiting_assignment",
        "assigned",
        "ready",
        "in_progress",
        "completed",
        "problem",
        "cancelled",
    ]


class OperationAssignmentCreate(APIModel):
    driver_id: Optional[str] = None
    vehicle_id: Optional[str] = None


class OperationReassignmentCreate(APIModel):
    driver_id: Optional[str] = None
    vehicle_id: Optional[str] = None

    reason: str

    mark_previous_vehicle_maintenance: bool = False
