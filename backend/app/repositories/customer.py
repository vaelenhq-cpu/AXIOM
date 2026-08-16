from typing import Any, Dict, List, Optional

from app.core.tenant import get_company_id

from .base import BaseRepository


class CustomerRepository(BaseRepository):
    table_name = "customers"

    def find_by_phone(
        self,
        phone: str,
    ) -> Optional[Dict[str, Any]]:
        connection, owned = self._conn()

        try:
            row = connection.execute(
                """
                SELECT *
                FROM customers
                WHERE company_id = ?
                  AND phone = ?
                LIMIT 1
                """,
                (
                    get_company_id(),
                    phone,
                ),
            ).fetchone()

            return dict(row) if row else None

        finally:
            self._close_if_owned(connection, owned)

    def search(
        self,
        query: str,
        limit: int = 25,
    ) -> List[Dict[str, Any]]:
        connection, owned = self._conn()

        pattern = f"%{query.strip()}%"

        try:
            rows = connection.execute(
                """
                SELECT *
                FROM customers
                WHERE company_id = ?
                  AND (
                    first_name LIKE ?
                    OR last_name LIKE ?
                    OR email LIKE ?
                    OR phone LIKE ?
                  )
                ORDER BY created_at DESC
                LIMIT ?
                """,
                (
                    get_company_id(),
                    pattern,
                    pattern,
                    pattern,
                    pattern,
                    limit,
                ),
            ).fetchall()

            return [dict(row) for row in rows]

        finally:
            self._close_if_owned(connection, owned)
