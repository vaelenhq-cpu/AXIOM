from typing import Any, Dict, Optional

from app.core.database import create_connection
from app.core.tenant import get_company_id
from app.repositories.base import BaseRepository


class DomainProviderOAuthStateRepository(
    BaseRepository
):
    table_name = "domain_provider_oauth_states"

    def get_by_state_hash(
        self,
        state_hash: str,
    ) -> Optional[Dict[str, Any]]:
        connection, owned = self._conn()

        try:
            row = connection.execute(
                """
                SELECT *
                FROM domain_provider_oauth_states
                WHERE company_id = ?
                  AND state_hash = ?
                  AND consumed_at IS NULL
                  AND expires_at > CURRENT_TIMESTAMP
                LIMIT 1
                """,
                (
                    get_company_id(),
                    state_hash,
                ),
            ).fetchone()

            return dict(row) if row else None

        finally:
            self._close_if_owned(
                connection,
                owned,
            )

    @staticmethod
    def resolve_public_state(
        state_hash: str,
    ) -> Optional[Dict[str, Any]]:
        """
        OAuth callback authenticated AXIOM
        session üzerinden gelmediği için state
        global olarak aranır.

        state_hash UNIQUE olduğundan tenant
        buradan güvenli biçimde çözülebilir.
        """

        connection = create_connection()

        try:
            row = connection.execute(
                """
                SELECT *
                FROM domain_provider_oauth_states
                WHERE state_hash = ?
                  AND consumed_at IS NULL
                  AND expires_at > CURRENT_TIMESTAMP
                LIMIT 1
                """,
                (state_hash,),
            ).fetchone()

            return dict(row) if row else None

        finally:
            connection.close()
