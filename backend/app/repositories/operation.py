from typing import Any, Dict, List, Optional

from app.core.tenant import get_company_id

from .base import BaseRepository


class OperationRepository(BaseRepository):
    table_name = "operations"

    def get_by_source(
        self,
        source_type: str,
        source_id: str,
    ) -> Optional[Dict[str, Any]]:
        connection, owned = self._conn()

        try:
            row = connection.execute(
                """
                SELECT *
                FROM operations
                WHERE company_id = ?
                  AND source_type = ?
                  AND source_id = ?
                LIMIT 1
                """,
                (
                    get_company_id(),
                    source_type,
                    source_id,
                ),
            ).fetchone()

            return dict(row) if row else None

        finally:
            self._close_if_owned(connection, owned)

    def list_waiting_assignment(
        self,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        connection, owned = self._conn()

        try:
            rows = connection.execute(
                """
                SELECT *
                FROM operations
                WHERE company_id = ?
                  AND status = 'waiting_assignment'
                ORDER BY
                    priority ASC,
                    scheduled_start_at ASC
                LIMIT ?
                """,
                (
                    get_company_id(),
                    limit,
                ),
            ).fetchall()

            return [dict(row) for row in rows]

        finally:
            self._close_if_owned(connection, owned)


    def list_dispatch(
        self,
        limit: int = 100,
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
                    o.priority,
                    o.operation_note,
                    o.created_at,

                    b.id AS booking_id,
                    b.booking_code,
                    b.status AS booking_status,
                    b.source AS booking_source,

                    c.id AS customer_id,
                    c.first_name AS customer_first_name,
                    c.last_name AS customer_last_name,
                    c.phone AS customer_phone,

                    bs.title AS service_title,

                    t.pickup_location,
                    t.dropoff_location,
                    t.pickup_datetime,
                    t.flight_number,
                    t.pax,
                    t.luggage_count,
                    t.requested_vehicle_class,

                    oa.id AS assignment_id,
                    oa.status AS assignment_status,

                    d.id AS driver_id,
                    d.first_name AS driver_first_name,
                    d.last_name AS driver_last_name,
                    d.phone AS driver_phone,

                    v.id AS vehicle_id,
                    v.plate AS vehicle_plate,
                    v.brand AS vehicle_brand,
                    v.model AS vehicle_model,
                    v.vehicle_class

                FROM operations o

                LEFT JOIN transfers t
                  ON o.source_type = 'transfer'
                 AND t.company_id = o.company_id
                 AND t.id = o.source_id

                LEFT JOIN booking_services bs
                  ON bs.company_id = o.company_id
                 AND bs.id = t.booking_service_id

                LEFT JOIN bookings b
                  ON b.company_id = o.company_id
                 AND b.id = bs.booking_id

                LEFT JOIN customers c
                  ON c.company_id = o.company_id
                 AND c.id = b.customer_id

                LEFT JOIN operation_assignments oa
                  ON oa.company_id = o.company_id
                 AND oa.operation_id = o.id
                 AND oa.status NOT IN (
                    'cancelled',
                    'rejected'
                 )

                LEFT JOIN drivers d
                  ON d.company_id = o.company_id
                 AND d.id = oa.driver_id

                LEFT JOIN vehicles v
                  ON v.company_id = o.company_id
                 AND v.id = oa.vehicle_id

                WHERE o.company_id = ?
                  AND o.status != 'not_planned'

                ORDER BY
                    CASE o.status
                        WHEN 'problem' THEN 1
                        WHEN 'waiting_assignment' THEN 2
                        WHEN 'assigned' THEN 3
                        WHEN 'ready' THEN 4
                        WHEN 'in_progress' THEN 5
                        ELSE 6
                    END,
                    o.scheduled_start_at ASC,
                    o.priority ASC

                LIMIT ?
                """,
                (
                    get_company_id(),
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
