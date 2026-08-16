from fastapi import APIRouter, Depends, Query

from app.api.dependencies import authenticated_user

from app.schemas.finance import (
    FinanceTransactionCreate,
    PaymentCreate,
)

from app.services.finance import FinanceService


router = APIRouter(
    prefix="/api/finance",
    tags=["Finance"],
    dependencies=[
        Depends(authenticated_user),
    ],
)


@router.get("/payments")
async def list_payments(
    limit: int = Query(
        default=100,
        ge=1,
        le=500,
    ),
    offset: int = Query(
        default=0,
        ge=0,
    ),
):
    return FinanceService().list_payments(
        limit=limit,
        offset=offset,
    )


@router.post("/payments")
async def create_payment(
    payload: PaymentCreate,
):
    return FinanceService().create_payment(
        **payload.model_dump()
    )


@router.get("/transactions")
async def list_transactions(
    limit: int = Query(
        default=100,
        ge=1,
        le=500,
    ),
):
    return FinanceService().list_transactions(
        limit=limit
    )


@router.post("/transactions")
async def create_transaction(
    payload: FinanceTransactionCreate,
):
    return FinanceService().create_transaction(
        **payload.model_dump()
    )
