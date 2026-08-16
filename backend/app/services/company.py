from typing import Any, Dict

from app.repositories.company import CompanyRepository


class CompanyService:
    def __init__(self, connection=None):
        self.repo = CompanyRepository(connection)

    def get_current(self):
        company = self.repo.get_current()

        if company is None:
            raise LookupError(
                "Company not found"
            )

        return company

    def update_current(
        self,
        data: Dict[str, Any],
    ):
        payload = dict(data)

        if "name" in payload:
            payload["name"] = (
                payload["name"].strip()
            )

            if not payload["name"]:
                raise ValueError(
                    "Company name is required"
                )

        if (
            "legal_name" in payload
            and payload["legal_name"]
        ):
            payload["legal_name"] = (
                payload["legal_name"].strip()
            )

        if (
            "tax_number" in payload
            and payload["tax_number"]
        ):
            payload["tax_number"] = (
                payload["tax_number"].strip()
            )

        if "country_code" in payload:
            payload["country_code"] = (
                payload["country_code"]
                .strip()
                .upper()
            )

        if "default_currency" in payload:
            payload["default_currency"] = (
                payload["default_currency"]
                .strip()
                .upper()
            )

        if "timezone" in payload:
            payload["timezone"] = (
                payload["timezone"].strip()
            )

        company = self.repo.update_current(
            payload
        )

        if company is None:
            raise LookupError(
                "Company not found"
            )

        return company
