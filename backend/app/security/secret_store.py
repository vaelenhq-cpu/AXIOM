import base64
import hashlib
import os
import secrets

from Crypto.Cipher import AES


class SecretStore:

    KEY_ENV = "AXIOM_SECRET_MASTER_KEY"

    def _master_key(self) -> bytes:
        value = os.getenv(
            self.KEY_ENV,
            "",
        ).strip()

        if not value:
            raise RuntimeError(
                "AXIOM_SECRET_MASTER_KEY "
                "is not configured"
            )

        try:
            raw = base64.urlsafe_b64decode(
                value + "=" * (-len(value) % 4)
            )

        except Exception as exc:
            raise RuntimeError(
                "AXIOM_SECRET_MASTER_KEY "
                "is invalid"
            ) from exc

        if len(raw) != 32:
            raise RuntimeError(
                "AXIOM_SECRET_MASTER_KEY "
                "must decode to exactly 32 bytes"
            )

        return raw


    def encrypt(
        self,
        plaintext: str,
        *,
        company_id: str,
        secret_type: str,
    ) -> dict:

        if not plaintext:
            raise ValueError(
                "Secret cannot be empty"
            )

        nonce = secrets.token_bytes(12)

        cipher = AES.new(
            self._master_key(),
            AES.MODE_GCM,
            nonce=nonce,
            mac_len=16,
        )

        aad = (
            f"AXIOM|{company_id}|{secret_type}|v1"
        ).encode("utf-8")

        cipher.update(aad)

        ciphertext, tag = (
            cipher.encrypt_and_digest(
                plaintext.encode("utf-8")
            )
        )

        return {
            "ciphertext":
                base64.b64encode(
                    ciphertext
                ).decode("ascii"),

            "nonce":
                base64.b64encode(
                    nonce
                ).decode("ascii"),

            "auth_tag":
                base64.b64encode(
                    tag
                ).decode("ascii"),

            "key_version": 1,
        }


    def decrypt(
        self,
        *,
        ciphertext: str,
        nonce: str,
        auth_tag: str,
        company_id: str,
        secret_type: str,
        key_version: int = 1,
    ) -> str:

        if key_version != 1:
            raise ValueError(
                "Unsupported secret key version"
            )

        cipher = AES.new(
            self._master_key(),
            AES.MODE_GCM,
            nonce=base64.b64decode(
                nonce
            ),
            mac_len=16,
        )

        aad = (
            f"AXIOM|{company_id}|{secret_type}|v1"
        ).encode("utf-8")

        cipher.update(aad)

        plaintext = (
            cipher.decrypt_and_verify(
                base64.b64decode(
                    ciphertext
                ),
                base64.b64decode(
                    auth_tag
                ),
            )
        )

        return plaintext.decode("utf-8")


def generate_master_key() -> str:
    return base64.urlsafe_b64encode(
        secrets.token_bytes(32)
    ).decode("ascii")
