from app.core.tenant import get_company_id
from .base import BaseRepository


class OutboxWorkerRepository(
    BaseRepository
):
    table_name = "outbox_events"

    def pending(self, limit=100):
        connection, owned = self._conn()

        try:
            rows = connection.execute(
                """
                SELECT *
                FROM outbox_events
                WHERE company_id = ?
                  AND status = 'pending'
                  AND available_at
                      <= CURRENT_TIMESTAMP
                ORDER BY created_at ASC
                LIMIT ?
                """,
                (
                    get_company_id(),
                    limit,
                ),
            ).fetchall()

            return [
                dict(row)
                for row in rows
            ]

        finally:
            self._close_if_owned(
                connection,
                owned,
            )
