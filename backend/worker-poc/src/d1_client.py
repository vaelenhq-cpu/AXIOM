class D1Client:
    def __init__(
        self,
        service,
    ):
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

    async def create_booking(
        self,
        payload,
    ):
        return await self.service.createBooking(
            payload
        )

    async def change_booking_status(
        self,
        payload,
    ):
        return await self.service.changeBookingStatus(
            payload
        )

    async def change_operation_status(
        self,
        payload,
    ):
        return await self.service.changeOperationStatus(
            payload
        )

    async def report_driver_issue(
        self,
        payload,
    ):
        return await self.service.reportDriverIssue(
            payload
        )

    async def reassign_operation(
        self,
        payload,
    ):
        return await self.service.reassignOperation(
            payload
        )

    async def resource_catalog(
        self,
        payload,
    ):
        return await self.service.resourceCatalog(
            payload
        )

    async def resource_list(
        self,
        payload,
    ):
        return await self.service.resourceList(
            payload
        )

    async def resource_get(
        self,
        payload,
    ):
        return await self.service.resourceGet(
            payload
        )

    async def resource_create(
        self,
        payload,
    ):
        return await self.service.resourceCreate(
            payload
        )

    async def resource_update(
        self,
        payload,
    ):
        return await self.service.resourceUpdate(
            payload
        )

    async def resource_delete(
        self,
        payload,
    ):
        return await self.service.resourceDelete(
            payload
        )

    async def get_company(
        self,
        payload,
    ):
        return await self.service.getCompany(
            payload
        )

    async def update_company(
        self,
        payload,
    ):
        return await self.service.updateCompany(
            payload
        )

    async def dashboard_summary(
        self,
        payload,
    ):
        return await self.service.dashboardSummary(
            payload
        )

    async def dispatch_list(
        self,
        payload,
    ):
        return await self.service.dispatchList(
            payload
        )
