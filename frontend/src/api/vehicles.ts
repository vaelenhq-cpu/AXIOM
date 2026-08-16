import { apiRequest } from "./client";

export interface Vehicle {
  id: string;
  plate: string;
  brand?: string | null;
  model?: string | null;
  model_year?: number | null;
  vehicle_class?: string | null;
  capacity: number;
  status:
    | "available"
    | "busy"
    | "maintenance"
    | "inactive";
  active: number;
}

export interface VehicleCreate {
  plate: string;
  brand?: string;
  model?: string;
  model_year?: number;
  vehicle_class?: string;
  capacity: number;
  notes?: string;
}

export function getVehicles(): Promise<Vehicle[]> {
  return apiRequest("/api/vehicles");
}

export function getAvailableVehicles(): Promise<Vehicle[]> {
  return apiRequest("/api/vehicles/available");
}

export function createVehicle(
  payload: VehicleCreate,
): Promise<Vehicle> {
  return apiRequest("/api/vehicles", {
    method: "POST",
    body: payload,
  });
}
