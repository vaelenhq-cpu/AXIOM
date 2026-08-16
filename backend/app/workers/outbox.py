import json

from app.core.tenant import (
    reset_tenant,
    set_tenant,
)
from app.core.time import utc_now_iso
from app.core.database import create_connection
from app.core.ids import generate_id

from app.repositories.outbox_worker import (
    OutboxWorkerRepository,
)
from app.repositories.base import BaseRepository


class WebhookDeliveryRepository(
    BaseRepository
):
    table_name = "webhook_deliveries"


def subscribed(
    subscribed_events,
    event_type,
):
    if not subscribed_events:
        return False

    raw = subscribed_events.strip()

    try:
        value = json.loads(raw)

        if isinstance(value, list):
            return (
                event_type in value
                or "*" in value
            )
    except Exception:
        pass

    events = {
        item.strip()
        for item in raw.split(",")
        if item.strip()
    }

    return (
        event_type in events
        or "*" in events
    )


class OutboxWorker:
    def run_company(
        self,
        company_id: str,
        limit: int = 100,
    ):
        token = set_tenant(
            company_id=company_id
        )

        try:
            repo = OutboxWorkerRepository()
            delivery_repo = (
                WebhookDeliveryRepository()
            )

            events = repo.pending(limit)

            connection = create_connection()

            try:
                endpoints = connection.execute(
                    """
                    SELECT *
                    FROM webhook_endpoints
                    WHERE company_id = ?
                      AND active = 1
                    """,
                    (company_id,),
                ).fetchall()

                endpoints = [
                    dict(row)
                    for row in endpoints
                ]

            finally:
                connection.close()

            processed = 0

            for event in events:
                try:
                    for endpoint in endpoints:
                        if not subscribed(
                            endpoint[
                                "subscribed_events"
                            ],
                            event[
                                "event_type"
                            ],
                        ):
                            continue

                        delivery_repo.insert({
                            "id": generate_id(
                                "outbox"
                            ),
                            "webhook_endpoint_id":
                                endpoint["id"],
                            "event_type":
                                event["event_type"],
                            "payload":
                                event["payload"],
                            "status": "pending",
                            "attempt_count": 0,
                        })

                    repo.update(
                        event["id"],
                        {
                            "status":
                                "processed",
                            "processed_at":
                                utc_now_iso(),
                        },
                    )

                    processed += 1

                except Exception as exc:
                    repo.update(
                        event["id"],
                        {
                            "status": "failed",
                            "last_error":
                                str(exc),
                        },
                    )

            return {
                "company_id": company_id,
                "processed": processed,
                "seen": len(events),
            }

        finally:
            reset_tenant(token)

    def run_all(
        self,
        limit_per_company=100,
    ):
        connection = create_connection()

        try:
            rows = connection.execute(
                """
                SELECT DISTINCT company_id
                FROM outbox_events
                WHERE status = 'pending'
                """
            ).fetchall()

            companies = [
                row["company_id"]
                for row in rows
            ]

        finally:
            connection.close()

        return [
            self.run_company(
                company_id,
                limit_per_company,
            )
            for company_id in companies
        ]
