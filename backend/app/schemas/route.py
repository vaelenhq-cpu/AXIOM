from typing import Optional

from pydantic import Field

from .common import APIModel


class RouteCreate(APIModel):
    name: str = Field(
        min_length=1,
        max_length=250,
    )

    code: Optional[str] = Field(
        default=None,
        max_length=80,
    )

    origin_name: str = Field(
        min_length=1,
        max_length=300,
    )

    origin_code: Optional[str] = Field(
        default=None,
        max_length=80,
    )

    destination_name: str = Field(
        min_length=1,
        max_length=300,
    )

    destination_code: Optional[str] = Field(
        default=None,
        max_length=80,
    )

    distance_km: Optional[float] = Field(
        default=None,
        ge=0,
    )

    estimated_duration_minutes: Optional[int] = Field(
        default=None,
        ge=0,
    )
