from workers import WorkerEntrypoint
from fastapi import FastAPI, Request
import asgi

from d1_client import D1Client


app = FastAPI(
    title="AXIOM Cloudflare API PoC",
    version="0.3.0",
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
    env = request.scope["env"]

    client = D1Client(
        env.DB_SERVICE
    )

    result = await client.first(
        """
        SELECT
            CURRENT_TIMESTAMP AS now,
            1 AS connection_ok
        """
    )

    return {
        "api": "ok",
        "database": "Cloudflare D1",
        "result": result,
    }


@app.get("/companies-count")
async def companies_count(
    request: Request,
):
    env = request.scope["env"]

    client = D1Client(
        env.DB_SERVICE
    )

    result = await client.first(
        """
        SELECT COUNT(*) AS count
        FROM companies
        """
    )

    return {
        "status": "ok",
        "companies": result["count"],
    }


class Default(WorkerEntrypoint):
    async def fetch(self, request):
        return await asgi.fetch(
            app,
            request,
            self.env,
        )
