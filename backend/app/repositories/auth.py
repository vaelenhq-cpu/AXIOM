import sqlite3
from typing import Any, Dict, Optional

from app.core.database import create_connection


class AuthRepository:
    def __init__(
        self,
        connection: Optional[sqlite3.Connection] = None,
    ):
        self.connection = connection

    def _conn(self):
        if self.connection is not None:
            return self.connection, False

        return create_connection(), True

    def find_login_identity(
        self,
        *,
        company_slug: str,
        email: str,
    ) -> Optional[Dict[str, Any]]:
        connection, owned = self._conn()

        try:
            row = connection.execute(
                """
                SELECT
                    u.*,
                    c.slug AS company_slug,
                    c.name AS company_name,
                    c.status AS company_status
                FROM company_users u
                JOIN companies c
                  ON c.id = u.company_id
                WHERE c.slug = ?
                  AND lower(u.email) = lower(?)
                LIMIT 1
                """,
                (
                    company_slug.strip(),
                    email.strip(),
                ),
            ).fetchone()

            return dict(row) if row else None

        finally:
            if owned:
                connection.close()

    def get_session_with_user(
        self,
        token_hash: str,
    ) -> Optional[Dict[str, Any]]:
        connection, owned = self._conn()

        try:
            row = connection.execute(
                """
                SELECT
                    s.id AS session_id,
                    s.company_id,
                    s.user_id,
                    s.expires_at,
                    s.revoked_at,
                    u.email,
                    u.first_name,
                    u.last_name,
                    u.role,
                    u.status AS user_status,
                    c.status AS company_status
                FROM auth_sessions s
                JOIN company_users u
                  ON u.id = s.user_id
                 AND u.company_id = s.company_id
                JOIN companies c
                  ON c.id = s.company_id
                WHERE s.token_hash = ?
                LIMIT 1
                """,
                (token_hash,),
            ).fetchone()

            return dict(row) if row else None

        finally:
            if owned:
                connection.close()
