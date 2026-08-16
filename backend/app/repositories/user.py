from typing import Any, Dict, Optional

from app.core.tenant import get_company_id

from .base import BaseRepository


class UserRepository(BaseRepository):
    table_name = "company_users"

    def get_by_email(
        self,
        email: str,
    ) -> Optional[Dict[str, Any]]:
        connection, owned = self._conn()

        try:
            row = connection.execute(
                """
                SELECT *
                FROM company_users
                WHERE company_id = ?
                  AND lower(email) = lower(?)
                LIMIT 1
                """,
                (
                    get_company_id(),
                    email.strip(),
                ),
            ).fetchone()

            return dict(row) if row else None

        finally:
            self._close_if_owned(connection, owned)
