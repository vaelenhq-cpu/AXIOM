from typing import Any, Dict, Optional

from app.core.tenant import get_company_id

from .base import BaseRepository


class TransferRepository(BaseRepository):
    table_name = "transfers"

    def get_by_booking_service(
        self,
        booking_service_id: str,
    ) -> Optional[Dict[str, Any]]:
        connection, owned = self._conn()

        try:
            row = connection.execute(
                """
                SELECT *
                FROM transfers
                WHERE company_id = ?
                  AND booking_service_id = ?
                LIMIT 1
                """,
                (
                    get_company_id(),
                    booking_service_id,
                ),
            ).fetchone()

            return dict(row) if row else None

        finally:
            self._close_if_owned(connection, owned)
