from typing import Any, Dict, Optional

from app.core.tenant import get_company_id

from .base import BaseRepository


class CompanySettingsRepository(BaseRepository):
    table_name = "company_settings"

    def get_current(
        self,
    ) -> Optional[Dict[str, Any]]:
        connection, owned = self._conn()

        try:
            row = connection.execute(
                """
                SELECT *
                FROM company_settings
                WHERE company_id = ?
                LIMIT 1
                """,
                (get_company_id(),),
            ).fetchone()

            return dict(row) if row else None

        finally:
            self._close_if_owned(
                connection,
                owned,
            )
