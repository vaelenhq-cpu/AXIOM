from typing import Any, Dict, List

from app.core.tenant import get_company_id

from .base import BaseRepository


class VehicleRepository(BaseRepository):
    table_name = "vehicles"

    def list_available(self) -> List[Dict[str, Any]]:
        connection, owned = self._conn()

        try:
            rows = connection.execute(
                """
                SELECT *
                FROM vehicles
                WHERE company_id = ?
                  AND active = 1
                  AND status = 'available'
                ORDER BY plate
                """,
                (get_company_id(),),
            ).fetchall()

            return [dict(row) for row in rows]

        finally:
            self._close_if_owned(connection, owned)
