import {
  apiRequest,
} from "./client";


export interface BookingListItem {
  id: string;

  booking_code: string;

  status: string;

  source: string;

  source_provider?: string | null;

  external_reference?: string | null;

  currency: string;

  total_amount: number;

  created_at: string;

  booked_at?: string | null;

  customer_first_name?: string | null;
  customer_last_name?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;

  service_type?:
    | "transfer"
    | "tour"
    | "other"
    | null;

  service_title?: string | null;

  service_date?: string | null;
  start_time?: string | null;

  pax_total?: number | null;

  pickup_location?: string | null;
  dropoff_location?: string | null;

  pickup_datetime?: string | null;

  flight_number?: string | null;

  requested_vehicle_class?: string | null;

  tour_name?: string | null;

  departure_date?: string | null;
  departure_time?: string | null;
}


export interface BookingCustomer {
  id?: string | null;

  first_name?: string | null;
  last_name?: string | null;

  email?: string | null;
  phone?: string | null;

  nationality?: string | null;
  language?: string | null;

  notes?: string | null;
}


export interface TransferDetail {
  id: string;

  pickup_location: string;
  dropoff_location: string;

  pickup_datetime?: string | null;

  flight_number?: string | null;
  flight_datetime?: string | null;

  pickup_sign?: string | null;

  pax?: number | null;
  luggage_count?: number | null;

  requested_vehicle_class?:
    string | null;

  special_request?:
    string | null;
}


export interface OperationDetail {
  id: string;

  status: string;

  scheduled_start_at?:
    string | null;

  driver_id?: string | null;
  vehicle_id?: string | null;

  driver_first_name?:
    string | null;

  driver_last_name?:
    string | null;

  vehicle_plate?:
    string | null;

  vehicle_brand?:
    string | null;

  vehicle_model?:
    string | null;

  assignment_status?:
    string | null;
}


export interface TourDetail {
  id: string;

  tour_departure_id: string;

  adult_count: number;
  child_count: number;
  infant_count: number;

  pickup_required: number | boolean;

  pickup_location?: string | null;

  departure_date?: string | null;
  departure_time?: string | null;

  meeting_point?: string | null;

  tour_product_id?: string | null;

  tour_name?: string | null;
  tour_code?: string | null;
}


export interface BookingServiceItem {
  id: string;

  booking_id: string;

  service_type:
    | "transfer"
    | "tour"
    | "other";

  status: string;

  title: string;

  description?: string | null;

  service_date?: string | null;

  start_time?: string | null;

  pax_adult: number;
  pax_child: number;
  pax_infant: number;

  quantity: number;

  unit_price: number;
  total_price: number;

  transfer?: TransferDetail | null;

  operation?: OperationDetail | null;

  tour?: TourDetail | null;
}


export interface BookingDetail {
  id: string;

  company_id: string;

  customer_id?: string | null;

  booking_code: string;

  status: string;

  source: string;

  source_provider?: string | null;

  external_reference?: string | null;

  currency: string;

  subtotal_amount: number;

  discount_amount: number;

  tax_amount: number;

  total_amount: number;

  customer_note?: string | null;

  internal_note?: string | null;

  booked_at?: string | null;

  confirmed_at?: string | null;

  cancelled_at?: string | null;

  created_at: string;
  updated_at: string;

  customer: BookingCustomer;

  services: BookingServiceItem[];
}


export function getBookings(
  limit = 100,
): Promise<BookingListItem[]> {
  return apiRequest(
    `/api/bookings?limit=${limit}`,
  );
}


export function getBooking(
  bookingId: string,
): Promise<BookingDetail> {
  return apiRequest(
    `/api/bookings/${encodeURIComponent(
      bookingId,
    )}`,
  );
}


export function updateBookingStatus(
  bookingId: string,
  status: string,
): Promise<BookingDetail> {
  return apiRequest(
    `/api/bookings/${encodeURIComponent(
      bookingId,
    )}/status`,
    {
      method: "PATCH",

      body: {
        status,
      },
    },
  );
}
