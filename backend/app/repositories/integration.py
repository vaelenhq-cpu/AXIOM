from typing import Any, Dict, List, Optional

from app.core.tenant import get_company_id
from .base import BaseRepository


class IntegrationRepository(BaseRepository):
    table_name = "integrations"

    def list_active(self) -> List[Dict[str, Any]]:
        connection, owned = self._conn()

        try:
            rows = connection.execute(
                """
                SELECT *
                FROM integrations
                WHERE company_id = ?
                  AND status = 'active'
                ORDER BY created_at DESC
                """,
                (get_company_id(),),
            ).fetchall()

            return [dict(row) for row in rows]

        finally:
            self._close_if_owned(connection, owned)


class IntegrationEventRepository(BaseRepository):
    table_name = "integration_events"


class ExternalBookingRepository(BaseRepository):
    table_name = "external_bookings"

    def get_by_external_id(
        self,
        *,
        integration_id: str,
        external_booking_id: str,
    ) -> Optional[Dict[str, Any]]:

        connection, owned = self._conn()

        try:
            row = connection.execute(
                """
                SELECT *
                FROM external_bookings
                WHERE company_id = ?
                  AND integration_id = ?
                  AND external_booking_id = ?
                LIMIT 1
                """,
                (
                    get_company_id(),
                    integration_id,
                    external_booking_id,
                ),
            ).fetchone()

            return dict(row) if row else None

        finally:
            self._close_if_owned(connection, owned)


class IntegrationMappingRepository(BaseRepository):
    table_name = "integration_entity_mappings"
