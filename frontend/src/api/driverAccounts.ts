import {
  apiRequest,
} from "./client";

export interface DriverAccountCreate {
  driver_id: string;
  login_identifier: string;
  password: string;
}

export function createDriverAccount(
  payload: DriverAccountCreate,
) {
  return apiRequest(
    "/api/platform/driver-accounts",
    {
      method: "POST",
      body: payload,
    },
  );
}
