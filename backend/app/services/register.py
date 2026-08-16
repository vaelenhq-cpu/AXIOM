import re
import unicodedata
from datetime import datetime, timedelta, timezone

from app.core.ids import generate_id
from app.core.transactions import transaction

from app.security.passwords import hash_password
from app.security.tokens import generate_token, hash_token


def slugify(value: str) -> str:
    normalized = unicodedata.normalize(
        "NFKD",
        value,
    )

    ascii_value = normalized.encode(
        "ascii",
        "ignore",
    ).decode("ascii")

    slug = re.sub(
        r"[^a-zA-Z0-9]+",
        "-",
        ascii_value,
    ).strip("-").lower()

    return slug or "company"


class RegisterService:
    SESSION_HOURS = 12

    def register(
        self,
        *,
        company_name: str,
        first_name: str,
        last_name: str,
        email: str,
        phone: str | None,
        password: str,
    ):
        company_name = company_name.strip()
        first_name = first_name.strip()
        last_name = last_name.strip()
        email = email.strip().lower()

        with transaction() as connection:
            existing_user = connection.execute(
                """
                SELECT id
                FROM company_users
                WHERE lower(email) = lower(?)
                LIMIT 1
                """,
                (email,),
            ).fetchone()

            if existing_user:
                raise ValueError(
                    "This email address is already registered"
                )

            base_slug = slugify(
                company_name
            )

            slug = base_slug
            counter = 2

            while connection.execute(
                """
                SELECT 1
                FROM companies
                WHERE slug = ?
                LIMIT 1
                """,
                (slug,),
            ).fetchone():
                slug = (
                    f"{base_slug}-{counter}"
                )
                counter += 1

            company_id = generate_id(
                "company"
            )

            user_id = generate_id(
                "user"
            )

            settings_id = generate_id(
                "company_settings"
            )

            session_id = generate_id(
                "session"
            )

            connection.execute(
                """
                INSERT INTO companies (
                    id,
                    name,
                    slug,
                    status,
                    country_code,
                    timezone,
                    default_currency
                )
                VALUES (
                    ?,
                    ?,
                    ?,
                    'active',
                    'TR',
                    'Europe/Istanbul',
                    'TRY'
                )
                """,
                (
                    company_id,
                    company_name,
                    slug,
                ),
            )

            connection.execute(
                """
                INSERT INTO company_settings (
                    id,
                    company_id,
                    booking_prefix,
                    auto_confirm_bookings,
                    auto_create_operations,
                    require_driver_acceptance,
                    default_language,
                    default_timezone,
                    default_currency
                )
                VALUES (
                    ?,
                    ?,
                    'AX',
                    0,
                    1,
                    0,
                    'tr',
                    'Europe/Istanbul',
                    'TRY'
                )
                """,
                (
                    settings_id,
                    company_id,
                ),
            )

            connection.execute(
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
                VALUES (
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    'owner',
                    'active'
                )
                """,
                (
                    user_id,
                    company_id,
                    email,
                    hash_password(password),
                    first_name,
                    last_name,
                ),
            )

            raw_token = generate_token()
            token_hash = hash_token(
                raw_token
            )

            expires_at = (
                datetime.now(
                    timezone.utc
                )
                + timedelta(
                    hours=self.SESSION_HOURS
                )
            ).isoformat()

            connection.execute(
                """
                INSERT INTO auth_sessions (
                    id,
                    company_id,
                    user_id,
                    token_hash,
                    expires_at
                )
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    session_id,
                    company_id,
                    user_id,
                    token_hash,
                    expires_at,
                ),
            )

            return {
                "token": raw_token,
                "token_type": "bearer",
                "expires_at": expires_at,
                "session_id": session_id,
                "company": {
                    "id": company_id,
                    "name": company_name,
                    "slug": slug,
                },
                "user": {
                    "id": user_id,
                    "company_id": company_id,
                    "email": email,
                    "first_name": first_name,
                    "last_name": last_name,
                    "role": "owner",
                },
            }
