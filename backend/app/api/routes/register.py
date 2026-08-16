from fastapi import APIRouter

from app.schemas.register import RegisterRequest
from app.services.register import RegisterService


router = APIRouter(
    prefix="/api/auth",
    tags=["Authentication"],
)


@router.post("/register")
def register(
    payload: RegisterRequest,
):
    return RegisterService().register(
        company_name=payload.company_name,
        first_name=payload.first_name,
        last_name=payload.last_name,
        email=str(payload.email),
        phone=payload.phone,
        password=payload.password,
    )
