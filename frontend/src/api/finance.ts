import {
  apiRequest,
} from "./client";


export interface Payment {
  id: string;

  booking_id: string;

  provider?: string | null;

  external_payment_id?:
    string | null;

  payment_method?:
    string | null;

  status: string;

  currency: string;

  amount: number;

  paid_at?: string | null;
  refunded_at?: string | null;

  notes?: string | null;

  created_at?: string | null;
  updated_at?: string | null;
}


export interface FinanceTransaction {
  id: string;

  booking_id?: string | null;
  payment_id?: string | null;

  transaction_type:
    | "income"
    | "expense"
    | "commission"
    | "refund"
    | "adjustment";

  category?: string | null;

  currency: string;

  amount: number;

  description?: string | null;

  transaction_date: string;

  created_at?: string | null;
}


export interface PaymentCreatePayload {
  booking_id: string;

  amount: number;

  currency?: string;

  payment_method?:
    | "cash"
    | "card"
    | "bank_transfer"
    | "online"
    | "virtual_pos"
    | "other"
    | null;

  provider?: string | null;

  external_payment_id?:
    string | null;

  notes?: string | null;
}


export interface FinanceTransactionPayload {
  transaction_type:
    | "income"
    | "expense"
    | "commission"
    | "refund"
    | "adjustment";

  amount: number;

  currency?: string;

  booking_id?: string | null;
  payment_id?: string | null;

  category?: string | null;

  description?: string | null;
}


export function getPayments():
Promise<Payment[]> {
  return apiRequest(
    "/api/finance/payments"
  );
}


export function createPayment(
  payload: PaymentCreatePayload,
):
Promise<Payment> {
  return apiRequest(
    "/api/finance/payments",
    {
      method: "POST",
      body: payload,
    },
  );
}


export function getFinanceTransactions():
Promise<FinanceTransaction[]> {
  return apiRequest(
    "/api/finance/transactions"
  );
}


export function createFinanceTransaction(
  payload:
    FinanceTransactionPayload,
):
Promise<FinanceTransaction> {
  return apiRequest(
    "/api/finance/transactions",
    {
      method: "POST",
      body: payload,
    },
  );
}
