from fastapi import APIRouter, Depends, Request

from app.api.driver_dependencies import (
    authenticated_driver,
)

from app.schemas.driver_auth import (
    DriverLoginRequest,
    DriverOperationIssueRequest,
    DriverOperationEventRequest,
)

from app.services.driver_auth import (
    DriverAuthService,
)

from app.services.driver_operation import (
    DriverOperationService,
)


router = APIRouter(
    prefix="/driver",
    tags=["Driver"],
)


@router.post("/auth/login")
async def login(
    payload: DriverLoginRequest,
    request: Request,
):
    return DriverAuthService().login(
        company_slug=payload.company_slug,
        login_identifier=payload.login_identifier,
        password=payload.password,
        ip_address=(
            request.client.host
            if request.client
            else None
        ),
        user_agent=request.headers.get(
            "user-agent"
        ),
    )


@router.get("/me")
async def me(
    identity: dict = Depends(
        authenticated_driver
    ),
):
    return identity


@router.get("/operations")
async def operations(
    identity: dict = Depends(
        authenticated_driver
    ),
):
    return DriverOperationService().list(
        identity["driver_id"]
    )


@router.get(
    "/operations/{operation_id}"
)
async def operation_detail(
    operation_id: str,
    identity: dict = Depends(
        authenticated_driver
    ),
):
    return (
        DriverOperationService()
        .detail(
            driver_id=identity[
                "driver_id"
            ],
            operation_id=operation_id,
        )
    )


@router.post(
    "/operations/{operation_id}/accept"
)
async def accept_operation(
    operation_id: str,
    identity: dict = Depends(
        authenticated_driver
    ),
):
    return (
        DriverOperationService()
        .accept(
            driver_id=identity[
                "driver_id"
            ],
            operation_id=operation_id,
        )
    )


@router.post(
    "/operations/{operation_id}/start"
)
async def start_operation(
    operation_id: str,
    identity: dict = Depends(
        authenticated_driver
    ),
):
    return (
        DriverOperationService()
        .start(
            driver_id=identity[
                "driver_id"
            ],
            operation_id=operation_id,
        )
    )


@router.post(
    "/operations/{operation_id}/complete"
)
async def complete_operation(
    operation_id: str,
    identity: dict = Depends(
        authenticated_driver
    ),
):
    return (
        DriverOperationService()
        .complete(
            driver_id=identity[
                "driver_id"
            ],
            operation_id=operation_id,
        )
    )

@router.post(
    "/operations/{operation_id}/event"
)
async def record_operation_event(
    operation_id: str,
    payload: DriverOperationEventRequest,
    identity: dict = Depends(
        authenticated_driver
    ),
):
    return (
        DriverOperationService()
        .record_field_event(
            driver_id=identity[
                "driver_id"
            ],
            operation_id=operation_id,
            event_type=
                payload.event_type,
            description=
                payload.description,
        )
    )


@router.post(
    "/operations/{operation_id}/issue"
)
async def report_operation_issue(
    operation_id: str,
    payload: DriverOperationIssueRequest,
    identity: dict = Depends(
        authenticated_driver
    ),
):
    return (
        DriverOperationService()
        .report_issue(
            driver_id=identity[
                "driver_id"
            ],
            operation_id=operation_id,
            issue_type=
                payload.issue_type,
            description=
                payload.description,
        )
    )

