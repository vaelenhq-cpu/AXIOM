from workers import WorkerEntrypoint
from fastapi import FastAPI, Request
import asgi

from d1_client import D1Client
from repositories.company import CompanyRepository


app = FastAPI(
    title="AXIOM Cloudflare API",
    version="0.5.0",
)


def db_client(
    request: Request,
) -> D1Client:
    env = request.scope["env"]

    return D1Client(
        env.DB_SERVICE
    )


@app.get("/")
async def root():
    return {
        "service": "AXIOM API",
        "runtime": "Cloudflare Python Worker",
        "status": "ok",
    }


@app.get("/health")
async def health():
    return {
        "status": "healthy",
    }


@app.get("/db-health")
async def db_health(
    request: Request,
):
    client = db_client(request)

    result = await client.db_check()

    return {
        "api": "ok",
        "database": "Cloudflare D1",
        "result": result,
    }


@app.get("/companies")
async def companies(
    request: Request,
):
    repo = CompanyRepository(
        db_client(request)
    )

    rows = await repo.list(
        limit=100,
    )

    return {
        "status": "ok",
        "count": len(rows),
        "results": rows,
    }


@app.get("/companies-count")
async def companies_count(
    request: Request,
):
    repo = CompanyRepository(
        db_client(request)
    )

    return {
        "status": "ok",
        "companies": await repo.count(),
    }


@app.get("/companies/slug/{slug}")
async def company_by_slug(
    slug: str,
    request: Request,
):
    repo = CompanyRepository(
        db_client(request)
    )

    company = await repo.get_by_slug(
        slug
    )

    if company is None:
        return {
            "status": "not_found",
            "company": None,
        }

    return {
        "status": "ok",
        "company": company,
    }


class Default(WorkerEntrypoint):
    async def fetch(
        self,
        request,
    ):
        return await asgi.fetch(
            app,
            request,
            self.env,
        )
