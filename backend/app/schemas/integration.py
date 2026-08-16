from typing import Any, Dict, Literal, Optional

from pydantic import Field

from .common import APIModel


class IntegrationCreate(APIModel):
    provider: str = Field(min_length=1, max_length=120)

    integration_type: Literal[
        "website",
        "api",
        "b2b",
        "tour_operator",
        "payment",
        "messaging",
        "other",
    ]

    name: str = Field(min_length=1, max_length=200)

    base_url: Optional[str] = None
    external_account_id: Optional[str] = None
    secret_ref: Optional[str] = None

    sync_mode: Literal[
        "manual",
        "scheduled",
        "webhook",
        "realtime",
    ] = "manual"

    settings: Optional[Dict[str, Any]] = None


class IntegrationStatusUpdate(APIModel):
    status: Literal[
        "inactive",
        "active",
        "error",
        "disabled",
    ]


class ExternalBookingIngest(APIModel):
    external_booking_id: str
    payload: Dict[str, Any]
