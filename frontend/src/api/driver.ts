import {
  clearDriverAuth,
  getDriverToken,
  setDriverAuth,
  type DriverIdentity,
} from "../driver/driverAuthStore";

import { config } from "../core/config";


async function driverRequest<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    auth?: boolean;
  } = {},
): Promise<T> {
  const {
    method = "GET",
    body,
    auth = true,
  } = options;

  const headers:
  Record<string, string> = {
    Accept: "application/json",
  };

  if (body !== undefined) {
    headers["Content-Type"] =
      "application/json";
  }

  if (auth) {
    const token =
      getDriverToken();

    if (token) {
      headers.Authorization =
        `Bearer ${token}`;
    }
  }

  const response = await fetch(
    `${config.apiBaseUrl}${path}`,
    {
      method,
      headers,
      body:
        body !== undefined
          ? JSON.stringify(body)
          : undefined,
    },
  );

  const payload =
    await response.json()
      .catch(() => null);

  if (!response.ok) {
    const message =
      payload?.message
      ?? payload?.detail
      ?? `HTTP ${response.status}`;

    throw new Error(
      String(message),
    );
  }

  return payload as T;
}


export interface DriverLoginPayload {
  company_slug: string;
  login_identifier: string;
  password: string;
}

export interface DriverLoginResponse {
  token: string;
  expires_at: string;
  session_id: string;
  driver: DriverIdentity;
}

export interface DriverOperation {
  id: string;

  source_type: string;
  source_id?: string | null;

  status: string;

  scheduled_start_at?: string | null;
  scheduled_end_at?: string | null;

  actual_start_at?: string | null;
  actual_end_at?: string | null;

  priority?: number | null;

  operation_note?: string | null;

  assignment_id?: string | null;
  assignment_status?: string | null;

  vehicle_id?: string | null;

  assigned_at?: string | null;
  accepted_at?: string | null;

  booking_id?: string | null;
  booking_code?: string | null;
  customer_note?: string | null;

  customer_id?: string | null;

  customer_first_name?: string | null;
  customer_last_name?: string | null;

  customer_phone?: string | null;
  customer_email?: string | null;

  customer_language?: string | null;

  booking_service_id?: string | null;

  service_type?: string | null;
  service_title?: string | null;
  service_description?: string | null;

  service_date?: string | null;
  start_time?: string | null;

  pax_adult?: number | null;
  pax_child?: number | null;
  pax_infant?: number | null;

  transfer_id?: string | null;

  pickup_location?: string | null;
  dropoff_location?: string | null;

  pickup_datetime?: string | null;

  flight_number?: string | null;
  flight_datetime?: string | null;

  pickup_sign?: string | null;

  pax?: number | null;

  luggage_count?: number | null;

  requested_vehicle_class?: string | null;

  special_request?: string | null;

  vehicle_plate?: string | null;
  vehicle_brand?: string | null;
  vehicle_model?: string | null;
  vehicle_model_year?: number | null;
  vehicle_class?: string | null;
  vehicle_capacity?: number | null;
}



export async function driverLogin(
  payload: DriverLoginPayload,
): Promise<DriverLoginResponse> {
  const result =
    await driverRequest<DriverLoginResponse>(
      "/driver/auth/login",
      {
        method: "POST",
        body: payload,
        auth: false,
      },
    );

  setDriverAuth(
    result.token,
    result.driver,
  );

  return result;
}


export function getDriverOperations():
Promise<DriverOperation[]> {
  return driverRequest(
    "/driver/operations",
  );
}


export function acceptDriverOperation(
  operationId: string,
) {
  return driverRequest(
    `/driver/operations/${encodeURIComponent(
      operationId,
    )}/accept`,
    {
      method: "POST",
    },
  );
}


export function startDriverOperation(
  operationId: string,
) {
  return driverRequest(
    `/driver/operations/${encodeURIComponent(
      operationId,
    )}/start`,
    {
      method: "POST",
    },
  );
}


export function completeDriverOperation(
  operationId: string,
) {
  return driverRequest(
    `/driver/operations/${encodeURIComponent(
      operationId,
    )}/complete`,
    {
      method: "POST",
    },
  );
}


export function driverLogout(): void {
  clearDriverAuth();
}


export type DriverIssueType =
  | "delay"
  | "passenger_missing"
  | "problem";


export function reportDriverIssue(
  operationId: string,
  issueType: DriverIssueType,
  description: string,
) {
  return driverRequest(
    `/driver/operations/${encodeURIComponent(
      operationId,
    )}/issue`,
    {
      method: "POST",

      body: {
        issue_type: issueType,
        description,
      },
    },
  );
}
