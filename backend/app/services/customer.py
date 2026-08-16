from typing import Any, Dict, Optional

from app.core.ids import generate_id
from app.repositories.customer import CustomerRepository


class CustomerService:
    def __init__(self, connection=None):
        self.repo = CustomerRepository(connection)

    def create(
        self,
        *,
        first_name: str,
        last_name: Optional[str] = None,
        email: Optional[str] = None,
        phone: Optional[str] = None,
        nationality: Optional[str] = None,
        language: Optional[str] = None,
        notes: Optional[str] = None,
    ) -> Dict[str, Any]:

        first_name = first_name.strip()

        if not first_name:
            raise ValueError("Customer first_name is required")

        if phone:
            existing = self.repo.find_by_phone(phone)

            if existing:
                return existing

        return self.repo.insert({
            "id": generate_id("customer"),
            "first_name": first_name,
            "last_name": last_name.strip() if last_name else None,
            "email": email.strip().lower() if email else None,
            "phone": phone,
            "nationality": nationality,
            "language": language,
            "notes": notes,
        })

    def get(self, customer_id: str):
        return self.repo.get_by_id(customer_id)

    def search(self, query: str):
        return self.repo.search(query)

    def list(self, limit: int = 100, offset: int = 0):
        return self.repo.list(
            limit=limit,
            offset=offset,
        )

    def update(
        self,
        customer_id: str,
        data: Dict[str, Any],
    ):
        customer = self.repo.get_by_id(customer_id)

        if customer is None:
            raise LookupError("Customer not found")

        payload = {
            key: value
            for key, value in data.items()
            if value is not None
        }

        return self.repo.update(
            customer_id,
            payload,
        )
