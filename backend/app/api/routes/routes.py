from fastapi import APIRouter, Depends

from app.api.dependencies import authenticated_user
from app.schemas.route import RouteCreate
from app.services.route import RouteService


router = APIRouter(
    prefix="/api/routes",
    tags=["Routes"],
    dependencies=[
        Depends(authenticated_user),
    ],
)


@router.get("")
async def list_routes():
    return RouteService().list()


@router.post("")
async def create_route(
    payload: RouteCreate,
):
    return RouteService().create(
        **payload.model_dump()
    )


@router.get("/{route_id}")
async def get_route(route_id: str):
    return RouteService().get(
        route_id
    )
