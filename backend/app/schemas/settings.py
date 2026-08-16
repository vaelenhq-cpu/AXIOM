from typing import Optional

from pydantic import Field

from .common import APIModel


class SettingsUpdate(APIModel):
    booking_prefix: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=20,
    )

    auto_confirm_bookings: Optional[bool] = None

    auto_create_operations: Optional[bool] = None

    require_driver_acceptance: Optional[bool] = None

    default_language: Optional[str] = Field(
        default=None,
        max_length=10,
    )

    default_timezone: Optional[str] = Field(
        default=None,
        max_length=100,
    )

    default_currency: Optional[str] = Field(
        default=None,
        min_length=3,
        max_length=3,
    )

    notification_email: Optional[str] = None
    notification_phone: Optional[str] = None

    settings_json: Optional[str] = None
