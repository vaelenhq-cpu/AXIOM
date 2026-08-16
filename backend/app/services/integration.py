import json
from typing import Any, Dict, Optional

from app.core.ids import generate_id

from app.repositories.integration import (
    ExternalBookingRepository,
    IntegrationEventRepository,
    IntegrationMappingRepository,
    IntegrationRepository,
)


class IntegrationService:
    def __init__(self, connection=None):
        self.repo = IntegrationRepository(connection)
        self.event_repo = IntegrationEventRepository(connection)
        self.external_repo = ExternalBookingRepository(connection)
        self.mapping_repo = IntegrationMappingRepository(connection)

    def create(
        self,
        *,
        provider: str,
        integration_type: str,
        name: str,
        base_url: Optional[str] = None,
        external_account_id: Optional[str] = None,
        secret_ref: Optional[str] = None,
        sync_mode: str = "manual",
        settings: Optional[Dict[str, Any]] = None,
    ):
        return self.repo.insert({
            "id": generate_id("integration"),
            "provider": provider,
            "integration_type": integration_type,
            "name": name,
            "status": "inactive",
            "base_url": base_url,
            "external_account_id": external_account_id,
            "secret_ref": secret_ref,
            "sync_mode": sync_mode,
            "settings_json": (
                json.dumps(settings, ensure_ascii=False)
                if settings is not None
                else None
            ),
        })

    def list(self, limit=100, offset=0):
        return self.repo.list(
            limit=limit,
            offset=offset,
        )

    def get(self, integration_id: str):
        record = self.repo.get_by_id(integration_id)

        if record is None:
            raise LookupError("Integration not found")

        return record

    def set_status(
        self,
        integration_id: str,
        status: str,
    ):
        if status not in {
            "inactive",
            "active",
            "error",
            "disabled",
        }:
            raise ValueError("Invalid integration status")

        return self.repo.update(
            integration_id,
            {"status": status},
        )

    def ingest_external_booking(
        self,
        *,
        integration_id: str,
        external_booking_id: str,
        payload: Dict[str, Any],
    ):
        integration = self.get(integration_id)

        existing = self.external_repo.get_by_external_id(
            integration_id=integration_id,
            external_booking_id=external_booking_id,
        )

        if existing:
            return existing

        record = self.external_repo.insert({
            "id": generate_id("external_booking"),
            "integration_id": integration_id,
            "external_booking_id": external_booking_id,
            "status": "received",
            "raw_payload": json.dumps(
                payload,
                ensure_ascii=False,
            ),
        })

        self.event_repo.insert({
            "id": generate_id("integration_event"),
            "integration_id": integration_id,
            "direction": "inbound",
            "event_type": "external_booking.received",
            "external_reference": external_booking_id,
            "status": "received",
            "request_payload": json.dumps(
                payload,
                ensure_ascii=False,
            ),
        })

        return record

    def map_entity(
        self,
        *,
        integration_id: str,
        entity_type: str,
        local_entity_id: str,
        external_entity_id: str,
        external_reference: Optional[str] = None,
    ):
        return self.mapping_repo.insert({
            "id": generate_id("integration_event"),
            "integration_id": integration_id,
            "entity_type": entity_type,
            "local_entity_id": local_entity_id,
            "external_entity_id": external_entity_id,
            "external_reference": external_reference,
        })
