import hashlib
import secrets


def generate_token(size: int = 32) -> str:
    return secrets.token_urlsafe(size)


def hash_token(token: str) -> str:
    if not token:
        raise ValueError("Token is required")

    return hashlib.sha256(
        token.encode("utf-8")
    ).hexdigest()


def generate_api_key() -> tuple[str, str, str]:
    raw = "ax_" + secrets.token_urlsafe(32)
    prefix = raw[:12]
    hashed = hash_token(raw)

    return raw, prefix, hashed


def generate_public_booking_key() -> str:
    return "pbk_" + secrets.token_urlsafe(24)
