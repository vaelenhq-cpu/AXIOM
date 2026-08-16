from app.core.ids import generate_id
from app.core.tenant import get_company_id
from app.repositories.secret import (
    EncryptedSecretRepository,
)
from app.security.secret_store import (
    SecretStore,
)


class SecretVaultService:

    REF_PREFIX = "vault:"

    def __init__(
        self,
        connection=None,
    ):
        self.repo = (
            EncryptedSecretRepository(
                connection
            )
        )

        self.crypto = SecretStore()


    def store(
        self,
        *,
        secret_type: str,
        plaintext: str,
    ) -> str:

        company_id = get_company_id()

        encrypted = self.crypto.encrypt(
            plaintext,
            company_id=company_id,
            secret_type=secret_type,
        )

        record = self.repo.insert({
            "id": generate_id(
                "secret"
            ),
            "secret_type":
                secret_type,
            **encrypted,
        })

        return (
            self.REF_PREFIX
            + record["id"]
        )


    def resolve(
        self,
        secret_ref: str,
    ) -> str:

        if not secret_ref.startswith(
            self.REF_PREFIX
        ):
            raise ValueError(
                "Invalid vault secret reference"
            )

        secret_id = secret_ref[
            len(self.REF_PREFIX):
        ]

        record = self.repo.get_secret(
            secret_id
        )

        if record is None:
            raise LookupError(
                "Secret not found"
            )

        return self.crypto.decrypt(
            ciphertext=
                record["ciphertext"],

            nonce=
                record["nonce"],

            auth_tag=
                record["auth_tag"],

            company_id=
                record["company_id"],

            secret_type=
                record["secret_type"],

            key_version=int(
                record["key_version"]
            ),
        )
