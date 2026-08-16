import json
from typing import Any, Optional

from app.core.ids import generate_id
from app.core.tenant import get_company_id, get_tenant
from app.repositories.base import BaseRepository


class AuditRepository(BaseRepository):
    table_name = "audit_logs"


class AuditService:
    def __init__(self, connection=None):
        self.repo = AuditRepository(connection)

    def log(
        self,
        *,
        action: str,
        entity_type: str,
        entity_id: Optional[str] = None,
        old_data: Any = None,
        new_data: Any = None,
        actor_type: str = "user",
        actor_id: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ):
        tenant = get_tenant()

        if actor_id is None:
            actor_id = tenant.user_id

        return self.repo.insert({
            "id": generate_id("audit"),
            "actor_type": actor_type,
            "actor_id": actor_id,
            "action": action,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "old_data": json.dumps(old_data, ensure_ascii=False) if old_data is not None else None,
            "new_data": json.dumps(new_data, ensure_ascii=False) if new_data is not None else None,
            "ip_address": ip_address,
            "user_agent": user_agent,
        })
