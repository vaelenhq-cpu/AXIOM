from typing import Optional

from pydantic import Field

from .common import APIModel


class TourProductCreate(APIModel):
    name: str = Field(
        min_length=1,
        max_length=250,
    )

    code: Optional[str] = Field(
        default=None,
        max_length=80,
    )

    description: Optional[str] = None

    duration_minutes: Optional[int] = Field(
        default=None,
        ge=1,
    )

    default_capacity: Optional[int] = Field(
        default=None,
        ge=1,
        le=1000,
    )


class TourDepartureCreate(APIModel):
    tour_product_id: str

    departure_date: str
    departure_time: Optional[str] = None

    capacity: Optional[int] = Field(
        default=None,
        ge=1,
        le=1000,
    )

    meeting_point: Optional[str] = Field(
        default=None,
        max_length=500,
    )
