from fastapi import APIRouter, Depends, Query

from app.api.dependencies import authenticated_user

from app.schemas.operation import (
    OperationAssignmentCreate,
    OperationReassignmentCreate,
    OperationStatusUpdate,
)

from app.services.assignment import AssignmentService
from app.services.operation import OperationService
from app.services.reassignment import ReassignmentService
from app.services.operation_workflow import OperationWorkflowService


router = APIRouter(
    prefix="/api/operations",
    tags=["Operations"],
    dependencies=[
        Depends(authenticated_user),
    ],
)


@router.get("")
async def list_operations(
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
):
    return OperationService().list(
        limit=limit,
        offset=offset,
    )


@router.get("/waiting-assignment")
async def waiting_assignment():
    return (
        OperationService()
        .list_waiting_assignment()
    )


@router.get("/{operation_id}")
async def get_operation(
    operation_id: str,
):
    return OperationService().get(
        operation_id
    )


@router.patch("/{operation_id}/status")
async def update_operation_status(
    operation_id: str,
    payload: OperationStatusUpdate,
):
    return OperationWorkflowService().change_status(
        operation_id,
        payload.status,
    )


@router.post("/{operation_id}/assign")
async def assign_operation(
    operation_id: str,
    payload: OperationAssignmentCreate,
):
    operation = OperationService().get(
        operation_id
    )

    if operation["status"] != "waiting_assignment":
        raise ValueError(
            "Only waiting_assignment operations "
            "can be assigned"
        )

    assignment = AssignmentService().assign(
        operation_id=operation_id,
        driver_id=payload.driver_id,
        vehicle_id=payload.vehicle_id,
    )

    operation = OperationService().get(
        operation_id
    )

    if operation["status"] == "waiting_assignment":
        operation = (
            OperationWorkflowService()
            .change_status(
                operation_id,
                "assigned",
            )
        )

    return {
        "assignment": assignment,
        "operation": operation,
    }


@router.post(
    "/{operation_id}/reassign"
)
async def reassign_operation(
    operation_id: str,
    payload: OperationReassignmentCreate,
):
    return (
        ReassignmentService()
        .reassign(
            operation_id=
                operation_id,

            driver_id=
                payload.driver_id,

            vehicle_id=
                payload.vehicle_id,

            reason=
                payload.reason,

            mark_previous_vehicle_maintenance=
                payload.mark_previous_vehicle_maintenance,
        )
    )
