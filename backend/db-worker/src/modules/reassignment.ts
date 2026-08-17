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


type ReassignmentInput = {
  tenant: TenantContext;

  operationId: string;

  driverId?: string | null;
  vehicleId?: string | null;

  reason: string;

  markPreviousVehicleMaintenance?: boolean;
};


export async function reassignOperation(
  db: D1Database,
  input: ReassignmentInput,
) {
  const tenant = requireTenant(
    input.tenant,
  );

  const reason =
    input.reason.trim();

  if (!reason) {
    throw new ValidationError(
      "Reassignment reason is required",
    );
  }

  if (
    !input.driverId
    &&
    !input.vehicleId
  ) {
    throw new ValidationError(
      "Driver or vehicle is required",
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

  if (
    operation.status === "completed"
    ||
    operation.status === "cancelled"
  ) {
    throw new ValidationError(
      "Completed or cancelled operation cannot be reassigned",
    );
  }


  /*
   * -------------------------------------------------
   * Current assignment
   * -------------------------------------------------
   */

  const currentAssignment =
    await first<any>(
      db,
      `
      SELECT *
      FROM operation_assignments
      WHERE company_id = ?
        AND operation_id = ?
        AND status IN (
          'assigned',
          'accepted',
          'started'
        )
      ORDER BY assigned_at DESC
      LIMIT 1
      `,
      [
        tenant.companyId,
        input.operationId,
      ],
    );


  const oldDriverId =
    currentAssignment?.driver_id
    ?? null;

  const oldVehicleId =
    currentAssignment?.vehicle_id
    ?? null;


  const newDriverId =
    input.driverId
    ?? oldDriverId;

  const newVehicleId =
    input.vehicleId
    ?? oldVehicleId;


  if (
    !newDriverId
    &&
    !newVehicleId
  ) {
    throw new ValidationError(
      "No resource available for reassignment",
    );
  }


  if (
    newDriverId === oldDriverId
    &&
    newVehicleId === oldVehicleId
  ) {
    throw new ValidationError(
      "New assignment must change driver or vehicle",
    );
  }


  /*
   * -------------------------------------------------
   * Validate new driver
   * -------------------------------------------------
   */

  if (newDriverId) {
    const driver =
      await first<any>(
        db,
        `
        SELECT *
        FROM drivers
        WHERE id = ?
          AND company_id = ?
        LIMIT 1
        `,
        [
          newDriverId,
          tenant.companyId,
        ],
      );

    if (!driver) {
      throw new NotFoundError(
        "Driver not found",
      );
    }

    if (!driver.active) {
      throw new ValidationError(
        "Driver is inactive",
      );
    }

    if (
      newDriverId !== oldDriverId
      &&
      driver.status !== "available"
    ) {
      throw new ValidationError(
        "Driver is not available",
      );
    }
  }


  /*
   * -------------------------------------------------
   * Validate new vehicle
   * -------------------------------------------------
   */

  if (newVehicleId) {
    const vehicle =
      await first<any>(
        db,
        `
        SELECT *
        FROM vehicles
        WHERE id = ?
          AND company_id = ?
        LIMIT 1
        `,
        [
          newVehicleId,
          tenant.companyId,
        ],
      );

    if (!vehicle) {
      throw new NotFoundError(
        "Vehicle not found",
      );
    }

    if (!vehicle.active) {
      throw new ValidationError(
        "Vehicle is inactive",
      );
    }

    if (
      newVehicleId !== oldVehicleId
      &&
      vehicle.status !== "available"
    ) {
      throw new ValidationError(
        "Vehicle is not available",
      );
    }
  }


  /*
   * -------------------------------------------------
   * Maintenance rule
   * -------------------------------------------------
   */

  if (
    input.markPreviousVehicleMaintenance
    &&
    oldVehicleId
    &&
    newVehicleId === oldVehicleId
  ) {
    throw new ValidationError(
      "Problem vehicle cannot remain assigned",
    );
  }


  const now = nowIso();

  const statements: {
    sql: string;
    params?: unknown[];
  }[] = [];


  /*
   * -------------------------------------------------
   * Cancel previous assignment
   * -------------------------------------------------
   */

  if (currentAssignment) {
    statements.push({
      sql: `
        UPDATE operation_assignments
        SET
          status = 'cancelled',
          updated_at = ?
        WHERE id = ?
          AND company_id = ?
      `,
      params: [
        now,
        currentAssignment.id,
        tenant.companyId,
      ],
    });
  }


  /*
   * -------------------------------------------------
   * Release previous driver
   * -------------------------------------------------
   */

  if (
    oldDriverId
    &&
    oldDriverId !== newDriverId
  ) {
    statements.push({
      sql: `
        UPDATE drivers
        SET status = 'available',
            updated_at = ?
        WHERE id = ?
          AND company_id = ?
      `,
      params: [
        now,
        oldDriverId,
        tenant.companyId,
      ],
    });
  }


  /*
   * -------------------------------------------------
   * Release / maintenance previous vehicle
   * -------------------------------------------------
   */

  if (
    oldVehicleId
    &&
    oldVehicleId !== newVehicleId
  ) {
    statements.push({
      sql: `
        UPDATE vehicles
        SET
          status = ?,
          updated_at = ?
        WHERE id = ?
          AND company_id = ?
      `,
      params: [
        input.markPreviousVehicleMaintenance
          ? "maintenance"
          : "available",
        now,
        oldVehicleId,
        tenant.companyId,
      ],
    });
  }


  /*
   * -------------------------------------------------
   * New assignment
   * -------------------------------------------------
   */

  const assignmentId =
    generateId(
      "assignment",
    );

  statements.push({
    sql: `
      INSERT INTO operation_assignments (
        id,
        company_id,
        operation_id,
        driver_id,
        vehicle_id,
        status,
        assigned_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    params: [
      assignmentId,
      tenant.companyId,
      input.operationId,
      newDriverId,
      newVehicleId,
      "assigned",
      tenant.userId ?? null,
    ],
  });


  /*
   * -------------------------------------------------
   * Keep newly assigned resources available
   * until driver actually starts the operation.
   * -------------------------------------------------
   */

  if (newDriverId) {
    statements.push({
      sql: `
        UPDATE drivers
        SET
          status = 'available',
          updated_at = ?
        WHERE id = ?
          AND company_id = ?
      `,
      params: [
        now,
        newDriverId,
        tenant.companyId,
      ],
    });
  }


  if (newVehicleId) {
    statements.push({
      sql: `
        UPDATE vehicles
        SET
          status = 'available',
          updated_at = ?
        WHERE id = ?
          AND company_id = ?
      `,
      params: [
        now,
        newVehicleId,
        tenant.companyId,
      ],
    });
  }


  /*
   * -------------------------------------------------
   * Operation returns to assigned
   * -------------------------------------------------
   */

  const oldStatus =
    operation.status;

  statements.push({
    sql: `
      UPDATE operations
      SET
        status = 'assigned',
        updated_at = ?
      WHERE id = ?
        AND company_id = ?
    `,
    params: [
      now,
      input.operationId,
      tenant.companyId,
    ],
  });


  /*
   * -------------------------------------------------
   * Event
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
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    params: [
      generateId(
        "operation_event",
      ),
      tenant.companyId,
      input.operationId,
      "operation_reassigned",
      oldStatus,
      "assigned",
      reason,
      tenant.userId ?? null,
      newDriverId,
    ],
  });


  /*
   * -------------------------------------------------
   * Atomic commit
   * -------------------------------------------------
   */

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


  const assignment =
    await first<any>(
      db,
      `
      SELECT *
      FROM operation_assignments
      WHERE id = ?
        AND company_id = ?
      LIMIT 1
      `,
      [
        assignmentId,
        tenant.companyId,
      ],
    );


  return {
    operation:
      updatedOperation,

    assignment,

    previous: {
      driverId:
        oldDriverId,

      vehicleId:
        oldVehicleId,
    },

    current: {
      driverId:
        newDriverId,

      vehicleId:
        newVehicleId,
    },
  };
}
