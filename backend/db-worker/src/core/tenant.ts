import { ValidationError } from "./errors";

export type TenantContext = {
  companyId: string;
  userId?: string | null;
  role?: string | null;
};

export function requireTenant(
  tenant: TenantContext,
): TenantContext {
  if (!tenant?.companyId) {
    throw new ValidationError(
      "companyId is required",
    );
  }

  return tenant;
}
