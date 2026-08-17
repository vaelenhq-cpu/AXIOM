class D1Client:
    def __init__(self, service):
        self.service = service

    async def db_check(self):
        return await self.service.dbCheck()

    async def first(
        self,
        sql: str,
        params=(),
    ):
        return await self.service.first(
            sql,
            list(params),
        )

    async def all(
        self,
        sql: str,
        params=(),
    ):
        return await self.service.all(
            sql,
            list(params),
        )

    async def run(
        self,
        sql: str,
        params=(),
    ):
        return await self.service.run(
            sql,
            list(params),
        )

    async def batch(
        self,
        statements,
    ):
        return await self.service.batch(
            statements
        )
