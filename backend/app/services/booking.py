from typing import Any, Dict, List, Optional

from app.core.ids import generate_id
from app.core.tenant import get_user_id
from app.core.transactions import transaction
from app.core.time import utc_now_iso

from app.repositories.booking import BookingRepository
from app.repositories.booking_service import BookingServiceRepository
from app.repositories.booking_event import BookingEventRepository

from app.services.customer import CustomerService
from app.services.transfer import TransferService
from app.services.operation import OperationService
from app.services.audit import AuditService
from app.services.outbox import OutboxService


class BookingService:
    def create(
        self,
        *,
        booking_code: str,
        customer: Dict[str, Any],
        services: List[Dict[str, Any]],
        source: str = "manual",
        currency: str = "TRY",
        customer_note: Optional[str] = None,
        internal_note: Optional[str] = None,
    ) -> Dict[str, Any]:

        if not booking_code.strip():
            raise ValueError("booking_code is required")

        if not services:
            raise ValueError(
                "Booking must contain at least one service"
            )

        with transaction() as connection:

            customer_service = CustomerService(connection)

            booking_repo = BookingRepository(connection)
            booking_service_repo = BookingServiceRepository(connection)
            booking_event_repo = BookingEventRepository(connection)

            transfer_service = TransferService(connection)
            operation_service = OperationService(connection)

            audit = AuditService(connection)
            outbox = OutboxService(connection)

            customer_record = customer_service.create(
                first_name=customer["first_name"],
                last_name=customer.get("last_name"),
                email=customer.get("email"),
                phone=customer.get("phone"),
                nationality=customer.get("nationality"),
                language=customer.get("language"),
                notes=customer.get("notes"),
            )

            subtotal = sum(
                float(item.get("total_price", 0))
                for item in services
            )

            booking = booking_repo.insert({
                "id": generate_id("booking"),
                "customer_id": customer_record["id"],
                "booking_code": booking_code.strip(),
                "status": "confirmed",
                "source": source,
                "currency": currency,
                "subtotal_amount": subtotal,
                "discount_amount": 0,
                "tax_amount": 0,
                "total_amount": subtotal,
                "customer_note": customer_note,
                "internal_note": internal_note,
                "booked_at": utc_now_iso(),
                "created_by": get_user_id(),
            })

            created_services = []

            for item in services:

                service_type = item["service_type"]

                service = booking_service_repo.insert({
                    "id": generate_id("service"),
                    "booking_id": booking["id"],
                    "service_type": service_type,
                    "status": "confirmed",
                    "title": item["title"],
                    "description": item.get("description"),
                    "service_date": item.get("service_date"),
                    "start_time": item.get("start_time"),
                    "pax_adult": item.get("pax_adult", 0),
                    "pax_child": item.get("pax_child", 0),
                    "pax_infant": item.get("pax_infant", 0),
                    "quantity": item.get("quantity", 1),
                    "unit_price": item.get("unit_price", 0),
                    "total_price": item.get("total_price", 0),
                })

                created_entry = {
                    "service": service,
                }

                if service_type == "transfer":

                    transfer_data = item.get("transfer")

                    if not transfer_data:
                        raise ValueError(
                            "Transfer service requires transfer data"
                        )

                    transfer_record = transfer_service.create(
                        booking_service_id=service["id"],
                        pickup_location=transfer_data[
                            "pickup_location"
                        ],
                        dropoff_location=transfer_data[
                            "dropoff_location"
                        ],
                        pickup_datetime=transfer_data.get(
                            "pickup_datetime"
                        ),
                        flight_number=transfer_data.get(
                            "flight_number"
                        ),
                        flight_datetime=transfer_data.get(
                            "flight_datetime"
                        ),
                        pickup_sign=transfer_data.get(
                            "pickup_sign"
                        ),
                        pax=transfer_data.get("pax", 1),
                        luggage_count=transfer_data.get(
                            "luggage_count",
                            0,
                        ),
                        requested_vehicle_class=transfer_data.get(
                            "requested_vehicle_class"
                        ),
                        special_request=transfer_data.get(
                            "special_request"
                        ),
                    )

                    operation = operation_service.create(
                        source_type="transfer",
                        source_id=transfer_record["id"],
                        scheduled_start_at=transfer_data.get(
                            "pickup_datetime"
                        ),
                        status="waiting_assignment",
                    )

                    created_entry["transfer"] = transfer_record
                    created_entry["operation"] = operation

                elif service_type == "tour":

                    from app.services.tour import TourService

                    tour_data = item.get("tour")

                    if not tour_data:
                        raise ValueError(
                            "Tour service requires tour data"
                        )

                    tour_service = TourService(connection)

                    tour_booking = tour_service.attach_booking(
                        booking_service_id=service["id"],
                        tour_departure_id=tour_data[
                            "tour_departure_id"
                        ],
                        adult_count=item.get(
                            "pax_adult",
                            0,
                        ),
                        child_count=item.get(
                            "pax_child",
                            0,
                        ),
                        infant_count=item.get(
                            "pax_infant",
                            0,
                        ),
                        pickup_required=tour_data.get(
                            "pickup_required",
                            False,
                        ),
                        pickup_location=tour_data.get(
                            "pickup_location"
                        ),
                        notes=tour_data.get("notes"),
                    )

                    created_entry["tour_booking"] = tour_booking

                elif service_type == "other":
                    pass

                else:
                    raise ValueError(
                        f"Unsupported service type: {service_type}"
                    )

                created_services.append(created_entry)

            booking_event_repo.insert({
                "id": generate_id("outbox"),
                "booking_id": booking["id"],
                "event_type": "booking_created",
                "new_value": booking["status"],
                "description": "Booking created",
                "actor_user_id": get_user_id(),
            })

            audit.log(
                action="booking.create",
                entity_type="booking",
                entity_id=booking["id"],
                new_data={
                    "booking_code": booking["booking_code"],
                    "status": booking["status"],
                    "source": booking["source"],
                },
            )

            outbox.publish(
                event_type="booking.created",
                aggregate_type="booking",
                aggregate_id=booking["id"],
                payload={
                    "booking_id": booking["id"],
                    "booking_code": booking["booking_code"],
                },
            )

            return {
                "booking": booking,
                "customer": customer_record,
                "services": created_services,
            }

    def get(self, booking_id: str):
        repo = BookingRepository()

        booking = repo.get_full_detail(
            booking_id
        )

        if booking is None:
            raise LookupError(
                "Booking not found"
            )

        return booking

    def get_by_code(self, booking_code: str):
        repo = BookingRepository()
        booking = repo.get_by_code(booking_code)

        if booking is None:
            raise LookupError("Booking not found")

        booking["services"] = repo.get_services(
            booking["id"]
        )

        return booking

    def list_recent(self, limit: int = 50):
        return BookingRepository().list_recent(
            limit=limit
        )
