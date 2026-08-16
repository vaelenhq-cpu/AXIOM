import sqlite3
from typing import Any, Dict, Optional

from app.core.database import create_connection


class DriverAuthRepository:
    def __init__(
        self,
        connection: Optional[sqlite3.Connection] = None,
    ):
        self.connection = connection

    def _conn(self):
        if self.connection is not None:
            return self.connection, False

        return create_connection(), True

    def find_identity(
        self,
        *,
        company_slug: str,
        login_identifier: str,
    ) -> Optional[Dict[str, Any]]:
        connection, owned = self._conn()

        try:
            row = connection.execute(
                """
                SELECT
                    da.*,
                    d.first_name,
                    d.last_name,
                    d.phone,
                    d.active AS driver_active,
                    c.slug AS company_slug,
                    c.status AS company_status
                FROM driver_accounts da
                JOIN drivers d
                  ON d.id = da.driver_id
                 AND d.company_id = da.company_id
                JOIN companies c
                  ON c.id = da.company_id
                WHERE c.slug = ?
                  AND da.login_identifier = ?
                LIMIT 1
                """,
                (
                    company_slug.strip(),
                    login_identifier.strip(),
                ),
            ).fetchone()

            return dict(row) if row else None

        finally:
            if owned:
                connection.close()

    def get_session(
        self,
        token_hash: str,
    ) -> Optional[Dict[str, Any]]:
        connection, owned = self._conn()

        try:
            row = connection.execute(
                """
                SELECT
                    ds.id AS session_id,
                    ds.company_id,
                    ds.driver_account_id,
                    ds.expires_at,
                    ds.revoked_at,
                    da.driver_id,
                    da.status AS account_status,
                    d.first_name,
                    d.last_name,
                    d.active AS driver_active,
                    c.status AS company_status
                FROM driver_sessions ds
                JOIN driver_accounts da
                  ON da.id = ds.driver_account_id
                 AND da.company_id = ds.company_id
                JOIN drivers d
                  ON d.id = da.driver_id
                 AND d.company_id = ds.company_id
                JOIN companies c
                  ON c.id = ds.company_id
                WHERE ds.token_hash = ?
                LIMIT 1
                """,
                (token_hash,),
            ).fetchone()

            return dict(row) if row else None

        finally:
            if owned:
                connection.close()
