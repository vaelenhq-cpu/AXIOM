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


@app.post("/commands/booking/create")
async def command_create_booking(
    request: Request,
):
    payload = await request.json()

    client = D1Client(
        request.scope["env"].DB_SERVICE
    )

    result = await client.create_booking(
        payload
    )

    return {
        "status": "ok",
        "result": result,
    }


@app.post("/commands/booking/status")
async def command_booking_status(
    request: Request,
):
    payload = await request.json()

    client = D1Client(
        request.scope["env"].DB_SERVICE
    )

    result = await client.change_booking_status(
        payload
    )

    return {
        "status": "ok",
        "result": result,
    }


@app.post("/commands/operation/status")
async def command_operation_status(
    request: Request,
):
    payload = await request.json()

    client = D1Client(
        request.scope["env"].DB_SERVICE
    )

    result = await client.change_operation_status(
        payload
    )

    return {
        "status": "ok",
        "result": result,
    }


@app.post("/commands/driver/issue")
async def command_driver_issue(
    request: Request,
):
    payload = await request.json()

    client = D1Client(
        request.scope["env"].DB_SERVICE
    )

    result = await client.report_driver_issue(
        payload
    )

    return {
        "status": "ok",
        "result": result,
    }


@app.post("/commands/operation/reassign")
async def command_operation_reassign(
    request: Request,
):
    payload = await request.json()

    client = D1Client(
        request.scope["env"].DB_SERVICE
    )

    result = await client.reassign_operation(
        payload
    )

    return {
        "status": "ok",
        "result": result,
    }


# =========================================================
# AXIOM GENERIC RESOURCE GATEWAY
# =========================================================


def command_client(
    request: Request,
):
    return D1Client(
        request.scope["env"].DB_SERVICE
    )


@app.post("/commands/resource/catalog")
async def command_resource_catalog(
    request: Request,
):
    payload = await request.json()

    result = (
        await command_client(
            request
        ).resource_catalog(
            payload
        )
    )

    return {
        "status": "ok",
        "result": result,
    }


@app.post("/commands/resource/list")
async def command_resource_list(
    request: Request,
):
    payload = await request.json()

    result = (
        await command_client(
            request
        ).resource_list(
            payload
        )
    )

    return {
        "status": "ok",
        "result": result,
    }


@app.post("/commands/resource/get")
async def command_resource_get(
    request: Request,
):
    payload = await request.json()

    result = (
        await command_client(
            request
        ).resource_get(
            payload
        )
    )

    return {
        "status": "ok",
        "result": result,
    }


@app.post("/commands/resource/create")
async def command_resource_create(
    request: Request,
):
    payload = await request.json()

    result = (
        await command_client(
            request
        ).resource_create(
            payload
        )
    )

    return {
        "status": "ok",
        "result": result,
    }


@app.post("/commands/resource/update")
async def command_resource_update(
    request: Request,
):
    payload = await request.json()

    result = (
        await command_client(
            request
        ).resource_update(
            payload
        )
    )

    return {
        "status": "ok",
        "result": result,
    }


@app.post("/commands/resource/delete")
async def command_resource_delete(
    request: Request,
):
    payload = await request.json()

    result = (
        await command_client(
            request
        ).resource_delete(
            payload
        )
    )

    return {
        "status": "ok",
        "result": result,
    }


# =========================================================
# COMPANY
# =========================================================


@app.post("/commands/company/get")
async def command_company_get(
    request: Request,
):
    payload = await request.json()

    result = (
        await command_client(
            request
        ).get_company(
            payload
        )
    )

    return {
        "status": "ok",
        "result": result,
    }


@app.post("/commands/company/update")
async def command_company_update(
    request: Request,
):
    payload = await request.json()

    result = (
        await command_client(
            request
        ).update_company(
            payload
        )
    )

    return {
        "status": "ok",
        "result": result,
    }


# =========================================================
# DASHBOARD
# =========================================================


@app.post("/commands/dashboard/summary")
async def command_dashboard_summary(
    request: Request,
):
    payload = await request.json()

    result = (
        await command_client(
            request
        ).dashboard_summary(
            payload
        )
    )

    return {
        "status": "ok",
        "result": result,
    }


# =========================================================
# DISPATCH
# =========================================================


@app.post("/commands/dispatch/list")
async def command_dispatch_list(
    request: Request,
):
    payload = await request.json()

    result = (
        await command_client(
            request
        ).dispatch_list(
            payload
        )
    )

    return {
        "status": "ok",
        "result": result,
    }
