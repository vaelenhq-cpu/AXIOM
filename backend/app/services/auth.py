from datetime import datetime, timedelta, timezone
from typing import Optional

from app.core.ids import generate_id
from app.core.tenant import set_tenant

from app.repositories.auth import AuthRepository
from app.repositories.session import SessionRepository
from app.repositories.user import UserRepository

from app.security.passwords import verify_password
from app.security.tokens import generate_token, hash_token
from app.security.exceptions import (
    AccountDisabled,
    InvalidCredentials,
    SessionExpired,
    SessionRevoked,
)


class AuthService:
    SESSION_HOURS = 12

    def __init__(self, connection=None):
        self.auth_repo = AuthRepository(connection)

    def login(
        self,
        *,
        company_slug: str,
        email: str,
        password: str,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ):
        identity = self.auth_repo.find_login_identity(
            company_slug=company_slug,
            email=email,
        )

        if identity is None:
            raise InvalidCredentials(
                "Invalid company, email or password"
            )

        if identity["company_status"] not in {
            "trial",
            "active",
        }:
            raise AccountDisabled(
                "Company account is not active"
            )

        if identity["status"] != "active":
            raise AccountDisabled(
                "User account is not active"
            )

        if not verify_password(
            password,
            identity["password_hash"],
        ):
            raise InvalidCredentials(
                "Invalid company, email or password"
            )

        tenant_token = set_tenant(
            company_id=identity["company_id"],
            user_id=identity["id"],
            role=identity["role"],
        )

        try:
            session_repo = SessionRepository()

            raw_token = generate_token()
            token_hash = hash_token(raw_token)

            expires_at = (
                datetime.now(timezone.utc)
                + timedelta(hours=self.SESSION_HOURS)
            ).isoformat()

            session = session_repo.insert({
                "id": generate_id("session"),
                "user_id": identity["id"],
                "token_hash": token_hash,
                "ip_address": ip_address,
                "user_agent": user_agent,
                "expires_at": expires_at,
            })

            user_repo = UserRepository()

            user_repo.update(
                identity["id"],
                {
                    "last_login_at": datetime.now(
                        timezone.utc
                    ).isoformat(),
                },
            )

            return {
                "token": raw_token,
                "expires_at": expires_at,
                "session_id": session["id"],
                "user": {
                    "id": identity["id"],
                    "company_id": identity["company_id"],
                    "email": identity["email"],
                    "first_name": identity["first_name"],
                    "last_name": identity["last_name"],
                    "role": identity["role"],
                },
            }

        finally:
            from app.core.tenant import reset_tenant
            reset_tenant(tenant_token)

    def authenticate_token(
        self,
        token: str,
    ):
        token_hash = hash_token(token)

        session = self.auth_repo.get_session_with_user(
            token_hash
        )

        if session is None:
            raise InvalidCredentials(
                "Invalid session"
            )

        if session["revoked_at"] is not None:
            raise SessionRevoked(
                "Session has been revoked"
            )

        if session["company_status"] not in {
            "trial",
            "active",
        }:
            raise AccountDisabled(
                "Company account is not active"
            )

        if session["user_status"] != "active":
            raise AccountDisabled(
                "User account is not active"
            )

        expires_at = datetime.fromisoformat(
            session["expires_at"]
        )

        now = datetime.now(timezone.utc)

        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(
                tzinfo=timezone.utc
            )

        if expires_at <= now:
            raise SessionExpired(
                "Session expired"
            )

        return {
            "session_id": session["session_id"],
            "company_id": session["company_id"],
            "user_id": session["user_id"],
            "email": session["email"],
            "first_name": session["first_name"],
            "last_name": session["last_name"],
            "role": session["role"],
        }


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
