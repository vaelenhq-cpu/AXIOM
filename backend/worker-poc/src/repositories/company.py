from typing import Any

from .base import D1Repository


class CompanyRepository(D1Repository):
    table_name = "companies"
    tenant_scoped = False

    async def get_by_slug(
        self,
        slug: str,
    ) -> dict[str, Any] | None:

        return await self.client.first(
            """
            SELECT *
            FROM companies
            WHERE slug = ?
            LIMIT 1
            """,
            (slug,),
        )

    async def count(
        self,
    ) -> int:

        result = await self.client.first(
            """
            SELECT COUNT(*) AS count
            FROM companies
            """
        )

        return int(
            result["count"]
            if result
            else 0
        )
