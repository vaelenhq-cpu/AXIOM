import secrets
import time


PREFIXES = {
    "company": "cmp",
    "company_settings": "cfg",
    "role": "rol",
    "user": "usr",
    "customer": "cus",
    "booking": "bkg",
    "booking_event": "bev",
    "service": "svc",
    "passenger": "pax",
    "transfer": "trf",
    "tour_product": "tur",
    "tour_departure": "tdp",
    "tour_booking": "tbk",
    "driver": "drv",
    "driver_account": "dac",
    "vehicle": "veh",
    "operation": "op",
    "operation_event": "oev",
    "assignment": "asn",
    "guide": "gde",
    "route": "rte",
    "pricing": "prc",
    "payment": "pay",
    "finance": "fin",
    "integration": "int",
    "integration_event": "iev",
    "integration_mapping": "map",
    "external_booking": "ext",
    "notification": "ntf",
    "audit": "aud",
    "session": "ses",
    "driver_session": "dss",
    "api_key": "key",
    "public_booking_key": "pbk",
    "public_booking_request": "pbr",
    "domain": "dom",
    "attachment": "att",
    "outbox": "evt",
}


def generate_id(entity: str) -> str:
    prefix = PREFIXES.get(entity)

    if not prefix:
        raise ValueError(f"Unknown AXIOM entity type: {entity}")

    timestamp = int(time.time() * 1000)
    random_part = secrets.token_hex(6)

    return f"{prefix}_{timestamp:x}_{random_part}"
