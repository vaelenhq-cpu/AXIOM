from app.core.ids import generate_id
from app.core.tenant import get_user_id
from app.core.transactions import transaction
from app.core.time import utc_now_iso

from app.repositories.booking import BookingRepository
from app.repositories.booking_event import BookingEventRepository

from app.services.audit import AuditService
from app.services.outbox import OutboxService


class BookingWorkflowService:
    TRANSITIONS = {
        "draft": {
            "pending",
            "confirmed",
            "cancelled",
        },
        "pending": {
            "confirmed",
            "cancelled",
        },
        "confirmed": {
            "cancelled",
        },
        "completed": set(),
        "cancelled": set(),
    }

    def change_status(
        self,
        booking_id: str,
        new_status: str,
    ):
        with transaction() as connection:
            booking_repo = BookingRepository(
                connection
            )

            event_repo = BookingEventRepository(
                connection
            )

            booking = booking_repo.get_by_id(
                booking_id
            )

            if booking is None:
                raise LookupError(
                    "Booking not found"
                )

            current_status = booking["status"]

            if new_status == current_status:
                return booking

            allowed = self.TRANSITIONS.get(
                current_status,
                set(),
            )

            if new_status not in allowed:
                raise ValueError(
                    "Invalid booking transition: "
                    f"{current_status} -> {new_status}"
                )

            update = {
                "status": new_status,
                "updated_at": utc_now_iso(),
            }

            if new_status == "confirmed":
                update["confirmed_at"] = utc_now_iso()

            if new_status == "cancelled":
                update["cancelled_at"] = utc_now_iso()

            updated = booking_repo.update(
                booking_id,
                update,
            )

            event_repo.insert({
                "id": generate_id(
                    "booking_event"
                ),
                "booking_id": booking_id,
                "event_type": "status_changed",
                "old_value": current_status,
                "new_value": new_status,
                "description": (
                    "Booking status changed: "
                    f"{current_status} -> {new_status}"
                ),
                "actor_user_id": get_user_id(),
            })

            #
            # Transfer operasyonlarını bul.
            #
            operation_rows = connection.execute(
                """
                SELECT
                    o.id,
                    o.status
                FROM operations o

                JOIN transfers t
                  ON t.company_id = o.company_id
                 AND o.source_type = 'transfer'
                 AND o.source_id = t.id

                JOIN booking_services bs
                  ON bs.company_id = t.company_id
                 AND bs.id = t.booking_service_id

                WHERE bs.booking_id = ?
                  AND bs.company_id = ?
                """,
                (
                    booking_id,
                    booking["company_id"],
                ),
            ).fetchall()

            for row in operation_rows:
                operation_id = row["id"]
                operation_status = row["status"]

                #
                # Rezervasyon onaylandı:
                # operasyon Dispatch havuzuna girer.
                #
                if (
                    new_status == "confirmed"
                    and operation_status == "not_planned"
                ):
                    connection.execute(
                        """
                        UPDATE operations
                        SET
                            status = 'waiting_assignment',
                            updated_at = ?
                        WHERE id = ?
                          AND company_id = ?
                        """,
                        (
                            utc_now_iso(),
                            operation_id,
                            booking["company_id"],
                        ),
                    )

                    connection.execute(
                        """
                        INSERT INTO operation_events (
                            id,
                            company_id,
                            operation_id,
                            event_type,
                            old_status,
                            new_status,
                            description,
                            actor_user_id
                        )
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (
                            generate_id(
                                "operation_event"
                            ),
                            booking["company_id"],
                            operation_id,
                            "status_changed",
                            "not_planned",
                            "waiting_assignment",
                            (
                                "Booking confirmed; "
                                "operation released to dispatch"
                            ),
                            get_user_id(),
                        ),
                    )

                #
                # Rezervasyon iptal edildi:
                # henüz başlamamış operasyonu iptal et.
                #
                elif (
                    new_status == "cancelled"
                    and operation_status
                    in {
                        "not_planned",
                        "waiting_assignment",
                        "assigned",
                        "ready",
                        "problem",
                    }
                ):
                    connection.execute(
                        """
                        UPDATE operations
                        SET
                            status = 'cancelled',
                            updated_at = ?
                        WHERE id = ?
                          AND company_id = ?
                        """,
                        (
                            utc_now_iso(),
                            operation_id,
                            booking["company_id"],
                        ),
                    )

                    connection.execute(
                        """
                        INSERT INTO operation_events (
                            id,
                            company_id,
                            operation_id,
                            event_type,
                            old_status,
                            new_status,
                            description,
                            actor_user_id
                        )
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (
                            generate_id(
                                "operation_event"
                            ),
                            booking["company_id"],
                            operation_id,
                            "status_changed",
                            operation_status,
                            "cancelled",
                            (
                                "Booking cancelled; "
                                "operation cancelled"
                            ),
                            get_user_id(),
                        ),
                    )

            AuditService(connection).log(
                action="booking.status_change",
                entity_type="booking",
                entity_id=booking_id,
                old_data={
                    "status": current_status,
                },
                new_data={
                    "status": new_status,
                },
            )

            OutboxService(connection).publish(
                event_type="booking.status_changed",
                aggregate_type="booking",
                aggregate_id=booking_id,
                payload={
                    "booking_id": booking_id,
                    "old_status": current_status,
                    "new_status": new_status,
                },
            )

            return updated
