import {
  apiRequest,
} from "./client";

export interface DashboardSummaryGroup {
  [key: string]:
    number | null;
}

export interface DashboardOverview {
  summary: {
    bookings:
      DashboardSummaryGroup;

    operations:
      DashboardSummaryGroup;

    drivers:
      DashboardSummaryGroup;

    vehicles:
      DashboardSummaryGroup;

    transfers:
      DashboardSummaryGroup;

    tours:
      DashboardSummaryGroup;
  };

  action_required:
    Record<string, unknown>[];

  recent_bookings:
    Record<string, unknown>[];

  upcoming_operations:
    Record<string, unknown>[];
}

export function getDashboard():
Promise<DashboardOverview> {
  return apiRequest(
    "/api/dashboard",
  );
}
