from typing import Literal, Optional

from pydantic import Field

from .common import APIModel


class DomainProviderConnectionCreate(APIModel):
    provider: Literal[
        "cloudflare",
        "manual",
        "other",
    ]

    name: str = Field(
        min_length=1,
        max_length=200,
    )

    external_account_id: Optional[str] = None

    secret_ref: Optional[str] = None


class DomainProviderConnectionUpdate(APIModel):
    name: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=200,
    )

    status: Optional[
        Literal[
            "pending",
            "connected",
            "error",
            "disabled",
        ]
    ] = None

    external_account_id: Optional[str] = None

    secret_ref: Optional[str] = None
