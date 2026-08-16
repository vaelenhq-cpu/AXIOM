from fastapi import (
    APIRouter,
    Depends,
    Query,
)

from app.api.dependencies import (
    authenticated_user,
)

from app.services.domain_provider_oauth import (
    DomainProviderOAuthService,
)


router = APIRouter(
    prefix="/api/domain-providers/cloudflare",
    tags=["Domain Provider OAuth"],
)


@router.post(
    "/connect",
    dependencies=[
        Depends(authenticated_user),
    ],
)
async def connect_cloudflare(
    redirect_path: str | None = None,
):
    return (
        DomainProviderOAuthService()
        .start_cloudflare(
            redirect_path=redirect_path,
        )
    )


@router.get("/callback")
async def cloudflare_callback(
    code: str = Query(...),
    state: str = Query(...),
):
    return (
        DomainProviderOAuthService()
        .complete_cloudflare(
            code=code,
            state=state,
        )
    )

