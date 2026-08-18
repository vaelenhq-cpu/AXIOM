from workers import WorkerEntrypoint
from fastapi import FastAPI, Request, HTTPException
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



def bearer_token(request: Request) -> str:
    value = request.headers.get("authorization")
    if not value or not value.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Bearer token required")
    token = value.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Bearer token required")
    return token

async def owner_identity(request: Request):
    try:
        return await db_client(request).owner_authenticate(bearer_token(request))
    except Exception as exc:
        raise HTTPException(status_code=401, detail=str(exc))

async def driver_identity(request: Request):
    try:
        return await db_client(request).driver_authenticate(bearer_token(request))
    except Exception as exc:
        raise HTTPException(status_code=401, detail=str(exc))

def owner_tenant(identity):
    return {"companyId": identity["company_id"], "userId": identity["user_id"], "role": identity["role"]}

def driver_context(identity):
    return {"companyId": identity["company_id"], "driverId": identity["driver_id"]}

async def secured_owner_payload(request: Request):
    payload = await request.json()
    identity = await owner_identity(request)
    payload["tenant"] = owner_tenant(identity)
    return payload

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



@app.post("/api/auth/login")
async def owner_login_route(request: Request):
    payload = await request.json()
    try:
        return await db_client(request).owner_login({
            "companySlug": payload.get("company_slug", ""), "email": payload.get("email", ""),
            "password": payload.get("password", ""), "ipAddress": request.headers.get("cf-connecting-ip"),
            "userAgent": request.headers.get("user-agent"),
        })
    except Exception as exc:
        raise HTTPException(status_code=401, detail=str(exc))

@app.get("/api/auth/me")
async def owner_me_route(request: Request):
    return await owner_identity(request)

@app.post("/api/auth/logout")
async def owner_logout_route(request: Request):
    await db_client(request).owner_logout(bearer_token(request))
    return {"status": "ok"}

@app.post("/driver/auth/login")
async def driver_login_route(request: Request):
    payload = await request.json()
    try:
        return await db_client(request).driver_login({
            "companySlug": payload.get("company_slug", ""), "loginIdentifier": payload.get("login_identifier", ""),
            "password": payload.get("password", ""), "ipAddress": request.headers.get("cf-connecting-ip"),
            "userAgent": request.headers.get("user-agent"),
        })
    except Exception as exc:
        raise HTTPException(status_code=401, detail=str(exc))

@app.get("/driver/me")
async def driver_me_route(request: Request):
    return await driver_identity(request)

@app.get("/driver/operations")
async def driver_operations_route(request: Request):
    identity = await driver_identity(request)
    return await db_client(request).driver_operations_list(driver_context(identity), 100)

@app.get("/driver/operations/{operation_id}")
async def driver_operation_detail_route(operation_id: str, request: Request):
    identity = await driver_identity(request)
    return await db_client(request).driver_operation_detail(driver_context(identity), operation_id)

@app.post("/driver/operations/{operation_id}/accept")
async def driver_accept_route(operation_id: str, request: Request):
    identity = await driver_identity(request)
    return await db_client(request).driver_accept_operation(driver_context(identity), operation_id)

@app.post("/driver/operations/{operation_id}/start")
async def driver_start_route(operation_id: str, request: Request):
    identity = await driver_identity(request)
    return await db_client(request).driver_start_operation(driver_context(identity), operation_id)

@app.post("/driver/operations/{operation_id}/event")
async def driver_event_route(operation_id: str, request: Request):
    identity = await driver_identity(request)
    payload = await request.json()
    return await db_client(request).driver_record_field_event(driver_context(identity), operation_id, payload.get("event_type", ""), payload.get("description"))

@app.post("/driver/operations/{operation_id}/complete")
async def driver_complete_route(operation_id: str, request: Request):
    identity = await driver_identity(request)
    return await db_client(request).driver_complete_operation(driver_context(identity), operation_id)

@app.post("/driver/operations/{operation_id}/issue")
async def driver_issue_route(operation_id: str, request: Request):
    identity = await driver_identity(request)
    payload = await request.json()
    return await db_client(request).report_driver_issue({
        "tenant": {"companyId": identity["company_id"]}, "driverId": identity["driver_id"],
        "operationId": operation_id, "issueType": payload.get("issue_type", ""), "description": payload.get("description", ""),
    })

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
    payload = await secured_owner_payload(
        request
    )

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
    payload = await secured_owner_payload(
        request
    )

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
    payload = await secured_owner_payload(
        request
    )

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
    identity = await driver_identity(request)
    payload["tenant"] = {"companyId": identity["company_id"]}
    payload["driverId"] = identity["driver_id"]

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
    payload = await secured_owner_payload(
        request
    )

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
    payload = await secured_owner_payload(
        request
    )

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
    payload = await secured_owner_payload(
        request
    )

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
    payload = await secured_owner_payload(
        request
    )

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
    payload = await secured_owner_payload(
        request
    )

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
    payload = await secured_owner_payload(
        request
    )

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
    payload = await secured_owner_payload(
        request
    )

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
    payload = await secured_owner_payload(
        request
    )

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
    payload = await secured_owner_payload(
        request
    )

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
    payload = await secured_owner_payload(
        request
    )

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
    payload = await secured_owner_payload(
        request
    )

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


# AXIOM_STABILIZE_V3_OWNER_PARITY
# ============================================================
# OWNER REST FACADE
# Auth/tenant identity comes from V2 owner_identity().
# ============================================================

import hashlib
import re
import secrets
import unicodedata
from datetime import datetime, timedelta, timezone


def _owner_tenant(identity):
    return {
        "companyId": identity["company_id"],
        "userId": identity["user_id"],
        "role": identity.get("role"),
    }


async def _owner_resource_list(
    request: Request,
    resource: str,
    *,
    filters=None,
    limit=100,
    offset=0,
    order_by=None,
    descending=True,
):
    identity = await owner_identity(request)
    payload = {
        "tenant": _owner_tenant(identity),
        "resource": resource,
        "limit": limit,
        "offset": offset,
        "filters": filters or {},
        "descending": descending,
    }
    if order_by:
        payload["orderBy"] = order_by
    return await db_client(request).resource_list(payload)


async def _owner_resource_get(request: Request, resource: str, resource_id: str):
    identity = await owner_identity(request)
    return await db_client(request).resource_get({
        "tenant": _owner_tenant(identity),
        "resource": resource,
        "id": resource_id,
    })


async def _owner_resource_create(request: Request, resource: str, data: dict):
    identity = await owner_identity(request)
    return await db_client(request).resource_create({
        "tenant": _owner_tenant(identity),
        "resource": resource,
        "data": data,
    })


async def _owner_resource_update(request: Request, resource: str, resource_id: str, data: dict):
    identity = await owner_identity(request)
    return await db_client(request).resource_update({
        "tenant": _owner_tenant(identity),
        "resource": resource,
        "id": resource_id,
        "data": data,
    })


def _slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    ascii_value = normalized.encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", ascii_value).strip("-").lower()
    return slug or "company"


def _new_id(prefix: str) -> str:
    return prefix + "_" + secrets.token_hex(12)


def _hash_password(password: str) -> str:
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must contain at least 8 characters")
    iterations = 100_000
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    return f"pbkdf2_sha256${iterations}${salt.hex()}${digest.hex()}"


def _new_session_token():
    raw = secrets.token_urlsafe(32)
    hashed = hashlib.sha256(raw.encode("utf-8")).hexdigest()
    return raw, hashed


@app.post("/api/auth/register")
async def owner_register_v3(request: Request):
    payload = await request.json()
    company_name = str(payload.get("company_name", "")).strip()
    first_name = str(payload.get("first_name", "")).strip()
    last_name = str(payload.get("last_name", "")).strip()
    email = str(payload.get("email", "")).strip().lower()
    password = str(payload.get("password", ""))
    password_confirm = str(payload.get("password_confirm", ""))

    if not company_name:
        raise HTTPException(status_code=400, detail="Company name is required")
    if not first_name:
        raise HTTPException(status_code=400, detail="First name is required")
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")
    if password != password_confirm:
        raise HTTPException(status_code=400, detail="Passwords do not match")

    client = db_client(request)
    existing = await client.first(
        "SELECT id FROM company_users WHERE lower(email)=lower(?) LIMIT 1",
        [email],
    )
    if existing:
        raise HTTPException(status_code=409, detail="This email address is already registered")

    base_slug = _slugify(company_name)
    slug = base_slug
    counter = 2
    while await client.first("SELECT 1 FROM companies WHERE slug=? LIMIT 1", [slug]):
        slug = f"{base_slug}-{counter}"
        counter += 1

    company_id = _new_id("company")
    user_id = _new_id("user")
    settings_id = _new_id("company_settings")
    session_id = _new_id("session")
    raw_token, token_hash = _new_session_token()
    expires_at = (datetime.now(timezone.utc) + timedelta(hours=12)).isoformat()
    password_hash = _hash_password(password)

    await client.batch([
        {
            "sql": "INSERT INTO companies (id,name,slug,status,country_code,timezone,default_currency) VALUES (?,?,?,'active','TR','Europe/Istanbul','TRY')",
            "params": [company_id, company_name, slug],
        },
        {
            "sql": "INSERT INTO company_settings (id,company_id,booking_prefix,auto_confirm_bookings,auto_create_operations,require_driver_acceptance,default_language,default_timezone,default_currency) VALUES (?,?,'AX',0,1,0,'tr','Europe/Istanbul','TRY')",
            "params": [settings_id, company_id],
        },
        {
            "sql": "INSERT INTO company_users (id,company_id,email,password_hash,first_name,last_name,role,status) VALUES (?,?,?,?,?,?,'owner','active')",
            "params": [user_id, company_id, email, password_hash, first_name, last_name],
        },
        {
            "sql": "INSERT INTO auth_sessions (id,company_id,user_id,token_hash,expires_at) VALUES (?,?,?,?,?)",
            "params": [session_id, company_id, user_id, token_hash, expires_at],
        },
    ])

    return {
        "token": raw_token,
        "token_type": "bearer",
        "expires_at": expires_at,
        "session_id": session_id,
        "company": {"id": company_id, "name": company_name, "slug": slug},
        "user": {
            "id": user_id,
            "company_id": company_id,
            "email": email,
            "first_name": first_name,
            "last_name": last_name,
            "role": "owner",
        },
    }


@app.get("/api/company")
async def company_get_v3(request: Request):
    identity = await owner_identity(request)
    return await db_client(request).get_company({"tenant": _owner_tenant(identity)})


@app.patch("/api/company")
async def company_update_v3(request: Request):
    identity = await owner_identity(request)
    return await db_client(request).update_company({
        "tenant": _owner_tenant(identity),
        "data": await request.json(),
    })


@app.get("/api/settings")
async def settings_get_v3(request: Request):
    rows = await _owner_resource_list(request, "company_settings", limit=1)
    if not rows:
        raise HTTPException(status_code=404, detail="Company settings not found")
    return rows[0]


@app.patch("/api/settings")
async def settings_update_v3(request: Request):
    rows = await _owner_resource_list(request, "company_settings", limit=1)
    if not rows:
        raise HTTPException(status_code=404, detail="Company settings not found")
    return await _owner_resource_update(request, "company_settings", rows[0]["id"], await request.json())


@app.get("/api/customers")
async def customers_list_v3(request: Request):
    return await _owner_resource_list(request, "customers")


@app.get("/api/customers/search")
async def customers_search_v3(request: Request, q: str = ""):
    identity = await owner_identity(request)
    query = q.strip()
    if not query:
        return []
    like = f"%{query}%"
    return await db_client(request).all(
        "SELECT * FROM customers WHERE company_id=? AND (first_name LIKE ? OR last_name LIKE ? OR email LIKE ? OR phone LIKE ?) ORDER BY created_at DESC LIMIT 100",
        [identity["company_id"], like, like, like, like],
    )


@app.get("/api/customers/{customer_id}")
async def customer_get_v3(customer_id: str, request: Request):
    return await _owner_resource_get(request, "customers", customer_id)


@app.post("/api/customers")
async def customer_create_v3(request: Request):
    return await _owner_resource_create(request, "customers", await request.json())


@app.patch("/api/customers/{customer_id}")
async def customer_update_v3(customer_id: str, request: Request):
    return await _owner_resource_update(request, "customers", customer_id, await request.json())


@app.get("/api/drivers")
async def drivers_list_v3(request: Request):
    return await _owner_resource_list(request, "drivers")


@app.get("/api/drivers/available")
async def drivers_available_v3(request: Request):
    return await _owner_resource_list(request, "drivers", filters={"active": 1, "status": "available"})


@app.get("/api/drivers/{driver_id}")
async def driver_get_owner_v3(driver_id: str, request: Request):
    return await _owner_resource_get(request, "drivers", driver_id)


@app.post("/api/drivers")
async def driver_create_owner_v3(request: Request):
    payload = await request.json()
    payload.setdefault("status", "available")
    payload.setdefault("active", 1)
    return await _owner_resource_create(request, "drivers", payload)


@app.patch("/api/drivers/{driver_id}/status")
async def driver_status_owner_v3(driver_id: str, request: Request):
    return await _owner_resource_update(request, "drivers", driver_id, await request.json())


@app.get("/api/vehicles")
async def vehicles_list_v3(request: Request):
    return await _owner_resource_list(request, "vehicles")


@app.get("/api/vehicles/available")
async def vehicles_available_v3(request: Request):
    return await _owner_resource_list(request, "vehicles", filters={"active": 1, "status": "available"})


@app.get("/api/vehicles/{vehicle_id}")
async def vehicle_get_v3(vehicle_id: str, request: Request):
    return await _owner_resource_get(request, "vehicles", vehicle_id)


@app.post("/api/vehicles")
async def vehicle_create_v3(request: Request):
    payload = await request.json()
    payload.setdefault("status", "available")
    payload.setdefault("active", 1)
    return await _owner_resource_create(request, "vehicles", payload)


@app.patch("/api/vehicles/{vehicle_id}/status")
async def vehicle_status_v3(vehicle_id: str, request: Request):
    return await _owner_resource_update(request, "vehicles", vehicle_id, await request.json())


@app.get("/api/tours")
async def tours_list_v3(request: Request):
    return await _owner_resource_list(request, "tour_products")


@app.post("/api/tours")
async def tours_create_v3(request: Request):
    payload = await request.json()
    payload.setdefault("active", 1)
    return await _owner_resource_create(request, "tour_products", payload)


@app.get("/api/tours/departures")
async def departures_list_v3(request: Request):
    return await _owner_resource_list(request, "tour_departures", order_by="departure_date", descending=False)


@app.post("/api/tours/departures")
async def departures_create_v3(request: Request):
    payload = await request.json()
    payload.setdefault("status", "scheduled")
    return await _owner_resource_create(request, "tour_departures", payload)


@app.get("/api/routes")
async def routes_list_v3(request: Request):
    return await _owner_resource_list(request, "routes")


@app.post("/api/routes")
async def routes_create_v3(request: Request):
    payload = await request.json()
    payload.setdefault("active", 1)
    return await _owner_resource_create(request, "routes", payload)


@app.get("/api/routes/{route_id}")
async def route_get_v3(route_id: str, request: Request):
    return await _owner_resource_get(request, "routes", route_id)


@app.get("/api/pricing")
async def pricing_list_v3(request: Request):
    return await _owner_resource_list(request, "pricing_rules", filters={"active": 1}, order_by="priority", descending=False)


@app.post("/api/pricing/route")
async def pricing_route_create_v3(request: Request):
    payload = await request.json()
    route_id = payload.get("route_id")
    if not route_id:
        raise HTTPException(status_code=400, detail="route_id is required")
    await _owner_resource_get(request, "routes", route_id)
    if float(payload.get("base_price", 0)) < 0:
        raise HTTPException(status_code=400, detail="base_price cannot be negative")
    data = dict(payload)
    data["rule_type"] = "route"
    data["active"] = 1
    return await _owner_resource_create(request, "pricing_rules", data)


@app.get("/api/pricing/calculate/route")
async def pricing_route_calculate_v3(request: Request, route_id: str, vehicle_class: str | None = None):
    identity = await owner_identity(request)
    client = db_client(request)
    if vehicle_class:
        row = await client.first(
            "SELECT * FROM pricing_rules WHERE company_id=? AND rule_type='route' AND route_id=? AND active=1 AND (vehicle_class=? OR vehicle_class IS NULL) AND (valid_from IS NULL OR valid_from<=CURRENT_TIMESTAMP) AND (valid_until IS NULL OR valid_until>=CURRENT_TIMESTAMP) ORDER BY CASE WHEN vehicle_class=? THEN 0 ELSE 1 END, priority ASC LIMIT 1",
            [identity["company_id"], route_id, vehicle_class, vehicle_class],
        )
    else:
        row = await client.first(
            "SELECT * FROM pricing_rules WHERE company_id=? AND rule_type='route' AND route_id=? AND active=1 AND vehicle_class IS NULL AND (valid_from IS NULL OR valid_from<=CURRENT_TIMESTAMP) AND (valid_until IS NULL OR valid_until>=CURRENT_TIMESTAMP) ORDER BY priority ASC LIMIT 1",
            [identity["company_id"], route_id],
        )
    if not row:
        raise HTTPException(status_code=404, detail="No active pricing rule found")
    return {"pricing_rule_id": row["id"], "currency": row["currency"], "amount": float(row["base_price"])}


@app.get("/api/finance/payments")
async def payments_list_v3(request: Request):
    return await _owner_resource_list(request, "payments")


@app.post("/api/finance/payments")
async def payments_create_v3(request: Request):
    payload = await request.json()
    if float(payload.get("amount", 0)) <= 0:
        raise HTTPException(status_code=400, detail="Payment amount must be greater than zero")
    await _owner_resource_get(request, "bookings", payload.get("booking_id", ""))
    payload.setdefault("status", "pending")
    payload.setdefault("currency", "TRY")
    return await _owner_resource_create(request, "payments", payload)


@app.get("/api/finance/transactions")
async def finance_transactions_list_v3(request: Request):
    return await _owner_resource_list(request, "finance_transactions", order_by="transaction_date")


@app.post("/api/finance/transactions")
async def finance_transactions_create_v3(request: Request):
    identity = await owner_identity(request)
    payload = await request.json()
    if float(payload.get("amount", 0)) < 0:
        raise HTTPException(status_code=400, detail="Transaction amount cannot be negative")
    payload.setdefault("currency", "TRY")
    payload["created_by"] = identity["user_id"]
    return await _owner_resource_create(request, "finance_transactions", payload)


@app.get("/api/integrations")
async def integrations_list_v3(request: Request):
    return await _owner_resource_list(request, "integrations")


@app.post("/api/integrations")
async def integrations_create_v3(request: Request):
    import json
    payload = await request.json()
    settings = payload.pop("settings", None)
    if settings is not None:
        payload["settings_json"] = json.dumps(settings)
    payload.setdefault("status", "inactive")
    payload.setdefault("sync_mode", "manual")
    return await _owner_resource_create(request, "integrations", payload)


@app.patch("/api/integrations/{integration_id}/status")
async def integration_status_v3(integration_id: str, request: Request):
    return await _owner_resource_update(request, "integrations", integration_id, await request.json())


@app.get("/api/operations")
async def operations_list_v3(request: Request):
    identity = await owner_identity(request)
    return await db_client(request).dispatch_list({"tenant": _owner_tenant(identity), "limit": 100})


@app.post("/api/operations/{operation_id}/assign")
async def operation_assign_v3(operation_id: str, request: Request):
    identity = await owner_identity(request)
    payload = await request.json()
    return await db_client(request).reassign_operation({
        "tenant": _owner_tenant(identity),
        "operationId": operation_id,
        "driverId": payload.get("driver_id"),
        "vehicleId": payload.get("vehicle_id"),
        "reason": "Initial assignment",
        "markPreviousVehicleMaintenance": False,
    })


@app.post("/api/operations/{operation_id}/reassign")
async def operation_reassign_v3(operation_id: str, request: Request):
    identity = await owner_identity(request)
    payload = await request.json()
    return await db_client(request).reassign_operation({
        "tenant": _owner_tenant(identity),
        "operationId": operation_id,
        "driverId": payload.get("driver_id"),
        "vehicleId": payload.get("vehicle_id"),
        "reason": payload.get("reason", ""),
        "markPreviousVehicleMaintenance": bool(payload.get("mark_previous_vehicle_maintenance", False)),
    })


@app.get("/api/bookings")
async def bookings_list_v3(request: Request, limit: int = 100):
    identity = await owner_identity(request)
    return await db_client(request).all(
        """
        SELECT b.id,b.booking_code,b.status,b.source,b.source_provider,b.external_reference,b.currency,b.total_amount,b.created_at,b.booked_at,
               c.first_name AS customer_first_name,c.last_name AS customer_last_name,c.phone AS customer_phone,c.email AS customer_email,
               bs.service_type,bs.title AS service_title,bs.service_date,bs.start_time,
               (COALESCE(bs.pax_adult,0)+COALESCE(bs.pax_child,0)+COALESCE(bs.pax_infant,0)) AS pax_total,
               t.pickup_location,t.dropoff_location,t.pickup_datetime,t.flight_number,t.requested_vehicle_class,
               tp.name AS tour_name,td.departure_date,td.departure_time
        FROM bookings b
        LEFT JOIN customers c ON c.company_id=b.company_id AND c.id=b.customer_id
        LEFT JOIN booking_services bs ON bs.company_id=b.company_id AND bs.booking_id=b.id
        LEFT JOIN transfers t ON t.company_id=b.company_id AND t.booking_service_id=bs.id
        LEFT JOIN tour_bookings tb ON tb.company_id=b.company_id AND tb.booking_service_id=bs.id
        LEFT JOIN tour_departures td ON td.company_id=b.company_id AND td.id=tb.tour_departure_id
        LEFT JOIN tour_products tp ON tp.company_id=b.company_id AND tp.id=td.tour_product_id
        WHERE b.company_id=?
        GROUP BY b.id
        ORDER BY b.created_at DESC
        LIMIT ?
        """,
        [identity["company_id"], min(max(limit, 1), 200)],
    )


@app.get("/api/bookings/{booking_id}")
async def booking_detail_v3(booking_id: str, request: Request):
    identity = await owner_identity(request)
    company_id = identity["company_id"]
    client = db_client(request)
    booking = await client.first("SELECT * FROM bookings WHERE company_id=? AND id=? LIMIT 1", [company_id, booking_id])
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    customer = {}
    if booking.get("customer_id"):
        customer = await client.first("SELECT * FROM customers WHERE company_id=? AND id=? LIMIT 1", [company_id, booking["customer_id"]]) or {}
    services = await client.all("SELECT * FROM booking_services WHERE company_id=? AND booking_id=? ORDER BY created_at ASC", [company_id, booking_id])
    for service in services:
        if service.get("service_type") == "transfer":
            transfer = await client.first("SELECT * FROM transfers WHERE company_id=? AND booking_service_id=? LIMIT 1", [company_id, service["id"]])
            service["transfer"] = transfer
            if transfer:
                service["operation"] = await client.first(
                    "SELECT o.*,oa.status AS assignment_status,oa.driver_id,oa.vehicle_id,d.first_name AS driver_first_name,d.last_name AS driver_last_name,v.plate AS vehicle_plate,v.brand AS vehicle_brand,v.model AS vehicle_model FROM operations o LEFT JOIN operation_assignments oa ON oa.company_id=o.company_id AND oa.operation_id=o.id AND oa.status NOT IN ('cancelled','rejected') LEFT JOIN drivers d ON d.company_id=o.company_id AND d.id=oa.driver_id LEFT JOIN vehicles v ON v.company_id=o.company_id AND v.id=oa.vehicle_id WHERE o.company_id=? AND o.source_type='transfer' AND o.source_id=? ORDER BY oa.assigned_at DESC LIMIT 1",
                    [company_id, transfer["id"]],
                )
        elif service.get("service_type") == "tour":
            service["tour"] = await client.first(
                "SELECT tb.*,td.departure_date,td.departure_time,td.meeting_point,td.tour_product_id,tp.name AS tour_name,tp.code AS tour_code FROM tour_bookings tb JOIN tour_departures td ON td.company_id=tb.company_id AND td.id=tb.tour_departure_id JOIN tour_products tp ON tp.company_id=td.company_id AND tp.id=td.tour_product_id WHERE tb.company_id=? AND tb.booking_service_id=? LIMIT 1",
                [company_id, service["id"]],
            )
    result = dict(booking)
    result["customer"] = customer
    result["services"] = services
    return result


@app.patch("/api/bookings/{booking_id}/status")
async def booking_status_v3(booking_id: str, request: Request):
    identity = await owner_identity(request)
    payload = await request.json()
    return await db_client(request).change_booking_status({
        "tenant": _owner_tenant(identity),
        "bookingId": booking_id,
        "newStatus": payload.get("status"),
    })


@app.get("/api/dashboard")
async def dashboard_v3(request: Request):
    identity = await owner_identity(request)
    tenant = _owner_tenant(identity)
    client = db_client(request)
    summary = await client.dashboard_summary({"tenant": tenant})
    dispatch = await client.dispatch_list({"tenant": tenant, "limit": 100})
    action_required = [item for item in dispatch if item.get("status") in {"problem", "waiting_assignment"}][:20]
    upcoming = [item for item in dispatch if item.get("status") not in {"completed", "cancelled"}][:20]
    return {
        "summary": {
            "bookings": summary.get("bookings", {}),
            "operations": summary.get("operations", {}),
            "drivers": {"available": summary.get("resources", {}).get("availableDrivers", 0)},
            "vehicles": {"available": summary.get("resources", {}).get("availableVehicles", 0)},
            "transfers": {},
            "tours": {},
        },
        "action_required": action_required,
        "recent_bookings": summary.get("recentBookings", []),
        "upcoming_operations": upcoming,
    }


@app.get("/api/platform/domains")
async def domains_list_v3(request: Request):
    return await _owner_resource_list(request, "company_domains")


@app.post("/api/platform/domains")
async def domains_create_v3(request: Request):
    payload = await request.json()
    domain = str(payload.get("domain", "")).strip().lower().replace("https://", "").replace("http://", "").strip("/")
    if not domain:
        raise HTTPException(status_code=400, detail="Domain is required")
    existing = await _owner_resource_list(request, "company_domains", filters={"domain": domain}, limit=1)
    if existing:
        return existing[0]
    return await _owner_resource_create(request, "company_domains", {
        "domain": domain,
        "domain_type": payload.get("domain_type", "website"),
        "status": "pending",
        "verification_token": "axiom-domain-" + secrets.token_urlsafe(18),
    })


@app.post("/api/platform/domains/{domain_id}/verify")
async def domain_verify_pending_v3(domain_id: str, request: Request):
    await owner_identity(request)
    raise HTTPException(status_code=501, detail="Domain verification requires the dedicated production verifier boundary")


@app.post("/api/platform/driver-accounts")
async def driver_account_create_v3(request: Request):
    identity = await owner_identity(request)
    payload = await request.json()
    driver_id = str(payload.get("driver_id", ""))
    login_identifier = str(payload.get("login_identifier", "")).strip()
    password = str(payload.get("password", ""))
    if not login_identifier:
        raise HTTPException(status_code=400, detail="login_identifier is required")
    client = db_client(request)
    driver = await client.first("SELECT id FROM drivers WHERE company_id=? AND id=? LIMIT 1", [identity["company_id"], driver_id])
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    account_id = _new_id("driver_account")
    password_hash = _hash_password(password)
    try:
        await client.run(
            "INSERT INTO driver_accounts (id,company_id,driver_id,login_identifier,password_hash,status) VALUES (?,?,?,?,?,'active')",
            [account_id, identity["company_id"], driver_id, login_identifier, password_hash],
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return await client.first(
        "SELECT id,company_id,driver_id,login_identifier,status,last_login_at,created_at,updated_at FROM driver_accounts WHERE company_id=? AND id=? LIMIT 1",
        [identity["company_id"], account_id],
    )
