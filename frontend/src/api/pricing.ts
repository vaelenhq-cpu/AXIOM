import {
  apiRequest,
} from "./client";


export interface PricingRule {
  id: string;

  name: string;

  rule_type: string;

  route_id?: string | null;

  vehicle_class?: string | null;

  currency: string;

  base_price: number;

  priority: number;

  valid_from?: string | null;
  valid_until?: string | null;

  active: number | boolean;

  created_at?: string | null;
  updated_at?: string | null;
}


export interface RoutePricingRulePayload {
  name: string;

  route_id: string;

  base_price: number;

  vehicle_class?: string | null;

  currency?: string;

  priority?: number;

  valid_from?: string | null;
  valid_until?: string | null;
}


export interface RoutePriceResult {
  pricing_rule_id: string;

  currency: string;

  amount: number;
}


export function getPricingRules():
Promise<PricingRule[]> {
  return apiRequest(
    "/api/pricing"
  );
}


export function createRoutePricingRule(
  payload: RoutePricingRulePayload,
):
Promise<PricingRule> {
  return apiRequest(
    "/api/pricing/route",
    {
      method: "POST",
      body: payload,
    },
  );
}


export function calculateRoutePrice(
  routeId: string,
  vehicleClass?: string | null,
):
Promise<RoutePriceResult> {
  const params =
    new URLSearchParams();

  params.set(
    "route_id",
    routeId
  );

  if (vehicleClass) {
    params.set(
      "vehicle_class",
      vehicleClass
    );
  }

  return apiRequest(
    `/api/pricing/calculate/route?${params.toString()}`
  );
}
