import {
  apiRequest,
} from "./client";


export interface DispatchOperation {
  id: string;

  source_type: string;

  status: string;

  scheduled_start_at?: string | null;

  priority: number;

  booking_id?: string | null;
  booking_code?: string | null;
  booking_status?: string | null;
  booking_source?: string | null;

  customer_first_name?: string | null;
  customer_last_name?: string | null;
  customer_phone?: string | null;

  service_title?: string | null;

  pickup_location?: string | null;
  dropoff_location?: string | null;
  pickup_datetime?: string | null;

  flight_number?: string | null;

  pax?: number | null;

  luggage_count?: number | null;

  requested_vehicle_class?: string | null;

  assignment_id?: string | null;
  assignment_status?: string | null;

  driver_id?: string | null;
  driver_first_name?: string | null;
  driver_last_name?: string | null;

  vehicle_id?: string | null;
  vehicle_plate?: string | null;
  vehicle_brand?: string | null;
  vehicle_model?: string | null;
}


export interface AvailableDriver {
  id: string;
  first_name: string;
  last_name?: string | null;
  status: string;
}


export interface AvailableVehicle {
  id: string;
  plate: string;
  brand?: string | null;
  model?: string | null;
  vehicle_class?: string | null;
  status: string;
}


export function getOperations():
Promise<DispatchOperation[]> {
  return apiRequest(
    "/api/operations",
  );
}


export function getAvailableDrivers():
Promise<AvailableDriver[]> {
  return apiRequest(
    "/api/drivers/available",
  );
}


export function getAvailableVehicles():
Promise<AvailableVehicle[]> {
  return apiRequest(
    "/api/vehicles/available",
  );
}


export function assignOperation(
  operationId: string,
  driverId: string,
  vehicleId: string,
) {
  return apiRequest(
    `/api/operations/${encodeURIComponent(
      operationId,
    )}/assign`,
    {
      method: "POST",

      body: {
        driver_id: driverId,
        vehicle_id: vehicleId,
      },
    },
  );
}


export interface ReassignOperationPayload {
  driver_id?: string | null;
  vehicle_id?: string | null;

  reason: string;

  mark_previous_vehicle_maintenance:
    boolean;
}


export function reassignOperation(
  operationId: string,
  payload: ReassignOperationPayload,
) {
  return apiRequest(
    `/api/operations/${encodeURIComponent(
      operationId,
    )}/reassign`,
    {
      method: "POST",
      body: payload,
    },
  );
}
