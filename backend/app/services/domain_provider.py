import json
from typing import Any, Dict

from app.core.ids import generate_id
from app.core.time import utc_now_iso
from app.repositories.domain_provider import (
    DomainProviderConnectionRepository,
    DomainProviderZoneRepository,
)
from app.repositories.platform import (
    CompanyDomainRepository,
)
from app.providers.domain.factory import (
    DomainProviderFactory,
)


class DomainProviderService:

    def __init__(
        self,
        connection=None,
    ):
        self.connection_repo = (
            DomainProviderConnectionRepository(
                connection
            )
        )

        self.zone_repo = (
            DomainProviderZoneRepository(
                connection
            )
        )

        self.domain_repo = (
            CompanyDomainRepository(
                connection
            )
        )

        self.factory = (
            DomainProviderFactory()
        )


    # =====================================================
    # CONNECTIONS
    # =====================================================

    def list_connections(self):
        return self.connection_repo.list()


    def create_connection(
        self,
        data: Dict[str, Any],
    ):
        payload = dict(data)

        payload["name"] = (
            payload["name"].strip()
        )

        if not payload["name"]:
            raise ValueError(
                "Provider connection name "
                "is required"
            )

        provider = payload["provider"]

        if provider not in {
            "cloudflare",
            "manual",
            "other",
        }:
            raise ValueError(
                "Unsupported domain provider"
            )

        payload.update({
            "id": generate_id(
                "domain_provider"
            ),
            "status": "pending",
        })

        return self.connection_repo.insert(
            payload
        )


    def update_connection(
        self,
        connection_id: str,
        data: Dict[str, Any],
    ):
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

        payload = dict(data)

        if (
            "name" in payload
            and payload["name"] is not None
        ):
            payload["name"] = (
                payload["name"].strip()
            )

        if payload.get(
            "status"
        ) == "connected":
            payload["connected_at"] = (
                utc_now_iso()
            )

        result = (
            self.connection_repo.update(
                connection_id,
                payload,
            )
        )

        if result is None:
            raise LookupError(
                "Domain provider connection "
                "not found"
            )

        return result


    # =====================================================
    # CONNECTION TEST
    # =====================================================

    def verify_connection(
        self,
        connection_id: str,
    ):
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

        provider_name = connection[
            "provider"
        ]

        if provider_name != "cloudflare":
            raise ValueError(
                "Automatic verification "
                "is not supported for "
                "this provider"
            )

        try:
            provider = self.factory.create(
                connection
            )

            result = (
                provider.verify_credentials()
            )

        except Exception as exc:
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

            raise

        updated = (
            self.connection_repo.update(
                connection_id,
                {
                    "status": "connected",
                    "connected_at":
                        utc_now_iso(),
                    "last_check_at":
                        utc_now_iso(),
                    "last_error": None,
                },
            )
        )

        return {
            "connection": updated,
            "provider_result": result,
        }


    # =====================================================
    # ZONE
    # =====================================================

    def get_zone_for_domain(
        self,
        domain_id: str,
    ):
        zone = self.zone_repo.get_by_domain(
            domain_id
        )

        if zone is None:
            raise LookupError(
                "Domain provider zone "
                "not found"
            )

        return zone


    # =====================================================
    # AUTOMATIC DOMAIN PROVISIONING
    # =====================================================

    def provision_domain(
        self,
        domain_id: str,
        connection_id: str,
    ):
        domain = self.domain_repo.get_by_id(
            domain_id
        )

        if domain is None:
            raise LookupError(
                "Domain not found"
            )

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

        if connection["status"] != "connected":
            raise ValueError(
                "Domain provider connection "
                "is not connected"
            )

        if connection["provider"] != "cloudflare":
            raise ValueError(
                "Automatic DNS provisioning "
                "is currently supported only "
                "for Cloudflare"
            )

        provider = self.factory.create(
            connection
        )

        domain_name = (
            domain["domain"]
            .strip()
            .lower()
            .rstrip(".")
        )

        zone = provider.find_zone(
            domain_name
        )

        if zone is None:
            raise LookupError(
                "Cloudflare zone not found "
                "for domain"
            )

        zone_id = zone.get("id")
        zone_name = zone.get("name")

        if not zone_id or not zone_name:
            raise ValueError(
                "Cloudflare zone response "
                "is incomplete"
            )

        verification_token = domain.get(
            "verification_token"
        )

        if not verification_token:
            raise ValueError(
                "Domain verification token "
                "is missing"
            )

        txt_name = (
            "_axiom-verification."
            + domain_name
        )

        existing_records = (
            provider.list_dns_records(
                zone_id,
                name=txt_name,
                record_type="TXT",
            )
        )

        matching_record = None

        for record in existing_records:
            if (
                str(
                    record.get(
                        "content",
                        "",
                    )
                ).strip()
                == verification_token
            ):
                matching_record = record
                break

        if matching_record is None:
            matching_record = (
                provider.create_txt_record(
                    zone_id,
                    name=txt_name,
                    content=verification_token,
                )
            )

        existing_zone = (
            self.zone_repo.get_by_domain(
                domain_id
            )
        )

        zone_payload = {
            "external_zone_id":
                str(zone_id),

            "zone_name":
                str(zone_name),

            "status":
                "active",

            "last_sync_at":
                utc_now_iso(),

            "last_error":
                None,

            "nameservers_json":
                json.dumps(
                    zone.get(
                        "name_servers"
                    )
                    or []
                ),
        }

        if existing_zone:
            provider_zone = (
                self.zone_repo.update(
                    existing_zone["id"],
                    zone_payload,
                )
            )

        else:
            provider_zone = (
                self.zone_repo.insert({
                    "id": generate_id(
                        "domain_zone"
                    ),

                    "domain_id":
                        domain_id,

                    "connection_id":
                        connection_id,

                    **zone_payload,
                })
            )

        self.domain_repo.update(
            domain_id,
            {
                "verification_method":
                    "dns",

                "status":
                    "verifying",

                "verification_attempts":
                    0,

                "last_check_at":
                    None,

                "next_check_at":
                    None,

                "last_error":
                    None,
            },
        )

        return {
            "domain":
                self.domain_repo.get_by_id(
                    domain_id
                ),

            "provider_zone":
                provider_zone,

            "verification": {
                "type": "TXT",
                "name": txt_name,
                "content":
                    verification_token,

                "provider_record_id":
                    matching_record.get(
                        "id"
                    ),
            },
        }
