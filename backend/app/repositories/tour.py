from typing import Any, Dict, List, Optional

from app.core.tenant import get_company_id

from .base import BaseRepository


class TourProductRepository(BaseRepository):
    table_name = "tour_products"

    def get_by_code(
        self,
        code: str,
    ) -> Optional[Dict[str, Any]]:
        connection, owned = self._conn()

        try:
            row = connection.execute(
                """
                SELECT *
                FROM tour_products
                WHERE company_id = ?
                  AND code = ?
                LIMIT 1
                """,
                (
                    get_company_id(),
                    code,
                ),
            ).fetchone()

            return dict(row) if row else None

        finally:
            self._close_if_owned(connection, owned)


class TourDepartureRepository(BaseRepository):
    table_name = "tour_departures"

    def list_by_date(
        self,
        departure_date: str,
    ) -> List[Dict[str, Any]]:
        connection, owned = self._conn()

        try:
            rows = connection.execute(
                """
                SELECT
                    td.*,
                    tp.name AS tour_name,
                    tp.code AS tour_code
                FROM tour_departures td
                JOIN tour_products tp
                  ON tp.id = td.tour_product_id
                 AND tp.company_id = td.company_id
                WHERE td.company_id = ?
                  AND td.departure_date = ?
                ORDER BY td.departure_time ASC
                """,
                (
                    get_company_id(),
                    departure_date,
                ),
            ).fetchall()

            return [dict(row) for row in rows]

        finally:
            self._close_if_owned(connection, owned)


class TourBookingRepository(BaseRepository):
    table_name = "tour_bookings"

    def list_by_departure(
        self,
        departure_id: str,
    ) -> List[Dict[str, Any]]:
        connection, owned = self._conn()

        try:
            rows = connection.execute(
                """
                SELECT *
                FROM tour_bookings
                WHERE company_id = ?
                  AND tour_departure_id = ?
                ORDER BY created_at ASC
                """,
                (
                    get_company_id(),
                    departure_id,
                ),
            ).fetchall()

            return [dict(row) for row in rows]

        finally:
            self._close_if_owned(connection, owned)
