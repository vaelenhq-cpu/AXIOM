from typing import List, Literal, Optional

from pydantic import Field

from .common import APIModel


class DomainCreate(APIModel):
    domain: str = Field(
        min_length=3,
        max_length=255,
    )

    domain_type: Literal[
        "website",
        "booking",
        "api",
        "custom",
    ] = "website"


class DomainStatusUpdate(APIModel):
    status: Literal[
        "pending",
        "disabled",
    ]


class PublicBookingKeyCreate(APIModel):
    name: str = Field(
        min_length=1,
        max_length=200,
    )

    allowed_domain: Optional[str] = None


class APIKeyCreate(APIModel):
    name: str = Field(
        min_length=1,
        max_length=200,
    )

    scopes: Optional[List[str]] = None
    expires_at: Optional[str] = None


class DriverAccountCreate(APIModel):
    driver_id: str

    login_identifier: str = Field(
        min_length=3,
        max_length=200,
    )

    password: str = Field(
        min_length=8,
        max_length=256,
    )


class BookingStatusUpdate(APIModel):
    status: Literal[
        "draft",
        "pending",
        "confirmed",
        "cancelled",
        "completed",
    ]
