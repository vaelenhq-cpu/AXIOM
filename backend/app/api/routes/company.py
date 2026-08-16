from fastapi import APIRouter, Depends

from app.api.dependencies import authenticated_user
from app.schemas.company import CompanyUpdate
from app.services.company import CompanyService


router = APIRouter(
    prefix="/api/company",
    tags=["Company"],
    dependencies=[
        Depends(authenticated_user),
    ],
)


@router.get("")
async def get_company():
    return CompanyService().get_current()


@router.patch("")
async def update_company(
    payload: CompanyUpdate,
):
    return CompanyService().update_current(
        payload.model_dump(
            exclude_unset=True
        )
    )
