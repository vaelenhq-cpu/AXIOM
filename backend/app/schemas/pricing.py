from typing import Optional

from pydantic import Field

from .common import APIModel


class RoutePricingRuleCreate(APIModel):
    name: str = Field(
        min_length=1,
        max_length=250,
    )

    route_id: str

    base_price: float = Field(
        ge=0,
    )

    vehicle_class: Optional[str] = Field(
        default=None,
        max_length=100,
    )

    currency: str = Field(
        default="TRY",
        min_length=3,
        max_length=3,
    )

    priority: int = Field(
        default=100,
        ge=0,
    )

    valid_from: Optional[str] = None
    valid_until: Optional[str] = None


class RoutePriceQuery(APIModel):
    route_id: str
    vehicle_class: Optional[str] = None
