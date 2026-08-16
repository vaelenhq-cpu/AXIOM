from typing import Any, Dict, Optional

from app.core.tenant import get_company_id
from app.repositories.base import BaseRepository


class EncryptedSecretRepository(
    BaseRepository
):
    table_name = "encrypted_secrets"

    def get_secret(
        self,
        secret_id: str,
    ) -> Optional[Dict[str, Any]]:
        return self.get_by_id(
            secret_id
        )

    def list_by_type(
        self,
        secret_type: str,
    ):
        connection, owned = self._conn()

        try:
            rows = connection.execute(
                """
                SELECT *
                FROM encrypted_secrets
                WHERE company_id = ?
                  AND secret_type = ?
                ORDER BY created_at DESC
                """,
                (
                    get_company_id(),
                    secret_type,
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
