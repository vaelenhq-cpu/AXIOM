import urllib.error
import urllib.request

from app.core.ids import generate_id

from app.repositories.driver import DriverRepository
from app.repositories.platform import (
    CompanyDomainRepository,
    DriverAccountRepository,
    PublicBookingKeyTenantRepository,
)

from app.security.network import (
    validate_public_https_url,
)
from app.security.passwords import hash_password
from app.security.tokens import (
    generate_public_booking_key,
    generate_token,
)

from app.core.time import utc_now_iso

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

        verification_token = (
            "axiom-domain-"
            + generate_token(24)
        )

        return self.domain_repo.insert({
            "id": generate_id("domain"),
            "domain": domain,
            "domain_type": domain_type,
            "status": "pending",
            "verification_token":
                verification_token,
        })

    def set_domain_status(
        self,
        domain_id: str,
        status: str,
    ):
        if status not in {
            "pending",
            "disabled",
        }:
            raise ValueError(
                "Domain verification status "
                "cannot be changed manually"
            )

        return self.domain_repo.update(
            domain_id,
            {
                "status": status,
            },
        )

    def verify_domain(
        self,
        domain_id: str,
    ):
        domain = self.domain_repo.get_by_id(
            domain_id
        )

        if domain is None:
            raise LookupError(
                "Domain not found"
            )

        expected = domain.get(
            "verification_token"
        )

        if not expected:
            raise ValueError(
                "Domain verification token "
                "is missing"
            )

        domain_name = (
            domain["domain"]
            .strip()
            .lower()
            .rstrip("/")
        )

        verification_url = (
            f"https://{domain_name}"
            "/.well-known/"
            "axiom-domain-verification.txt"
        )

        self.domain_repo.update(
            domain_id,
            {
                "status": "verifying",
            },
        )

        validate_public_https_url(
            verification_url
        )

        request = urllib.request.Request(
            verification_url,
            headers={
                "User-Agent":
                    "AXIOM-Domain-Verifier/1.0",
                "Accept":
                    "text/plain",
            },
            method="GET",
        )

        try:
            with urllib.request.urlopen(
                request,
                timeout=8,
            ) as response:
                content = (
                    response
                    .read(4096)
                    .decode(
                        "utf-8",
                        errors="replace",
                    )
                    .strip()
                )

        except (
            urllib.error.URLError,
            urllib.error.HTTPError,
            TimeoutError,
        ) as exc:
            self.domain_repo.update(
                domain_id,
                {
                    "status": "failed",
                },
            )

            raise ValueError(
                "Domain verification file "
                "could not be reached"
            ) from exc

        if content != expected:
            self.domain_repo.update(
                domain_id,
                {
                    "status": "failed",
                },
            )

            raise ValueError(
                "Domain verification token "
                "does not match"
            )

        return self.domain_repo.update(
            domain_id,
            {
                "status": "verified",
                "verified_at": utc_now_iso(),
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
