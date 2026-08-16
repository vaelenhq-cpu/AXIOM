from app.repositories.assignment import AssignmentRepository
from app.repositories.driver import DriverRepository
from app.repositories.driver_operation import DriverOperationRepository
from app.repositories.operation import OperationRepository
from app.repositories.vehicle import VehicleRepository
from app.core.time import utc_now_iso

from app.services.operation_workflow import OperationWorkflowService


class DriverOperationService:
    def __init__(self, connection=None):
        self.operation_repo = OperationRepository(
            connection
        )
        self.driver_operation_repo = (
            DriverOperationRepository(
                connection
            )
        )
        self.assignment_repo = AssignmentRepository(
            connection
        )
        self.driver_repo = DriverRepository(
            connection
        )
        self.vehicle_repo = VehicleRepository(
            connection
        )

    def list(self, driver_id: str):
        return self.driver_operation_repo.list_for_driver(
            driver_id
        )

    def _assignment(
        self,
        driver_id: str,
        operation_id: str,
    ):
        assignments = (
            self.assignment_repo
            .list_by_operation(
                operation_id
            )
        )

        for assignment in assignments:
            if (
                assignment["driver_id"]
                == driver_id
                and assignment["status"]
                not in {
                    "cancelled",
                    "rejected",
                }
            ):
                return assignment

        raise PermissionError(
            "Operation is not assigned "
            "to this driver"
        )

    def accept(
        self,
        *,
        driver_id: str,
        operation_id: str,
    ):
        assignment = self._assignment(
            driver_id,
            operation_id,
        )

        updated = self.assignment_repo.update(
            assignment["id"],
            {
                "status": "accepted",
                "accepted_at": utc_now_iso(),
            },
        )

        operation = self.operation_repo.get_by_id(
            operation_id
        )

        if (
            operation
            and operation["status"] == "assigned"
        ):
            OperationWorkflowService().change_status(
                operation_id,
                "ready",
                driver_id=driver_id,
            )

        return updated

    def start(
        self,
        *,
        driver_id: str,
        operation_id: str,
    ):
        assignment = self._assignment(
            driver_id,
            operation_id,
        )

        operation = self.operation_repo.get_by_id(
            operation_id
        )

        if operation is None:
            raise LookupError(
                "Operation not found"
            )

        if operation["status"] == "assigned":
            OperationWorkflowService().change_status(
                operation_id,
                "ready",
                driver_id=driver_id,
            )

        self.assignment_repo.update(
            assignment["id"],
            {
                "status": "started",
            },
        )

        self.driver_repo.update(
            driver_id,
            {
                "status": "busy",
            },
        )

        vehicle_id = assignment.get(
            "vehicle_id"
        )

        if vehicle_id:
            self.vehicle_repo.update(
                vehicle_id,
                {
                    "status": "busy",
                },
            )

        return (
            OperationWorkflowService()
            .change_status(
                operation_id,
                "in_progress",
                driver_id=driver_id,
            )
        )

    def complete(
        self,
        *,
        driver_id: str,
        operation_id: str,
    ):
        assignment = self._assignment(
            driver_id,
            operation_id,
        )

        self.assignment_repo.update(
            assignment["id"],
            {
                "status": "completed",
            },
        )

        result = (
            OperationWorkflowService()
            .change_status(
                operation_id,
                "completed",
                driver_id=driver_id,
            )
        )

        self.driver_repo.update(
            driver_id,
            {
                "status": "available",
            },
        )

        vehicle_id = assignment.get(
            "vehicle_id"
        )

        if vehicle_id:
            self.vehicle_repo.update(
                vehicle_id,
                {
                    "status": "available",
                },
            )

        return result


    def report_issue(
        self,
        *,
        driver_id: str,
        operation_id: str,
        issue_type: str,
        description: str,
    ):
        from app.core.ids import generate_id
        from app.core.transactions import transaction
        from app.core.time import utc_now_iso
        from app.repositories.operation_event import (
            OperationEventRepository,
        )

        allowed_types = {
            "delay",
            "passenger_missing",
            "problem",
        }

        if issue_type not in allowed_types:
            raise ValueError(
                "Invalid driver issue type"
            )

        description = description.strip()

        if not description:
            raise ValueError(
                "Issue description is required"
            )

        with transaction() as connection:
            operation_repo = OperationRepository(
                connection
            )

            assignment_repo = AssignmentRepository(
                connection
            )

            event_repo = OperationEventRepository(
                connection
            )

            operation = operation_repo.get_by_id(
                operation_id
            )

            if operation is None:
                raise LookupError(
                    "Operation not found"
                )

            assignments = (
                assignment_repo
                .list_by_operation(
                    operation_id
                )
            )

            assignment = None

            for item in assignments:
                if (
                    item["driver_id"]
                    == driver_id
                    and item["status"]
                    not in {
                        "cancelled",
                        "rejected",
                    }
                ):
                    assignment = item
                    break

            if assignment is None:
                raise PermissionError(
                    "Operation is not assigned "
                    "to this driver"
                )

            event_type_map = {
                "delay":
                    "driver_delay",

                "passenger_missing":
                    "passenger_missing",

                "problem":
                    "driver_problem",
            }

            current_status = operation["status"]

            new_status = current_status

            if (
                issue_type
                in {
                    "passenger_missing",
                    "problem",
                }
                and current_status
                not in {
                    "completed",
                    "cancelled",
                    "problem",
                }
            ):
                allowed_problem_from = {
                    "waiting_assignment",
                    "assigned",
                    "ready",
                    "in_progress",
                }

                if (
                    current_status
                    in allowed_problem_from
                ):
                    operation_repo.update(
                        operation_id,
                        {
                            "status": "problem",
                            "updated_at":
                                utc_now_iso(),
                        },
                    )

                    new_status = "problem"

            event = event_repo.insert({
                "id": generate_id(
                    "operation_event"
                ),

                "operation_id":
                    operation_id,

                "event_type":
                    event_type_map[
                        issue_type
                    ],

                "old_status":
                    current_status,

                "new_status":
                    new_status,

                "description":
                    description,

                "driver_id":
                    driver_id,

                "actor_user_id":
                    None,
            })

            return {
                "event": event,

                "operation":
                    operation_repo
                    .get_by_id(
                        operation_id
                    ),
            }
