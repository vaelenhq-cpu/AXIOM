#!/usr/bin/env python3

import compileall
import importlib
import json
import os
import socket
import sqlite3
import subprocess
import sys
import tempfile
import time
import traceback
import urllib.error
import urllib.request
from pathlib import Path


# ============================================================
# PATHS
# ============================================================

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
APP_DIR = BACKEND / "app"
MIGRATIONS_DIR = BACKEND / "migrations"
REPORT_DIR = BACKEND / "audit" / "reports"

sys.path.insert(0, str(BACKEND))

REPORT_DIR.mkdir(parents=True, exist_ok=True)


# ============================================================
# RESULT ENGINE
# ============================================================

RESULTS = []


def pass_test(name, detail=""):
    RESULTS.append(("PASS", name, detail))
    print(f"[PASS] {name}")
    if detail:
        print(f"       {detail}")


def fail_test(name, detail=""):
    RESULTS.append(("FAIL", name, detail))
    print(f"[FAIL] {name}")
    if detail:
        print(f"       {detail}")


def section(title):
    print()
    print("=" * 72)
    print(title)
    print("=" * 72)


def run_check(name, fn):
    try:
        detail = fn()
        pass_test(name, detail or "")
        return True
    except Exception as exc:
        fail_test(
            name,
            f"{type(exc).__name__}: {exc}",
        )
        traceback.print_exc()
        return False


# ============================================================
# TEMP DATABASE
# ============================================================

TEMP_DIR = tempfile.TemporaryDirectory(
    prefix="axiom_audit_"
)

TEMP_DB = Path(TEMP_DIR.name) / "axiom_audit.db"

os.environ["AXIOM_DATABASE_PATH"] = str(TEMP_DB)
os.environ["AXIOM_ENV"] = "audit"
os.environ["AXIOM_DEBUG"] = "0"


# ============================================================
# EXPECTED DATABASE OBJECTS
# ============================================================

EXPECTED_TABLES = {
    "companies",
    "company_users",
    "customers",
    "bookings",
    "booking_services",
    "booking_events",
    "auth_sessions",

    "drivers",
    "vehicles",
    "transfers",
    "tour_products",
    "tour_departures",
    "tour_bookings",

    "operations",
    "operation_assignments",
    "operation_events",

    "routes",
    "pricing_rules",
    "payments",
    "finance_transactions",
    "company_settings",

    "integrations",
    "integration_events",
    "notifications",
    "audit_logs",

    "webhook_endpoints",
    "webhook_deliveries",

    "roles",
    "permissions",
    "role_permissions",
    "user_roles",

    "company_domains",
    "booking_passengers",
    "booking_service_relations",

    "api_keys",
    "public_booking_keys",
    "public_booking_requests",
    "idempotency_keys",

    "integration_entity_mappings",
    "external_bookings",

    "driver_accounts",
    "driver_sessions",

    "guides",
    "operation_guide_assignments",

    "attachments",
    "outbox_events",
}


EXPECTED_ROUTES = {
    "/health",

    "/api/auth/login",
    "/api/auth/me",

    "/api/customers",
    "/api/bookings",

    "/api/drivers",
    "/api/vehicles",
    "/api/operations",

    "/api/tours",
    "/api/routes",
    "/api/pricing",

    "/api/settings",

    "/api/finance/payments",
    "/api/finance/transactions",

    "/api/integrations",

    "/public/booking",

    "/driver/auth/login",
    "/driver/me",
    "/driver/operations",

    "/api/dashboard",
    "/api/dashboard/summary",
    "/api/dashboard/action-required",
}


# ============================================================
# 01 PYTHON SYNTAX
# ============================================================

def check_python_syntax():
    ok = compileall.compile_dir(
        APP_DIR,
        quiet=1,
        force=True,
    )

    if not ok:
        raise RuntimeError(
            "One or more Python files failed compilation"
        )

    return "All backend/app Python files compiled"


# ============================================================
# 02 MIGRATIONS
# ============================================================

def migration_files():
    files = sorted(
        MIGRATIONS_DIR.glob("*.sql")
    )

    if not files:
        raise RuntimeError(
            "No SQL migrations found"
        )

    return files


def check_migration_sequence():
    files = migration_files()

    numbers = []

    for file in files:
        prefix = file.name.split("_", 1)[0]

        try:
            numbers.append(int(prefix))
        except ValueError:
            raise RuntimeError(
                f"Invalid migration filename: {file.name}"
            )

    if numbers != sorted(numbers):
        raise RuntimeError(
            "Migration ordering invalid"
        )

    if len(numbers) != len(set(numbers)):
        raise RuntimeError(
            "Duplicate migration numbers detected"
        )

    return ", ".join(
        file.name
        for file in files
    )


def apply_migrations():
    connection = sqlite3.connect(TEMP_DB)

    try:
        connection.execute(
            "PRAGMA foreign_keys = ON"
        )

        for file in migration_files():
            sql = file.read_text(
                encoding="utf-8"
            )

            connection.executescript(sql)

        connection.commit()

    finally:
        connection.close()

    return f"Applied to {TEMP_DB.name}"


# ============================================================
# 03 DATABASE OBJECTS
# ============================================================

def db_connection():
    conn = sqlite3.connect(TEMP_DB)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def check_tables():
    conn = db_connection()

    try:
        rows = conn.execute(
            """
            SELECT name
            FROM sqlite_master
            WHERE type = 'table'
              AND name NOT LIKE 'sqlite_%'
            """
        ).fetchall()

        actual = {
            row["name"]
            for row in rows
        }

    finally:
        conn.close()

    missing = EXPECTED_TABLES - actual

    if missing:
        raise RuntimeError(
            "Missing tables: "
            + ", ".join(sorted(missing))
        )

    return f"{len(actual)} tables present"


def check_foreign_keys():
    conn = db_connection()

    try:
        rows = conn.execute(
            "PRAGMA foreign_key_check"
        ).fetchall()

    finally:
        conn.close()

    if rows:
        raise RuntimeError(
            f"{len(rows)} foreign key violations"
        )

    return "No foreign key violations"


def check_integrity():
    conn = db_connection()

    try:
        result = conn.execute(
            "PRAGMA integrity_check"
        ).fetchone()[0]

    finally:
        conn.close()

    if result != "ok":
        raise RuntimeError(result)

    return "SQLite integrity_check = ok"


# ============================================================
# IMPORT APPLICATION AFTER DB ENVIRONMENT IS READY
# ============================================================

def import_axiom():
    global core
    global repos
    global services

    core = importlib.import_module(
        "app.core"
    )

    repos = importlib.import_module(
        "app.repositories"
    )

    services = importlib.import_module(
        "app.services"
    )

    importlib.import_module(
        "app.main"
    )


def check_imports():
    import_axiom()
    return "Core, repositories, services and FastAPI app imported"


# ============================================================
# TEST DATA HELPERS
# ============================================================

def raw_insert(sql, values):
    conn = db_connection()

    try:
        conn.execute(sql, values)
        conn.commit()
    finally:
        conn.close()


def create_company(
    company_id,
    name,
    slug,
):
    raw_insert(
        """
        INSERT INTO companies (
            id,
            name,
            slug,
            status
        )
        VALUES (?, ?, ?, 'active')
        """,
        (
            company_id,
            name,
            slug,
        ),
    )


def create_owner(
    user_id,
    company_id,
    email,
    password,
):
    from app.security.passwords import (
        hash_password,
    )

    raw_insert(
        """
        INSERT INTO company_users (
            id,
            company_id,
            email,
            password_hash,
            first_name,
            last_name,
            role,
            status
        )
        VALUES (?, ?, ?, ?, ?, ?, 'owner', 'active')
        """,
        (
            user_id,
            company_id,
            email,
            hash_password(password),
            "Audit",
            "Owner",
        ),
    )


# ============================================================
# 04 TENANT ISOLATION
# ============================================================

def check_tenant_isolation():
    from app.core.tenant import (
        reset_tenant,
        set_tenant,
    )

    from app.services.customer import (
        CustomerService,
    )

    create_company(
        "cmp_audit_a",
        "Audit Company A",
        "audit-a",
    )

    create_company(
        "cmp_audit_b",
        "Audit Company B",
        "audit-b",
    )

    token_a = set_tenant(
        "cmp_audit_a"
    )

    try:
        customer_a = CustomerService().create(
            first_name="Tenant",
            last_name="A",
            phone="+900000000001",
        )
    finally:
        reset_tenant(token_a)

    token_b = set_tenant(
        "cmp_audit_b"
    )

    try:
        visible = CustomerService().get(
            customer_a["id"]
        )
    finally:
        reset_tenant(token_b)

    if visible is not None:
        raise RuntimeError(
            "Cross-tenant customer read succeeded"
        )

    return "Cross-tenant repository read blocked"


# ============================================================
# 05 TENANT DATABASE GUARD
# ============================================================

def check_tenant_db_guard():
    conn = db_connection()

    try:
        conn.execute(
            """
            INSERT INTO customers (
                id,
                company_id,
                first_name
            )
            VALUES (
                'cus_guard_b',
                'cmp_audit_b',
                'Guard'
            )
            """
        )

        try:
            conn.execute(
                """
                INSERT INTO bookings (
                    id,
                    company_id,
                    customer_id,
                    booking_code
                )
                VALUES (
                    'bkg_guard_fail',
                    'cmp_audit_a',
                    'cus_guard_b',
                    'AX-GUARD-FAIL'
                )
                """
            )

            conn.commit()

        except sqlite3.IntegrityError:
            conn.rollback()
            return "Cross-tenant DB relation rejected"

        raise RuntimeError(
            "Tenant guard allowed invalid relationship"
        )

    finally:
        conn.close()


# ============================================================
# 06 AUTH
# ============================================================

AUDIT_PASSWORD = "AxiomAudit#2026"


def check_authentication():
    from app.services.auth import AuthService

    create_owner(
        "usr_audit_owner",
        "cmp_audit_a",
        "owner@audit.example.com",
        AUDIT_PASSWORD,
    )

    result = AuthService().login(
        company_slug="audit-a",
        email="owner@audit.example.com",
        password=AUDIT_PASSWORD,
    )

    if not result.get("token"):
        raise RuntimeError(
            "Login returned no token"
        )

    identity = (
        AuthService()
        .authenticate_token(
            result["token"]
        )
    )

    if identity["company_id"] != "cmp_audit_a":
        raise RuntimeError(
            "Authenticated tenant mismatch"
        )

    globals()["AUTH_TOKEN"] = result["token"]

    return "Login + session validation succeeded"


# ============================================================
# 07 CUSTOMER / BOOKING / TRANSFER
# ============================================================

def tenant_a():
    from app.core.tenant import set_tenant

    return set_tenant(
        company_id="cmp_audit_a",
        user_id="usr_audit_owner",
        role="owner",
    )


def tenant_reset(token):
    from app.core.tenant import reset_tenant
    reset_tenant(token)


def check_booking_flow():
    from app.services.booking import (
        BookingService,
    )

    token = tenant_a()

    try:
        result = BookingService().create(
            booking_code="AX-AUDIT-0001",

            customer={
                "first_name": "Mehmet",
                "last_name": "Audit",
                "email": "mehmet@audit.local",
                "phone": "+905320000001",
                "nationality": "TR",
                "language": "tr",
            },

            services=[
                {
                    "service_type": "transfer",
                    "title": (
                        "Antalya Havalimanı → Belek"
                    ),
                    "service_date": "2026-08-18",
                    "start_time": "14:30",
                    "pax_adult": 2,
                    "quantity": 1,
                    "unit_price": 2200,
                    "total_price": 2200,

                    "transfer": {
                        "pickup_location":
                            "Antalya Havalimanı",
                        "dropoff_location":
                            "Belek",
                        "pickup_datetime":
                            "2026-08-18T14:30:00+03:00",
                        "pax": 2,
                        "luggage_count": 2,
                        "requested_vehicle_class":
                            "VIP Minivan",
                    },
                }
            ],

            source="website",
            currency="TRY",
        )

    finally:
        tenant_reset(token)

    booking = result["booking"]

    if booking["booking_code"] != "AX-AUDIT-0001":
        raise RuntimeError(
            "Booking code mismatch"
        )

    operation = (
        result["services"][0]
        .get("operation")
    )

    if not operation:
        raise RuntimeError(
            "Transfer operation not created"
        )

    globals()["AUDIT_BOOKING_ID"] = booking["id"]
    globals()["AUDIT_OPERATION_ID"] = operation["id"]

    return "Customer → Booking → Transfer → Operation succeeded"


# ============================================================
# 08 DRIVER / VEHICLE / ASSIGNMENT
# ============================================================

def check_assignment_flow():
    from app.services.driver import DriverService
    from app.services.vehicle import VehicleService
    from app.services.assignment import AssignmentService

    token = tenant_a()

    try:
        driver = DriverService().create(
            first_name="Ahmet",
            last_name="Audit",
            phone="+905330000001",
        )

        vehicle = VehicleService().create(
            plate="07 AXM 001",
            brand="Mercedes-Benz",
            model="Vito",
            vehicle_class="VIP Minivan",
            capacity=7,
        )

        assignment = AssignmentService().assign(
            operation_id=globals()[
                "AUDIT_OPERATION_ID"
            ],
            driver_id=driver["id"],
            vehicle_id=vehicle["id"],
        )

    finally:
        tenant_reset(token)

    if assignment["driver_id"] != driver["id"]:
        raise RuntimeError(
            "Driver assignment mismatch"
        )

    if assignment["vehicle_id"] != vehicle["id"]:
        raise RuntimeError(
            "Vehicle assignment mismatch"
        )

    globals()["AUDIT_DRIVER_ID"] = driver["id"]
    globals()["AUDIT_VEHICLE_ID"] = vehicle["id"]

    return "Driver + vehicle assignment succeeded"


# ============================================================
# 09 OPERATION STATE MACHINE
# ============================================================

def check_operation_states():
    from app.services.operation import OperationService

    token = tenant_a()

    try:
        service = OperationService()

        service.change_status(
            globals()["AUDIT_OPERATION_ID"],
            "ready",
        )

        service.change_status(
            globals()["AUDIT_OPERATION_ID"],
            "in_progress",
        )

        final = service.change_status(
            globals()["AUDIT_OPERATION_ID"],
            "completed",
        )

    finally:
        tenant_reset(token)

    if final["status"] != "completed":
        raise RuntimeError(
            "Operation failed to complete"
        )

    return "assigned → ready → in_progress → completed"


# ============================================================
# 10 TOUR
# ============================================================

def check_tour_flow():
    from app.services.tour import TourService
    from app.services.booking import BookingService

    token = tenant_a()

    try:
        tours = TourService()

        product = tours.create_product(
            name="Kapadokya Audit Turu",
            code="KAP-AUDIT",
            duration_minutes=720,
            default_capacity=30,
        )

        departure = tours.create_departure(
            tour_product_id=product["id"],
            departure_date="2026-08-20",
            departure_time="06:30",
            capacity=30,
            meeting_point="Audit Hotel",
        )

        booking = BookingService().create(
            booking_code="AX-AUDIT-TOUR-01",

            customer={
                "first_name": "Anna",
                "last_name": "Audit",
                "phone": "+491700000001",
            },

            services=[
                {
                    "service_type": "tour",
                    "title": "Kapadokya Audit Turu",
                    "service_date": "2026-08-20",
                    "start_time": "06:30",
                    "pax_adult": 2,
                    "quantity": 1,
                    "unit_price": 3000,
                    "total_price": 6000,

                    "tour": {
                        "tour_departure_id":
                            departure["id"],
                        "pickup_required": True,
                        "pickup_location":
                            "Audit Hotel",
                    },
                }
            ],

            source="manual",
            currency="TRY",
        )

    finally:
        tenant_reset(token)

    entry = booking["services"][0]

    if "tour_booking" not in entry:
        raise RuntimeError(
            "Tour booking relation missing"
        )

    return "Tour product → departure → booking succeeded"


# ============================================================
# 11 ROUTE / PRICING
# ============================================================

def check_pricing_flow():
    from app.services.route import RouteService
    from app.services.pricing import PricingService

    token = tenant_a()

    try:
        route = RouteService().create(
            name="AYT → Belek",
            code="AYT-BELEK-AUDIT",
            origin_name="Antalya Havalimanı",
            destination_name="Belek",
            distance_km=35,
            estimated_duration_minutes=40,
        )

        PricingService().create_route_rule(
            name="VIP AYT Belek",
            route_id=route["id"],
            base_price=2500,
            vehicle_class="VIP Minivan",
            currency="TRY",
        )

        price = PricingService().calculate_route_price(
            route_id=route["id"],
            vehicle_class="VIP Minivan",
        )

    finally:
        tenant_reset(token)

    if price["amount"] != 2500:
        raise RuntimeError(
            "Pricing calculation mismatch"
        )

    return "Route pricing resolved to 2500 TRY"


# ============================================================
# 12 FINANCE
# ============================================================

def check_finance_flow():
    from app.services.finance import FinanceService

    token = tenant_a()

    try:
        finance = FinanceService()

        payment = finance.create_payment(
            booking_id=globals()[
                "AUDIT_BOOKING_ID"
            ],
            amount=2200,
            currency="TRY",
            payment_method="card",
        )

        transaction = finance.create_transaction(
            transaction_type="income",
            amount=2200,
            currency="TRY",
            booking_id=globals()[
                "AUDIT_BOOKING_ID"
            ],
            payment_id=payment["id"],
            category="booking",
        )

    finally:
        tenant_reset(token)

    if transaction["amount"] != 2200:
        raise RuntimeError(
            "Finance amount mismatch"
        )

    return "Payment + income transaction succeeded"


# ============================================================
# 13 SETTINGS
# ============================================================

def check_settings():
    from app.services.settings import SettingsService

    token = tenant_a()

    try:
        settings = SettingsService().get()

        updated = SettingsService().update({
            "booking_prefix": "AX",
            "default_currency": "TRY",
        })

    finally:
        tenant_reset(token)

    if updated["booking_prefix"] != "AX":
        raise RuntimeError(
            "Settings update failed"
        )

    return "Company settings read/write succeeded"


# ============================================================
# 14 INTEGRATIONS
# ============================================================

def check_integration_flow():
    from app.services.integration import IntegrationService

    token = tenant_a()

    try:
        integration = IntegrationService().create(
            provider="audit-provider",
            integration_type="tour_operator",
            name="Audit Provider",
            sync_mode="realtime",
        )

        IntegrationService().set_status(
            integration["id"],
            "active",
        )

        external = (
            IntegrationService()
            .ingest_external_booking(
                integration_id=integration["id"],
                external_booking_id="EXT-AUDIT-001",
                payload={
                    "customer": "Audit",
                    "amount": 100,
                },
            )
        )

    finally:
        tenant_reset(token)

    if external["status"] != "received":
        raise RuntimeError(
            "External booking ingestion failed"
        )

    globals()["AUDIT_INTEGRATION_ID"] = integration["id"]

    return "Integration + external booking ingestion succeeded"


# ============================================================
# 15 PUBLIC BOOKING
# ============================================================

def check_public_booking():
    from app.security.tokens import (
        generate_public_booking_key,
    )
    from app.core.ids import generate_id
    from app.repositories.base import BaseRepository
    from app.services.public_booking import PublicBookingService

    class KeyRepo(BaseRepository):
        table_name = "public_booking_keys"

    token = tenant_a()

    try:
        public_key = generate_public_booking_key()

        KeyRepo().insert({
            "id": generate_id(
                "public_booking_key"
            ),
            "public_key": public_key,
            "name": "Audit Public Key",
            "allowed_domain": "audit.local",
            "active": 1,
        })

    finally:
        tenant_reset(token)

    result = PublicBookingService().create_booking(
        public_key=public_key,
        request_id="REQ-AUDIT-001",
        origin="https://audit.local",

        booking_payload={
            "booking_code":
                "AX-PUBLIC-AUDIT-01",

            "customer": {
                "first_name": "Public",
                "last_name": "Audit",
                "phone": "+905550000001",
            },

            "services": [
                {
                    "service_type":
                        "transfer",
                    "title":
                        "Public Audit Transfer",
                    "pax_adult": 1,
                    "quantity": 1,
                    "unit_price": 1500,
                    "total_price": 1500,

                    "transfer": {
                        "pickup_location":
                            "AYT",
                        "dropoff_location":
                            "Lara",
                        "pax": 1,
                    },
                }
            ],

            "source": "booking_widget",
            "currency": "TRY",
        },
    )

    if not result.get("booking"):
        raise RuntimeError(
            "Public booking not created"
        )

    return "Public booking key → booking succeeded"


# ============================================================
# 16 DASHBOARD
# ============================================================

def check_dashboard():
    from app.services.dashboard import DashboardService

    token = tenant_a()

    try:
        dashboard = DashboardService().overview()

    finally:
        tenant_reset(token)

    required = {
        "summary",
        "action_required",
        "recent_bookings",
        "upcoming_operations",
    }

    if not required.issubset(
        dashboard.keys()
    ):
        raise RuntimeError(
            "Dashboard response incomplete"
        )

    return "Dashboard overview generated"


# ============================================================
# 17 FASTAPI ROUTES
# ============================================================

def check_fastapi_routes():
    from app.main import app

    schema = app.openapi()

    paths = set(
        schema.get("paths", {}).keys()
    )

    missing = EXPECTED_ROUTES - paths

    if missing:
        raise RuntimeError(
            "Missing API routes: "
            + ", ".join(sorted(missing))
        )

    return (
        f"{len(paths)} OpenAPI routes discovered"
    )


# ============================================================
# 18 HTTP HEALTH SMOKE
# ============================================================

def free_port():
    sock = socket.socket()
    sock.bind(("127.0.0.1", 0))
    port = sock.getsockname()[1]
    sock.close()
    return port


def wait_for_server(url, timeout=12):
    deadline = time.time() + timeout

    while time.time() < deadline:
        try:
            with urllib.request.urlopen(
                url,
                timeout=1,
            ) as response:
                return response.status
        except Exception:
            time.sleep(0.25)

    raise RuntimeError(
        "Uvicorn did not become ready"
    )


def check_http_health():
    port = free_port()

    env = dict(os.environ)

    process = subprocess.Popen(
        [
            sys.executable,
            "-m",
            "uvicorn",
            "app.main:app",
            "--host",
            "127.0.0.1",
            "--port",
            str(port),
            "--log-level",
            "warning",
        ],
        cwd=BACKEND,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )

    try:
        url = (
            f"http://127.0.0.1:{port}/health"
        )

        status = wait_for_server(url)

        if status != 200:
            raise RuntimeError(
                f"Health returned HTTP {status}"
            )

        with urllib.request.urlopen(
            url,
            timeout=3,
        ) as response:
            payload = json.loads(
                response.read()
            )

        if payload.get("status") != "ok":
            raise RuntimeError(
                "Invalid health payload"
            )

        return "Uvicorn /health HTTP 200"

    finally:
        process.terminate()

        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()


# ============================================================
# 19 HTTP AUTH SMOKE
# ============================================================

def check_http_auth():
    port = free_port()

    env = dict(os.environ)

    process = subprocess.Popen(
        [
            sys.executable,
            "-m",
            "uvicorn",
            "app.main:app",
            "--host",
            "127.0.0.1",
            "--port",
            str(port),
            "--log-level",
            "warning",
        ],
        cwd=BACKEND,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )

    try:
        wait_for_server(
            f"http://127.0.0.1:{port}/health"
        )

        body = json.dumps({
            "company_slug": "audit-a",
            "email": "owner@audit.example.com",
            "password": AUDIT_PASSWORD,
        }).encode("utf-8")

        request = urllib.request.Request(
            f"http://127.0.0.1:{port}/api/auth/login",
            data=body,
            headers={
                "Content-Type":
                    "application/json",
            },
            method="POST",
        )

        with urllib.request.urlopen(
            request,
            timeout=5,
        ) as response:
            login_payload = json.loads(
                response.read()
            )

        bearer = login_payload.get("token")

        if not bearer:
            raise RuntimeError(
                "HTTP login returned no token"
            )

        me_request = urllib.request.Request(
            f"http://127.0.0.1:{port}/api/auth/me",
            headers={
                "Authorization":
                    f"Bearer {bearer}",
            },
        )

        with urllib.request.urlopen(
            me_request,
            timeout=5,
        ) as response:
            me = json.loads(
                response.read()
            )

        if me.get("company_id") != "cmp_audit_a":
            raise RuntimeError(
                "HTTP /me tenant mismatch"
            )

        return "HTTP login + Bearer /me succeeded"

    finally:
        process.terminate()

        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()


# ============================================================
# 20 SECURITY STATIC CHECKS
# ============================================================

def check_security_configuration():
    from app.main import app

    middleware_names = {
        middleware.cls.__name__
        for middleware in app.user_middleware
    }

    if "CORSMiddleware" not in middleware_names:
        raise RuntimeError(
            "CORS middleware missing"
        )

    from app.security.passwords import (
        hash_password,
        verify_password,
    )

    encoded = hash_password(
        "SecurityAudit#2026"
    )

    if (
        "SecurityAudit#2026"
        in encoded
    ):
        raise RuntimeError(
            "Password appears stored plaintext"
        )

    if not verify_password(
        "SecurityAudit#2026",
        encoded,
    ):
        raise RuntimeError(
            "Password verification failed"
        )

    if verify_password(
        "WrongPassword#2026",
        encoded,
    ):
        raise RuntimeError(
            "Wrong password accepted"
        )

    return "Password hashing + CORS baseline present"


# ============================================================
# REPORT
# ============================================================

def save_report():
    timestamp = time.strftime(
        "%Y%m%d_%H%M%S"
    )

    report_file = (
        REPORT_DIR
        / f"axiom_audit_{timestamp}.txt"
    )

    pass_count = sum(
        1
        for status, _, _ in RESULTS
        if status == "PASS"
    )

    fail_count = sum(
        1
        for status, _, _ in RESULTS
        if status == "FAIL"
    )

    lines = [
        "AXIOM V1 AUDIT REPORT",
        "=" * 72,
        "",
    ]

    for status, name, detail in RESULTS:
        lines.append(
            f"{status:4}  {name}"
        )

        if detail:
            lines.append(
                f"      {detail}"
            )

    lines.extend([
        "",
        "=" * 72,
        f"TOTAL : {len(RESULTS)}",
        f"PASS  : {pass_count}",
        f"FAIL  : {fail_count}",
        "",
        (
            "STATUS: READY"
            if fail_count == 0
            else "STATUS: NOT READY"
        ),
    ])

    report_file.write_text(
        "\n".join(lines) + "\n",
        encoding="utf-8",
    )

    return report_file


# ============================================================
# MAIN
# ============================================================

def main():
    print()
    print("AXIOM V1 — FULL SYSTEM AUDIT")
    print("Temporary database:")
    print(TEMP_DB)

    section("01 — SOURCE / DATABASE FOUNDATION")

    run_check(
        "Python syntax",
        check_python_syntax,
    )

    run_check(
        "Migration sequence",
        check_migration_sequence,
    )

    migration_ok = run_check(
        "Apply migrations",
        apply_migrations,
    )

    if not migration_ok:
        print()
        print(
            "Migration failure prevents "
            "safe continuation."
        )
        report = save_report()
        print(f"Report: {report}")
        return 1

    run_check(
        "Expected database tables",
        check_tables,
    )

    run_check(
        "SQLite integrity",
        check_integrity,
    )

    run_check(
        "Foreign keys",
        check_foreign_keys,
    )

    run_check(
        "Application imports",
        check_imports,
    )

    section("02 — MULTI-TENANT / AUTHENTICATION")

    run_check(
        "Repository tenant isolation",
        check_tenant_isolation,
    )

    run_check(
        "Database tenant guards",
        check_tenant_db_guard,
    )

    run_check(
        "Authentication + session",
        check_authentication,
    )

    section("03 — CORE BUSINESS FLOWS")

    run_check(
        "Booking / transfer flow",
        check_booking_flow,
    )

    run_check(
        "Driver / vehicle assignment",
        check_assignment_flow,
    )

    run_check(
        "Operation state machine",
        check_operation_states,
    )

    run_check(
        "Tour flow",
        check_tour_flow,
    )

    run_check(
        "Route / pricing",
        check_pricing_flow,
    )

    run_check(
        "Finance",
        check_finance_flow,
    )

    run_check(
        "Company settings",
        check_settings,
    )

    section("04 — EXTERNAL PLATFORM")

    run_check(
        "Integration engine",
        check_integration_flow,
    )

    run_check(
        "Public booking",
        check_public_booking,
    )

    run_check(
        "Dashboard query layer",
        check_dashboard,
    )

    section("05 — HTTP / SECURITY")

    run_check(
        "FastAPI route inventory",
        check_fastapi_routes,
    )

    run_check(
        "HTTP health smoke",
        check_http_health,
    )

    run_check(
        "HTTP authentication smoke",
        check_http_auth,
    )

    run_check(
        "Security baseline",
        check_security_configuration,
    )

    section("FINAL RESULT")

    pass_count = sum(
        1
        for status, _, _ in RESULTS
        if status == "PASS"
    )

    fail_count = sum(
        1
        for status, _, _ in RESULTS
        if status == "FAIL"
    )

    print(f"TOTAL : {len(RESULTS)}")
    print(f"PASS  : {pass_count}")
    print(f"FAIL  : {fail_count}")

    report = save_report()

    print()
    print(f"Report: {report}")

    if fail_count == 0:
        print()
        print("AXIOM V1 BACKEND: READY")
        return 0

    print()
    print("AXIOM V1 BACKEND: NOT READY")
    print()
    print("Failed modules:")

    for status, name, detail in RESULTS:
        if status == "FAIL":
            print(f" - {name}")
            if detail:
                print(f"   {detail}")

    return 1


if __name__ == "__main__":
    try:
        exit_code = main()
    finally:
        TEMP_DIR.cleanup()

    raise SystemExit(exit_code)
