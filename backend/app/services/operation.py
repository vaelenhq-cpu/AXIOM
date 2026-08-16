from typing import Any, Dict, Optional

from app.core.ids import generate_id
from app.repositories.operation import OperationRepository


class OperationService:
    VALID_STATUS_TRANSITIONS = {
        "not_planned": {
            "waiting_assignment",
            "cancelled",
        },
        "waiting_assignment": {
            "assigned",
            "cancelled",
            "problem",
        },
        "assigned": {
            "ready",
            "waiting_assignment",
            "cancelled",
            "problem",
        },
        "ready": {
            "in_progress",
            "cancelled",
            "problem",
        },
        "in_progress": {
            "completed",
            "problem",
        },
        "problem": {
            "waiting_assignment",
            "assigned",
            "ready",
            "in_progress",
            "cancelled",
        },
        "completed": set(),
        "cancelled": set(),
    }

    def __init__(self, connection=None):
        self.repo = OperationRepository(connection)

    def create(
        self,
        *,
        source_type: str,
        source_id: Optional[str],
        scheduled_start_at: Optional[str] = None,
        scheduled_end_at: Optional[str] = None,
        priority: int = 100,
        operation_note: Optional[str] = None,
        status: str = "not_planned",
    ) -> Dict[str, Any]:

        if source_type not in {
            "transfer",
            "tour_departure",
            "other",
        }:
            raise ValueError("Invalid operation source_type")

        return self.repo.insert({
            "id": generate_id("operation"),
            "source_type": source_type,
            "source_id": source_id,
            "status": status,
            "scheduled_start_at": scheduled_start_at,
            "scheduled_end_at": scheduled_end_at,
            "priority": priority,
            "operation_note": operation_note,
        })

    def change_status(
        self,
        operation_id: str,
        new_status: str,
    ):
        operation = self.repo.get_by_id(operation_id)

        if operation is None:
            raise LookupError("Operation not found")

        current_status = operation["status"]

        allowed = self.VALID_STATUS_TRANSITIONS.get(
            current_status,
            set(),
        )

        if new_status not in allowed:
            raise ValueError(
                f"Invalid operation transition: "
                f"{current_status} -> {new_status}"
            )

        return self.repo.update(
            operation_id,
            {
                "status": new_status,
            },
        )

    def get(self, operation_id: str):
        operation = self.repo.get_by_id(
            operation_id
        )

        if operation is None:
            raise LookupError("Operation not found")

        return operation

    def list(self, limit: int = 100, offset: int = 0):
        return self.repo.list_dispatch(
            limit=limit,
        )

    def list_waiting_assignment(self):
        return self.repo.list_waiting_assignment()
