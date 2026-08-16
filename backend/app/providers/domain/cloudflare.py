import json
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict, List

from app.security.network import (
    validate_public_https_url,
)


class CloudflareDomainProvider:

    API_BASE = (
        "https://api.cloudflare.com"
        "/client/v4"
    )

    def __init__(
        self,
        api_token: str,
    ):
        token = api_token.strip()

        if not token:
            raise ValueError(
                "Cloudflare API token is required"
            )

        self.api_token = token

    def _request(
        self,
        method: str,
        path: str,
        *,
        query: Dict[str, Any] | None = None,
        body: Dict[str, Any] | None = None,
    ) -> Dict[str, Any]:

        url = self.API_BASE + path

        if query:
            clean_query = {
                key: value
                for key, value in query.items()
                if value is not None
            }

            if clean_query:
                url += "?" + urllib.parse.urlencode(
                    clean_query
                )

        validate_public_https_url(url)

        headers = {
            "Authorization":
                f"Bearer {self.api_token}",
            "Accept":
                "application/json",
            "User-Agent":
                "AXIOM-Cloudflare/1.0",
        }

        data = None

        if body is not None:
            headers["Content-Type"] = (
                "application/json"
            )

            data = json.dumps(
                body
            ).encode("utf-8")

        request = urllib.request.Request(
            url,
            data=data,
            headers=headers,
            method=method,
        )

        try:
            with urllib.request.urlopen(
                request,
                timeout=12,
            ) as response:
                raw = response.read(
                    1024 * 1024
                )

        except urllib.error.HTTPError as exc:
            detail = ""

            try:
                detail = (
                    exc.read(8192)
                    .decode(
                        "utf-8",
                        errors="replace",
                    )
                )
            except Exception:
                pass

            raise ValueError(
                "Cloudflare API request failed "
                f"with HTTP {exc.code}"
                + (
                    f": {detail[:500]}"
                    if detail
                    else ""
                )
            ) from exc

        except urllib.error.URLError as exc:
            raise ValueError(
                "Cloudflare API could not "
                "be reached"
            ) from exc

        try:
            payload = json.loads(
                raw.decode("utf-8")
            )

        except (
            UnicodeDecodeError,
            json.JSONDecodeError,
        ) as exc:
            raise ValueError(
                "Cloudflare returned an "
                "invalid response"
            ) from exc

        if not isinstance(payload, dict):
            raise ValueError(
                "Invalid Cloudflare response"
            )

        if not payload.get("success"):
            errors = payload.get(
                "errors"
            ) or []

            messages = []

            for error in errors:
                if isinstance(error, dict):
                    message = error.get(
                        "message"
                    )

                    if message:
                        messages.append(
                            str(message)
                        )

            raise ValueError(
                "Cloudflare API error"
                + (
                    ": " + "; ".join(messages)
                    if messages
                    else ""
                )
            )

        return payload

    def verify_credentials(
        self,
    ) -> Dict[str, Any]:

        payload = self._request(
            "GET",
            "/user/tokens/verify",
        )

        result = payload.get(
            "result"
        )

        if not isinstance(result, dict):
            raise ValueError(
                "Cloudflare token verification "
                "returned no result"
            )

        if result.get("status") != "active":
            raise ValueError(
                "Cloudflare API token "
                "is not active"
            )

        return result

    def find_zone(
        self,
        domain: str,
    ) -> Dict[str, Any] | None:

        domain = (
            domain
            .strip()
            .lower()
            .rstrip(".")
        )

        if not domain:
            raise ValueError(
                "Domain is required"
            )

        parts = domain.split(".")

        if len(parts) < 2:
            raise ValueError(
                "Invalid domain"
            )

        # Domain'in kendisinden başlayarak
        # üst zone'lara doğru ilerle.
        #
        # booking.example.com
        # -> booking.example.com
        # -> example.com
        #
        # Cloudflare yalnızca gerçekten mevcut
        # zone için sonuç döndürür.
        candidates = [
            ".".join(parts[index:])
            for index in range(
                0,
                len(parts) - 1,
            )
        ]

        for candidate in candidates:

            payload = self._request(
                "GET",
                "/zones",
                query={
                    "name": candidate,
                    "per_page": 50,
                },
            )

            result = payload.get(
                "result"
            )

            if not isinstance(result, list):
                continue

            for zone in result:
                if (
                    isinstance(zone, dict)
                    and str(
                        zone.get(
                            "name",
                            "",
                        )
                    ).lower()
                    == candidate
                ):
                    return zone

        return None

    def list_dns_records(
        self,
        zone_id: str,
        *,
        name: str | None = None,
        record_type: str | None = None,
    ) -> List[Dict[str, Any]]:

        payload = self._request(
            "GET",
            (
                f"/zones/{zone_id}"
                "/dns_records"
            ),
            query={
                "name": name,
                "type": record_type,
                "per_page": 100,
            },
        )

        result = payload.get(
            "result"
        )

        if not isinstance(result, list):
            raise ValueError(
                "Cloudflare DNS record "
                "response is invalid"
            )

        return [
            item
            for item in result
            if isinstance(item, dict)
        ]

    def create_txt_record(
        self,
        zone_id: str,
        *,
        name: str,
        content: str,
    ) -> Dict[str, Any]:

        payload = self._request(
            "POST",
            (
                f"/zones/{zone_id}"
                "/dns_records"
            ),
            body={
                "type": "TXT",
                "name": name,
                "content": content,
                "ttl": 60,
            },
        )

        result = payload.get(
            "result"
        )

        if not isinstance(result, dict):
            raise ValueError(
                "Cloudflare DNS creation "
                "returned no record"
            )

        return result
