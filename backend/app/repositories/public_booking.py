import sqlite3
from typing import Any, Dict, Optional

from app.core.database import create_connection
from app.core.tenant import get_company_id

from .base import BaseRepository


class PublicBookingLookupRepository:
    def __init__(
        self,
        connection: Optional[
            sqlite3.Connection
        ] = None,
    ):
        self.connection = connection

    def _conn(self):
        if self.connection is not None:
            return self.connection, False

        return create_connection(), True

    def get_key(
        self,
        public_key: str,
    ) -> Optional[Dict[str, Any]]:
        connection, owned = self._conn()

        try:
            row = connection.execute(
                """
                SELECT *
                FROM public_booking_keys
                WHERE public_key = ?
                  AND active = 1
                  AND revoked_at IS NULL
                LIMIT 1
                """,
                (public_key,),
            ).fetchone()

            return dict(row) if row else None

        finally:
            if owned:
                connection.close()


class PublicBookingRequestRepository(
    BaseRepository
):
    table_name = "public_booking_requests"

    def get_by_request_id(
        self,
        request_id: str,
    ) -> Optional[Dict[str, Any]]:
        connection, owned = self._conn()

        try:
            row = connection.execute(
                """
                SELECT *
                FROM public_booking_requests
                WHERE company_id = ?
                  AND request_id = ?
                LIMIT 1
                """,
                (
                    get_company_id(),
                    request_id,
                ),
            ).fetchone()

            return dict(row) if row else None

        finally:
            self._close_if_owned(
                connection,
                owned,
            )
