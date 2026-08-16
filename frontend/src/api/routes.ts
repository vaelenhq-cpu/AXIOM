import {
  apiRequest,
} from "./client";


export interface RouteItem {
  id: string;

  code?: string | null;
  name: string;

  origin_name: string;
  origin_code?: string | null;

  destination_name: string;
  destination_code?: string | null;

  distance_km?: number | null;

  estimated_duration_minutes?:
    number | null;

  active: number | boolean;

  created_at?: string | null;
  updated_at?: string | null;
}


export interface RouteCreatePayload {
  name: string;

  code?: string | null;

  origin_name: string;
  origin_code?: string | null;

  destination_name: string;
  destination_code?: string | null;

  distance_km?: number | null;

  estimated_duration_minutes?:
    number | null;
}


export function getRoutes():
Promise<RouteItem[]> {
  return apiRequest(
    "/api/routes"
  );
}


export function createRoute(
  payload: RouteCreatePayload,
):
Promise<RouteItem> {
  return apiRequest(
    "/api/routes",
    {
      method: "POST",
      body: payload,
    },
  );
}


export function getRoute(
  routeId: string,
):
Promise<RouteItem> {
  return apiRequest(
    `/api/routes/${encodeURIComponent(
      routeId
    )}`
  );
}
