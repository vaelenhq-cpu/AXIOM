from app.providers.domain.cloudflare import (
    CloudflareDomainProvider,
)
from app.security.secrets import SecretResolver


class DomainProviderFactory:

    def __init__(
        self,
        secret_resolver=None,
    ):
        self.secret_resolver = (
            secret_resolver
            or SecretResolver()
        )

    def create(
        self,
        connection: dict,
    ):
        provider = connection.get(
            "provider"
        )

        secret_ref = connection.get(
            "secret_ref"
        )

        if provider == "cloudflare":
            token = (
                self.secret_resolver.resolve(
                    secret_ref
                )
            )

            return CloudflareDomainProvider(
                token
            )

        raise ValueError(
            "Unsupported domain provider"
        )
