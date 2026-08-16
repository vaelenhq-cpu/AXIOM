from typing import Any, Dict, List

from app.core.tenant import get_company_id

from .base import BaseRepository


class BookingServiceRepository(BaseRepository):
    table_name = "booking_services"

    def list_by_booking(
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
