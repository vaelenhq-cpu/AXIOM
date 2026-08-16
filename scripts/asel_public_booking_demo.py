#!/usr/bin/env python3

import json
import sys
import time
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"

sys.path.insert(
    0,
    str(BACKEND),
)


from app.core.database import create_connection
from app.core.tenant import clear_tenant, set_tenant
from app.services.platform import PlatformService


COMPANY_SLUG = "aselviptur"
ALLOWED_DOMAIN = "aselviptur.com"

API_URL = "http://127.0.0.1:8000/public/booking"


def load_company():
    connection = create_connection()

    try:
        row = connection.execute(
            """
            SELECT
                c.id AS company_id,
                c.name,
                c.slug,

                u.id AS user_id,
                u.email,
                u.role

            FROM companies c

            JOIN company_users u
              ON u.company_id = c.id

            WHERE c.slug = ?
              AND u.role = 'owner'
              AND u.status = 'active'

            LIMIT 1
            """,
            (COMPANY_SLUG,),
        ).fetchone()

        if row is None:
            raise RuntimeError(
                "ASELVIPTUR company/owner not found"
            )

        return dict(row)

    finally:
        connection.close()


def create_public_key(company):
    set_tenant(
        company_id=company["company_id"],
        user_id=company["user_id"],
        role=company["role"],
    )

    try:
        result = (
            PlatformService()
            .create_public_booking_key(
                name="ASELVIPTUR Website",
                allowed_domain=ALLOWED_DOMAIN,
            )
        )

        return result["public_key"]

    finally:
        clear_tenant()


def send_booking(public_key):
    stamp = int(time.time())

    request_id = f"ASEL-WEB-{stamp}"
    booking_code = f"ASL-{stamp}"

    payload = {
        "request_id": request_id,

        "booking": {
            "booking_code": booking_code,

            "source": "website",

            "currency": "TRY",

            "customer": {
                "first_name": "Mehmet",
                "last_name": "Yılmaz",

                "email": "mehmet@example.com",

                "phone": "+905551112233",

                "nationality": "TR",

                "language": "tr",

                "notes": (
                    "ASELVIPTUR web sitesi "
                    "rezervasyon testi"
                ),
            },

            "customer_note": (
                "Uçaktan indikten sonra "
                "WhatsApp üzerinden iletişim."
            ),

            "services": [
                {
                    "service_type": "transfer",

                    "title": (
                        "Antalya Havalimanı → Belek"
                    ),

                    "description": (
                        "ASELVIPTUR website "
                        "transfer booking"
                    ),

                    "service_date": "2026-08-18",

                    "start_time": "14:30",

                    "pax_adult": 2,
                    "pax_child": 0,
                    "pax_infant": 0,

                    "quantity": 1,

                    "unit_price": 2500,
                    "total_price": 2500,

                    "transfer": {
                        "pickup_location": (
                            "Antalya Havalimanı"
                        ),

                        "dropoff_location": (
                            "Belek"
                        ),

                        "pickup_datetime": (
                            "2026-08-18T14:30:00+03:00"
                        ),

                        "flight_number": "TK2410",

                        "flight_datetime": (
                            "2026-08-18T14:05:00+03:00"
                        ),

                        "pickup_sign": (
                            "MEHMET YILMAZ"
                        ),

                        "pax": 2,

                        "luggage_count": 2,

                        "requested_vehicle_class": (
                            "VIP Minivan"
                        ),

                        "special_request": (
                            "Çocuk koltuğu gerekmiyor."
                        ),
                    },
                }
            ],
        },
    }

    request = urllib.request.Request(
        API_URL,

        data=json.dumps(
            payload,
            ensure_ascii=False,
        ).encode("utf-8"),

        headers={
            "Content-Type":
                "application/json",

            "Accept":
                "application/json",

            "Origin":
                "https://aselviptur.com",

            "X-AXIOM-Booking-Key":
                public_key,
        },

        method="POST",
    )

    with urllib.request.urlopen(
        request,
        timeout=10,
    ) as response:

        body = json.loads(
            response.read()
        )

        return (
            response.status,
            request_id,
            booking_code,
            body,
        )


def main():
    company = load_company()

    print()
    print("ASELVIPTUR")
    print("===========")
    print(
        "Company:",
        company["name"],
    )
    print(
        "Slug   :",
        company["slug"],
    )
    print(
        "Owner  :",
        company["email"],
    )

    public_key = create_public_key(
        company
    )

    print()
    print("Public booking key created")
    print("--------------------------")
    print(public_key)

    (
        status,
        request_id,
        booking_code,
        result,
    ) = send_booking(public_key)

    print()
    print("WEBSITE BOOKING RESULT")
    print("----------------------")
    print(
        "HTTP        :",
        status,
    )
    print(
        "Request ID  :",
        request_id,
    )
    print(
        "Booking Code:",
        booking_code,
    )

    print()
    print(
        json.dumps(
            result,
            indent=2,
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
