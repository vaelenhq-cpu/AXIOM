from datetime import timedelta

from app.core.ids import generate_id
from app.core.time import utc_now, utc_now_iso
from app.core.tenant import (
    clear_tenant,
    set_tenant,
)
from app.providers.domain.cloudflare import (
    CloudflareDomainProvider,
)
from app.providers.domain.cloudflare_oauth import (
    CloudflareOAuth,
)
from app.repositories.domain_provider import (
    DomainProviderConnectionRepository,
)
from app.repositories.domain_provider_oauth import (
    DomainProviderOAuthStateRepository,
)
from app.services.secret_vault import (
    SecretVaultService,
)


class DomainProviderOAuthService:

    def __init__(self, connection=None):
        self.state_repo = (
            DomainProviderOAuthStateRepository(
                connection
            )
        )

        self.connection_repo = (
            DomainProviderConnectionRepository(
                connection
            )
        )

        self.cloudflare = CloudflareOAuth()


    # =====================================================
    # START
    # =====================================================

    def start_cloudflare(
        self,
        redirect_path: str | None = None,
    ):
        self.cloudflare.validate_configuration()

        connection = (
            self.connection_repo.insert({
                "id": generate_id(
                    "domain_provider"
                ),
                "provider": "cloudflare",
                "name": "Cloudflare",
                "status": "pending",
                "auth_type": "oauth",
            })
        )

        state = (
            self.cloudflare.generate_state()
        )

        state_hash = (
            self.cloudflare.hash_state(
                state
            )
        )

        expires_at = (
            utc_now()
            + timedelta(minutes=10)
        ).isoformat()

        self.state_repo.insert({
            "id": generate_id(
                "oauth_state"
            ),
            "provider": "cloudflare",
            "connection_id":
                connection["id"],
            "state_hash": state_hash,
            "redirect_path":
                redirect_path,
            "expires_at":
                expires_at,
        })

        return {
            "authorization_url":
                self.cloudflare.authorization_url(
                    state
                ),

            "connection_id":
                connection["id"],

            "expires_at":
                expires_at,
        }


    # =====================================================
    # PUBLIC CALLBACK STATE
    # =====================================================

    def resolve_callback_state(
        self,
        state: str,
    ):
        if not state:
            raise ValueError(
                "OAuth state is required"
            )

        state_hash = (
            self.cloudflare.hash_state(
                state
            )
        )

        oauth_state = (
            DomainProviderOAuthStateRepository
            .resolve_public_state(
                state_hash
            )
        )

        if oauth_state is None:
            raise ValueError(
                "OAuth state is invalid "
                "or expired"
            )

        if (
            oauth_state.get("provider")
            != "cloudflare"
        ):
            raise ValueError(
                "OAuth provider mismatch"
            )

        if not oauth_state.get(
            "connection_id"
        ):
            raise ValueError(
                "OAuth provider connection "
                "is missing"
            )

        return oauth_state


    # =====================================================
    # COMPLETE CALLBACK
    # =====================================================

    def complete_cloudflare(
        self,
        *,
        code: str,
        state: str,
    ):
        if not code:
            raise ValueError(
                "OAuth authorization code "
                "is required"
            )

        oauth_state = (
            self.resolve_callback_state(
                state
            )
        )

        company_id = (
            oauth_state["company_id"]
        )

        connection_id = (
            oauth_state["connection_id"]
        )

        # Callback normal AXIOM Bearer oturumu
        # taşımadığı için tenant context state
        # üzerinden kontrollü kuruluyor.
        set_tenant(
            company_id=company_id,
            user_id=None,
            role="oauth_callback",
        )

        try:
            connection = (
                self.connection_repo.get_by_id(
                    connection_id
                )
            )

            if connection is None:
                raise LookupError(
                    "Domain provider connection "
                    "not found"
                )

            token_result = (
                self.cloudflare.exchange_code(
                    code
                )
            )

            access_token = (
                token_result.get(
                    "access_token"
                )
            )

            refresh_token = (
                token_result.get(
                    "refresh_token"
                )
            )

            if not access_token:
                raise ValueError(
                    "Cloudflare OAuth access "
                    "token was not returned"
                )

            # Token gerçekten Cloudflare API'de
            # çalışıyor mu kontrol et.
            provider = (
                CloudflareDomainProvider(
                    access_token
                )
            )

            provider_result = (
                provider.verify_credentials()
            )

            vault = SecretVaultService()

            access_ref = vault.store(
                secret_type=(
                    "cloudflare_oauth_access_token"
                ),
                plaintext=access_token,
            )

            refresh_ref = None

            if refresh_token:
                refresh_ref = vault.store(
                    secret_type=(
                        "cloudflare_oauth_refresh_token"
                    ),
                    plaintext=refresh_token,
                )

            expires_at = None

            expires_in = token_result.get(
                "expires_in"
            )

            if expires_in is not None:
                try:
                    expires_at = (
                        utc_now()
                        + timedelta(
                            seconds=int(
                                expires_in
                            )
                        )
                    ).isoformat()

                except (
                    TypeError,
                    ValueError,
                ):
                    expires_at = None

            updated = (
                self.connection_repo.update(
                    connection_id,
                    {
                        "status":
                            "connected",

                        "secret_ref":
                            access_ref,

                        "refresh_secret_ref":
                            refresh_ref,

                        "token_expires_at":
                            expires_at,

                        "connected_at":
                            utc_now_iso(),

                        "last_check_at":
                            utc_now_iso(),

                        "last_error":
                            None,
                    },
                )
            )

            self.state_repo.update(
                oauth_state["id"],
                {
                    "consumed_at":
                        utc_now_iso(),
                },
            )

            return {
                "provider":
                    "cloudflare",

                "connection_id":
                    connection_id,

                "status":
                    "connected",

                "token_status":
                    provider_result.get(
                        "status"
                    ),

                "token_expires_at":
                    expires_at,

                "redirect_path":
                    oauth_state.get(
                        "redirect_path"
                    ),
            }

        except Exception as exc:
            # Connection bulunuyorsa hata durumuna
            # geçir, fakat token/log sızıntısı yapma.
            try:
                self.connection_repo.update(
                    connection_id,
                    {
                        "status": "error",
                        "last_check_at":
                            utc_now_iso(),
                        "last_error":
                            str(exc)[:500],
                    },
                )
            except Exception:
                pass

            raise

        finally:
            clear_tenant()
