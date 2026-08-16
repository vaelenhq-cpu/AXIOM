from typing import Any, Dict, Optional

from app.core.tenant import get_company_id

from .base import BaseRepository


class SessionRepository(BaseRepository):
    table_name = "auth_sessions"

    def get_by_token_hash(
        self,
        token_hash: str,
    ) -> Optional[Dict[str, Any]]:
        connection, owned = self._conn()

        try:
            row = connection.execute(
                """
                SELECT *
                FROM auth_sessions
                WHERE company_id = ?
                  AND token_hash = ?
                LIMIT 1
                """,
                (
                    get_company_id(),
                    token_hash,
                ),
            ).fetchone()

            return dict(row) if row else None

        finally:
            self._close_if_owned(connection, owned)

    def revoke(
        self,
        session_id: str,
    ) -> bool:
        connection, owned = self._conn()

        try:
            cursor = connection.execute(
                """
                UPDATE auth_sessions
                SET revoked_at = CURRENT_TIMESTAMP
                WHERE id = ?
                  AND company_id = ?
                  AND revoked_at IS NULL
                """,
                (
                    session_id,
                    get_company_id(),
                ),
            )

            if owned:
                connection.commit()

            return cursor.rowcount > 0

        except Exception:
            if owned:
                connection.rollback()
            raise

        finally:
            self._close_if_owned(connection, owned)
