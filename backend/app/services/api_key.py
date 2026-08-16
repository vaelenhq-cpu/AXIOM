from typing import Iterable, Optional

from app.core.ids import generate_id
from app.core.tenant import get_user_id

from app.repositories.base import BaseRepository
from app.repositories.api_key import ApiKeyRepository

from app.security.tokens import (
    generate_api_key,
    hash_token,
)


class TenantApiKeyRepository(BaseRepository):
    table_name = "api_keys"


class ApiKeyService:
    def __init__(self, connection=None):
        self.repo = TenantApiKeyRepository(connection)
        self.lookup_repo = ApiKeyRepository(connection)

    def create(
        self,
        *,
        name: str,
        scopes: Optional[Iterable[str]] = None,
        expires_at: Optional[str] = None,
    ):
        raw, prefix, hashed = generate_api_key()

        scope_value = (
            ",".join(sorted(set(scopes)))
            if scopes
            else None
        )

        record = self.repo.insert({
            "id": generate_id("api_key"),
            "name": name.strip(),
            "key_prefix": prefix,
            "key_hash": hashed,
            "scopes": scope_value,
            "status": "active",
            "expires_at": expires_at,
            "created_by": get_user_id(),
        })

        return {
            "api_key": raw,
            "record": record,
        }

    def authenticate(
        self,
        raw_key: str,
    ):
        key_hash = hash_token(raw_key)

        record = self.lookup_repo.get_active_by_hash(
            key_hash
        )

        if record is None:
            raise PermissionError(
                "Invalid API key"
            )

        scopes = {
            scope.strip()
            for scope in (
                record.get("scopes") or ""
            ).split(",")
            if scope.strip()
        }

        return {
            "id": record["id"],
            "company_id": record["company_id"],
            "name": record["name"],
            "scopes": scopes,
        }
