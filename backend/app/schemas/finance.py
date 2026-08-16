from typing import Literal, Optional

from pydantic import Field

from .common import APIModel


class PaymentCreate(APIModel):
    booking_id: str

    amount: float = Field(
        gt=0,
    )

    currency: str = Field(
        default="TRY",
        min_length=3,
        max_length=3,
    )

    payment_method: Optional[
        Literal[
            "cash",
            "card",
            "bank_transfer",
            "online",
            "virtual_pos",
            "other",
        ]
    ] = None

    provider: Optional[str] = None
    external_payment_id: Optional[str] = None
    notes: Optional[str] = None


class FinanceTransactionCreate(APIModel):
    transaction_type: Literal[
        "income",
        "expense",
        "commission",
        "refund",
        "adjustment",
    ]

    amount: float = Field(
        ge=0,
    )

    currency: str = Field(
        default="TRY",
        min_length=3,
        max_length=3,
    )

    booking_id: Optional[str] = None
    payment_id: Optional[str] = None

    category: Optional[str] = None
    description: Optional[str] = None
