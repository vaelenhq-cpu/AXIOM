from fastapi import APIRouter, Depends, Query

from app.api.dependencies import authenticated_user
from app.services.dashboard import DashboardService


router = APIRouter(
    prefix="/api/dashboard",
    tags=["Dashboard"],
    dependencies=[
        Depends(authenticated_user),
    ],
)


@router.get("")
async def dashboard_overview():
    return DashboardService().overview()


@router.get("/summary")
async def dashboard_summary():
    return DashboardService().summary()


@router.get("/action-required")
async def action_required():
    return DashboardService().action_required()


@router.get("/recent-bookings")
async def recent_bookings(
    limit: int = Query(
        default=20,
        ge=1,
        le=100,
    ),
):
    return DashboardService().recent_bookings(
        limit
    )


@router.get("/upcoming-operations")
async def upcoming_operations(
    limit: int = Query(
        default=20,
        ge=1,
        le=100,
    ),
):
    return DashboardService().upcoming_operations(
        limit
    )
