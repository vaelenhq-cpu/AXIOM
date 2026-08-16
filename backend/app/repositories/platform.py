from typing import Any, Dict, Optional

from app.core.tenant import get_company_id
from .base import BaseRepository


class CompanyDomainRepository(BaseRepository):
    table_name = "company_domains"

    def get_by_domain(
        self,
        domain: str,
    ) -> Optional[Dict[str, Any]]:
        connection, owned = self._conn()

        try:
            row = connection.execute(
                """
                SELECT *
                FROM company_domains
                WHERE company_id = ?
                  AND lower(domain) = lower(?)
                LIMIT 1
                """,
                (
                    get_company_id(),
                    domain,
                ),
            ).fetchone()

            return dict(row) if row else None

        finally:
            self._close_if_owned(
                connection,
                owned,
            )


class PublicBookingKeyTenantRepository(
    BaseRepository
):
    table_name = "public_booking_keys"


class DriverAccountRepository(
    BaseRepository
):
    table_name = "driver_accounts"
