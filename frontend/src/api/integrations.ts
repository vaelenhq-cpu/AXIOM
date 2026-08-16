import {
  apiRequest,
} from "./client";


export type IntegrationType =
  | "website"
  | "api"
  | "b2b"
  | "tour_operator"
  | "payment"
  | "messaging"
  | "other";


export type IntegrationStatus =
  | "inactive"
  | "active"
  | "error"
  | "disabled";


export type IntegrationSyncMode =
  | "manual"
  | "scheduled"
  | "webhook"
  | "realtime";


export interface Integration {
  id: string;

  provider: string;

  integration_type:
    IntegrationType;

  name: string;

  status:
    IntegrationStatus;

  base_url?: string | null;

  external_account_id?:
    string | null;

  secret_ref?: string | null;

  sync_mode:
    IntegrationSyncMode;

  last_sync_at?: string | null;
  last_success_at?: string | null;
  last_error_at?: string | null;

  settings_json?: string | null;

  created_at?: string | null;
  updated_at?: string | null;
}


export interface IntegrationCreatePayload {
  provider: string;

  integration_type:
    IntegrationType;

  name: string;

  base_url?: string | null;

  external_account_id?:
    string | null;

  secret_ref?: string | null;

  sync_mode?:
    IntegrationSyncMode;

  settings?:
    Record<string, unknown> | null;
}


export function getIntegrations():
Promise<Integration[]> {
  return apiRequest(
    "/api/integrations"
  );
}


export function createIntegration(
  payload: IntegrationCreatePayload,
):
Promise<Integration> {
  return apiRequest(
    "/api/integrations",
    {
      method: "POST",
      body: payload,
    },
  );
}


export function updateIntegrationStatus(
  integrationId: string,
  status: IntegrationStatus,
):
Promise<Integration> {
  return apiRequest(
    `/api/integrations/${encodeURIComponent(
      integrationId
    )}/status`,
    {
      method: "PATCH",

      body: {
        status,
      },
    },
  );
}
