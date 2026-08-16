from typing import Any, Dict, List

from app.core.tenant import get_company_id

from .base import BaseRepository


class RouteRepository(BaseRepository):
    table_name = "routes"

    def list_active(self) -> List[Dict[str, Any]]:
        connection, owned = self._conn()

        try:
            rows = connection.execute(
                """
                SELECT *
                FROM routes
                WHERE company_id = ?
                  AND active = 1
                ORDER BY name
                """,
                (get_company_id(),),
            ).fetchall()

            return [dict(row) for row in rows]

        finally:
            self._close_if_owned(connection, owned)
