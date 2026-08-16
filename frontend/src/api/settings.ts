import { apiRequest } from "./client";


export interface CompanyProfile {
  id: string;
  name: string;
  slug: string;
  legal_name: string | null;
  tax_number: string | null;
  country_code: string;
  timezone: string;
  default_currency: string;
  status: string;
  created_at: string;
  updated_at: string;
}


export interface CompanyUpdate {
  name?: string;
  legal_name?: string | null;
  tax_number?: string | null;
  country_code?: string;
  timezone?: string;
  default_currency?: string;
}


export interface CompanySettings {
  id: string;
  company_id: string;

  booking_prefix: string;

  auto_confirm_bookings: number | boolean;
  auto_create_operations: number | boolean;
  require_driver_acceptance: number | boolean;

  default_language: string;
  default_timezone: string;
  default_currency: string;

  notification_email: string | null;
  notification_phone: string | null;

  settings_json: string | null;

  created_at: string;
  updated_at: string;
}


export interface CompanySettingsUpdate {
  booking_prefix?: string;

  auto_confirm_bookings?: boolean;
  auto_create_operations?: boolean;
  require_driver_acceptance?: boolean;

  default_language?: string;
  default_timezone?: string;
  default_currency?: string;

  notification_email?: string | null;
  notification_phone?: string | null;
}


export interface CompanyDomain {
  id: string;
  company_id: string;

  domain: string;
  domain_type:
    | "website"
    | "booking"
    | "api"
    | "custom";

  status:
    | "pending"
    | "verifying"
    | "verified"
    | "failed"
    | "disabled";

  verification_token: string | null;
  verified_at: string | null;

  created_at: string;
  updated_at: string;
}


export interface DomainCreate {
  domain: string;

  domain_type:
    | "website"
    | "booking"
    | "api"
    | "custom";
}


export function getCompany() {
  return apiRequest<CompanyProfile>(
    "/api/company",
  );
}


export function updateCompany(
  payload: CompanyUpdate,
) {
  return apiRequest<CompanyProfile>(
    "/api/company",
    {
      method: "PATCH",
      body: payload,
    },
  );
}


export function getCompanySettings() {
  return apiRequest<CompanySettings>(
    "/api/settings",
  );
}


export function updateCompanySettings(
  payload: CompanySettingsUpdate,
) {
  return apiRequest<CompanySettings>(
    "/api/settings",
    {
      method: "PATCH",
      body: payload,
    },
  );
}


export function getCompanyDomains() {
  return apiRequest<CompanyDomain[]>(
    "/api/platform/domains",
  );
}


export function createCompanyDomain(
  payload: DomainCreate,
) {
  return apiRequest<CompanyDomain>(
    "/api/platform/domains",
    {
      method: "POST",
      body: payload,
    },
  );
}


export function verifyCompanyDomain(
  domainId: string,
) {
  return apiRequest<CompanyDomain>(
    `/api/platform/domains/${domainId}/verify`,
    {
      method: "POST",
    },
  );
}
