from typing import Optional

from pydantic import EmailStr, Field

from .common import APIModel


class DriverCreate(APIModel):
    first_name: str = Field(
        min_length=1,
        max_length=120,
    )

    last_name: Optional[str] = None

    phone: Optional[str] = None
    email: Optional[EmailStr] = None

    license_number: Optional[str] = None
    license_class: Optional[str] = None

    notes: Optional[str] = None


class VehicleCreate(APIModel):
    plate: str = Field(
        min_length=1,
        max_length=30,
    )

    brand: Optional[str] = None
    model: Optional[str] = None

    model_year: Optional[int] = Field(
        default=None,
        ge=1900,
        le=2200,
    )

    vehicle_class: Optional[str] = None

    capacity: int = Field(
        default=1,
        ge=1,
        le=200,
    )

    notes: Optional[str] = None
