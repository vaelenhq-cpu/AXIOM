import json
from urllib.parse import urlparse

from app.core.ids import generate_id
from app.core.tenant import (
    reset_tenant,
    set_tenant,
)

from app.repositories.public_booking import (
    PublicBookingLookupRepository,
    PublicBookingRequestRepository,
)

from app.services.booking import BookingService


def normalize_origin(origin):
    if not origin:
        return None

    parsed = urlparse(origin)

    host = parsed.hostname

    return (
        host.lower()
        if host
        else None
    )


class PublicBookingService:
    def __init__(self, connection=None):
        self.lookup_repo = (
            PublicBookingLookupRepository(
                connection
            )
        )

    def create_booking(
        self,
        *,
        public_key: str,
        request_id: str,
        booking_payload,
        origin=None,
        ip_address=None,
        user_agent=None,
    ):
        key_record = self.lookup_repo.get_key(
            public_key
        )

        if key_record is None:
            raise PermissionError(
                "Invalid public booking key"
            )

        allowed_domain = (
            key_record.get(
                "allowed_domain"
            )
        )

        if allowed_domain:
            incoming_domain = (
                normalize_origin(origin)
            )

            expected = (
                allowed_domain
                .lower()
                .replace("https://", "")
                .replace("http://", "")
                .strip("/")
            )

            if incoming_domain != expected:
                raise PermissionError(
                    "Booking origin is not allowed"
                )

        tenant_token = set_tenant(
            company_id=key_record[
                "company_id"
            ]
        )

        try:
            request_repo = (
                PublicBookingRequestRepository()
            )

            existing = (
                request_repo
                .get_by_request_id(
                    request_id
                )
            )

            if existing:
                if (
                    existing["status"]
                    == "booking_created"
                    and existing["booking_id"]
                ):
                    return {
                        "idempotent": True,
                        "booking":
                            BookingService()
                            .get(
                                existing[
                                    "booking_id"
                                ]
                            ),
                    }

                raise ValueError(
                    "Request ID already exists"
                )

            request_record = (
                request_repo.insert({
                    "id": generate_id(
                        "public_booking_request"
                    ),
                    "public_booking_key_id":
                        key_record["id"],
                    "request_id":
                        request_id,
                    "status":
                        "validated",
                    "payload":
                        json.dumps(
                            booking_payload,
                            ensure_ascii=False,
                        ),
                    "ip_address":
                        ip_address,
                    "user_agent":
                        user_agent,
                })
            )

            result = BookingService().create(
                **booking_payload
            )

            request_repo.update(
                request_record["id"],
                {
                    "status":
                        "booking_created",
                    "booking_id":
                        result["booking"][
                            "id"
                        ],
                },
            )

            return {
                "idempotent": False,
                **result,
            }

        finally:
            reset_tenant(tenant_token)
