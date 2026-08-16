import urllib.error
import urllib.request

from app.core.database import create_connection
from app.core.time import utc_now_iso
from app.security.network import (
    validate_public_https_url,
)
from app.providers.domain.factory import (
    DomainProviderFactory,
)


class DomainVerificationWorker:

    def __init__(self):
        self.provider_factory = (
            DomainProviderFactory()
        )


    def run_once(
        self,
        limit: int = 20,
    ):
        connection = create_connection()

        try:
            rows = connection.execute(
                """
                SELECT *
                FROM company_domains
                WHERE status IN (
                    'pending',
                    'verifying'
                )
                  AND (
                    next_check_at IS NULL
                    OR next_check_at
                        <= CURRENT_TIMESTAMP
                  )
                ORDER BY created_at ASC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()

            results = []

            for row in rows:
                domain = dict(row)

                method = domain.get(
                    "verification_method"
                ) or "http"

                if method == "dns":
                    result = self._verify_dns(
                        connection,
                        domain,
                    )

                else:
                    result = self._verify_http(
                        connection,
                        domain,
                    )

                results.append(result)

            connection.commit()

            return results

        except Exception:
            connection.rollback()
            raise

        finally:
            connection.close()


    # =====================================================
    # HTTP VERIFICATION
    # =====================================================

    def _verify_http(
        self,
        connection,
        domain: dict,
    ):
        domain_id = domain["id"]

        domain_name = (
            domain["domain"]
            .strip()
            .lower()
            .rstrip("/")
        )

        expected_token = domain.get(
            "verification_token"
        )

        attempts = self._next_attempt(
            domain
        )

        now = utc_now_iso()

        if not expected_token:
            return self._retry(
                connection,
                domain_id,
                attempts,
                "Verification token is missing",
                now,
            )

        verification_url = (
            f"https://{domain_name}"
            "/.well-known/"
            "axiom-domain-verification.txt"
        )

        try:
            validate_public_https_url(
                verification_url
            )

            self._mark_checking(
                connection,
                domain_id,
                attempts,
                now,
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

            if content != expected_token:
                return self._retry(
                    connection,
                    domain_id,
                    attempts,
                    (
                        "Verification token "
                        "does not match"
                    ),
                    now,
                )

            return self._verified(
                connection,
                domain_id,
                attempts,
            )

        except (
            urllib.error.URLError,
            urllib.error.HTTPError,
            TimeoutError,
            ValueError,
        ) as exc:
            return self._retry(
                connection,
                domain_id,
                attempts,
                str(exc),
                now,
            )


    # =====================================================
    # DNS / PROVIDER VERIFICATION
    # =====================================================

    def _verify_dns(
        self,
        connection,
        domain: dict,
    ):
        domain_id = domain["id"]

        domain_name = (
            domain["domain"]
            .strip()
            .lower()
            .rstrip(".")
        )

        expected_token = domain.get(
            "verification_token"
        )

        attempts = self._next_attempt(
            domain
        )

        now = utc_now_iso()

        if not expected_token:
            return self._retry(
                connection,
                domain_id,
                attempts,
                "Verification token is missing",
                now,
            )

        try:
            row = connection.execute(
                """
                SELECT
                    dpz.*,
                    dpc.provider,
                    dpc.secret_ref,
                    dpc.status
                        AS connection_status
                FROM domain_provider_zones dpz
                JOIN domain_provider_connections dpc
                  ON dpc.id =
                     dpz.connection_id
                 AND dpc.company_id =
                     dpz.company_id
                WHERE dpz.domain_id = ?
                  AND dpz.company_id = ?
                  AND dpz.status = 'active'
                ORDER BY dpz.created_at DESC
                LIMIT 1
                """,
                (
                    domain_id,
                    domain["company_id"],
                ),
            ).fetchone()

            if row is None:
                return self._retry(
                    connection,
                    domain_id,
                    attempts,
                    (
                        "Active domain provider "
                        "zone not found"
                    ),
                    now,
                )

            provider_connection = dict(
                row
            )

            if (
                provider_connection[
                    "connection_status"
                ]
                != "connected"
            ):
                return self._retry(
                    connection,
                    domain_id,
                    attempts,
                    (
                        "Domain provider "
                        "connection is not "
                        "connected"
                    ),
                    now,
                )

            external_zone_id = (
                provider_connection.get(
                    "external_zone_id"
                )
            )

            if not external_zone_id:
                return self._retry(
                    connection,
                    domain_id,
                    attempts,
                    (
                        "External provider "
                        "zone ID is missing"
                    ),
                    now,
                )

            self._mark_checking(
                connection,
                domain_id,
                attempts,
                now,
            )

            provider = (
                self.provider_factory.create(
                    provider_connection
                )
            )

            txt_name = (
                "_axiom-verification."
                + domain_name
            )

            records = (
                provider.list_dns_records(
                    external_zone_id,
                    name=txt_name,
                    record_type="TXT",
                )
            )

            matched = any(
                str(
                    record.get(
                        "content",
                        "",
                    )
                ).strip()
                == expected_token
                for record in records
            )

            if not matched:
                return self._retry(
                    connection,
                    domain_id,
                    attempts,
                    (
                        "DNS verification "
                        "TXT record not found"
                    ),
                    now,
                )

            return self._verified(
                connection,
                domain_id,
                attempts,
            )

        except Exception as exc:
            return self._retry(
                connection,
                domain_id,
                attempts,
                str(exc),
                now,
            )


    # =====================================================
    # SHARED STATE
    # =====================================================

    def _next_attempt(
        self,
        domain: dict,
    ) -> int:
        return int(
            domain.get(
                "verification_attempts"
            )
            or 0
        ) + 1


    def _mark_checking(
        self,
        connection,
        domain_id: str,
        attempts: int,
        checked_at: str,
    ):
        connection.execute(
            """
            UPDATE company_domains
            SET
                status = 'verifying',
                verification_attempts = ?,
                last_check_at = ?,
                last_error = NULL,
                updated_at =
                    CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (
                attempts,
                checked_at,
                domain_id,
            ),
        )


    def _verified(
        self,
        connection,
        domain_id: str,
        attempts: int,
    ):
        verified_at = utc_now_iso()

        connection.execute(
            """
            UPDATE company_domains
            SET
                status = 'verified',
                verification_attempts = ?,
                last_check_at = ?,
                next_check_at = NULL,
                last_error = NULL,
                verified_at = ?,
                updated_at =
                    CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (
                attempts,
                verified_at,
                verified_at,
                domain_id,
            ),
        )

        return {
            "id": domain_id,
            "status": "verified",
            "attempts": attempts,
        }


    def _retry(
        self,
        connection,
        domain_id: str,
        attempts: int,
        error: str,
        checked_at: str,
    ):
        if attempts <= 3:
            delay = 1

        elif attempts <= 6:
            delay = 5

        elif attempts <= 10:
            delay = 15

        else:
            delay = 60

        connection.execute(
            """
            UPDATE company_domains
            SET
                status = 'verifying',
                verification_attempts = ?,
                last_check_at = ?,
                next_check_at =
                    datetime(
                        'now',
                        '+' || ? || ' minutes'
                    ),
                last_error = ?,
                updated_at =
                    CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (
                attempts,
                checked_at,
                delay,
                error[:500],
                domain_id,
            ),
        )

        return {
            "id": domain_id,
            "status":
                "retry_scheduled",
            "attempts": attempts,
            "retry_minutes": delay,
            "error": error,
        }
