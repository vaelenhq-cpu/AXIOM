import { config } from "../core/config";

export interface PublicBookingConfig {
  company: {
    id: string;
    name: string;
    slug: string;
    default_currency: string;
    country_code?: string | null;
  };
  public_key: string;
}

export interface PublicBookingPayload {
  request_id: string;
  booking: {
    bookingCode: string;
    customer: {
      firstName: string;
      lastName?: string | null;
      email?: string | null;
      phone?: string | null;
      nationality?: string | null;
      language?: string | null;
      notes?: string | null;
    };
    services: Array<{
      serviceType: "transfer" | "tour" | "other";
      title: string;
      description?: string | null;
      serviceDate?: string | null;
      startTime?: string | null;
      paxAdult?: number;
      paxChild?: number;
      paxInfant?: number;
      quantity?: number;
      unitPrice?: number;
      totalPrice?: number;
      transfer?: {
        pickupLocation: string;
        pickupLatitude?: number | null;
        pickupLongitude?: number | null;
        pickupPlaceId?: string | null;
        dropoffLocation: string;
        dropoffLatitude?: number | null;
        dropoffLongitude?: number | null;
        dropoffPlaceId?: string | null;
        pickupDatetime?: string | null;
        flightNumber?: string | null;
        flightDatetime?: string | null;
        pickupSign?: string | null;
        pax?: number;
        luggageCount?: number;
        requestedVehicleClass?: string | null;
        specialRequest?: string | null;
      };
    }>;
    source?: string;
    currency?: string;
    customerNote?: string | null;
  };
}

async function publicRequest<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    publicKey?: string;
  } = {},
): Promise<T> {
  const {
    method = "GET",
    body,
    publicKey,
  } = options;

  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (publicKey) {
    headers["X-Axiom-Booking-Key"] = publicKey;
  }

  const response = await fetch(
    `${config.apiBaseUrl}${path}`,
    {
      method,
      headers,
      body:
        body === undefined
          ? undefined
          : JSON.stringify(body),
    },
  );

  const payload =
    await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      payload?.detail
      ?? payload?.message
      ?? `HTTP ${response.status}`;

    throw new Error(String(message));
  }

  return payload as T;
}

export function getPublicBookingConfig(
  companySlug: string,
): Promise<PublicBookingConfig> {
  return publicRequest(
    `/public/booking/config?company_slug=${encodeURIComponent(companySlug)}`,
  );
}

export function createPublicBooking(
  publicKey: string,
  payload: PublicBookingPayload,
) {
  return publicRequest<{
    request_id: string;
    booking: Record<string, unknown>;
    customer: Record<string, unknown>;
    services: Record<string, unknown>[];
  }>(
    "/public/booking",
    {
      method: "POST",
      body: payload,
      publicKey,
    },
  );
}
