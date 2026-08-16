from datetime import datetime, timedelta, timezone

from app.core.ids import generate_id
from app.core.tenant import reset_tenant, set_tenant

from app.repositories.driver_auth import DriverAuthRepository
from app.repositories.driver_session import DriverSessionRepository

from app.security.passwords import verify_password
from app.security.tokens import generate_token, hash_token
from app.security.exceptions import (
    AccountDisabled,
    InvalidCredentials,
    SessionExpired,
    SessionRevoked,
)


class DriverAuthService:
    SESSION_HOURS = 24

    def __init__(self, connection=None):
        self.auth_repo = DriverAuthRepository(connection)

    def login(
        self,
        *,
        company_slug: str,
        login_identifier: str,
        password: str,
        ip_address=None,
        user_agent=None,
    ):
        identity = self.auth_repo.find_identity(
            company_slug=company_slug,
            login_identifier=login_identifier,
        )

        if identity is None:
            raise InvalidCredentials(
                "Invalid driver credentials"
            )

        if identity["company_status"] not in {
            "trial",
            "active",
        }:
            raise AccountDisabled(
                "Company account is disabled"
            )

        if identity["status"] != "active":
            raise AccountDisabled(
                "Driver account is disabled"
            )

        if not identity["driver_active"]:
            raise AccountDisabled(
                "Driver is inactive"
            )

        if not identity["password_hash"]:
            raise InvalidCredentials(
                "Driver password is not configured"
            )

        if not verify_password(
            password,
            identity["password_hash"],
        ):
            raise InvalidCredentials(
                "Invalid driver credentials"
            )

        tenant_token = set_tenant(
            company_id=identity["company_id"],
        )

        try:
            raw_token = generate_token()
            hashed = hash_token(raw_token)

            expires_at = (
                datetime.now(timezone.utc)
                + timedelta(hours=self.SESSION_HOURS)
            ).isoformat()

            repo = DriverSessionRepository()

            session = repo.insert({
                "id": generate_id("session"),
                "driver_account_id": identity["id"],
                "token_hash": hashed,
                "ip_address": ip_address,
                "user_agent": user_agent,
                "expires_at": expires_at,
            })

            return {
                "token": raw_token,
                "expires_at": expires_at,
                "session_id": session["id"],
                "driver": {
                    "id": identity["driver_id"],
                    "first_name": identity["first_name"],
                    "last_name": identity["last_name"],
                },
            }

        finally:
            reset_tenant(tenant_token)

    def authenticate_token(self, token: str):
        session = self.auth_repo.get_session(
            hash_token(token)
        )

        if session is None:
            raise InvalidCredentials(
                "Invalid driver session"
            )

        if session["revoked_at"] is not None:
            raise SessionRevoked(
                "Driver session revoked"
            )

        if session["account_status"] != "active":
            raise AccountDisabled(
                "Driver account disabled"
            )

        if not session["driver_active"]:
            raise AccountDisabled(
                "Driver inactive"
            )

        if session["company_status"] not in {
            "trial",
            "active",
        }:
            raise AccountDisabled(
                "Company inactive"
            )

        expires_at = datetime.fromisoformat(
            session["expires_at"]
        )

        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(
                tzinfo=timezone.utc
            )

        if expires_at <= datetime.now(timezone.utc):
            raise SessionExpired(
                "Driver session expired"
            )

        return {
            "session_id": session["session_id"],
            "company_id": session["company_id"],
            "driver_id": session["driver_id"],
            "first_name": session["first_name"],
            "last_name": session["last_name"],
        }
