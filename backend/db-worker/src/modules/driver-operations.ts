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
  PermissionError,
  ValidationError,
} from "../core/errors";

import {
  requireTenant,
  TenantContext,
} from "../core/tenant";


type DriverIssueInput = {
  tenant: TenantContext;
  driverId: string;
  operationId: string;
  issueType: string;
  description: string;
};


const issueEvents: Record<
  string,
  string
> = {
  delay:
    "driver_delay",

  passenger_missing:
    "passenger_missing",

  problem:
    "driver_problem",
};


const problemAllowedFrom =
  new Set([
    "waiting_assignment",
    "assigned",
    "ready",
    "in_progress",
  ]);


export async function reportDriverIssue(
  db: D1Database,
  input: DriverIssueInput,
) {
  const tenant = requireTenant(
    input.tenant,
  );

  if (
    !Object.prototype
      .hasOwnProperty.call(
        issueEvents,
        input.issueType,
      )
  ) {
    throw new ValidationError(
      "Invalid driver issue type",
    );
  }

  const description =
    input.description.trim();

  if (!description) {
    throw new ValidationError(
      "Issue description is required",
    );
  }


  /*
   * -------------------------------------------------
   * Operation
   * -------------------------------------------------
   */

  const operation =
    await first<any>(
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


  /*
   * -------------------------------------------------
   * Driver must own active assignment
   * -------------------------------------------------
   */

  const assignment =
    await first<any>(
      db,
      `
      SELECT *
      FROM operation_assignments
      WHERE company_id = ?
        AND operation_id = ?
        AND driver_id = ?
        AND status NOT IN (
          'cancelled',
          'rejected'
        )
      ORDER BY assigned_at DESC
      LIMIT 1
      `,
      [
        tenant.companyId,
        input.operationId,
        input.driverId,
      ],
    );

  if (!assignment) {
    throw new PermissionError(
      "Operation is not assigned to this driver",
    );
  }


  /*
   * -------------------------------------------------
   * Determine resulting state
   * -------------------------------------------------
   */

  const currentStatus =
    operation.status;

  let newStatus =
    currentStatus;

  if (
    (
      input.issueType ===
        "passenger_missing"
      ||
      input.issueType ===
        "problem"
    )
    &&
    ![
      "completed",
      "cancelled",
      "problem",
    ].includes(
      currentStatus,
    )
    &&
    problemAllowedFrom.has(
      currentStatus,
    )
  ) {
    newStatus =
      "problem";
  }


  const now = nowIso();

  const statements: {
    sql: string;
    params?: unknown[];
  }[] = [];


  /*
   * -------------------------------------------------
   * Change operation state if necessary
   * -------------------------------------------------
   */

  if (
    newStatus !==
    currentStatus
  ) {
    statements.push({
      sql: `
        UPDATE operations
        SET
          status = ?,
          updated_at = ?
        WHERE id = ?
          AND company_id = ?
      `,
      params: [
        newStatus,
        now,
        input.operationId,
        tenant.companyId,
      ],
    });
  }


  const eventId =
    generateId(
      "operation_event",
    );


  /*
   * -------------------------------------------------
   * Driver issue event
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
      eventId,
      tenant.companyId,
      input.operationId,
      issueEvents[
        input.issueType
      ],
      currentStatus,
      newStatus,
      description,
      null,
      input.driverId,
    ],
  });


  await atomic(
    db,
    statements,
  );


  const updatedOperation =
    await first<any>(
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


  const event =
    await first<any>(
      db,
      `
      SELECT *
      FROM operation_events
      WHERE id = ?
        AND company_id = ?
      LIMIT 1
      `,
      [
        eventId,
        tenant.companyId,
      ],
    );


  return {
    event,
    operation:
      updatedOperation,
  };
}
