from typing import Any, Dict

from app.core.ids import generate_id

from app.repositories.settings import (
    CompanySettingsRepository,
)


class SettingsService:
    def __init__(self, connection=None):
        self.repo = CompanySettingsRepository(
            connection
        )

    def get(self):
        settings = self.repo.get_current()

        if settings is None:
            settings = self.repo.insert({
                "id": generate_id("company_settings"),
                "booking_prefix": "AX",
                "auto_confirm_bookings": 0,
                "auto_create_operations": 1,
                "require_driver_acceptance": 0,
                "default_language": "tr",
                "default_timezone": "Europe/Istanbul",
                "default_currency": "TRY",
            })

        return settings

    def update(
        self,
        data: Dict[str, Any],
    ):
        settings = self.get()

        allowed = {
            "booking_prefix",
            "auto_confirm_bookings",
            "auto_create_operations",
            "require_driver_acceptance",
            "default_language",
            "default_timezone",
            "default_currency",
            "notification_email",
            "notification_phone",
            "settings_json",
        }

        payload = {
            key: value
            for key, value in data.items()
            if key in allowed
            and value is not None
        }

        return self.repo.update(
            settings["id"],
            payload,
        )
