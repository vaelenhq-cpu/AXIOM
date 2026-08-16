from typing import Any, Dict, List, Optional

from app.core.tenant import get_company_id

from .base import BaseRepository


class BookingRepository(BaseRepository):
    table_name = "bookings"

    def get_by_code(
        self,
        booking_code: str,
    ) -> Optional[Dict[str, Any]]:
        connection, owned = self._conn()

        try:
            row = connection.execute(
                """
                SELECT *
                FROM bookings
                WHERE company_id = ?
                  AND booking_code = ?
                LIMIT 1
                """,
                (
                    get_company_id(),
                    booking_code,
                ),
            ).fetchone()

            return dict(row) if row else None

        finally:
            self._close_if_owned(connection, owned)

    def list_by_status(
        self,
        status: str,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        connection, owned = self._conn()

        try:
            rows = connection.execute(
                """
                SELECT *
                FROM bookings
                WHERE company_id = ?
                  AND status = ?
                ORDER BY created_at DESC
                LIMIT ?
                """,
                (
                    get_company_id(),
                    status,
                    limit,
                ),
            ).fetchall()

            return [dict(row) for row in rows]

        finally:
            self._close_if_owned(connection, owned)

    def list_recent(
        self,
        limit: int = 50,
    ):
        from app.core.tenant import get_company_id

        connection, owned = self._conn()

        try:
            rows = connection.execute(
                """
                SELECT
                    b.id,
                    b.booking_code,
                    b.status,
                    b.source,
                    b.source_provider,
                    b.external_reference,
                    b.currency,
                    b.total_amount,
                    b.created_at,
                    b.booked_at,

                    c.first_name
                        AS customer_first_name,
                    c.last_name
                        AS customer_last_name,
                    c.phone
                        AS customer_phone,
                    c.email
                        AS customer_email,

                    bs.service_type,
                    bs.title
                        AS service_title,
                    bs.service_date,
                    bs.start_time,

                    (
                        COALESCE(
                            bs.pax_adult,
                            0
                        )
                        +
                        COALESCE(
                            bs.pax_child,
                            0
                        )
                        +
                        COALESCE(
                            bs.pax_infant,
                            0
                        )
                    ) AS pax_total,

                    t.pickup_location,
                    t.dropoff_location,
                    t.pickup_datetime,
                    t.flight_number,
                    t.requested_vehicle_class,

                    tp.name AS tour_name,
                    td.departure_date,
                    td.departure_time

                FROM bookings b

                LEFT JOIN customers c
                  ON c.company_id = b.company_id
                 AND c.id = b.customer_id

                LEFT JOIN booking_services bs
                  ON bs.company_id = b.company_id
                 AND bs.booking_id = b.id

                LEFT JOIN transfers t
                  ON t.company_id = b.company_id
                 AND t.booking_service_id = bs.id
                 AND bs.service_type = 'transfer'

                LEFT JOIN tour_bookings tb
                  ON tb.company_id = b.company_id
                 AND tb.booking_service_id = bs.id
                 AND bs.service_type = 'tour'

                LEFT JOIN tour_departures td
                  ON td.company_id = b.company_id
                 AND td.id = tb.tour_departure_id

                LEFT JOIN tour_products tp
                  ON tp.company_id = b.company_id
                 AND tp.id = td.tour_product_id

                WHERE b.company_id = ?

                GROUP BY b.id

                ORDER BY
                    b.created_at DESC

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

    def get_services(
        self,
        booking_id: str,
    ) -> List[Dict[str, Any]]:
        connection, owned = self._conn()

        try:
            rows = connection.execute(
                """
                SELECT *
                FROM booking_services
                WHERE company_id = ?
                  AND booking_id = ?
                ORDER BY created_at ASC
                """,
                (
                    get_company_id(),
                    booking_id,
                ),
            ).fetchall()

            return [dict(row) for row in rows]

        finally:
            self._close_if_owned(connection, owned)


    def get_full_detail(
        self,
        booking_id: str,
    ):
        from app.core.tenant import get_company_id

        connection, owned = self._conn()

        try:
            company_id = get_company_id()

            booking_row = connection.execute(
                """
                SELECT
                    b.*,

                    c.first_name AS customer_first_name,
                    c.last_name AS customer_last_name,
                    c.email AS customer_email,
                    c.phone AS customer_phone,
                    c.nationality AS customer_nationality,
                    c.language AS customer_language,
                    c.notes AS customer_notes

                FROM bookings b

                LEFT JOIN customers c
                  ON c.id = b.customer_id
                 AND c.company_id = b.company_id

                WHERE b.company_id = ?
                  AND b.id = ?

                LIMIT 1
                """,
                (
                    company_id,
                    booking_id,
                ),
            ).fetchone()

            if booking_row is None:
                return None

            booking = dict(
                booking_row
            )

            service_rows = connection.execute(
                """
                SELECT *
                FROM booking_services
                WHERE company_id = ?
                  AND booking_id = ?
                ORDER BY created_at ASC
                """,
                (
                    company_id,
                    booking_id,
                ),
            ).fetchall()

            services = []

            for service_row in service_rows:
                service = dict(
                    service_row
                )

                service_type = service[
                    "service_type"
                ]

                if service_type == "transfer":
                    transfer = connection.execute(
                        """
                        SELECT *
                        FROM transfers
                        WHERE company_id = ?
                          AND booking_service_id = ?
                        LIMIT 1
                        """,
                        (
                            company_id,
                            service["id"],
                        ),
                    ).fetchone()

                    if transfer:
                        transfer_data = dict(
                            transfer
                        )

                        operation = connection.execute(
                            """
                            SELECT
                                o.*,

                                oa.id AS assignment_id,
                                oa.driver_id,
                                oa.vehicle_id,
                                oa.status
                                    AS assignment_status,

                                d.first_name
                                    AS driver_first_name,
                                d.last_name
                                    AS driver_last_name,

                                v.plate
                                    AS vehicle_plate,
                                v.brand
                                    AS vehicle_brand,
                                v.model
                                    AS vehicle_model

                            FROM operations o

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
                              AND o.source_type = 'transfer'
                              AND o.source_id = ?

                            ORDER BY oa.assigned_at DESC

                            LIMIT 1
                            """,
                            (
                                company_id,
                                transfer_data["id"],
                            ),
                        ).fetchone()

                        service[
                            "transfer"
                        ] = transfer_data

                        service[
                            "operation"
                        ] = (
                            dict(operation)
                            if operation
                            else None
                        )

                elif service_type == "tour":
                    tour_booking = connection.execute(
                        """
                        SELECT
                            tb.*,

                            td.departure_date,
                            td.departure_time,
                            td.meeting_point,
                            td.status
                                AS departure_status,

                            tp.id
                                AS tour_product_id,
                            tp.name
                                AS tour_name,
                            tp.code
                                AS tour_code

                        FROM tour_bookings tb

                        JOIN tour_departures td
                          ON td.company_id = tb.company_id
                         AND td.id =
                            tb.tour_departure_id

                        JOIN tour_products tp
                          ON tp.company_id = tb.company_id
                         AND tp.id =
                            td.tour_product_id

                        WHERE tb.company_id = ?
                          AND tb.booking_service_id = ?

                        LIMIT 1
                        """,
                        (
                            company_id,
                            service["id"],
                        ),
                    ).fetchone()

                    service[
                        "tour"
                    ] = (
                        dict(tour_booking)
                        if tour_booking
                        else None
                    )

                services.append(
                    service
                )

            booking["customer"] = {
                "id":
                    booking.get(
                        "customer_id"
                    ),

                "first_name":
                    booking.pop(
                        "customer_first_name",
                        None,
                    ),

                "last_name":
                    booking.pop(
                        "customer_last_name",
                        None,
                    ),

                "email":
                    booking.pop(
                        "customer_email",
                        None,
                    ),

                "phone":
                    booking.pop(
                        "customer_phone",
                        None,
                    ),

                "nationality":
                    booking.pop(
                        "customer_nationality",
                        None,
                    ),

                "language":
                    booking.pop(
                        "customer_language",
                        None,
                    ),

                "notes":
                    booking.pop(
                        "customer_notes",
                        None,
                    ),
            }

            booking["services"] = services

            return booking

        finally:
            self._close_if_owned(
                connection,
                owned,
            )
