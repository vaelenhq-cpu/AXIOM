from typing import Optional

from fastapi import APIRouter, Depends, Query

from app.api.dependencies import authenticated_user

from app.schemas.pricing import (
    RoutePricingRuleCreate,
)

from app.services.pricing import PricingService


router = APIRouter(
    prefix="/api/pricing",
    tags=["Pricing"],
    dependencies=[
        Depends(authenticated_user),
    ],
)


@router.get("")
async def list_pricing_rules():
    return PricingService().list_active()


@router.post("/route")
async def create_route_pricing_rule(
    payload: RoutePricingRuleCreate,
):
    return PricingService().create_route_rule(
        **payload.model_dump()
    )


@router.get("/calculate/route")
async def calculate_route_price(
    route_id: str,
    vehicle_class: Optional[str] = Query(
        default=None
    ),
):
    return PricingService().calculate_route_price(
        route_id=route_id,
        vehicle_class=vehicle_class,
    )
