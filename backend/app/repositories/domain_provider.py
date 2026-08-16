from typing import Any, Dict, Optional

from app.core.tenant import get_company_id
from app.repositories.base import BaseRepository


class DomainProviderConnectionRepository(
    BaseRepository
):
    table_name = "domain_provider_connections"

    def get_connected(
        self,
        provider: str,
    ) -> Optional[Dict[str, Any]]:
        connection, owned = self._conn()

        try:
            row = connection.execute(
                """
                SELECT *
                FROM domain_provider_connections
                WHERE company_id = ?
                  AND provider = ?
                  AND status = 'connected'
                ORDER BY created_at DESC
                LIMIT 1
                """,
                (
                    get_company_id(),
                    provider,
                ),
            ).fetchone()

            return dict(row) if row else None

        finally:
            self._close_if_owned(
                connection,
                owned,
            )


class DomainProviderZoneRepository(
    BaseRepository
):
    table_name = "domain_provider_zones"

    def get_by_domain(
        self,
        domain_id: str,
    ) -> Optional[Dict[str, Any]]:
        connection, owned = self._conn()

        try:
            row = connection.execute(
                """
                SELECT *
                FROM domain_provider_zones
                WHERE company_id = ?
                  AND domain_id = ?
                LIMIT 1
                """,
                (
                    get_company_id(),
                    domain_id,
                ),
            ).fetchone()

            return dict(row) if row else None

        finally:
            self._close_if_owned(
                connection,
                owned,
            )
