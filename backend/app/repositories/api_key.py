import sqlite3
from typing import Any, Dict, Optional

from app.core.database import create_connection


class ApiKeyRepository:
    def __init__(
        self,
        connection: Optional[sqlite3.Connection] = None,
    ):
        self.connection = connection

    def _conn(self):
        if self.connection is not None:
            return self.connection, False

        return create_connection(), True

    def get_active_by_hash(
        self,
        key_hash: str,
    ) -> Optional[Dict[str, Any]]:
        connection, owned = self._conn()

        try:
            row = connection.execute(
                """
                SELECT *
                FROM api_keys
                WHERE key_hash = ?
                  AND status = 'active'
                  AND revoked_at IS NULL
                  AND (
                    expires_at IS NULL
                    OR expires_at > CURRENT_TIMESTAMP
                  )
                LIMIT 1
                """,
                (key_hash,),
            ).fetchone()

            return dict(row) if row else None

        finally:
            if owned:
                connection.close()
