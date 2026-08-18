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

    async def owner_login(self, payload):
        return await self.service.ownerLogin(payload)

    async def owner_authenticate(self, token):
        return await self.service.ownerAuthenticate(token)

    async def owner_logout(self, token):
        return await self.service.ownerLogout(token)

    async def driver_login(self, payload):
        return await self.service.driverLogin(payload)

    async def driver_authenticate(self, token):
        return await self.service.driverAuthenticate(token)

    async def driver_operations_list(self, context, limit=100):
        return await self.service.driverOperationsList(context, limit)

    async def driver_operation_detail(self, context, operation_id):
        return await self.service.driverOperationDetail(context, operation_id)

    async def driver_accept_operation(self, context, operation_id):
        return await self.service.driverAcceptOperation(context, operation_id)

    async def driver_start_operation(self, context, operation_id):
        return await self.service.driverStartOperation(context, operation_id)

    async def driver_record_field_event(self, context, operation_id, event_type, description=None):
        return await self.service.driverRecordFieldEvent(context, operation_id, event_type, description)

    async def driver_complete_operation(self, context, operation_id):
        return await self.service.driverCompleteOperation(context, operation_id)

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
