from typing import Any, Dict, List

from app.core.tenant import get_company_id

from .base import BaseRepository


class AssignmentRepository(BaseRepository):
    table_name = "operation_assignments"

    def list_by_operation(
        self,
        operation_id: str,
    ) -> List[Dict[str, Any]]:
        connection, owned = self._conn()

        try:
            rows = connection.execute(
                """
                SELECT *
                FROM operation_assignments
                WHERE company_id = ?
                  AND operation_id = ?
                ORDER BY assigned_at DESC
                """,
                (
                    get_company_id(),
                    operation_id,
                ),
            ).fetchall()

            return [dict(row) for row in rows]

        finally:
            self._close_if_owned(connection, owned)
