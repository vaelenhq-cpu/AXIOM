from typing import List, Literal, Optional

from pydantic import Field, model_validator

from .common import APIModel
from .customer import CustomerCreate


class TransferInput(APIModel):
    pickup_location: str
    dropoff_location: str

    pickup_datetime: Optional[str] = None

    flight_number: Optional[str] = None
    flight_datetime: Optional[str] = None

    pickup_sign: Optional[str] = None

    pax: int = Field(default=1, ge=1)
    luggage_count: int = Field(default=0, ge=0)

    requested_vehicle_class: Optional[str] = None
    special_request: Optional[str] = None


class TourInput(APIModel):
    tour_departure_id: str

    pickup_required: bool = False
    pickup_location: Optional[str] = None

    notes: Optional[str] = None


class BookingServiceInput(APIModel):
    service_type: Literal[
        "transfer",
        "tour",
        "other",
    ]

    title: str

    description: Optional[str] = None

    service_date: Optional[str] = None
    start_time: Optional[str] = None

    pax_adult: int = Field(default=0, ge=0)
    pax_child: int = Field(default=0, ge=0)
    pax_infant: int = Field(default=0, ge=0)

    quantity: int = Field(default=1, ge=1)

    unit_price: float = Field(default=0, ge=0)
    total_price: float = Field(default=0, ge=0)

    transfer: Optional[TransferInput] = None
    tour: Optional[TourInput] = None

    @model_validator(mode="after")
    def validate_payload(self):
        if (
            self.service_type == "transfer"
            and self.transfer is None
        ):
            raise ValueError(
                "transfer payload is required"
            )

        if (
            self.service_type == "tour"
            and self.tour is None
        ):
            raise ValueError(
                "tour payload is required"
            )

        return self


class BookingCreate(APIModel):
    booking_code: str = Field(
        min_length=1,
        max_length=80,
    )

    customer: CustomerCreate

    services: List[BookingServiceInput] = Field(
        min_length=1,
        max_length=100,
    )

    source: Literal[
        "manual",
        "website",
        "booking_widget",
        "api",
        "integration",
        "b2b",
        "phone",
        "whatsapp",
        "hotel",
        "other",
    ] = "manual"

    currency: str = Field(
        default="TRY",
        min_length=3,
        max_length=3,
    )

    customer_note: Optional[str] = None
    internal_note: Optional[str] = None
