import { apiRequest } from "./client";

export interface Driver {
  id: string;
  first_name: string;
  last_name?: string | null;
  phone?: string | null;
  email?: string | null;
  license_number?: string | null;
  license_class?: string | null;
  status: "available" | "busy" | "off_duty" | "inactive";
  active: number;
}

export interface DriverCreate {
  first_name: string;
  last_name?: string;
  phone?: string;
  email?: string;
  license_number?: string;
  license_class?: string;
  notes?: string;
}

export function getDrivers(): Promise<Driver[]> {
  return apiRequest("/api/drivers");
}

export function getAvailableDrivers(): Promise<Driver[]> {
  return apiRequest("/api/drivers/available");
}

export function createDriver(
  payload: DriverCreate,
): Promise<Driver> {
  return apiRequest("/api/drivers", {
    method: "POST",
    body: payload,
  });
}
