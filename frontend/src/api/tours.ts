import {
  apiRequest,
} from "./client";


export interface TourProduct {
  id: string;

  code?: string | null;

  name: string;

  description?: string | null;

  duration_minutes?: number | null;

  default_capacity?: number | null;

  active: number | boolean;

  created_at?: string | null;
  updated_at?: string | null;
}


export interface TourDeparture {
  id: string;

  tour_product_id: string;

  departure_date: string;

  departure_time?: string | null;

  capacity?: number | null;

  meeting_point?: string | null;

  status: string;

  tour_name?: string | null;
  tour_code?: string | null;

  created_at?: string | null;
  updated_at?: string | null;
}


export interface TourProductPayload {
  name: string;

  code?: string | null;

  description?: string | null;

  duration_minutes?: number | null;

  default_capacity?: number | null;
}


export interface TourDeparturePayload {
  tour_product_id: string;

  departure_date: string;

  departure_time?: string | null;

  capacity?: number | null;

  meeting_point?: string | null;
}


export function getTourProducts():
Promise<TourProduct[]> {
  return apiRequest(
    "/api/tours"
  );
}


export function createTourProduct(
  payload: TourProductPayload,
):
Promise<TourProduct> {
  return apiRequest(
    "/api/tours",
    {
      method: "POST",
      body: payload,
    },
  );
}


export function getTourDepartures():
Promise<TourDeparture[]> {
  return apiRequest(
    "/api/tours/departures"
  );
}


export function createTourDeparture(
  payload: TourDeparturePayload,
):
Promise<TourDeparture> {
  return apiRequest(
    "/api/tours/departures",
    {
      method: "POST",
      body: payload,
    },
  );
}
