from typing import Any

from d1_client import D1Client


class D1Repository:
    table_name = ""
    tenant_scoped = True

    def __init__(
        self,
        client: D1Client,
        company_id: str | None = None,
    ):
        if not self.table_name:
            raise RuntimeError(
                "Repository table_name is not configured"
            )

        if self.tenant_scoped and not company_id:
            raise ValueError(
                "company_id is required for tenant scoped repository"
            )

        self.client = client
        self.company_id = company_id

    async def get_by_id(
        self,
        entity_id: str,
    ) -> dict[str, Any] | None:

        if self.tenant_scoped:
            return await self.client.first(
                f"""
                SELECT *
                FROM {self.table_name}
                WHERE id = ?
                  AND company_id = ?
                LIMIT 1
                """,
                (
                    entity_id,
                    self.company_id,
                ),
            )

        return await self.client.first(
            f"""
            SELECT *
            FROM {self.table_name}
            WHERE id = ?
            LIMIT 1
            """,
            (entity_id,),
        )

    async def list(
        self,
        limit: int = 100,
        offset: int = 0,
    ) -> list[dict[str, Any]]:

        if self.tenant_scoped:
            return await self.client.all(
                f"""
                SELECT *
                FROM {self.table_name}
                WHERE company_id = ?
                ORDER BY created_at DESC
                LIMIT ?
                OFFSET ?
                """,
                (
                    self.company_id,
                    limit,
                    offset,
                ),
            )

        return await self.client.all(
            f"""
            SELECT *
            FROM {self.table_name}
            ORDER BY created_at DESC
            LIMIT ?
            OFFSET ?
            """,
            (
                limit,
                offset,
            ),
        )
