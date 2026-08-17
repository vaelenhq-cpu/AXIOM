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


type OperationStatusInput = {
  tenant: TenantContext;
  operationId: string;
  newStatus: string;
  driverId?: string | null;
};


const transitions: Record<
  string,
  Set<string>
> = {
  not_planned: new Set([
    "waiting_assignment",
    "cancelled",
  ]),

  waiting_assignment: new Set([
    "assigned",
    "problem",
    "cancelled",
  ]),

  assigned: new Set([
    "ready",
    "waiting_assignment",
    "problem",
    "cancelled",
  ]),

  ready: new Set([
    "in_progress",
    "problem",
    "cancelled",
  ]),

  in_progress: new Set([
    "completed",
    "problem",
  ]),

  problem: new Set([
    "waiting_assignment",
    "assigned",
    "ready",
    "in_progress",
    "cancelled",
  ]),

  completed: new Set(),

  cancelled: new Set(),
};


export async function changeOperationStatus(
  db: D1Database,
  input: OperationStatusInput,
) {
  const tenant = requireTenant(
    input.tenant,
  );

  const operation = await first<any>(
    db,
    `
    SELECT *
    FROM operations
    WHERE id = ?
      AND company_id = ?
    LIMIT 1
    `,
    [
      input.operationId,
      tenant.companyId,
    ],
  );

  if (!operation) {
    throw new NotFoundError(
      "Operation not found",
    );
  }

  const currentStatus =
    operation.status;

  if (
    currentStatus ===
    input.newStatus
  ) {
    return operation;
  }

  const allowed =
    transitions[currentStatus]
    ?? new Set<string>();

  if (
    !allowed.has(
      input.newStatus,
    )
  ) {
    throw new ValidationError(
      `Invalid operation transition: ${currentStatus} -> ${input.newStatus}`,
    );
  }

  const now = nowIso();

  const statements: {
    sql: string;
    params?: unknown[];
  }[] = [];


  /*
   * -------------------------------------------------
   * Operation state
   * -------------------------------------------------
   */

  let actualStartAt =
    operation.actual_start_at
    ?? null;

  let actualEndAt =
    operation.actual_end_at
    ?? null;

  if (
    input.newStatus ===
    "in_progress"
  ) {
    actualStartAt = now;
  }

  if (
    input.newStatus ===
    "completed"
  ) {
    actualEndAt = now;
  }

  statements.push({
    sql: `
      UPDATE operations
      SET
        status = ?,
        actual_start_at = ?,
        actual_end_at = ?,
        updated_at = ?
      WHERE id = ?
        AND company_id = ?
    `,
    params: [
      input.newStatus,
      actualStartAt,
      actualEndAt,
      now,
      input.operationId,
      tenant.companyId,
    ],
  });


  /*
   * -------------------------------------------------
   * Operation event
   * -------------------------------------------------
   */

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
        actor_user_id,
        driver_id
      )
      VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `,
    params: [
      generateId(
        "operation_event",
      ),
      tenant.companyId,
      input.operationId,
      "status_changed",
      currentStatus,
      input.newStatus,
      (
        "Operation status changed: "
        + `${currentStatus} -> ${input.newStatus}`
      ),
      tenant.userId ?? null,
      input.driverId ?? null,
    ],
  });


  /*
   * -------------------------------------------------
   * Transfer operation completed:
   * booking completion control
   * -------------------------------------------------
   */

  if (
    input.newStatus ===
      "completed"
    &&
    operation.source_type ===
      "transfer"
    &&
    operation.source_id
  ) {
    const booking =
      await first<any>(
        db,
        `
        SELECT
          b.id,
          b.status
        FROM bookings b

        JOIN booking_services bs
          ON bs.company_id =
             b.company_id
         AND bs.booking_id =
             b.id

        JOIN transfers t
          ON t.company_id =
             bs.company_id
         AND t.booking_service_id =
             bs.id

        WHERE t.company_id = ?
          AND t.id = ?

        LIMIT 1
        `,
        [
          tenant.companyId,
          operation.source_id,
        ],
      );

    if (
      booking
      &&
      booking.status ===
        "confirmed"
    ) {
      /*
       * Current operation is about to
       * become completed, so exclude it
       * from the remaining count.
       */

      const incomplete =
        await first<any>(
          db,
          `
          SELECT
            COUNT(*) AS count
          FROM operations o

          JOIN transfers t
            ON t.company_id =
               o.company_id
           AND o.source_type =
               'transfer'
           AND o.source_id =
               t.id

          JOIN booking_services bs
            ON bs.company_id =
               t.company_id
           AND bs.id =
               t.booking_service_id

          WHERE bs.company_id = ?
            AND bs.booking_id = ?
            AND o.id != ?
            AND o.status !=
                'completed'
          `,
          [
            tenant.companyId,
            booking.id,
            input.operationId,
          ],
        );

      const remaining =
        Number(
          incomplete?.count ?? 0,
        );

      if (remaining === 0) {
        statements.push({
          sql: `
            UPDATE bookings
            SET
              status = 'completed',
              updated_at = ?
            WHERE company_id = ?
              AND id = ?
              AND status =
                  'confirmed'
          `,
          params: [
            now,
            tenant.companyId,
            booking.id,
          ],
        });
      }
    }
  }


  /*
   * -------------------------------------------------
   * Single atomic D1 write
   * -------------------------------------------------
   */

  await atomic(
    db,
    statements,
  );


  return await first<any>(
    db,
    `
    SELECT *
    FROM operations
    WHERE id = ?
      AND company_id = ?
    LIMIT 1
    `,
    [
      input.operationId,
      tenant.companyId,
    ],
  );
}
