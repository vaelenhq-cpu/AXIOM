import json
import urllib.request

from app.core.database import create_connection
from app.core.time import utc_now_iso
from app.security.network import (
    validate_webhook_url,
)


class WebhookWorker:
    def run_once(self, limit=50):
        connection = create_connection()

        try:
            rows = connection.execute(
                """
                SELECT
                    wd.*,
                    we.endpoint_url
                FROM webhook_deliveries wd
                JOIN webhook_endpoints we
                  ON we.id =
                     wd.webhook_endpoint_id
                 AND we.company_id =
                     wd.company_id
                WHERE wd.status IN (
                    'pending',
                    'failed'
                )
                  AND (
                    wd.next_attempt_at IS NULL
                    OR wd.next_attempt_at
                        <= CURRENT_TIMESTAMP
                  )
                  AND wd.attempt_count < 5
                  AND we.active = 1
                ORDER BY wd.created_at ASC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()

            results = []

            for row in rows:
                delivery = dict(row)

                try:
                    validate_webhook_url(
                        delivery[
                            "endpoint_url"
                        ]
                    )

                    request = urllib.request.Request(
                        delivery[
                            "endpoint_url"
                        ],
                        data=delivery[
                            "payload"
                        ].encode("utf-8"),
                        headers={
                            "Content-Type":
                                "application/json",
                            "User-Agent":
                                "AXIOM-Webhook/1.0",
                            "X-AXIOM-Event":
                                delivery[
                                    "event_type"
                                ],
                        },
                        method="POST",
                    )

                    with urllib.request.urlopen(
                        request,
                        timeout=10,
                    ) as response:
                        status = (
                            response.status
                        )

                    connection.execute(
                        """
                        UPDATE webhook_deliveries
                        SET
                            status = 'sent',
                            attempt_count =
                                attempt_count + 1,
                            last_http_status = ?,
                            delivered_at = ?
                        WHERE id = ?
                        """,
                        (
                            status,
                            utc_now_iso(),
                            delivery["id"],
                        ),
                    )

                    results.append({
                        "id": delivery["id"],
                        "status": "sent",
                    })

                except Exception as exc:
                    connection.execute(
                        """
                        UPDATE webhook_deliveries
                        SET
                            status = 'failed',
                            attempt_count =
                                attempt_count + 1,
                            last_error = ?
                        WHERE id = ?
                        """,
                        (
                            str(exc),
                            delivery["id"],
                        ),
                    )

                    results.append({
                        "id": delivery["id"],
                        "status": "failed",
                        "error": str(exc),
                    })

            connection.commit()

            return results

        finally:
            connection.close()
