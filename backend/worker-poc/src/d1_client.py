import json
from typing import Any

from js import Request


class D1Client:
    def __init__(self, service):
        self.service = service

    async def _post(
        self,
        path: str,
        payload: dict[str, Any],
    ) -> dict[str, Any]:

        req = Request.new(
            f"https://axiom-db-worker{path}",
            {
                "method": "POST",
                "headers": {
                    "content-type": "application/json",
                },
                "body": json.dumps(payload),
            },
        )

        response = await self.service.fetch(req)

        data = await response.json()

        if data.get("status") != "ok":
            raise RuntimeError(
                data.get(
                    "message",
                    "D1 request failed",
                )
            )

        return data

    async def first(
        self,
        sql: str,
        params=(),
    ):
        data = await self._post(
            "/query/first",
            {
                "sql": sql,
                "params": list(params),
            },
        )

        return data.get("result")

    async def all(
        self,
        sql: str,
        params=(),
    ):
        data = await self._post(
            "/query/all",
            {
                "sql": sql,
                "params": list(params),
            },
        )

        return data.get(
            "results",
            [],
        )

    async def run(
        self,
        sql: str,
        params=(),
    ):
        data = await self._post(
            "/query/run",
            {
                "sql": sql,
                "params": list(params),
            },
        )

        return data.get(
            "meta",
            {},
        )

    async def batch(
        self,
        statements: list[dict[str, Any]],
    ):
        data = await self._post(
            "/query/batch",
            {
                "statements": statements,
            },
        )

        return data.get(
            "results",
            [],
        )
