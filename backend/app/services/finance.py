from typing import Optional

from app.core.ids import generate_id
from app.core.tenant import get_user_id

from app.repositories.booking import (
    BookingRepository,
)

from app.repositories.finance import (
    FinanceTransactionRepository,
    PaymentRepository,
)


class FinanceService:
    def __init__(self, connection=None):
        self.payment_repo = PaymentRepository(
            connection
        )

        self.transaction_repo = (
            FinanceTransactionRepository(
                connection
            )
        )

        self.booking_repo = BookingRepository(
            connection
        )

    def create_payment(
        self,
        *,
        booking_id: str,
        amount: float,
        currency: str = "TRY",
        payment_method: Optional[str] = None,
        provider: Optional[str] = None,
        external_payment_id: Optional[str] = None,
        notes: Optional[str] = None,
    ):
        booking = self.booking_repo.get_by_id(
            booking_id
        )

        if booking is None:
            raise LookupError(
                "Booking not found"
            )

        if amount <= 0:
            raise ValueError(
                "Payment amount must be greater than zero"
            )

        return self.payment_repo.insert({
            "id": generate_id("payment"),
            "booking_id": booking_id,
            "provider": provider,
            "external_payment_id": external_payment_id,
            "payment_method": payment_method,
            "status": "pending",
            "currency": currency,
            "amount": amount,
            "notes": notes,
        })

    def create_transaction(
        self,
        *,
        transaction_type: str,
        amount: float,
        currency: str = "TRY",
        booking_id: Optional[str] = None,
        payment_id: Optional[str] = None,
        category: Optional[str] = None,
        description: Optional[str] = None,
    ):
        if amount < 0:
            raise ValueError(
                "Transaction amount cannot be negative"
            )

        return self.transaction_repo.insert({
            "id": generate_id("finance"),
            "booking_id": booking_id,
            "payment_id": payment_id,
            "transaction_type": transaction_type,
            "category": category,
            "currency": currency,
            "amount": amount,
            "description": description,
            "created_by": get_user_id(),
        })

    def list_payments(
        self,
        limit: int = 100,
        offset: int = 0,
    ):
        return self.payment_repo.list(
            limit=limit,
            offset=offset,
        )

    def list_transactions(
        self,
        limit: int = 100,
    ):
        return self.transaction_repo.list_recent(
            limit=limit
        )
