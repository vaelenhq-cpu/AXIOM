import json
from typing import Any

from app.core.ids import generate_id
from app.repositories.base import BaseRepository


class OutboxRepository(BaseRepository):
    table_name = "outbox_events"


class OutboxService:
    def __init__(self, connection=None):
        self.repo = OutboxRepository(connection)

    def publish(
        self,
        *,
        event_type: str,
        aggregate_type: str,
        aggregate_id: str,
        payload: Any,
    ):
        return self.repo.insert({
            "id": generate_id("outbox"),
            "event_type": event_type,
            "aggregate_type": aggregate_type,
            "aggregate_id": aggregate_id,
            "payload": json.dumps(
                payload,
                ensure_ascii=False,
            ),
            "status": "pending",
        })
