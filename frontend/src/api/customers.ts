import {
  apiRequest,
} from "./client";


export interface Customer {
  id: string;

  first_name: string;
  last_name?: string | null;

  email?: string | null;
  phone?: string | null;

  nationality?: string | null;
  language?: string | null;

  notes?: string | null;

  created_at?: string | null;
  updated_at?: string | null;
}


export interface CustomerPayload {
  first_name: string;

  last_name?: string | null;

  email?: string | null;
  phone?: string | null;

  nationality?: string | null;
  language?: string | null;

  notes?: string | null;
}


export function getCustomers():
Promise<Customer[]> {
  return apiRequest(
    "/api/customers"
  );
}


export function searchCustomers(
  query: string,
):
Promise<Customer[]> {
  return apiRequest(
    `/api/customers/search?q=${encodeURIComponent(
      query
    )}`
  );
}


export function getCustomer(
  customerId: string,
):
Promise<Customer> {
  return apiRequest(
    `/api/customers/${encodeURIComponent(
      customerId
    )}`
  );
}


export function createCustomer(
  payload: CustomerPayload,
):
Promise<Customer> {
  return apiRequest(
    "/api/customers",
    {
      method: "POST",
      body: payload,
    },
  );
}


export function updateCustomer(
  customerId: string,
  payload:
    Partial<CustomerPayload>,
):
Promise<Customer> {
  return apiRequest(
    `/api/customers/${encodeURIComponent(
      customerId
    )}`,
    {
      method: "PATCH",
      body: payload,
    },
  );
}
