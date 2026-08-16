from typing import Any, Dict, Optional

from app.core.tenant import get_company_id

from .base import BaseRepository


class CompanyRepository(BaseRepository):
    table_name = "companies"
    tenant_scoped = False

    def get_by_slug(
        self,
        slug: str,
    ) -> Optional[Dict[str, Any]]:
        connection, owned = self._conn()

        try:
            row = connection.execute(
                """
                SELECT *
                FROM companies
                WHERE slug = ?
                LIMIT 1
                """,
                (slug,),
            ).fetchone()

            return dict(row) if row else None

        finally:
            self._close_if_owned(
                connection,
                owned,
            )

    def get_current(
        self,
    ) -> Optional[Dict[str, Any]]:
        connection, owned = self._conn()

        try:
            row = connection.execute(
                """
                SELECT *
                FROM companies
                WHERE id = ?
                LIMIT 1
                """,
                (get_company_id(),),
            ).fetchone()

            return dict(row) if row else None

        finally:
            self._close_if_owned(
                connection,
                owned,
            )

    def update_current(
        self,
        data: Dict[str, Any],
    ) -> Optional[Dict[str, Any]]:
        allowed = {
            "name",
            "legal_name",
            "tax_number",
            "country_code",
            "timezone",
            "default_currency",
        }

        payload = {
            key: value
            for key, value in data.items()
            if key in allowed
        }

        if not payload:
            return self.get_current()

        assignments = ", ".join(
            f"{column} = ?"
            for column in payload.keys()
        )

        values = list(payload.values())
        values.append(get_company_id())

        connection, owned = self._conn()

        try:
            cursor = connection.execute(
                f"""
                UPDATE companies
                SET {assignments},
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                values,
            )

            if owned:
                connection.commit()

            if cursor.rowcount == 0:
                return None

            return self.get_current()

        except Exception:
            if owned:
                connection.rollback()
            raise

        finally:
            self._close_if_owned(
                connection,
                owned,
            )
