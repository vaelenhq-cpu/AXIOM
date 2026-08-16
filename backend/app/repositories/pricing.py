from typing import Any, Dict, List, Optional

from app.core.tenant import get_company_id

from .base import BaseRepository


class PricingRepository(BaseRepository):
    table_name = "pricing_rules"

    def find_route_price(
        self,
        *,
        route_id: str,
        vehicle_class: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:

        connection, owned = self._conn()

        try:
            rows = connection.execute(
                """
                SELECT *
                FROM pricing_rules
                WHERE company_id = ?
                  AND active = 1
                  AND rule_type = 'route'
                  AND route_id = ?
                  AND (
                    vehicle_class IS NULL
                    OR vehicle_class = ?
                  )
                ORDER BY priority ASC
                """,
                (
                    get_company_id(),
                    route_id,
                    vehicle_class,
                ),
            ).fetchall()

            if not rows:
                return None

            return dict(rows[0])

        finally:
            self._close_if_owned(connection, owned)

    def list_active(self) -> List[Dict[str, Any]]:
        connection, owned = self._conn()

        try:
            rows = connection.execute(
                """
                SELECT *
                FROM pricing_rules
                WHERE company_id = ?
                  AND active = 1
                ORDER BY priority ASC
                """,
                (get_company_id(),),
            ).fetchall()

            return [dict(row) for row in rows]

        finally:
            self._close_if_owned(connection, owned)
