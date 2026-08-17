import {
  atomic,
  first,
} from "../core/db";
import {
  generateId,
} from "../core/ids";
import {
  nowIso,
} from "../core/time";
import {
  NotFoundError,
  ValidationError,
} from "../core/errors";
import {
  requireTenant,
  TenantContext,
} from "../core/tenant";

type BookingStatusInput = {
  tenant: TenantContext;
  bookingId: string;
  newStatus: string;
};

const transitions: Record<string, Set<string>> = {
  draft: new Set([
    "pending",
    "confirmed",
    "cancelled",
  ]),
  pending: new Set([
    "confirmed",
    "cancelled",
  ]),
  confirmed: new Set([
    "cancelled",
  ]),
  completed: new Set(),
  cancelled: new Set(),
};

export async function changeBookingStatus(
  db: D1Database,
  input: BookingStatusInput,
) {
  const tenant = requireTenant(input.tenant);

  const booking = await first<any>(
    db,
    `
    SELECT *
    FROM bookings
    WHERE id = ?
      AND company_id = ?
    LIMIT 1
    `,
    [
      input.bookingId,
      tenant.companyId,
    ],
  );

  if (!booking) {
    throw new NotFoundError(
      "Booking not found",
    );
  }

  const currentStatus = booking.status;

  if (currentStatus === input.newStatus) {
    return booking;
  }

  const allowed =
    transitions[currentStatus] ?? new Set();

  if (!allowed.has(input.newStatus)) {
    throw new ValidationError(
      `Invalid booking transition: ${currentStatus} -> ${input.newStatus}`,
    );
  }

  const now = nowIso();

  const statements: {
    sql: string;
    params?: unknown[];
  }[] = [];

  const confirmedAt =
    input.newStatus === "confirmed"
      ? now
      : booking.confirmed_at;

  const cancelledAt =
    input.newStatus === "cancelled"
      ? now
      : booking.cancelled_at;

  statements.push({
    sql: `
      UPDATE bookings
      SET status = ?,
          confirmed_at = ?,
          cancelled_at = ?,
          updated_at = ?
      WHERE id = ?
        AND company_id = ?
    `,
    params: [
      input.newStatus,
      confirmedAt,
      cancelledAt,
      now,
      input.bookingId,
      tenant.companyId,
    ],
  });

  statements.push({
    sql: `
      INSERT INTO booking_events (
        id,
        company_id,
        booking_id,
        event_type,
        old_value,
        new_value,
        description,
        actor_user_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    params: [
      generateId("booking_event"),
      tenant.companyId,
      input.bookingId,
      "status_changed",
      currentStatus,
      input.newStatus,
      `Booking status changed: ${currentStatus} -> ${input.newStatus}`,
      tenant.userId ?? null,
    ],
  });

  const operations = await db
    .prepare(`
      SELECT
        o.id,
        o.status
      FROM operations o

      JOIN transfers t
        ON t.company_id = o.company_id
       AND o.source_type = 'transfer'
       AND o.source_id = t.id

      JOIN booking_services bs
        ON bs.company_id = t.company_id
       AND bs.id = t.booking_service_id

      WHERE bs.booking_id = ?
        AND bs.company_id = ?
    `)
    .bind(
      input.bookingId,
      tenant.companyId,
    )
    .all<any>();

  for (const operation of operations.results ?? []) {
    if (
      input.newStatus === "confirmed" &&
      operation.status === "not_planned"
    ) {
      statements.push({
        sql: `
          UPDATE operations
          SET status = 'waiting_assignment',
              updated_at = ?
          WHERE id = ?
            AND company_id = ?
        `,
        params: [
          now,
          operation.id,
          tenant.companyId,
        ],
      });

      statements.push({
        sql: `
          INSERT INTO operation_events (
            id,
            company_id,
            operation_id,
            event_type,
            old_status,
            new_status,
            description,
            actor_user_id
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        params: [
          generateId("operation_event"),
          tenant.companyId,
          operation.id,
          "status_changed",
          "not_planned",
          "waiting_assignment",
          "Booking confirmed; operation released to dispatch",
          tenant.userId ?? null,
        ],
      });
    }

    if (
      input.newStatus === "cancelled" &&
      [
        "not_planned",
        "waiting_assignment",
        "assigned",
        "ready",
        "problem",
      ].includes(operation.status)
    ) {
      statements.push({
        sql: `
          UPDATE operations
          SET status = 'cancelled',
              updated_at = ?
          WHERE id = ?
            AND company_id = ?
        `,
        params: [
          now,
          operation.id,
          tenant.companyId,
        ],
      });

      statements.push({
        sql: `
          INSERT INTO operation_events (
            id,
            company_id,
            operation_id,
            event_type,
            old_status,
            new_status,
            description,
            actor_user_id
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        params: [
          generateId("operation_event"),
          tenant.companyId,
          operation.id,
          "status_changed",
          operation.status,
          "cancelled",
          "Booking cancelled; operation cancelled",
          tenant.userId ?? null,
        ],
      });
    }
  }

  await atomic(
    db,
    statements,
  );

  return await first<any>(
    db,
    `
    SELECT *
    FROM bookings
    WHERE id = ?
      AND company_id = ?
    LIMIT 1
    `,
    [
      input.bookingId,
      tenant.companyId,
    ],
  );
}
