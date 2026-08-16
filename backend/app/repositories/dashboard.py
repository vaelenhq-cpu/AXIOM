from typing import Any, Dict, List

from app.core.tenant import get_company_id
from .base import BaseRepository


class DashboardRepository(BaseRepository):
    table_name = "bookings"

    def summary(self) -> Dict[str, Any]:
        company_id = get_company_id()
        connection, owned = self._conn()

        try:
            booking_stats = connection.execute(
                """
                SELECT
                    COUNT(*) AS total,
                    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
                    SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) AS confirmed,
                    SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled,
                    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed
                FROM bookings
                WHERE company_id = ?
                """,
                (company_id,),
            ).fetchone()

            operation_stats = connection.execute(
                """
                SELECT
                    COUNT(*) AS total,
                    SUM(CASE WHEN status = 'waiting_assignment' THEN 1 ELSE 0 END) AS waiting_assignment,
                    SUM(CASE WHEN status = 'assigned' THEN 1 ELSE 0 END) AS assigned,
                    SUM(CASE WHEN status = 'ready' THEN 1 ELSE 0 END) AS ready,
                    SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress,
                    SUM(CASE WHEN status = 'problem' THEN 1 ELSE 0 END) AS problem,
                    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed
                FROM operations
                WHERE company_id = ?
                """,
                (company_id,),
            ).fetchone()

            driver_stats = connection.execute(
                """
                SELECT
                    COUNT(*) AS total,
                    SUM(CASE WHEN active = 1 THEN 1 ELSE 0 END) AS active,
                    SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) AS available,
                    SUM(CASE WHEN status = 'busy' THEN 1 ELSE 0 END) AS busy,
                    SUM(CASE WHEN status = 'off_duty' THEN 1 ELSE 0 END) AS off_duty
                FROM drivers
                WHERE company_id = ?
                """,
                (company_id,),
            ).fetchone()

            vehicle_stats = connection.execute(
                """
                SELECT
                    COUNT(*) AS total,
                    SUM(CASE WHEN active = 1 THEN 1 ELSE 0 END) AS active,
                    SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) AS available,
                    SUM(CASE WHEN status = 'busy' THEN 1 ELSE 0 END) AS busy,
                    SUM(CASE WHEN status = 'maintenance' THEN 1 ELSE 0 END) AS maintenance
                FROM vehicles
                WHERE company_id = ?
                """,
                (company_id,),
            ).fetchone()

            transfer_stats = connection.execute(
                """
                SELECT
                    COUNT(*) AS total,
                    SUM(
                        CASE
                            WHEN o.status = 'waiting_assignment'
                            THEN 1
                            ELSE 0
                        END
                    ) AS waiting_assignment,
                    SUM(
                        CASE
                            WHEN o.status = 'in_progress'
                            THEN 1
                            ELSE 0
                        END
                    ) AS in_progress
                FROM transfers t
                LEFT JOIN operations o
                  ON o.company_id = t.company_id
                 AND o.source_type = 'transfer'
                 AND o.source_id = t.id
                WHERE t.company_id = ?
                """,
                (company_id,),
            ).fetchone()

            tour_stats = connection.execute(
                """
                SELECT
                    COUNT(*) AS total_departures,
                    SUM(CASE WHEN status = 'scheduled' THEN 1 ELSE 0 END) AS scheduled,
                    SUM(CASE WHEN status = 'ready' THEN 1 ELSE 0 END) AS ready,
                    SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress,
                    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed
                FROM tour_departures
                WHERE company_id = ?
                """,
                (company_id,),
            ).fetchone()

            return {
                "bookings": dict(booking_stats),
                "operations": dict(operation_stats),
                "drivers": dict(driver_stats),
                "vehicles": dict(vehicle_stats),
                "transfers": dict(transfer_stats),
                "tours": dict(tour_stats),
            }

        finally:
            self._close_if_owned(connection, owned)

    def action_required(self) -> List[Dict[str, Any]]:
        company_id = get_company_id()
        connection, owned = self._conn()

        try:
            rows = []

            waiting_ops = connection.execute(
                """
                SELECT
                    o.id,
                    o.source_type,
                    o.source_id,
                    o.status,
                    o.scheduled_start_at,
                    o.priority,

                    t.pickup_location,
                    t.dropoff_location,

                    b.booking_code,

                    c.first_name AS customer_first_name,
                    c.last_name AS customer_last_name,

                    d.first_name AS driver_first_name,
                    d.last_name AS driver_last_name,

                    v.plate AS vehicle_plate,

                    oe.event_type AS latest_event_type,
                    oe.description AS latest_event_description,
                    oe.created_at AS latest_event_at

                FROM operations o

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

                LEFT JOIN operation_assignments oa
                  ON oa.operation_id = o.id
                 AND oa.company_id = o.company_id
                 AND oa.status NOT IN (
                    'cancelled',
                    'rejected'
                 )

                LEFT JOIN drivers d
                  ON d.id = oa.driver_id
                 AND d.company_id = o.company_id

                LEFT JOIN vehicles v
                  ON v.id = oa.vehicle_id
                 AND v.company_id = o.company_id

                LEFT JOIN operation_events oe
                  ON oe.id = (
                    SELECT oe2.id
                    FROM operation_events oe2
                    WHERE oe2.company_id = o.company_id
                      AND oe2.operation_id = o.id
                      AND oe2.event_type IN (
                        'driver_delay',
                        'passenger_missing',
                        'driver_problem'
                      )
                    ORDER BY oe2.created_at DESC
                    LIMIT 1
                  )

                WHERE o.company_id = ?
                  AND o.status IN (
                    'waiting_assignment',
                    'problem'
                  )

                ORDER BY
                    CASE
                        WHEN o.status = 'problem'
                            THEN 1
                        ELSE 2
                    END,
                    o.priority ASC,
                    o.scheduled_start_at ASC

                LIMIT 100
                """,
                (company_id,),
            ).fetchall()

            for row in waiting_ops:
                item = dict(row)
                item["type"] = "operation"
                rows.append(item)

            delay_events = connection.execute(
                """
                SELECT
                    o.id,
                    o.source_type,
                    o.source_id,
                    o.status,
                    o.scheduled_start_at,
                    o.priority,

                    t.pickup_location,
                    t.dropoff_location,

                    b.booking_code,

                    c.first_name AS customer_first_name,
                    c.last_name AS customer_last_name,

                    d.first_name AS driver_first_name,
                    d.last_name AS driver_last_name,

                    v.plate AS vehicle_plate,

                    oe.event_type AS latest_event_type,
                    oe.description AS latest_event_description,
                    oe.created_at AS latest_event_at

                FROM operation_events oe

                JOIN operations o
                  ON o.id = oe.operation_id
                 AND o.company_id = oe.company_id

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

                LEFT JOIN operation_assignments oa
                  ON oa.operation_id = o.id
                 AND oa.company_id = o.company_id
                 AND oa.status NOT IN (
                    'cancelled',
                    'rejected'
                 )

                LEFT JOIN drivers d
                  ON d.id = oa.driver_id
                 AND d.company_id = o.company_id

                LEFT JOIN vehicles v
                  ON v.id = oa.vehicle_id
                 AND v.company_id = o.company_id

                WHERE oe.company_id = ?
                  AND oe.event_type = 'driver_delay'
                  AND o.status NOT IN (
                    'completed',
                    'cancelled',
                    'problem'
                  )

                  AND oe.id = (
                    SELECT oe2.id
                    FROM operation_events oe2
                    WHERE oe2.company_id = oe.company_id
                      AND oe2.operation_id = oe.operation_id
                      AND oe2.event_type = 'driver_delay'
                    ORDER BY oe2.created_at DESC
                    LIMIT 1
                  )

                ORDER BY oe.created_at DESC

                LIMIT 100
                """,
                (company_id,),
            ).fetchall()

            known_operation_ids = {
                item["id"]
                for item in rows
                if item["type"] == "operation"
            }

            for row in delay_events:
                item = dict(row)

                if item["id"] in known_operation_ids:
                    continue

                item["type"] = "operation"
                item["alert_type"] = "delay"

                rows.append(item)

            pending_bookings = connection.execute(
                """
                SELECT
                    id,
                    booking_code,
                    status,
                    source,
                    total_amount,
                    currency,
                    created_at
                FROM bookings
                WHERE company_id = ?
                  AND status = 'pending'
                ORDER BY created_at DESC
                LIMIT 100
                """,
                (company_id,),
            ).fetchall()

            for row in pending_bookings:
                item = dict(row)
                item["type"] = "booking"
                rows.append(item)

            return rows

        finally:
            self._close_if_owned(
                connection,
                owned,
            )

    def recent_bookings(
        self,
        limit: int = 20,
    ) -> List[Dict[str, Any]]:
        company_id = get_company_id()
        connection, owned = self._conn()

        try:
            rows = connection.execute(
                """
                SELECT
                    b.id,
                    b.booking_code,
                    b.status,
                    b.source,
                    b.total_amount,
                    b.currency,
                    b.created_at,
                    c.first_name,
                    c.last_name,
                    c.phone
                FROM bookings b
                LEFT JOIN customers c
                  ON c.id = b.customer_id
                 AND c.company_id = b.company_id
                WHERE b.company_id = ?
                ORDER BY b.created_at DESC
                LIMIT ?
                """,
                (
                    company_id,
                    limit,
                ),
            ).fetchall()

            return [dict(row) for row in rows]

        finally:
            self._close_if_owned(connection, owned)

    def upcoming_operations(
        self,
        limit: int = 20,
    ) -> List[Dict[str, Any]]:
        company_id = get_company_id()
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

                    oa.driver_id,
                    oa.vehicle_id,
                    oa.status AS assignment_status,

                    d.first_name AS driver_first_name,
                    d.last_name AS driver_last_name,

                    v.plate AS vehicle_plate,
                    v.brand AS vehicle_brand,
                    v.model AS vehicle_model,
                    v.vehicle_class,

                    t.pickup_location,
                    t.dropoff_location,
                    t.pickup_datetime,
                    t.flight_number,
                    t.pax,
                    t.luggage_count,

                    b.id AS booking_id,
                    b.booking_code,

                    c.first_name AS customer_first_name,
                    c.last_name AS customer_last_name,
                    c.phone AS customer_phone

                FROM operations o

                LEFT JOIN operation_assignments oa
                  ON oa.operation_id = o.id
                 AND oa.company_id = o.company_id
                 AND oa.status NOT IN (
                    'cancelled',
                    'rejected'
                 )

                LEFT JOIN drivers d
                  ON d.id = oa.driver_id
                 AND d.company_id = o.company_id

                LEFT JOIN vehicles v
                  ON v.id = oa.vehicle_id
                 AND v.company_id = o.company_id

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

                WHERE o.company_id = ?
                  AND o.status NOT IN (
                    'completed',
                    'cancelled'
                  )

                ORDER BY
                    CASE
                        WHEN o.status = 'problem'
                            THEN 1
                        WHEN o.status = 'in_progress'
                            THEN 2
                        WHEN o.status = 'ready'
                            THEN 3
                        WHEN o.status = 'assigned'
                            THEN 4
                        WHEN o.status = 'waiting_assignment'
                            THEN 5
                        ELSE 6
                    END,
                    o.scheduled_start_at ASC,
                    o.priority ASC

                LIMIT ?
                """,
                (
                    company_id,
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
