from fastapi import APIRouter, Depends, Query

from app.api.dependencies import authenticated_user
from app.schemas.customer import (
    CustomerCreate,
    CustomerUpdate,
)
from app.services.customer import CustomerService


router = APIRouter(
    prefix="/api/customers",
    tags=["Customers"],
    dependencies=[
        Depends(authenticated_user),
    ],
)


@router.get("")
async def list_customers(
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
):
    return CustomerService().list(
        limit=limit,
        offset=offset,
    )


@router.get("/search")
async def search_customers(
    q: str,
):
    return CustomerService().search(q)


@router.get("/{customer_id}")
async def get_customer(customer_id: str):
    customer = CustomerService().get(
        customer_id
    )

    if customer is None:
        raise LookupError("Customer not found")

    return customer


@router.post("")
async def create_customer(
    payload: CustomerCreate,
):
    return CustomerService().create(
        **payload.model_dump()
    )


@router.patch("/{customer_id}")
async def update_customer(
    customer_id: str,
    payload: CustomerUpdate,
):
    return CustomerService().update(
        customer_id,
        payload.model_dump(
            exclude_unset=True
        ),
    )
