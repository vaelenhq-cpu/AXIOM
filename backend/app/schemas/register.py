from typing import Optional

from pydantic import EmailStr, Field, model_validator

from .common import APIModel


class RegisterRequest(APIModel):
    company_name: str = Field(
        min_length=2,
        max_length=200,
    )

    first_name: str = Field(
        min_length=1,
        max_length=120,
    )

    last_name: str = Field(
        min_length=1,
        max_length=120,
    )

    email: EmailStr

    phone: Optional[str] = Field(
        default=None,
        max_length=40,
    )

    password: str = Field(
        min_length=8,
        max_length=256,
    )

    password_confirm: str = Field(
        min_length=8,
        max_length=256,
    )

    @model_validator(mode="after")
    def passwords_match(self):
        if self.password != self.password_confirm:
            raise ValueError(
                "Passwords do not match"
            )

        return self
