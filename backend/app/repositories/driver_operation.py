from typing import Any, Dict, List

from app.core.tenant import get_company_id
from .base import BaseRepository


class DriverOperationRepository(BaseRepository):
    table_name = "operations"

    def list_for_driver(
        self,
        driver_id: str,
        limit: int = 100,
        operation_id: str | None = None,
    ) -> List[Dict[str, Any]]:

        connection, owned = self._conn()

        try:
            rows = connection.execute(
                """
                SELECT
                    o.id,
                    o.source_type,
                    o.source_id,
                    o.status,
                    o.scheduled_start_at,
                    o.scheduled_end_at,
                    o.actual_start_at,
                    o.actual_end_at,
                    o.priority,
                    o.operation_note,

                    oa.id AS assignment_id,
                    oa.status AS assignment_status,
                    oa.vehicle_id,
                    oa.assigned_at,
                    oa.accepted_at,

                    b.id AS booking_id,
                    b.booking_code,
                    b.customer_note,

                    c.id AS customer_id,
                    c.first_name AS customer_first_name,
                    c.last_name AS customer_last_name,
                    c.phone AS customer_phone,
                    c.email AS customer_email,
                    c.language AS customer_language,

                    bs.id AS booking_service_id,
                    bs.service_type,
                    bs.title AS service_title,
                    bs.description AS service_description,
                    bs.service_date,
                    bs.start_time,
                    bs.pax_adult,
                    bs.pax_child,
                    bs.pax_infant,

                    t.id AS transfer_id,
                    t.pickup_location,
                    t.pickup_latitude,
                    t.pickup_longitude,
                    t.pickup_place_id,

                    t.dropoff_location,
                    t.dropoff_latitude,
                    t.dropoff_longitude,
                    t.dropoff_place_id,

                    t.pickup_datetime,
                    t.flight_number,
                    t.flight_datetime,
                    t.pickup_sign,
                    t.pax,
                    t.luggage_count,
                    t.requested_vehicle_class,
                    t.special_request,

                    v.plate AS vehicle_plate,
                    v.brand AS vehicle_brand,
                    v.model AS vehicle_model,
                    v.model_year AS vehicle_model_year,
                    v.vehicle_class,
                    v.capacity AS vehicle_capacity

                FROM operations o

                JOIN operation_assignments oa
                  ON oa.operation_id = o.id
                 AND oa.company_id = o.company_id

                LEFT JOIN transfers t
                  ON o.source_type = 'transfer'
                 AND t.id = o.source_id
                 AND t.company_id = o.company_id

                LEFT JOIN booking_services bs
                  ON bs.id = t.booking_service_id
                 AND bs.company_id = o.company_id

                LEFT JOIN bookings b
                  ON b.id = bs.booking_id
                 AND b.company_id = o.company_id

                LEFT JOIN customers c
                  ON c.id = b.customer_id
                 AND c.company_id = o.company_id

                LEFT JOIN vehicles v
                  ON v.id = oa.vehicle_id
                 AND v.company_id = o.company_id

                WHERE o.company_id = ?
                  AND oa.driver_id = ?
                  AND oa.status NOT IN (
                    'cancelled',
                    'rejected'
                  )
                  AND (
                    ? IS NULL
                    OR o.id = ?
                  )

                ORDER BY
                    CASE
                        WHEN o.status = 'in_progress'
                            THEN 1
                        WHEN o.status = 'ready'
                            THEN 2
                        WHEN o.status = 'assigned'
                            THEN 3
                        WHEN o.status = 'problem'
                            THEN 4
                        WHEN o.status = 'completed'
                            THEN 5
                        ELSE 6
                    END,
                    o.scheduled_start_at ASC

                LIMIT ?
                """,
                (
                    get_company_id(),
                    driver_id,
                    operation_id,
                    operation_id,
                    limit,
                ),
            ).fetchall()

            return [
                dict(row)
                for row in rows
            ]

        finally:
            self._close_if_owned(
                connection,
                owned,
            )

    def timeline_for_driver(
        self,
        *,
        driver_id: str,
        operation_id: str,
        limit: int = 200,
    ) -> List[Dict[str, Any]]:

        connection, owned = self._conn()

        try:
            rows = connection.execute(
                """
                SELECT
                    oe.id,
                    oe.event_type,
                    oe.old_status,
                    oe.new_status,
                    oe.description,
                    oe.actor_user_id,
                    oe.driver_id,
                    oe.created_at
                FROM operation_events oe
                WHERE oe.company_id = ?
                  AND oe.operation_id = ?
                  AND EXISTS (
                    SELECT 1
                    FROM operation_assignments oa
                    WHERE oa.company_id = oe.company_id
                      AND oa.operation_id = oe.operation_id
                      AND oa.driver_id = ?
                      AND oa.status NOT IN (
                        'cancelled',
                        'rejected'
                      )
                  )
                ORDER BY
                    oe.created_at ASC,
                    oe.id ASC
                LIMIT ?
                """,
                (
                    get_company_id(),
                    operation_id,
                    driver_id,
                    limit,
                ),
            ).fetchall()

            return [
                dict(row)
                for row in rows
            ]

        finally:
            self._close_if_owned(
                connection,
                owned,
            )
