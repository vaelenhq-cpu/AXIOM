import ipaddress
import socket
from urllib.parse import urlparse


def validate_public_https_url(
    url: str,
) -> None:
    """
    HTTPS URL'nin yalnızca public network
    hedeflerine gitmesine izin verir.

    SSRF koruması:
    - HTTP engellenir
    - credentials engellenir
    - private IP engellenir
    - loopback engellenir
    - link-local engellenir
    - multicast engellenir
    - reserved engellenir
    - unspecified engellenir
    """

    parsed = urlparse(url)

    if parsed.scheme != "https":
        raise ValueError(
            "URL must use HTTPS"
        )

    if not parsed.hostname:
        raise ValueError(
            "URL hostname missing"
        )

    if (
        parsed.username is not None
        or parsed.password is not None
    ):
        raise ValueError(
            "URL credentials are not allowed"
        )

    try:
        addresses = socket.getaddrinfo(
            parsed.hostname,
            parsed.port or 443,
            type=socket.SOCK_STREAM,
        )
    except socket.gaierror as exc:
        raise ValueError(
            "URL hostname could not be resolved"
        ) from exc

    if not addresses:
        raise ValueError(
            "URL hostname could not be resolved"
        )

    for entry in addresses:
        try:
            ip = ipaddress.ip_address(
                entry[4][0]
            )
        except ValueError as exc:
            raise ValueError(
                "Invalid target IP address"
            ) from exc

        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_multicast
            or ip.is_reserved
            or ip.is_unspecified
        ):
            raise ValueError(
                "Target network is not allowed"
            )


def validate_webhook_url(
    url: str,
) -> None:
    validate_public_https_url(url)
