from typing import Any, Dict, Optional

from app.core.ids import generate_id
from app.repositories.pricing import PricingRepository
from app.repositories.route import RouteRepository


class PricingService:
    def __init__(self, connection=None):
        self.repo = PricingRepository(connection)
        self.route_repo = RouteRepository(connection)

    def create_route_rule(
        self,
        *,
        name: str,
        route_id: str,
        base_price: float,
        vehicle_class: Optional[str] = None,
        currency: str = "TRY",
        priority: int = 100,
        valid_from: Optional[str] = None,
        valid_until: Optional[str] = None,
    ) -> Dict[str, Any]:

        route = self.route_repo.get_by_id(route_id)

        if route is None:
            raise LookupError("Route not found")

        if base_price < 0:
            raise ValueError("base_price cannot be negative")

        return self.repo.insert({
            "id": generate_id("pricing"),
            "name": name.strip(),
            "rule_type": "route",
            "route_id": route_id,
            "vehicle_class": vehicle_class,
            "currency": currency,
            "base_price": base_price,
            "priority": priority,
            "valid_from": valid_from,
            "valid_until": valid_until,
            "active": 1,
        })

    def calculate_route_price(
        self,
        *,
        route_id: str,
        vehicle_class: Optional[str] = None,
    ) -> Dict[str, Any]:

        rule = self.repo.find_route_price(
            route_id=route_id,
            vehicle_class=vehicle_class,
        )

        if rule is None:
            raise LookupError(
                "No active pricing rule found"
            )

        return {
            "pricing_rule_id": rule["id"],
            "currency": rule["currency"],
            "amount": float(rule["base_price"]),
        }

    def list_active(self):
        return self.repo.list_active()
