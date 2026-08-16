#!/data/data/com.termux/files/usr/bin/bash
set -e

ROOT="$HOME/AXIOM"
cd "$ROOT"

echo "=============================================="
echo " AXIOM V1 — BACKEND FINALIZATION"
echo "=============================================="

mkdir -p \
  backend/app/middleware \
  backend/app/workers \
  backend/app/api/routes

touch \
  backend/app/middleware/__init__.py \
  backend/app/workers/__init__.py


# ============================================================
# 006 HARDENING MIGRATION
# ============================================================

cat > backend/migrations/006_hardening.sql <<'SQL'
PRAGMA foreign_keys = ON;

-- =========================================================
-- AXIOM DATABASE
-- Migration: 006_hardening
-- Final V1 integrity/index hardening
-- =========================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_operations_unique_source
ON operations(
    company_id,
    source_type,
    source_id
)
WHERE source_id IS NOT NULL;


CREATE UNIQUE INDEX IF NOT EXISTS idx_active_assignment_per_operation
ON operation_assignments(
    company_id,
    operation_id
)
WHERE status IN (
    'assigned',
    'accepted',
    'started'
);


CREATE UNIQUE INDEX IF NOT EXISTS idx_booking_external_identity
ON bookings(
    company_id,
    source_provider,
    external_reference
)
WHERE source_provider IS NOT NULL
  AND external_reference IS NOT NULL;


CREATE INDEX IF NOT EXISTS idx_public_booking_requests_company_status
ON public_booking_requests(
    company_id,
    status,
    created_at
);


CREATE INDEX IF NOT EXISTS idx_external_bookings_status
ON external_bookings(
    company_id,
    integration_id,
    status,
    received_at
);


CREATE INDEX IF NOT EXISTS idx_driver_sessions_expiry
ON driver_sessions(
    expires_at
);


CREATE INDEX IF NOT EXISTS idx_outbox_status_available
ON outbox_events(
    status,
    available_at,
    created_at
);


CREATE INDEX IF NOT EXISTS idx_webhook_delivery_retry
ON webhook_deliveries(
    status,
    next_attempt_at,
    attempt_count
);
SQL


# ============================================================
# ID PREFIX HARDENING
# ============================================================

python - <<'PY'
from pathlib import Path

path = Path("backend/app/core/ids.py")
text = path.read_text()

items = {
    '"booking_event": "bev",': '"booking": "bkg",',
    '"operation_event": "oev",': '"operation": "op",',
    '"public_booking_request": "pbr",': '"public_booking_key": "pbk",',
    '"integration_mapping": "map",': '"integration_event": "iev",',
    '"driver_session": "dss",': '"session": "ses",',
    '"role": "rol",': '"company_settings": "cfg",',
    '"domain": "dom",': '"company": "cmp",',
}

for new_line, anchor in items.items():
    if new_line not in text and anchor in text:
        text = text.replace(
            anchor,
            anchor + "\n    " + new_line
        )

path.write_text(text)
PY


# ============================================================
# OPERATION EVENT REPOSITORY
# ============================================================

cat > backend/app/repositories/operation_event.py <<'PY'
from .base import BaseRepository


class OperationEventRepository(BaseRepository):
    table_name = "operation_events"
PY


# ============================================================
# BOOKING STATUS WORKFLOW
# ============================================================

cat > backend/app/services/booking_workflow.py <<'PY'
from app.core.ids import generate_id
from app.core.tenant import get_user_id
from app.core.transactions import transaction
from app.core.time import utc_now_iso

from app.repositories.booking import BookingRepository
from app.repositories.booking_event import BookingEventRepository

from app.services.audit import AuditService
from app.services.outbox import OutboxService


class BookingWorkflowService:
    TRANSITIONS = {
        "draft": {
            "pending",
            "confirmed",
            "cancelled",
        },
        "pending": {
            "confirmed",
            "cancelled",
        },
        "confirmed": {
            "completed",
            "cancelled",
        },
        "completed": set(),
        "cancelled": set(),
    }

    def change_status(
        self,
        booking_id: str,
        new_status: str,
    ):
        with transaction() as connection:
            booking_repo = BookingRepository(connection)
            event_repo = BookingEventRepository(connection)

            booking = booking_repo.get_by_id(
                booking_id
            )

            if booking is None:
                raise LookupError(
                    "Booking not found"
                )

            current_status = booking["status"]

            if new_status == current_status:
                return booking

            allowed = self.TRANSITIONS.get(
                current_status,
                set(),
            )

            if new_status not in allowed:
                raise ValueError(
                    "Invalid booking transition: "
                    f"{current_status} -> {new_status}"
                )

            update = {
                "status": new_status,
                "updated_at": utc_now_iso(),
            }

            if new_status == "confirmed":
                update["confirmed_at"] = utc_now_iso()

            if new_status == "cancelled":
                update["cancelled_at"] = utc_now_iso()

            updated = booking_repo.update(
                booking_id,
                update,
            )

            event_repo.insert({
                "id": generate_id("booking_event"),
                "booking_id": booking_id,
                "event_type": "status_changed",
                "old_value": current_status,
                "new_value": new_status,
                "description": (
                    f"Booking status changed: "
                    f"{current_status} -> {new_status}"
                ),
                "actor_user_id": get_user_id(),
            })

            AuditService(connection).log(
                action="booking.status_change",
                entity_type="booking",
                entity_id=booking_id,
                old_data={
                    "status": current_status,
                },
                new_data={
                    "status": new_status,
                },
            )

            OutboxService(connection).publish(
                event_type="booking.status_changed",
                aggregate_type="booking",
                aggregate_id=booking_id,
                payload={
                    "booking_id": booking_id,
                    "old_status": current_status,
                    "new_status": new_status,
                },
            )

            return updated
PY


# ============================================================
# OPERATION WORKFLOW
# ============================================================

cat > backend/app/services/operation_workflow.py <<'PY'
from app.core.ids import generate_id
from app.core.tenant import get_user_id
from app.core.transactions import transaction
from app.core.time import utc_now_iso

from app.repositories.operation import OperationRepository
from app.repositories.operation_event import OperationEventRepository

from app.services.audit import AuditService
from app.services.outbox import OutboxService


class OperationWorkflowService:
    TRANSITIONS = {
        "not_planned": {
            "waiting_assignment",
            "cancelled",
        },
        "waiting_assignment": {
            "assigned",
            "problem",
            "cancelled",
        },
        "assigned": {
            "ready",
            "waiting_assignment",
            "problem",
            "cancelled",
        },
        "ready": {
            "in_progress",
            "problem",
            "cancelled",
        },
        "in_progress": {
            "completed",
            "problem",
        },
        "problem": {
            "waiting_assignment",
            "assigned",
            "ready",
            "in_progress",
            "cancelled",
        },
        "completed": set(),
        "cancelled": set(),
    }

    def change_status(
        self,
        operation_id: str,
        new_status: str,
        driver_id=None,
    ):
        with transaction() as connection:
            repo = OperationRepository(connection)
            event_repo = OperationEventRepository(
                connection
            )

            operation = repo.get_by_id(
                operation_id
            )

            if operation is None:
                raise LookupError(
                    "Operation not found"
                )

            current = operation["status"]

            if new_status == current:
                return operation

            allowed = self.TRANSITIONS.get(
                current,
                set(),
            )

            if new_status not in allowed:
                raise ValueError(
                    "Invalid operation transition: "
                    f"{current} -> {new_status}"
                )

            payload = {
                "status": new_status,
                "updated_at": utc_now_iso(),
            }

            if new_status == "in_progress":
                payload["actual_start_at"] = (
                    utc_now_iso()
                )

            if new_status == "completed":
                payload["actual_end_at"] = (
                    utc_now_iso()
                )

            updated = repo.update(
                operation_id,
                payload,
            )

            event_repo.insert({
                "id": generate_id(
                    "operation_event"
                ),
                "operation_id": operation_id,
                "event_type": "status_changed",
                "old_status": current,
                "new_status": new_status,
                "description": (
                    f"Operation status changed: "
                    f"{current} -> {new_status}"
                ),
                "actor_user_id": get_user_id(),
                "driver_id": driver_id,
            })

            AuditService(connection).log(
                action="operation.status_change",
                entity_type="operation",
                entity_id=operation_id,
                old_data={
                    "status": current,
                },
                new_data={
                    "status": new_status,
                },
                actor_type=(
                    "driver"
                    if driver_id
                    else "user"
                ),
                actor_id=(
                    driver_id
                    if driver_id
                    else get_user_id()
                ),
            )

            OutboxService(connection).publish(
                event_type="operation.status_changed",
                aggregate_type="operation",
                aggregate_id=operation_id,
                payload={
                    "operation_id": operation_id,
                    "old_status": current,
                    "new_status": new_status,
                },
            )

            return updated
PY


# ============================================================
# DRIVER OPERATION WORKFLOW
# ============================================================

cat > backend/app/services/driver_operation.py <<'PY'
from app.repositories.assignment import AssignmentRepository
from app.repositories.driver import DriverRepository
from app.repositories.driver_operation import DriverOperationRepository
from app.repositories.operation import OperationRepository
from app.repositories.vehicle import VehicleRepository

from app.services.operation_workflow import OperationWorkflowService


class DriverOperationService:
    def __init__(self, connection=None):
        self.operation_repo = OperationRepository(
            connection
        )
        self.driver_operation_repo = (
            DriverOperationRepository(
                connection
            )
        )
        self.assignment_repo = AssignmentRepository(
            connection
        )
        self.driver_repo = DriverRepository(
            connection
        )
        self.vehicle_repo = VehicleRepository(
            connection
        )

    def list(self, driver_id: str):
        return self.driver_operation_repo.list_for_driver(
            driver_id
        )

    def _assignment(
        self,
        driver_id: str,
        operation_id: str,
    ):
        assignments = (
            self.assignment_repo
            .list_by_operation(
                operation_id
            )
        )

        for assignment in assignments:
            if (
                assignment["driver_id"]
                == driver_id
                and assignment["status"]
                not in {
                    "cancelled",
                    "rejected",
                }
            ):
                return assignment

        raise PermissionError(
            "Operation is not assigned "
            "to this driver"
        )

    def accept(
        self,
        *,
        driver_id: str,
        operation_id: str,
    ):
        assignment = self._assignment(
            driver_id,
            operation_id,
        )

        updated = self.assignment_repo.update(
            assignment["id"],
            {
                "status": "accepted",
            },
        )

        operation = self.operation_repo.get_by_id(
            operation_id
        )

        if (
            operation
            and operation["status"] == "assigned"
        ):
            OperationWorkflowService().change_status(
                operation_id,
                "ready",
                driver_id=driver_id,
            )

        return updated

    def start(
        self,
        *,
        driver_id: str,
        operation_id: str,
    ):
        assignment = self._assignment(
            driver_id,
            operation_id,
        )

        operation = self.operation_repo.get_by_id(
            operation_id
        )

        if operation is None:
            raise LookupError(
                "Operation not found"
            )

        if operation["status"] == "assigned":
            OperationWorkflowService().change_status(
                operation_id,
                "ready",
                driver_id=driver_id,
            )

        self.assignment_repo.update(
            assignment["id"],
            {
                "status": "started",
            },
        )

        self.driver_repo.update(
            driver_id,
            {
                "status": "busy",
            },
        )

        vehicle_id = assignment.get(
            "vehicle_id"
        )

        if vehicle_id:
            self.vehicle_repo.update(
                vehicle_id,
                {
                    "status": "busy",
                },
            )

        return (
            OperationWorkflowService()
            .change_status(
                operation_id,
                "in_progress",
                driver_id=driver_id,
            )
        )

    def complete(
        self,
        *,
        driver_id: str,
        operation_id: str,
    ):
        assignment = self._assignment(
            driver_id,
            operation_id,
        )

        self.assignment_repo.update(
            assignment["id"],
            {
                "status": "completed",
            },
        )

        result = (
            OperationWorkflowService()
            .change_status(
                operation_id,
                "completed",
                driver_id=driver_id,
            )
        )

        self.driver_repo.update(
            driver_id,
            {
                "status": "available",
            },
        )

        vehicle_id = assignment.get(
            "vehicle_id"
        )

        if vehicle_id:
            self.vehicle_repo.update(
                vehicle_id,
                {
                    "status": "available",
                },
            )

        return result
PY


# ============================================================
# LOGOUT
# ============================================================

python - <<'PY'
from pathlib import Path

path = Path("backend/app/services/auth.py")
text = path.read_text()

marker = "    def logout(\n"

if marker not in text:
    addition = '''

    def logout(self, token: str):
        from app.core.tenant import (
            reset_tenant,
            set_tenant,
        )
        from app.repositories.session import (
            SessionRepository,
        )

        identity = self.authenticate_token(
            token
        )

        tenant_token = set_tenant(
            company_id=identity["company_id"],
            user_id=identity["user_id"],
            role=identity["role"],
        )

        try:
            revoked = SessionRepository().revoke(
                identity["session_id"]
            )

            return {
                "revoked": revoked,
                "session_id":
                    identity["session_id"],
            }

        finally:
            reset_tenant(tenant_token)
'''

    text += addition
    path.write_text(text)
PY


# ============================================================
# PLATFORM REPOSITORIES
# ============================================================

cat > backend/app/repositories/platform.py <<'PY'
from typing import Any, Dict, Optional

from app.core.tenant import get_company_id
from .base import BaseRepository


class CompanyDomainRepository(BaseRepository):
    table_name = "company_domains"

    def get_by_domain(
        self,
        domain: str,
    ) -> Optional[Dict[str, Any]]:
        connection, owned = self._conn()

        try:
            row = connection.execute(
                """
                SELECT *
                FROM company_domains
                WHERE company_id = ?
                  AND lower(domain) = lower(?)
                LIMIT 1
                """,
                (
                    get_company_id(),
                    domain,
                ),
            ).fetchone()

            return dict(row) if row else None

        finally:
            self._close_if_owned(
                connection,
                owned,
            )


class PublicBookingKeyTenantRepository(
    BaseRepository
):
    table_name = "public_booking_keys"


class DriverAccountRepository(
    BaseRepository
):
    table_name = "driver_accounts"
PY


# ============================================================
# PLATFORM ADMIN SERVICE
# ============================================================

cat > backend/app/services/platform.py <<'PY'
from app.core.ids import generate_id

from app.repositories.driver import DriverRepository
from app.repositories.platform import (
    CompanyDomainRepository,
    DriverAccountRepository,
    PublicBookingKeyTenantRepository,
)

from app.security.passwords import hash_password
from app.security.tokens import (
    generate_public_booking_key,
)

from app.services.api_key import ApiKeyService


class PlatformService:
    def __init__(self, connection=None):
        self.domain_repo = CompanyDomainRepository(
            connection
        )
        self.booking_key_repo = (
            PublicBookingKeyTenantRepository(
                connection
            )
        )
        self.driver_account_repo = (
            DriverAccountRepository(
                connection
            )
        )
        self.driver_repo = DriverRepository(
            connection
        )

    def create_domain(
        self,
        *,
        domain: str,
        domain_type: str = "website",
    ):
        domain = (
            domain
            .strip()
            .lower()
            .replace("https://", "")
            .replace("http://", "")
            .strip("/")
        )

        if not domain:
            raise ValueError(
                "Domain is required"
            )

        existing = self.domain_repo.get_by_domain(
            domain
        )

        if existing:
            return existing

        return self.domain_repo.insert({
            "id": generate_id("domain"),
            "domain": domain,
            "domain_type": domain_type,
            "status": "pending",
        })

    def set_domain_status(
        self,
        domain_id: str,
        status: str,
    ):
        if status not in {
            "pending",
            "verifying",
            "verified",
            "failed",
            "disabled",
        }:
            raise ValueError(
                "Invalid domain status"
            )

        return self.domain_repo.update(
            domain_id,
            {
                "status": status,
            },
        )

    def list_domains(self):
        return self.domain_repo.list()

    def create_public_booking_key(
        self,
        *,
        name: str,
        allowed_domain: str = None,
    ):
        raw = generate_public_booking_key()

        record = self.booking_key_repo.insert({
            "id": generate_id(
                "public_booking_key"
            ),
            "public_key": raw,
            "name": name,
            "allowed_domain": (
                allowed_domain
                .strip()
                .lower()
                if allowed_domain
                else None
            ),
            "active": 1,
        })

        return {
            "public_key": raw,
            "record": record,
        }

    def revoke_public_booking_key(
        self,
        key_id: str,
    ):
        from app.core.time import utc_now_iso

        return self.booking_key_repo.update(
            key_id,
            {
                "active": 0,
                "revoked_at": utc_now_iso(),
            },
        )

    def list_public_booking_keys(self):
        return self.booking_key_repo.list()

    def create_api_key(
        self,
        *,
        name: str,
        scopes=None,
        expires_at=None,
    ):
        return ApiKeyService().create(
            name=name,
            scopes=scopes,
            expires_at=expires_at,
        )

    def create_driver_account(
        self,
        *,
        driver_id: str,
        login_identifier: str,
        password: str,
    ):
        driver = self.driver_repo.get_by_id(
            driver_id
        )

        if driver is None:
            raise LookupError(
                "Driver not found"
            )

        return self.driver_account_repo.insert({
            "id": generate_id(
                "driver_account"
            ),
            "driver_id": driver_id,
            "login_identifier":
                login_identifier.strip(),
            "password_hash":
                hash_password(password),
            "status": "active",
        })
PY


# ============================================================
# PLATFORM SCHEMAS
# ============================================================

cat > backend/app/schemas/platform.py <<'PY'
from typing import List, Literal, Optional

from pydantic import Field

from .common import APIModel


class DomainCreate(APIModel):
    domain: str = Field(
        min_length=3,
        max_length=255,
    )

    domain_type: Literal[
        "website",
        "booking",
        "api",
        "custom",
    ] = "website"


class DomainStatusUpdate(APIModel):
    status: Literal[
        "pending",
        "verifying",
        "verified",
        "failed",
        "disabled",
    ]


class PublicBookingKeyCreate(APIModel):
    name: str = Field(
        min_length=1,
        max_length=200,
    )

    allowed_domain: Optional[str] = None


class APIKeyCreate(APIModel):
    name: str = Field(
        min_length=1,
        max_length=200,
    )

    scopes: Optional[List[str]] = None
    expires_at: Optional[str] = None


class DriverAccountCreate(APIModel):
    driver_id: str

    login_identifier: str = Field(
        min_length=3,
        max_length=200,
    )

    password: str = Field(
        min_length=8,
        max_length=256,
    )


class BookingStatusUpdate(APIModel):
    status: Literal[
        "draft",
        "pending",
        "confirmed",
        "cancelled",
        "completed",
    ]
PY


# ============================================================
# PUBLIC BOOKING HARDENING
# ============================================================

cat > backend/app/repositories/public_booking.py <<'PY'
import sqlite3
from typing import Any, Dict, Optional

from app.core.database import create_connection
from app.core.tenant import get_company_id

from .base import BaseRepository


class PublicBookingLookupRepository:
    def __init__(
        self,
        connection: Optional[
            sqlite3.Connection
        ] = None,
    ):
        self.connection = connection

    def _conn(self):
        if self.connection is not None:
            return self.connection, False

        return create_connection(), True

    def get_key(
        self,
        public_key: str,
    ) -> Optional[Dict[str, Any]]:
        connection, owned = self._conn()

        try:
            row = connection.execute(
                """
                SELECT *
                FROM public_booking_keys
                WHERE public_key = ?
                  AND active = 1
                  AND revoked_at IS NULL
                LIMIT 1
                """,
                (public_key,),
            ).fetchone()

            return dict(row) if row else None

        finally:
            if owned:
                connection.close()


class PublicBookingRequestRepository(
    BaseRepository
):
    table_name = "public_booking_requests"

    def get_by_request_id(
        self,
        request_id: str,
    ) -> Optional[Dict[str, Any]]:
        connection, owned = self._conn()

        try:
            row = connection.execute(
                """
                SELECT *
                FROM public_booking_requests
                WHERE company_id = ?
                  AND request_id = ?
                LIMIT 1
                """,
                (
                    get_company_id(),
                    request_id,
                ),
            ).fetchone()

            return dict(row) if row else None

        finally:
            self._close_if_owned(
                connection,
                owned,
            )
PY


cat > backend/app/services/public_booking.py <<'PY'
import json
from urllib.parse import urlparse

from app.core.ids import generate_id
from app.core.tenant import (
    reset_tenant,
    set_tenant,
)

from app.repositories.public_booking import (
    PublicBookingLookupRepository,
    PublicBookingRequestRepository,
)

from app.services.booking import BookingService


def normalize_origin(origin):
    if not origin:
        return None

    parsed = urlparse(origin)

    host = parsed.hostname

    return (
        host.lower()
        if host
        else None
    )


class PublicBookingService:
    def __init__(self, connection=None):
        self.lookup_repo = (
            PublicBookingLookupRepository(
                connection
            )
        )

    def create_booking(
        self,
        *,
        public_key: str,
        request_id: str,
        booking_payload,
        origin=None,
        ip_address=None,
        user_agent=None,
    ):
        key_record = self.lookup_repo.get_key(
            public_key
        )

        if key_record is None:
            raise PermissionError(
                "Invalid public booking key"
            )

        allowed_domain = (
            key_record.get(
                "allowed_domain"
            )
        )

        if allowed_domain:
            incoming_domain = (
                normalize_origin(origin)
            )

            expected = (
                allowed_domain
                .lower()
                .replace("https://", "")
                .replace("http://", "")
                .strip("/")
            )

            if incoming_domain != expected:
                raise PermissionError(
                    "Booking origin is not allowed"
                )

        tenant_token = set_tenant(
            company_id=key_record[
                "company_id"
            ]
        )

        try:
            request_repo = (
                PublicBookingRequestRepository()
            )

            existing = (
                request_repo
                .get_by_request_id(
                    request_id
                )
            )

            if existing:
                if (
                    existing["status"]
                    == "booking_created"
                    and existing["booking_id"]
                ):
                    return {
                        "idempotent": True,
                        "booking":
                            BookingService()
                            .get(
                                existing[
                                    "booking_id"
                                ]
                            ),
                    }

                raise ValueError(
                    "Request ID already exists"
                )

            request_record = (
                request_repo.insert({
                    "id": generate_id(
                        "public_booking_request"
                    ),
                    "public_booking_key_id":
                        key_record["id"],
                    "request_id":
                        request_id,
                    "status":
                        "validated",
                    "payload":
                        json.dumps(
                            booking_payload,
                            ensure_ascii=False,
                        ),
                    "ip_address":
                        ip_address,
                    "user_agent":
                        user_agent,
                })
            )

            result = BookingService().create(
                **booking_payload
            )

            request_repo.update(
                request_record["id"],
                {
                    "status":
                        "booking_created",
                    "booking_id":
                        result["booking"][
                            "id"
                        ],
                },
            )

            return {
                "idempotent": False,
                **result,
            }

        finally:
            reset_tenant(tenant_token)
PY


# ============================================================
# RATE LIMIT MIDDLEWARE
# ============================================================

cat > backend/app/middleware/rate_limit.py <<'PY'
import threading
import time
from collections import defaultdict, deque

from starlette.middleware.base import (
    BaseHTTPMiddleware,
)
from starlette.responses import JSONResponse


class RateLimitMiddleware(
    BaseHTTPMiddleware
):
    def __init__(self, app):
        super().__init__(app)

        self.lock = threading.Lock()

        self.events = defaultdict(deque)

        self.rules = {
            "/api/auth/login": (
                10,
                60,
            ),
            "/driver/auth/login": (
                10,
                60,
            ),
            "/public/booking": (
                30,
                60,
            ),
        }

    async def dispatch(
        self,
        request,
        call_next,
    ):
        path = request.url.path

        rule = self.rules.get(path)

        if (
            rule is None
            or request.method != "POST"
        ):
            return await call_next(
                request
            )

        limit, window = rule

        client_ip = (
            request.client.host
            if request.client
            else "unknown"
        )

        key = (
            client_ip,
            path,
        )

        now = time.monotonic()

        with self.lock:
            queue = self.events[key]

            while (
                queue
                and queue[0]
                <= now - window
            ):
                queue.popleft()

            if len(queue) >= limit:
                retry_after = max(
                    1,
                    int(
                        window
                        - (
                            now
                            - queue[0]
                        )
                    ),
                )

                return JSONResponse(
                    status_code=429,
                    content={
                        "success": False,
                        "error":
                            "rate_limit_exceeded",
                        "message":
                            "Too many requests",
                    },
                    headers={
                        "Retry-After":
                            str(retry_after)
                    },
                )

            queue.append(now)

        return await call_next(
            request
        )
PY


# ============================================================
# CENTRAL RBAC MIDDLEWARE
# ============================================================

cat > backend/app/middleware/rbac.py <<'PY'
from starlette.middleware.base import (
    BaseHTTPMiddleware,
)
from starlette.responses import JSONResponse

from app.services.auth import AuthService


class RBACMiddleware(
    BaseHTTPMiddleware
):
    RULES = [
        (
            "/api/settings",
            {
                "owner",
                "admin",
            },
        ),
        (
            "/api/finance",
            {
                "owner",
                "admin",
                "finance",
            },
        ),
        (
            "/api/integrations",
            {
                "owner",
                "admin",
            },
        ),
        (
            "/api/platform",
            {
                "owner",
                "admin",
            },
        ),
        (
            "/api/pricing",
            {
                "owner",
                "admin",
            },
        ),
        (
            "/api/routes",
            {
                "owner",
                "admin",
                "operator",
                "dispatcher",
            },
        ),
        (
            "/api/tours",
            {
                "owner",
                "admin",
                "operator",
                "tour_manager",
            },
        ),
        (
            "/api/drivers",
            {
                "owner",
                "admin",
                "dispatcher",
            },
        ),
        (
            "/api/vehicles",
            {
                "owner",
                "admin",
                "dispatcher",
            },
        ),
        (
            "/api/operations",
            {
                "owner",
                "admin",
                "operator",
                "dispatcher",
            },
        ),
        (
            "/api/bookings",
            {
                "owner",
                "admin",
                "operator",
            },
        ),
    ]

    async def dispatch(
        self,
        request,
        call_next,
    ):
        if request.method in {
            "GET",
            "HEAD",
            "OPTIONS",
        }:
            return await call_next(
                request
            )

        path = request.url.path

        if path in {
            "/api/auth/login",
        }:
            return await call_next(
                request
            )

        allowed = None

        for prefix, roles in self.RULES:
            if path.startswith(prefix):
                allowed = roles
                break

        if allowed is None:
            return await call_next(
                request
            )

        header = request.headers.get(
            "authorization",
            "",
        )

        if not header.lower().startswith(
            "bearer "
        ):
            return await call_next(
                request
            )

        token = header.split(
            " ",
            1,
        )[1].strip()

        try:
            identity = (
                AuthService()
                .authenticate_token(token)
            )
        except Exception:
            return await call_next(
                request
            )

        if identity["role"] not in allowed:
            return JSONResponse(
                status_code=403,
                content={
                    "success": False,
                    "error":
                        "permission_denied",
                    "message":
                        "Role is not allowed "
                        "for this operation",
                },
            )

        return await call_next(
            request
        )
PY


# ============================================================
# PLATFORM API
# ============================================================

cat > backend/app/api/routes/platform.py <<'PY'
from fastapi import (
    APIRouter,
    Depends,
)

from app.api.dependencies import (
    authenticated_user,
)

from app.schemas.platform import (
    APIKeyCreate,
    DomainCreate,
    DomainStatusUpdate,
    DriverAccountCreate,
    PublicBookingKeyCreate,
)

from app.services.platform import (
    PlatformService,
)


router = APIRouter(
    prefix="/api/platform",
    tags=["Platform"],
    dependencies=[
        Depends(authenticated_user),
    ],
)


@router.get("/domains")
def domains():
    return PlatformService().list_domains()


@router.post("/domains")
def create_domain(
    payload: DomainCreate,
):
    return PlatformService().create_domain(
        **payload.model_dump()
    )


@router.patch(
    "/domains/{domain_id}/status"
)
def domain_status(
    domain_id: str,
    payload: DomainStatusUpdate,
):
    return (
        PlatformService()
        .set_domain_status(
            domain_id,
            payload.status,
        )
    )


@router.get("/booking-keys")
def booking_keys():
    return (
        PlatformService()
        .list_public_booking_keys()
    )


@router.post("/booking-keys")
def create_booking_key(
    payload: PublicBookingKeyCreate,
):
    return (
        PlatformService()
        .create_public_booking_key(
            **payload.model_dump()
        )
    )


@router.delete(
    "/booking-keys/{key_id}"
)
def revoke_booking_key(
    key_id: str,
):
    return (
        PlatformService()
        .revoke_public_booking_key(
            key_id
        )
    )


@router.post("/api-keys")
def create_api_key(
    payload: APIKeyCreate,
):
    return (
        PlatformService()
        .create_api_key(
            **payload.model_dump()
        )
    )


@router.post("/driver-accounts")
def create_driver_account(
    payload: DriverAccountCreate,
):
    return (
        PlatformService()
        .create_driver_account(
            **payload.model_dump()
        )
    )
PY


# ============================================================
# PATCH BOOKING API STATUS
# ============================================================

cat >> backend/app/api/routes/bookings.py <<'PY'


from app.schemas.platform import BookingStatusUpdate
from app.services.booking_workflow import BookingWorkflowService


@router.patch("/{booking_id}/status")
def change_booking_status(
    booking_id: str,
    payload: BookingStatusUpdate,
):
    return (
        BookingWorkflowService()
        .change_status(
            booking_id,
            payload.status,
        )
    )
PY


# ============================================================
# REPLACE OPERATION STATUS ENDPOINT WORKFLOW
# ============================================================

python - <<'PY'
from pathlib import Path

path = Path(
    "backend/app/api/routes/operations.py"
)

text = path.read_text()

if (
    "from app.services.operation_workflow "
    "import OperationWorkflowService"
    not in text
):
    text = text.replace(
        "from app.services.operation "
        "import OperationService\n",
        "from app.services.operation "
        "import OperationService\n"
        "from app.services.operation_workflow "
        "import OperationWorkflowService\n"
    )

text = text.replace(
    '''    return OperationService().change_status(
        operation_id,
        payload.status,
    )''',
    '''    return OperationWorkflowService().change_status(
        operation_id,
        payload.status,
    )'''
)

path.write_text(text)
PY


# ============================================================
# PATCH PUBLIC BOOKING ROUTE ORIGIN
# ============================================================

python - <<'PY'
from pathlib import Path

path = Path(
    "backend/app/api/routes/public_booking.py"
)

text = path.read_text()

needle = '''        request_id=payload.request_id,
        booking_payload=payload.booking.model_dump(),
'''

replacement = '''        request_id=payload.request_id,
        booking_payload=payload.booking.model_dump(),
        origin=request.headers.get("origin"),
'''

if needle in text:
    text = text.replace(
        needle,
        replacement,
    )

path.write_text(text)
PY


# ============================================================
# PATCH AUTH ROUTE — LOGOUT
# ============================================================

cat >> backend/app/api/routes/auth.py <<'PY'


from fastapi.security import HTTPAuthorizationCredentials
from app.api.dependencies import bearer_scheme


@router.post("/logout")
def logout(
    credentials: HTTPAuthorizationCredentials = Depends(
        bearer_scheme
    ),
):
    if credentials is None:
        raise ValueError(
            "Authentication token is required"
        )

    return AuthService().logout(
        credentials.credentials
    )
PY


# ============================================================
# OUTBOX REPOSITORY
# ============================================================

cat > backend/app/repositories/outbox_worker.py <<'PY'
from app.core.tenant import get_company_id
from .base import BaseRepository


class OutboxWorkerRepository(
    BaseRepository
):
    table_name = "outbox_events"

    def pending(self, limit=100):
        connection, owned = self._conn()

        try:
            rows = connection.execute(
                """
                SELECT *
                FROM outbox_events
                WHERE company_id = ?
                  AND status = 'pending'
                  AND available_at
                      <= CURRENT_TIMESTAMP
                ORDER BY created_at ASC
                LIMIT ?
                """,
                (
                    get_company_id(),
                    limit,
                ),
            ).fetchall()

            return [
                dict(row)
                for row in rows
            ]

        finally:
            self._close_if_owned(
                connection,
                owned,
            )
PY


# ============================================================
# OUTBOX WORKER
# ============================================================

cat > backend/app/workers/outbox.py <<'PY'
import json

from app.core.tenant import (
    reset_tenant,
    set_tenant,
)
from app.core.time import utc_now_iso
from app.core.database import create_connection
from app.core.ids import generate_id

from app.repositories.outbox_worker import (
    OutboxWorkerRepository,
)
from app.repositories.base import BaseRepository


class WebhookDeliveryRepository(
    BaseRepository
):
    table_name = "webhook_deliveries"


def subscribed(
    subscribed_events,
    event_type,
):
    if not subscribed_events:
        return False

    raw = subscribed_events.strip()

    try:
        value = json.loads(raw)

        if isinstance(value, list):
            return (
                event_type in value
                or "*" in value
            )
    except Exception:
        pass

    events = {
        item.strip()
        for item in raw.split(",")
        if item.strip()
    }

    return (
        event_type in events
        or "*" in events
    )


class OutboxWorker:
    def run_company(
        self,
        company_id: str,
        limit: int = 100,
    ):
        token = set_tenant(
            company_id=company_id
        )

        try:
            repo = OutboxWorkerRepository()
            delivery_repo = (
                WebhookDeliveryRepository()
            )

            events = repo.pending(limit)

            connection = create_connection()

            try:
                endpoints = connection.execute(
                    """
                    SELECT *
                    FROM webhook_endpoints
                    WHERE company_id = ?
                      AND active = 1
                    """,
                    (company_id,),
                ).fetchall()

                endpoints = [
                    dict(row)
                    for row in endpoints
                ]

            finally:
                connection.close()

            processed = 0

            for event in events:
                try:
                    for endpoint in endpoints:
                        if not subscribed(
                            endpoint[
                                "subscribed_events"
                            ],
                            event[
                                "event_type"
                            ],
                        ):
                            continue

                        delivery_repo.insert({
                            "id": generate_id(
                                "outbox"
                            ),
                            "webhook_endpoint_id":
                                endpoint["id"],
                            "event_type":
                                event["event_type"],
                            "payload":
                                event["payload"],
                            "status": "pending",
                            "attempt_count": 0,
                        })

                    repo.update(
                        event["id"],
                        {
                            "status":
                                "processed",
                            "processed_at":
                                utc_now_iso(),
                        },
                    )

                    processed += 1

                except Exception as exc:
                    repo.update(
                        event["id"],
                        {
                            "status": "failed",
                            "last_error":
                                str(exc),
                        },
                    )

            return {
                "company_id": company_id,
                "processed": processed,
                "seen": len(events),
            }

        finally:
            reset_tenant(token)

    def run_all(
        self,
        limit_per_company=100,
    ):
        connection = create_connection()

        try:
            rows = connection.execute(
                """
                SELECT DISTINCT company_id
                FROM outbox_events
                WHERE status = 'pending'
                """
            ).fetchall()

            companies = [
                row["company_id"]
                for row in rows
            ]

        finally:
            connection.close()

        return [
            self.run_company(
                company_id,
                limit_per_company,
            )
            for company_id in companies
        ]
PY


# ============================================================
# SAFE WEBHOOK DELIVERY WORKER
# ============================================================

cat > backend/app/workers/webhooks.py <<'PY'
import ipaddress
import json
import socket
import urllib.request
from urllib.parse import urlparse

from app.core.database import create_connection
from app.core.time import utc_now_iso


def validate_webhook_url(url: str):
    parsed = urlparse(url)

    if parsed.scheme != "https":
        raise ValueError(
            "Webhook URL must use HTTPS"
        )

    if not parsed.hostname:
        raise ValueError(
            "Webhook hostname missing"
        )

    addresses = socket.getaddrinfo(
        parsed.hostname,
        parsed.port or 443,
    )

    for entry in addresses:
        ip = ipaddress.ip_address(
            entry[4][0]
        )

        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_multicast
            or ip.is_reserved
        ):
            raise ValueError(
                "Webhook target network "
                "is not allowed"
            )


class WebhookWorker:
    def run_once(self, limit=50):
        connection = create_connection()

        try:
            rows = connection.execute(
                """
                SELECT
                    wd.*,
                    we.endpoint_url
                FROM webhook_deliveries wd
                JOIN webhook_endpoints we
                  ON we.id =
                     wd.webhook_endpoint_id
                 AND we.company_id =
                     wd.company_id
                WHERE wd.status IN (
                    'pending',
                    'failed'
                )
                  AND (
                    wd.next_attempt_at IS NULL
                    OR wd.next_attempt_at
                        <= CURRENT_TIMESTAMP
                  )
                  AND wd.attempt_count < 5
                  AND we.active = 1
                ORDER BY wd.created_at ASC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()

            results = []

            for row in rows:
                delivery = dict(row)

                try:
                    validate_webhook_url(
                        delivery[
                            "endpoint_url"
                        ]
                    )

                    request = urllib.request.Request(
                        delivery[
                            "endpoint_url"
                        ],
                        data=delivery[
                            "payload"
                        ].encode("utf-8"),
                        headers={
                            "Content-Type":
                                "application/json",
                            "User-Agent":
                                "AXIOM-Webhook/1.0",
                            "X-AXIOM-Event":
                                delivery[
                                    "event_type"
                                ],
                        },
                        method="POST",
                    )

                    with urllib.request.urlopen(
                        request,
                        timeout=10,
                    ) as response:
                        status = (
                            response.status
                        )

                    connection.execute(
                        """
                        UPDATE webhook_deliveries
                        SET
                            status = 'sent',
                            attempt_count =
                                attempt_count + 1,
                            last_http_status = ?,
                            delivered_at = ?
                        WHERE id = ?
                        """,
                        (
                            status,
                            utc_now_iso(),
                            delivery["id"],
                        ),
                    )

                    results.append({
                        "id": delivery["id"],
                        "status": "sent",
                    })

                except Exception as exc:
                    connection.execute(
                        """
                        UPDATE webhook_deliveries
                        SET
                            status = 'failed',
                            attempt_count =
                                attempt_count + 1,
                            last_error = ?
                        WHERE id = ?
                        """,
                        (
                            str(exc),
                            delivery["id"],
                        ),
                    )

                    results.append({
                        "id": delivery["id"],
                        "status": "failed",
                        "error": str(exc),
                    })

            connection.commit()

            return results

        finally:
            connection.close()
PY


# ============================================================
# WORKER CLI
# ============================================================

cat > scripts/axiom_worker.py <<'PY'
#!/usr/bin/env python3

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"

sys.path.insert(
    0,
    str(BACKEND),
)

from app.workers.outbox import OutboxWorker
from app.workers.webhooks import WebhookWorker


def main():
    outbox = OutboxWorker().run_all()

    webhooks = WebhookWorker().run_once()

    print(
        json.dumps(
            {
                "outbox": outbox,
                "webhooks": webhooks,
            },
            indent=2,
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
PY

chmod +x scripts/axiom_worker.py


# ============================================================
# CONFIG / CORS
# ============================================================

cat > backend/app/core/config.py <<'PY'
from pathlib import Path
import os


BASE_DIR = Path(__file__).resolve().parents[2]

DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(
    parents=True,
    exist_ok=True,
)

DEFAULT_DATABASE_PATH = (
    DATA_DIR / "axiom_dev.db"
)


class Settings:
    APP_NAME = os.getenv(
        "AXIOM_APP_NAME",
        "AXIOM",
    )

    ENV = os.getenv(
        "AXIOM_ENV",
        "development",
    )

    DATABASE_PATH = Path(
        os.getenv(
            "AXIOM_DATABASE_PATH",
            str(DEFAULT_DATABASE_PATH),
        )
    )

    DEBUG = os.getenv(
        "AXIOM_DEBUG",
        (
            "1"
            if ENV == "development"
            else "0"
        ),
    ) == "1"


settings = Settings()


def get_cors_origins():
    raw = os.getenv(
        "AXIOM_CORS_ORIGINS",
        (
            "http://localhost:5173,"
            "http://127.0.0.1:5173"
        ),
    )

    return [
        value.strip()
        for value in raw.split(",")
        if value.strip()
    ]
PY


# ============================================================
# CLEAN MAIN APPLICATION
# ============================================================

cat > backend/app/main.py <<'PY'
import sqlite3

from fastapi import FastAPI
from fastapi.middleware.cors import (
    CORSMiddleware,
)
from fastapi.responses import JSONResponse

from app.core.config import (
    get_cors_origins,
)

from app.middleware.rate_limit import (
    RateLimitMiddleware,
)
from app.middleware.rbac import (
    RBACMiddleware,
)

from app.security.exceptions import (
    AccountDisabled,
    AuthenticationError,
    InvalidCredentials,
    PermissionDenied,
    SessionExpired,
    SessionRevoked,
)

from app.api.routes.health import (
    router as health_router,
)
from app.api.routes.auth import (
    router as auth_router,
)
from app.api.routes.customers import (
    router as customers_router,
)
from app.api.routes.bookings import (
    router as bookings_router,
)
from app.api.routes.drivers import (
    router as drivers_router,
)
from app.api.routes.vehicles import (
    router as vehicles_router,
)
from app.api.routes.operations import (
    router as operations_router,
)
from app.api.routes.tours import (
    router as tours_router,
)
from app.api.routes.routes import (
    router as routes_router,
)
from app.api.routes.pricing import (
    router as pricing_router,
)
from app.api.routes.settings import (
    router as settings_router,
)
from app.api.routes.finance import (
    router as finance_router,
)
from app.api.routes.integrations import (
    router as integrations_router,
)
from app.api.routes.public_booking import (
    router as public_booking_router,
)
from app.api.routes.driver import (
    router as driver_router,
)
from app.api.routes.dashboard import (
    router as dashboard_router,
)
from app.api.routes.platform import (
    router as platform_router,
)


app = FastAPI(
    title="AXIOM API",
    version="0.1.0",
    description=(
        "AXIOM Tourism Operations Platform"
    ),
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_credentials=True,
    allow_methods=[
        "GET",
        "POST",
        "PUT",
        "PATCH",
        "DELETE",
        "OPTIONS",
    ],
    allow_headers=[
        "Authorization",
        "Content-Type",
        "Idempotency-Key",
        "X-API-Key",
        "X-AXIOM-Booking-Key",
    ],
)

app.add_middleware(
    RateLimitMiddleware
)

app.add_middleware(
    RBACMiddleware
)


def error_response(
    status_code,
    error,
    message,
):
    return JSONResponse(
        status_code=status_code,
        content={
            "success": False,
            "error": error,
            "message": message,
        },
    )


@app.exception_handler(
    InvalidCredentials
)
async def invalid_credentials(
    request,
    exc,
):
    return error_response(
        401,
        "invalid_credentials",
        str(exc),
    )


@app.exception_handler(
    SessionExpired
)
async def session_expired(
    request,
    exc,
):
    return error_response(
        401,
        "session_expired",
        str(exc),
    )


@app.exception_handler(
    SessionRevoked
)
async def session_revoked(
    request,
    exc,
):
    return error_response(
        401,
        "session_revoked",
        str(exc),
    )


@app.exception_handler(
    AccountDisabled
)
async def account_disabled(
    request,
    exc,
):
    return error_response(
        403,
        "account_disabled",
        str(exc),
    )


@app.exception_handler(
    PermissionDenied
)
async def permission_denied(
    request,
    exc,
):
    return error_response(
        403,
        "permission_denied",
        str(exc),
    )


@app.exception_handler(
    AuthenticationError
)
async def auth_error(
    request,
    exc,
):
    return error_response(
        401,
        "authentication_error",
        str(exc),
    )


@app.exception_handler(
    PermissionError
)
async def permission_error(
    request,
    exc,
):
    return error_response(
        403,
        "permission_denied",
        str(exc),
    )


@app.exception_handler(
    LookupError
)
async def lookup_error(
    request,
    exc,
):
    return error_response(
        404,
        "not_found",
        str(exc),
    )


@app.exception_handler(
    ValueError
)
async def value_error(
    request,
    exc,
):
    return error_response(
        400,
        "validation_error",
        str(exc),
    )


@app.exception_handler(
    sqlite3.IntegrityError
)
async def integrity_error(
    request,
    exc,
):
    return error_response(
        409,
        "database_conflict",
        "Operation conflicts "
        "with existing data",
    )


app.include_router(
    health_router
)
app.include_router(
    auth_router
)
app.include_router(
    customers_router
)
app.include_router(
    bookings_router
)
app.include_router(
    drivers_router
)
app.include_router(
    vehicles_router
)
app.include_router(
    operations_router
)
app.include_router(
    tours_router
)
app.include_router(
    routes_router
)
app.include_router(
    pricing_router
)
app.include_router(
    settings_router
)
app.include_router(
    finance_router
)
app.include_router(
    integrations_router
)
app.include_router(
    public_booking_router
)
app.include_router(
    driver_router
)
app.include_router(
    dashboard_router
)
app.include_router(
    platform_router
)
PY


# ============================================================
# EXPORTS
# ============================================================

cat >> backend/app/repositories/__init__.py <<'PY'

from .operation_event import OperationEventRepository
from .platform import (
    CompanyDomainRepository,
    PublicBookingKeyTenantRepository,
    DriverAccountRepository,
)
from .outbox_worker import OutboxWorkerRepository
PY

cat >> backend/app/services/__init__.py <<'PY'

from .booking_workflow import BookingWorkflowService
from .operation_workflow import OperationWorkflowService
from .platform import PlatformService
PY


# ============================================================
# APPLY FINAL MIGRATION TO DEV DATABASE
# ============================================================

echo
echo "[AXIOM] Applying 006_hardening.sql..."

sqlite3 backend/data/axiom_dev.db \
    < backend/migrations/006_hardening.sql


echo
echo "=============================================="
echo " AXIOM V1 BACKEND FINALIZATION COMPLETE"
echo "=============================================="
echo
echo "Next step:"
echo "  ./scripts/axiom_audit.sh"
echo
echo "Do NOT run partial/manual tests."
echo "Use the full audit only."
