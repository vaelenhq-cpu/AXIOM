from typing import Optional

from pydantic import Field

from .common import APIModel


class CompanyUpdate(APIModel):
    name: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=250,
    )

    legal_name: Optional[str] = Field(
        default=None,
        max_length=300,
    )

    tax_number: Optional[str] = Field(
        default=None,
        max_length=100,
    )

    country_code: Optional[str] = Field(
        default=None,
        min_length=2,
        max_length=2,
    )

    timezone: Optional[str] = Field(
        default=None,
        max_length=100,
    )

    default_currency: Optional[str] = Field(
        default=None,
        min_length=3,
        max_length=3,
    )
