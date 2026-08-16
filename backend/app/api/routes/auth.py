from fastapi import APIRouter, Depends, Request

from app.api.dependencies import authenticated_user

from app.schemas.auth import (
    CurrentUserResponse,
    LoginRequest,
    LoginResponse,
)

from app.services.auth import AuthService


router = APIRouter(
    prefix="/api/auth",
    tags=["Authentication"],
)


@router.post(
    "/login",
    response_model=LoginResponse,
)
def login(
    payload: LoginRequest,
    request: Request,
):
    result = AuthService().login(
        company_slug=payload.company_slug,
        email=str(payload.email),
        password=payload.password,
        ip_address=(
            request.client.host
            if request.client
            else None
        ),
        user_agent=request.headers.get(
            "user-agent"
        ),
    )

    return {
        **result,
        "token_type": "bearer",
    }


@router.get(
    "/me",
    response_model=CurrentUserResponse,
)
def me(
    identity: dict = Depends(
        authenticated_user
    ),
):
    return identity


from fastapi.security import HTTPAuthorizationCredentials
from app.api.dependencies import bearer_scheme


@router.post("/logout")
def logout(
    credentials: HTTPAuthorizationCredentials = Depends(
        bearer_scheme
    ),
):
    if credentials is None:
        raise ValueError(
            "Authentication token is required"
        )

    return AuthService().logout(
        credentials.credentials
    )
