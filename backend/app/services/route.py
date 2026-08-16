from typing import Any, Dict, Optional

from app.core.ids import generate_id
from app.repositories.route import RouteRepository


class RouteService:
    def __init__(self, connection=None):
        self.repo = RouteRepository(connection)

    def create(
        self,
        *,
        name: str,
        origin_name: str,
        destination_name: str,
        code: Optional[str] = None,
        origin_code: Optional[str] = None,
        destination_code: Optional[str] = None,
        distance_km: Optional[float] = None,
        estimated_duration_minutes: Optional[int] = None,
    ) -> Dict[str, Any]:

        if not name.strip():
            raise ValueError("Route name is required")

        if not origin_name.strip():
            raise ValueError("Route origin is required")

        if not destination_name.strip():
            raise ValueError("Route destination is required")

        return self.repo.insert({
            "id": generate_id("route"),
            "code": code,
            "name": name.strip(),
            "origin_name": origin_name.strip(),
            "origin_code": origin_code,
            "destination_name": destination_name.strip(),
            "destination_code": destination_code,
            "distance_km": distance_km,
            "estimated_duration_minutes": estimated_duration_minutes,
            "active": 1,
        })

    def list(self):
        return self.repo.list_active()

    def get(self, route_id: str):
        route = self.repo.get_by_id(route_id)

        if route is None:
            raise LookupError("Route not found")

        return route
