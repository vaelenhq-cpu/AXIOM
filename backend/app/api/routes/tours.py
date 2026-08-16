from fastapi import APIRouter, Depends, Query

from app.api.dependencies import authenticated_user

from app.schemas.tour import (
    TourDepartureCreate,
    TourProductCreate,
)

from app.services.tour import TourService


router = APIRouter(
    prefix="/api/tours",
    tags=["Tours"],
    dependencies=[
        Depends(authenticated_user),
    ],
)


@router.get("")
async def list_tour_products(
    limit: int = Query(
        default=100,
        ge=1,
        le=500,
    ),
    offset: int = Query(
        default=0,
        ge=0,
    ),
):
    return TourService().list_products(
        limit=limit,
        offset=offset,
    )


@router.post("")
async def create_tour_product(
    payload: TourProductCreate,
):
    return TourService().create_product(
        **payload.model_dump()
    )


@router.get("/departures")
async def list_departures(
    limit: int = Query(
        default=100,
        ge=1,
        le=500,
    ),
    offset: int = Query(
        default=0,
        ge=0,
    ),
):
    return TourService().list_departures(
        limit=limit,
        offset=offset,
    )


@router.get("/departures/date/{departure_date}")
async def departures_by_date(
    departure_date: str,
):
    return TourService().departures_by_date(
        departure_date
    )


@router.post("/departures")
async def create_departure(
    payload: TourDepartureCreate,
):
    return TourService().create_departure(
        **payload.model_dump()
    )


@router.get("/departures/{departure_id}")
async def get_departure(
    departure_id: str,
):
    return TourService().get_departure(
        departure_id
    )


@router.get("/{tour_product_id}")
async def get_product(
    tour_product_id: str,
):
    return TourService().get_product(
        tour_product_id
    )
