from contextlib import nullcontext
from app.core.ids import generate_id
from app.core.tenant import get_user_id
from app.core.transactions import transaction
from app.core.time import utc_now_iso

from app.repositories.operation import OperationRepository
from app.repositories.operation_event import OperationEventRepository

from app.services.audit import AuditService
from app.services.outbox import OutboxService


class OperationWorkflowService:
    def __init__(self, connection=None):
        self.connection = connection

    TRANSITIONS = {
        "not_planned": {
            "waiting_assignment",
            "cancelled",
        },
        "waiting_assignment": {
            "assigned",
            "problem",
            "cancelled",
        },
        "assigned": {
            "ready",
            "waiting_assignment",
            "problem",
            "cancelled",
        },
        "ready": {
            "in_progress",
            "problem",
            "cancelled",
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

    def change_status(
        self,
        operation_id: str,
        new_status: str,
        driver_id=None,
    ):
        context = (
            nullcontext(self.connection)
            if self.connection is not None
            else transaction()
        )

        with context as connection:
            repo = OperationRepository(connection)
            event_repo = OperationEventRepository(
                connection
            )

            operation = repo.get_by_id(
                operation_id
            )

            if operation is None:
                raise LookupError(
                    "Operation not found"
                )

            current = operation["status"]

            if new_status == current:
                return operation

            allowed = self.TRANSITIONS.get(
                current,
                set(),
            )

            if new_status not in allowed:
                raise ValueError(
                    "Invalid operation transition: "
                    f"{current} -> {new_status}"
                )

            payload = {
                "status": new_status,
                "updated_at": utc_now_iso(),
            }

            if new_status == "in_progress":
                payload["actual_start_at"] = (
                    utc_now_iso()
                )

            if new_status == "completed":
                payload["actual_end_at"] = (
                    utc_now_iso()
                )

            updated = repo.update(
                operation_id,
                payload,
            )

            #
            # Bir transfer operasyonu tamamlandıysa
            # bağlı rezervasyonun bütün operasyonlarını kontrol et.
            #
            if (
                new_status == "completed"
                and operation["source_type"] == "transfer"
                and operation.get("source_id")
            ):
                booking_row = connection.execute(
                    """
                    SELECT
                        b.id,
                        b.status
                    FROM bookings b

                    JOIN booking_services bs
                      ON bs.company_id = b.company_id
                     AND bs.booking_id = b.id

                    JOIN transfers t
                      ON t.company_id = bs.company_id
                     AND t.booking_service_id = bs.id

                    WHERE t.company_id = ?
                      AND t.id = ?

                    LIMIT 1
                    """,
                    (
                        operation["company_id"],
                        operation["source_id"],
                    ),
                ).fetchone()

                if (
                    booking_row
                    and booking_row["status"] == "confirmed"
                ):
                    incomplete = connection.execute(
                        """
                        SELECT COUNT(*) AS count
                        FROM operations o

                        JOIN transfers t
                          ON t.company_id = o.company_id
                         AND o.source_type = 'transfer'
                         AND o.source_id = t.id

                        JOIN booking_services bs
                          ON bs.company_id = t.company_id
                         AND bs.id = t.booking_service_id

                        WHERE bs.company_id = ?
                          AND bs.booking_id = ?
                          AND o.status != 'completed'
                        """,
                        (
                            operation["company_id"],
                            booking_row["id"],
                        ),
                    ).fetchone()

                    if (
                        incomplete
                        and incomplete["count"] == 0
                    ):
                        connection.execute(
                            """
                            UPDATE bookings
                            SET
                                status = 'completed',
                                updated_at = ?
                            WHERE company_id = ?
                              AND id = ?
                            """,
                            (
                                utc_now_iso(),
                                operation["company_id"],
                                booking_row["id"],
                            ),
                        )

            event_repo.insert({
                "id": generate_id(
                    "operation_event"
                ),
                "operation_id": operation_id,
                "event_type": "status_changed",
                "old_status": current,
                "new_status": new_status,
                "description": (
                    f"Operation status changed: "
                    f"{current} -> {new_status}"
                ),
                "actor_user_id": get_user_id(),
                "driver_id": driver_id,
            })

            AuditService(connection).log(
                action="operation.status_change",
                entity_type="operation",
                entity_id=operation_id,
                old_data={
                    "status": current,
                },
                new_data={
                    "status": new_status,
                },
                actor_type=(
                    "driver"
                    if driver_id
                    else "user"
                ),
                actor_id=(
                    driver_id
                    if driver_id
                    else get_user_id()
                ),
            )

            OutboxService(connection).publish(
                event_type="operation.status_changed",
                aggregate_type="operation",
                aggregate_id=operation_id,
                payload={
                    "operation_id": operation_id,
                    "old_status": current,
                    "new_status": new_status,
                },
            )

            return updated
