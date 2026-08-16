import base64
import json
import hashlib
import secrets
import urllib.error
import urllib.parse
import urllib.request

from app.core.config import settings


class CloudflareOAuth:

    AUTHORIZATION_URL = (
        "https://dash.cloudflare.com"
        "/oauth2/auth"
    )

    TOKEN_URL = (
        "https://dash.cloudflare.com"
        "/oauth2/token"
    )

    REVOKE_URL = (
        "https://dash.cloudflare.com"
        "/oauth2/revoke"
    )

    USERINFO_URL = (
        "https://dash.cloudflare.com"
        "/oauth2/userinfo"
    )

    def __init__(self):
        self.client_id = (
            settings
            .CLOUDFLARE_OAUTH_CLIENT_ID
        )

        self.client_secret = (
            settings
            .CLOUDFLARE_OAUTH_CLIENT_SECRET
        )

        self.redirect_uri = (
            settings
            .CLOUDFLARE_OAUTH_REDIRECT_URI
        )

        self.scopes = [
            scope.strip()
            for scope in (
                settings
                .CLOUDFLARE_OAUTH_SCOPES
            ).split()
            if scope.strip()
        ]

    def validate_configuration(
        self,
    ) -> None:
        if not self.client_id:
            raise ValueError(
                "Cloudflare OAuth client ID "
                "is not configured"
            )

        if not self.client_secret:
            raise ValueError(
                "Cloudflare OAuth client secret "
                "is not configured"
            )

        if not self.redirect_uri:
            raise ValueError(
                "Cloudflare OAuth redirect URI "
                "is not configured"
            )

        if not self.scopes:
            raise ValueError(
                "Cloudflare OAuth scopes "
                "are not configured"
            )

    def generate_state(self) -> str:
        return secrets.token_urlsafe(32)

    def hash_state(
        self,
        state: str,
    ) -> str:
        return hashlib.sha256(
            state.encode("utf-8")
        ).hexdigest()

    def authorization_url(
        self,
        state: str,
    ) -> str:
        self.validate_configuration()

        query = urllib.parse.urlencode({
            "response_type": "code",
            "client_id": self.client_id,
            "redirect_uri":
                self.redirect_uri,
            "scope":
                " ".join(self.scopes),
            "state": state,
        })

        return (
            self.AUTHORIZATION_URL
            + "?"
            + query
        )

    def exchange_code(
        self,
        code: str,
    ) -> dict:
        self.validate_configuration()

        data = urllib.parse.urlencode({
            "grant_type":
                "authorization_code",

            "code":
                code,

            "redirect_uri":
                self.redirect_uri,

            "client_id":
                self.client_id,

            "client_secret":
                self.client_secret,
        }).encode("utf-8")

        request = urllib.request.Request(
            self.TOKEN_URL,
            data=data,
            headers={
                "Content-Type":
                    "application/x-www-form-urlencoded",

                "Accept":
                    "application/json",

                "User-Agent":
                    "AXIOM-Cloudflare-OAuth/1.0",
            },
            method="POST",
        )

        try:
            with urllib.request.urlopen(
                request,
                timeout=15,
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
                "Cloudflare OAuth token "
                f"exchange failed HTTP {exc.code}"
                + (
                    f": {detail[:500]}"
                    if detail
                    else ""
                )
            ) from exc

        except urllib.error.URLError as exc:
            raise ValueError(
                "Cloudflare OAuth token "
                "endpoint could not be reached"
            ) from exc

        try:
            payload = json.loads(
                raw.decode("utf-8")
            )

        except Exception as exc:
            raise ValueError(
                "Cloudflare OAuth token "
                "response is invalid"
            ) from exc

        if not isinstance(payload, dict):
            raise ValueError(
                "Cloudflare OAuth token "
                "response is invalid"
            )

        if not payload.get(
            "access_token"
        ):
            raise ValueError(
                "Cloudflare OAuth access token "
                "was not returned"
            )

        return payload
