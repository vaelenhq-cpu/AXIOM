import os


class SecretResolver:

    ENV_PREFIX = "env:"
    VAULT_PREFIX = "vault:"

    def resolve(
        self,
        secret_ref: str,
    ) -> str:

        if not secret_ref:
            raise ValueError(
                "Secret reference is required"
            )

        if secret_ref.startswith(
            self.ENV_PREFIX
        ):
            variable = secret_ref[
                len(self.ENV_PREFIX):
            ].strip()

            if not variable:
                raise ValueError(
                    "Secret environment variable "
                    "is missing"
                )

            value = os.getenv(
                variable
            )

            if not value:
                raise ValueError(
                    "Provider secret is not "
                    "configured"
                )

            return value

        if secret_ref.startswith(
            self.VAULT_PREFIX
        ):
            # Circular import oluşmaması için
            # yalnızca gerektiğinde import edilir.
            from app.services.secret_vault import (
                SecretVaultService,
            )

            return (
                SecretVaultService()
                .resolve(secret_ref)
            )

        raise ValueError(
            "Unsupported secret reference"
        )
