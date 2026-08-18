import { apiRequest } from "./client";

export interface BookingKey {
  id: string;
  company_id: string;
  public_key: string;
  name?: string | null;
  allowed_domain?: string | null;
  active: number;
  created_at: string;
  revoked_at?: string | null;
}

export function getBookingKeys():
Promise<BookingKey[]> {
  return apiRequest(
    "/api/platform/booking-keys",
  );
}

export function createBookingKey(
  payload: {
    name?: string | null;
    allowed_domain?: string | null;
  },
): Promise<BookingKey> {
  return apiRequest(
    "/api/platform/booking-keys",
    {
      method: "POST",
      body: payload,
    },
  );
}
