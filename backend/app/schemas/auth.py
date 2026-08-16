from typing import Optional

from pydantic import EmailStr, Field

from .common import APIModel


class LoginRequest(APIModel):
    company_slug: str = Field(
        min_length=1,
        max_length=120,
    )

    email: EmailStr

    password: str = Field(
        min_length=8,
        max_length=256,
    )


class UserSession(APIModel):
    id: str
    company_id: str
    email: str

    first_name: Optional[str] = None
    last_name: Optional[str] = None

    role: str


class LoginResponse(APIModel):
    token: str
    token_type: str = "bearer"
    expires_at: str
    session_id: str
    user: UserSession


class CurrentUserResponse(APIModel):
    session_id: str
    company_id: str
    user_id: str

    email: str

    first_name: Optional[str] = None
    last_name: Optional[str] = None

    role: str
