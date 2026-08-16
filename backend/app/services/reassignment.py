from typing import Optional

from app.core.ids import generate_id
from app.core.tenant import get_user_id
from app.core.time import utc_now_iso
from app.core.transactions import transaction

from app.repositories.assignment import AssignmentRepository
from app.repositories.driver import DriverRepository
from app.repositories.operation import OperationRepository
from app.repositories.operation_event import OperationEventRepository
from app.repositories.vehicle import VehicleRepository

from app.services.audit import AuditService
from app.services.outbox import OutboxService


class ReassignmentService:

    def reassign(
        self,
        *,
        operation_id: str,
        driver_id: Optional[str],
        vehicle_id: Optional[str],
        reason: str,
        mark_previous_vehicle_maintenance: bool = False,
    ):
        reason = reason.strip()

        if not reason:
            raise ValueError(
                "Reassignment reason is required"
            )

        if (
            not driver_id
            and not vehicle_id
        ):
            raise ValueError(
                "Driver or vehicle is required"
            )

        with transaction() as connection:
            operation_repo = OperationRepository(
                connection
            )

            assignment_repo = AssignmentRepository(
                connection
            )

            driver_repo = DriverRepository(
                connection
            )

            vehicle_repo = VehicleRepository(
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

            if operation["status"] in {
                "completed",
                "cancelled",
            }:
                raise ValueError(
                    "Completed or cancelled "
                    "operation cannot be reassigned"
                )

            assignments = (
                assignment_repo
                .list_by_operation(
                    operation_id
                )
            )

            current_assignment = None

            for item in assignments:
                if item["status"] in {
                    "assigned",
                    "accepted",
                    "started",
                }:
                    current_assignment = item
                    break

            old_driver_id = (
                current_assignment.get(
                    "driver_id"
                )
                if current_assignment
                else None
            )

            old_vehicle_id = (
                current_assignment.get(
                    "vehicle_id"
                )
                if current_assignment
                else None
            )

            new_driver_id = (
                driver_id
                or old_driver_id
            )

            new_vehicle_id = (
                vehicle_id
                or old_vehicle_id
            )

            if (
                not new_driver_id
                and not new_vehicle_id
            ):
                raise ValueError(
                    "No resource available "
                    "for reassignment"
                )

            if (
                new_driver_id == old_driver_id
                and
                new_vehicle_id == old_vehicle_id
            ):
                raise ValueError(
                    "New assignment must change "
                    "driver or vehicle"
                )

            #
            # Validate new driver
            #
            if new_driver_id:
                driver = driver_repo.get_by_id(
                    new_driver_id
                )

                if driver is None:
                    raise LookupError(
                        "Driver not found"
                    )

                if not driver["active"]:
                    raise ValueError(
                        "Driver is inactive"
                    )

                if (
                    new_driver_id
                    != old_driver_id
                    and driver["status"]
                    != "available"
                ):
                    raise ValueError(
                        "Driver is not available"
                    )

            #
            # Validate new vehicle
            #
            if new_vehicle_id:
                vehicle = vehicle_repo.get_by_id(
                    new_vehicle_id
                )

                if vehicle is None:
                    raise LookupError(
                        "Vehicle not found"
                    )

                if not vehicle["active"]:
                    raise ValueError(
                        "Vehicle is inactive"
                    )

                if (
                    new_vehicle_id
                    != old_vehicle_id
                    and vehicle["status"]
                    != "available"
                ):
                    raise ValueError(
                        "Vehicle is not available"
                    )

            #
            # Problem vehicle cannot be selected again.
            #
            if (
                mark_previous_vehicle_maintenance
                and old_vehicle_id
                and new_vehicle_id
                == old_vehicle_id
            ):
                raise ValueError(
                    "Problem vehicle cannot "
                    "remain assigned"
                )

            #
            # Cancel historical active assignment.
            #
            if current_assignment:
                assignment_repo.update(
                    current_assignment["id"],
                    {
                        "status": "cancelled",
                        "updated_at":
                            utc_now_iso(),
                    },
                )

            #
            # Release old driver.
            #
            if (
                old_driver_id
                and old_driver_id
                != new_driver_id
            ):
                driver_repo.update(
                    old_driver_id,
                    {
                        "status":
                            "available",
                    },
                )

            #
            # Old vehicle:
            # available OR maintenance.
            #
            if (
                old_vehicle_id
                and old_vehicle_id
                != new_vehicle_id
            ):
                vehicle_repo.update(
                    old_vehicle_id,
                    {
                        "status":
                            (
                                "maintenance"
                                if mark_previous_vehicle_maintenance
                                else "available"
                            ),
                    },
                )

            #
            # New assignment.
            #
            assignment = (
                assignment_repo.insert({
                    "id":
                        generate_id(
                            "assignment"
                        ),

                    "operation_id":
                        operation_id,

                    "driver_id":
                        new_driver_id,

                    "vehicle_id":
                        new_vehicle_id,

                    "status":
                        "assigned",

                    "assigned_by":
                        get_user_id(),
                })
            )

            #
            # Reassigned resources wait until
            # operation starts again.
            #
            if new_driver_id:
                driver_repo.update(
                    new_driver_id,
                    {
                        "status":
                            "available",
                    },
                )

            if new_vehicle_id:
                vehicle_repo.update(
                    new_vehicle_id,
                    {
                        "status":
                            "available",
                    },
                )

            old_status = operation[
                "status"
            ]

            operation_repo.update(
                operation_id,
                {
                    "status":
                        "assigned",

                    "updated_at":
                        utc_now_iso(),
                },
            )

            event_repo.insert({
                "id":
                    generate_id(
                        "operation_event"
                    ),

                "operation_id":
                    operation_id,

                "event_type":
                    "operation_reassigned",

                "old_status":
                    old_status,

                "new_status":
                    "assigned",

                "description":
                    reason,

                "actor_user_id":
                    get_user_id(),

                "driver_id":
                    new_driver_id,
            })

            AuditService(
                connection
            ).log(
                action=
                    "operation.reassigned",

                entity_type=
                    "operation",

                entity_id=
                    operation_id,

                old_data={
                    "driver_id":
                        old_driver_id,

                    "vehicle_id":
                        old_vehicle_id,

                    "status":
                        old_status,
                },

                new_data={
                    "driver_id":
                        new_driver_id,

                    "vehicle_id":
                        new_vehicle_id,

                    "status":
                        "assigned",

                    "reason":
                        reason,
                },
            )

            OutboxService(
                connection
            ).publish(
                event_type=
                    "operation.reassigned",

                aggregate_type=
                    "operation",

                aggregate_id=
                    operation_id,

                payload={
                    "operation_id":
                        operation_id,

                    "old_driver_id":
                        old_driver_id,

                    "new_driver_id":
                        new_driver_id,

                    "old_vehicle_id":
                        old_vehicle_id,

                    "new_vehicle_id":
                        new_vehicle_id,

                    "reason":
                        reason,
                },
            )

            return {
                "operation":
                    operation_repo
                    .get_by_id(
                        operation_id
                    ),

                "assignment":
                    assignment,

                "previous": {
                    "driver_id":
                        old_driver_id,

                    "vehicle_id":
                        old_vehicle_id,
                },

                "current": {
                    "driver_id":
                        new_driver_id,

                    "vehicle_id":
                        new_vehicle_id,
                },
            }
