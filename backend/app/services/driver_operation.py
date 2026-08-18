from app.repositories.assignment import AssignmentRepository
from app.repositories.driver import DriverRepository
from app.repositories.driver_operation import DriverOperationRepository
from app.repositories.operation import OperationRepository
from app.repositories.vehicle import VehicleRepository
from app.core.time import utc_now_iso
from app.core.transactions import transaction

from app.services.operation_workflow import OperationWorkflowService


class DriverOperationService:
    FIELD_EVENT_ORDER = (
        "driver_en_route_to_pickup",
        "driver_arrived_at_pickup",
        "passenger_onboard",
        "driver_departed_pickup",
        "driver_arrived_at_dropoff",
        "passenger_dropped_off",
    )

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

    def detail(
        self,
        *,
        driver_id: str,
        operation_id: str,
    ):
        rows = (
            self.driver_operation_repo
            .list_for_driver(
                driver_id,
                limit=1,
                operation_id=operation_id,
            )
        )

        if not rows:
            raise LookupError(
                "Operation not found or "
                "not assigned to this driver"
            )

        row = rows[0]

        timeline = (
            self.driver_operation_repo
            .timeline_for_driver(
                driver_id=driver_id,
                operation_id=operation_id,
            )
        )

        field_event_order = list(self.FIELD_EVENT_ORDER)

        completed_field_events = {
            item["event_type"]
            for item in timeline
            if item["event_type"]
            in field_event_order
        }

        current_step = None
        next_event = None

        for item in field_event_order:
            if item not in completed_field_events:
                next_event = item
                break

        if completed_field_events:
            for item in reversed(
                field_event_order
            ):
                if item in completed_field_events:
                    current_step = item
                    break

        assignment_status = row[
            "assignment_status"
        ]

        operation_status = row["status"]

        can_accept = (
            assignment_status == "assigned"
            and operation_status
            not in {
                "completed",
                "cancelled",
            }
        )

        can_start = (
            assignment_status
            in {
                "accepted",
                "started",
            }
            and operation_status
            in {
                "assigned",
                "ready",
            }
        )

        can_complete = (
            operation_status == "in_progress"
            and (
                "passenger_dropped_off"
                in completed_field_events
            )
        )

        pickup_target = {
            "type": "pickup",
            "location":
                row["pickup_location"],
            "latitude":
                row["pickup_latitude"],
            "longitude":
                row["pickup_longitude"],
            "place_id":
                row["pickup_place_id"],
        }

        dropoff_target = {
            "type": "dropoff",
            "location":
                row["dropoff_location"],
            "latitude":
                row["dropoff_latitude"],
            "longitude":
                row["dropoff_longitude"],
            "place_id":
                row["dropoff_place_id"],
        }

        dropoff_phase_events = {
            "passenger_onboard",
            "driver_departed_pickup",
            "driver_arrived_at_dropoff",
            "passenger_dropped_off",
        }

        active_target = pickup_target

        if (
            current_step
            in dropoff_phase_events
        ):
            active_target = dropoff_target

        if (
            operation_status
            in {
                "completed",
                "cancelled",
            }
        ):
            active_target = None

        return {
            "operation": {
                "id":
                    row["id"],

                "status":
                    row["status"],

                "source_type":
                    row["source_type"],

                "source_id":
                    row["source_id"],

                "priority":
                    row["priority"],

                "scheduled_start_at":
                    row[
                        "scheduled_start_at"
                    ],

                "scheduled_end_at":
                    row[
                        "scheduled_end_at"
                    ],

                "actual_start_at":
                    row[
                        "actual_start_at"
                    ],

                "actual_end_at":
                    row[
                        "actual_end_at"
                    ],
            },

            "assignment": {
                "id":
                    row["assignment_id"],

                "status":
                    row[
                        "assignment_status"
                    ],

                "assigned_at":
                    row["assigned_at"],

                "accepted_at":
                    row["accepted_at"],
            },

            "booking": {
                "id":
                    row["booking_id"],

                "code":
                    row["booking_code"],
            },

            "customer": {
                "id":
                    row["customer_id"],

                "first_name":
                    row[
                        "customer_first_name"
                    ],

                "last_name":
                    row[
                        "customer_last_name"
                    ],

                "phone":
                    row[
                        "customer_phone"
                    ],

                "email":
                    row[
                        "customer_email"
                    ],

                "language":
                    row[
                        "customer_language"
                    ],
            },

            "service": {
                "id":
                    row[
                        "booking_service_id"
                    ],

                "type":
                    row["service_type"],

                "title":
                    row["service_title"],

                "description":
                    row[
                        "service_description"
                    ],

                "date":
                    row["service_date"],

                "start_time":
                    row["start_time"],

                "passengers": {
                    "adult":
                        row["pax_adult"],

                    "child":
                        row["pax_child"],

                    "infant":
                        row["pax_infant"],
                },
            },

            "transfer": {
                "id":
                    row["transfer_id"],

                "pickup": {
                    "location":
                        row[
                            "pickup_location"
                        ],

                    "datetime":
                        row[
                            "pickup_datetime"
                        ],

                    "latitude":
                        row[
                            "pickup_latitude"
                        ],

                    "longitude":
                        row[
                            "pickup_longitude"
                        ],

                    "place_id":
                        row[
                            "pickup_place_id"
                        ],
                },

                "dropoff": {
                    "location":
                        row[
                            "dropoff_location"
                        ],

                    "latitude":
                        row[
                            "dropoff_latitude"
                        ],

                    "longitude":
                        row[
                            "dropoff_longitude"
                        ],

                    "place_id":
                        row[
                            "dropoff_place_id"
                        ],
                },

                "flight": {
                    "number":
                        row[
                            "flight_number"
                        ],

                    "datetime":
                        row[
                            "flight_datetime"
                        ],
                },

                "pickup_sign":
                    row["pickup_sign"],

                "pax":
                    row["pax"],

                "luggage_count":
                    row[
                        "luggage_count"
                    ],

                "requested_vehicle_class":
                    row[
                        "requested_vehicle_class"
                    ],
            },

            "vehicle": {
                "id":
                    row["vehicle_id"],

                "plate":
                    row["vehicle_plate"],

                "brand":
                    row["vehicle_brand"],

                "model":
                    row["vehicle_model"],

                "model_year":
                    row[
                        "vehicle_model_year"
                    ],

                "class":
                    row["vehicle_class"],

                "capacity":
                    row[
                        "vehicle_capacity"
                    ],
            },

            "notes": {
                "operation":
                    row["operation_note"],

                "customer":
                    row["customer_note"],

                "special_request":
                    row[
                        "special_request"
                    ],
            },

            "navigation": {
                "active_target":
                    active_target,

                "pickup":
                    pickup_target,

                "dropoff":
                    dropoff_target,

                "has_pickup_coordinates":
                    (
                        row["pickup_latitude"]
                        is not None
                        and row[
                            "pickup_longitude"
                        ]
                        is not None
                    ),

                "has_dropoff_coordinates":
                    (
                        row["dropoff_latitude"]
                        is not None
                        and row[
                            "dropoff_longitude"
                        ]
                        is not None
                    ),
            },

            "workflow": {
                "current_step":
                    current_step,

                "next_event":
                    next_event,

                "can_accept":
                    can_accept,

                "can_start":
                    can_start,

                "can_complete":
                    can_complete,

                "field_events": {
                    "completed":
                        [
                            item
                            for item
                            in field_event_order
                            if item
                            in completed_field_events
                        ],

                    "remaining":
                        [
                            item
                            for item
                            in field_event_order
                            if item
                            not in completed_field_events
                        ],
                },
            },

            "timeline":
                timeline,
        }

    def _assignment(
        self,
        driver_id: str,
        operation_id: str,
        connection=None,
    ):
        assignment_repo = (
            AssignmentRepository(connection)
            if connection is not None
            else self.assignment_repo
        )

        assignments = (
            assignment_repo
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
        with transaction() as connection:
            assignment_repo = AssignmentRepository(connection)
            operation_repo = OperationRepository(connection)

            assignment = self._assignment(
                driver_id,
                operation_id,
                connection=connection,
            )

            if assignment["status"] != "assigned":
                raise ValueError(
                    "Assignment cannot be accepted "
                    f"from status: {assignment['status']}"
                )

            updated = assignment_repo.update(
                assignment["id"],
                {
                    "status": "accepted",
                    "accepted_at": utc_now_iso(),
                },
            )

            operation = operation_repo.get_by_id(
                operation_id
            )

            if operation is None:
                raise LookupError(
                    "Operation not found"
                )

            if operation["status"] == "assigned":
                OperationWorkflowService(
                    connection
                ).change_status(
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
        with transaction() as connection:
            assignment_repo = AssignmentRepository(connection)
            driver_repo = DriverRepository(connection)
            vehicle_repo = VehicleRepository(connection)
            operation_repo = OperationRepository(connection)

            assignment = self._assignment(
                driver_id,
                operation_id,
                connection=connection,
            )

            if assignment["status"] != "accepted":
                raise ValueError(
                    "Operation must be accepted before start"
                )

            operation = operation_repo.get_by_id(
                operation_id
            )

            if operation is None:
                raise LookupError(
                    "Operation not found"
                )

            if operation["status"] == "assigned":
                OperationWorkflowService(
                    connection
                ).change_status(
                    operation_id,
                    "ready",
                    driver_id=driver_id,
                )
                operation = operation_repo.get_by_id(
                    operation_id
                )

            if operation["status"] != "ready":
                raise ValueError(
                    "Operation cannot be started "
                    f"from status: {operation['status']}"
                )

            assignment_repo.update(
                assignment["id"],
                {
                    "status": "started",
                },
            )

            driver_repo.update(
                driver_id,
                {
                    "status": "busy",
                },
            )

            vehicle_id = assignment.get(
                "vehicle_id"
            )

            if vehicle_id:
                vehicle_repo.update(
                    vehicle_id,
                    {
                        "status": "busy",
                    },
                )

            return OperationWorkflowService(
                connection
            ).change_status(
                operation_id,
                "in_progress",
                driver_id=driver_id,
            )

    def complete(
        self,
        *,
        driver_id: str,
        operation_id: str,
    ):
        with transaction() as connection:
            assignment_repo = AssignmentRepository(connection)
            driver_repo = DriverRepository(connection)
            vehicle_repo = VehicleRepository(connection)
            operation_repo = OperationRepository(connection)
            driver_operation_repo = DriverOperationRepository(connection)

            assignment = self._assignment(
                driver_id,
                operation_id,
                connection=connection,
            )

            if assignment["status"] != "started":
                raise ValueError(
                    "Operation must be started before completion"
                )

            operation = operation_repo.get_by_id(
                operation_id
            )

            if operation is None:
                raise LookupError(
                    "Operation not found"
                )

            if operation["status"] != "in_progress":
                raise ValueError(
                    "Operation cannot be completed "
                    f"from status: {operation['status']}"
                )

            timeline = driver_operation_repo.timeline_for_driver(
                driver_id=driver_id,
                operation_id=operation_id,
            )

            completed_field_events = {
                item["event_type"]
                for item in timeline
            }

            if (
                "passenger_dropped_off"
                not in completed_field_events
            ):
                raise ValueError(
                    "Passenger drop-off must be "
                    "completed before operation completion"
                )

            assignment_repo.update(
                assignment["id"],
                {
                    "status": "completed",
                },
            )

            result = OperationWorkflowService(
                connection
            ).change_status(
                operation_id,
                "completed",
                driver_id=driver_id,
            )

            driver_repo.update(
                driver_id,
                {
                    "status": "available",
                },
            )

            vehicle_id = assignment.get(
                "vehicle_id"
            )

            if vehicle_id:
                vehicle_repo.update(
                    vehicle_id,
                    {
                        "status": "available",
                    },
                )

            return result


    def record_field_event(
        self,
        *,
        driver_id: str,
        operation_id: str,
        event_type: str,
        description: str | None = None,
    ):
        from app.core.ids import generate_id
        from app.core.transactions import transaction
        from app.repositories.operation_event import (
            OperationEventRepository,
        )

        if event_type not in self.FIELD_EVENT_ORDER:
            raise ValueError(
                "Invalid driver operation event"
            )

        event_order = list(self.FIELD_EVENT_ORDER)

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
                    item["driver_id"] == driver_id
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

            if operation["status"] in {
                "completed",
                "cancelled",
            }:
                raise ValueError(
                    "Operation is already closed"
                )

            #
            # Field lifecycle can begin only after
            # driver accepted/started the assignment.
            #
            if assignment["status"] == "assigned":
                raise ValueError(
                    "Operation must be accepted first"
                )

            previous_rows = connection.execute(
                """
                SELECT
                    event_type
                FROM operation_events
                WHERE company_id = ?
                  AND operation_id = ?
                  AND driver_id = ?
                  AND event_type IN (
                    'driver_en_route_to_pickup',
                    'driver_arrived_at_pickup',
                    'passenger_onboard',
                    'driver_departed_pickup',
                    'driver_arrived_at_dropoff',
                    'passenger_dropped_off'
                  )
                ORDER BY
                    created_at ASC,
                    id ASC
                """,
                (
                    operation["company_id"],
                    operation_id,
                    driver_id,
                ),
            ).fetchall()

            completed_events = {
                row["event_type"]
                for row in previous_rows
            }

            if event_type in completed_events:
                raise ValueError(
                    "Driver operation event "
                    "already recorded"
                )

            target_index = event_order.index(
                event_type
            )

            if target_index > 0:
                required_previous = (
                    event_order[
                        target_index - 1
                    ]
                )

                if (
                    required_previous
                    not in completed_events
                ):
                    raise ValueError(
                        "Previous driver operation "
                        "event is required: "
                        f"{required_previous}"
                    )

            clean_description = (
                description.strip()
                if description
                else None
            )

            event = event_repo.insert({
                "id": generate_id(
                    "operation_event"
                ),
                "operation_id":
                    operation_id,
                "event_type":
                    event_type,
                "old_status":
                    operation["status"],
                "new_status":
                    operation["status"],
                "description":
                    clean_description,
                "actor_user_id":
                    None,
                "driver_id":
                    driver_id,
            })

            return {
                "event": event,
                "operation_id":
                    operation_id,
                "operation_status":
                    operation["status"],
                "assignment_status":
                    assignment["status"],
                "next_event": (
                    event_order[
                        target_index + 1
                    ]
                    if (
                        target_index + 1
                        < len(event_order)
                    )
                    else None
                ),
            }


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
                    OperationWorkflowService(
                        connection
                    ).change_status(
                        operation_id,
                        "problem",
                        driver_id=driver_id,
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
