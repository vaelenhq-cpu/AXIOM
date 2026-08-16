from typing import Optional

from pydantic import EmailStr, Field

from .common import APIModel


class CustomerCreate(APIModel):
    first_name: str = Field(
        min_length=1,
        max_length=120,
    )

    last_name: Optional[str] = Field(
        default=None,
        max_length=120,
    )

    email: Optional[EmailStr] = None

    phone: Optional[str] = Field(
        default=None,
        max_length=40,
    )

    nationality: Optional[str] = Field(
        default=None,
        max_length=10,
    )

    language: Optional[str] = Field(
        default=None,
        max_length=10,
    )

    notes: Optional[str] = Field(
        default=None,
        max_length=5000,
    )


class CustomerUpdate(APIModel):
    first_name: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=120,
    )

    last_name: Optional[str] = Field(
        default=None,
        max_length=120,
    )

    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    nationality: Optional[str] = None
    language: Optional[str] = None
    notes: Optional[str] = None
