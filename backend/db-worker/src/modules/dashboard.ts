import {
  all,
  first,
} from "../core/db";

import {
  requireTenant,
  TenantContext,
} from "../core/tenant";


async function count(
  db: D1Database,
  sql: string,
  params: unknown[],
): Promise<number> {
  const row =
    await first<any>(
      db,
      sql,
      params,
    );

  return Number(
    row?.count ?? 0,
  );
}


export async function dashboardSummary(
  db: D1Database,
  input: {
    tenant: TenantContext;
  },
) {
  const tenant =
    requireTenant(
      input.tenant,
    );

  const companyId =
    tenant.companyId;

  const [
    bookingsTotal,
    bookingsPending,
    bookingsConfirmed,

    operationsWaiting,
    operationsAssigned,
    operationsReady,
    operationsInProgress,
    operationsProblem,

    driversAvailable,
    vehiclesAvailable,
  ] =
    await Promise.all([
      count(
        db,
        `
        SELECT COUNT(*) AS count
        FROM bookings
        WHERE company_id = ?
        `,
        [companyId],
      ),

      count(
        db,
        `
        SELECT COUNT(*) AS count
        FROM bookings
        WHERE company_id = ?
          AND status = 'pending'
        `,
        [companyId],
      ),

      count(
        db,
        `
        SELECT COUNT(*) AS count
        FROM bookings
        WHERE company_id = ?
          AND status = 'confirmed'
        `,
        [companyId],
      ),

      count(
        db,
        `
        SELECT COUNT(*) AS count
        FROM operations
        WHERE company_id = ?
          AND status =
              'waiting_assignment'
        `,
        [companyId],
      ),

      count(
        db,
        `
        SELECT COUNT(*) AS count
        FROM operations
        WHERE company_id = ?
          AND status = 'assigned'
        `,
        [companyId],
      ),

      count(
        db,
        `
        SELECT COUNT(*) AS count
        FROM operations
        WHERE company_id = ?
          AND status = 'ready'
        `,
        [companyId],
      ),

      count(
        db,
        `
        SELECT COUNT(*) AS count
        FROM operations
        WHERE company_id = ?
          AND status =
              'in_progress'
        `,
        [companyId],
      ),

      count(
        db,
        `
        SELECT COUNT(*) AS count
        FROM operations
        WHERE company_id = ?
          AND status = 'problem'
        `,
        [companyId],
      ),

      count(
        db,
        `
        SELECT COUNT(*) AS count
        FROM drivers
        WHERE company_id = ?
          AND active = 1
          AND status =
              'available'
        `,
        [companyId],
      ),

      count(
        db,
        `
        SELECT COUNT(*) AS count
        FROM vehicles
        WHERE company_id = ?
          AND active = 1
          AND status =
              'available'
        `,
        [companyId],
      ),
    ]);


  const recentBookings =
    await all(
      db,
      `
      SELECT
        b.id,
        b.booking_code,
        b.status,
        b.source,
        b.currency,
        b.total_amount,
        b.booked_at,
        b.created_at,

        c.first_name,
        c.last_name,
        c.phone,
        c.email

      FROM bookings b

      LEFT JOIN customers c
        ON c.company_id =
           b.company_id
       AND c.id =
           b.customer_id

      WHERE b.company_id = ?

      ORDER BY
        b.created_at DESC

      LIMIT 10
      `,
      [
        companyId,
      ],
    );


  return {
    bookings: {
      total:
        bookingsTotal,

      pending:
        bookingsPending,

      confirmed:
        bookingsConfirmed,
    },

    operations: {
      waitingAssignment:
        operationsWaiting,

      assigned:
        operationsAssigned,

      ready:
        operationsReady,

      inProgress:
        operationsInProgress,

      problem:
        operationsProblem,
    },

    resources: {
      availableDrivers:
        driversAvailable,

      availableVehicles:
        vehiclesAvailable,
    },

    recentBookings,
  };
}


export async function dispatchList(
  db: D1Database,
  input: {
    tenant: TenantContext;
    limit?: number;
  },
) {
  const tenant =
    requireTenant(
      input.tenant,
    );

  const limit =
    Math.min(
      Math.max(
        Number(
          input.limit ?? 100,
        ),
        1,
      ),
      200,
    );


  return await all(
    db,
    `
    SELECT
      o.id,
      o.source_type,
      o.source_id,
      o.status,

      o.scheduled_start_at,
      o.scheduled_end_at,

      o.priority,
      o.operation_note,

      b.id
        AS booking_id,

      b.booking_code,

      b.status
        AS booking_status,

      b.source
        AS booking_source,

      c.id
        AS customer_id,

      c.first_name
        AS customer_first_name,

      c.last_name
        AS customer_last_name,

      c.phone
        AS customer_phone,

      bs.title
        AS service_title,

      t.pickup_location,
      t.dropoff_location,
      t.pickup_datetime,
      t.flight_number,
      t.pax,
      t.luggage_count,
      t.requested_vehicle_class,

      oa.id
        AS assignment_id,

      oa.status
        AS assignment_status,

      d.id
        AS driver_id,

      d.first_name
        AS driver_first_name,

      d.last_name
        AS driver_last_name,

      d.phone
        AS driver_phone,

      v.id
        AS vehicle_id,

      v.plate
        AS vehicle_plate,

      v.brand
        AS vehicle_brand,

      v.model
        AS vehicle_model,

      v.vehicle_class

    FROM operations o

    LEFT JOIN transfers t
      ON o.source_type =
         'transfer'
     AND t.company_id =
         o.company_id
     AND t.id =
         o.source_id

    LEFT JOIN booking_services bs
      ON bs.company_id =
         o.company_id
     AND bs.id =
         t.booking_service_id

    LEFT JOIN bookings b
      ON b.company_id =
         o.company_id
     AND b.id =
         bs.booking_id

    LEFT JOIN customers c
      ON c.company_id =
         o.company_id
     AND c.id =
         b.customer_id

    LEFT JOIN operation_assignments oa
      ON oa.company_id =
         o.company_id
     AND oa.operation_id =
         o.id
     AND oa.status NOT IN (
       'cancelled',
       'rejected'
     )

    LEFT JOIN drivers d
      ON d.company_id =
         o.company_id
     AND d.id =
         oa.driver_id

    LEFT JOIN vehicles v
      ON v.company_id =
         o.company_id
     AND v.id =
         oa.vehicle_id

    WHERE o.company_id = ?
      AND o.status !=
          'not_planned'

    ORDER BY
      CASE o.status
        WHEN 'problem'
          THEN 1

        WHEN 'waiting_assignment'
          THEN 2

        WHEN 'assigned'
          THEN 3

        WHEN 'ready'
          THEN 4

        WHEN 'in_progress'
          THEN 5

        ELSE 6
      END,

      o.scheduled_start_at ASC,
      o.priority ASC

    LIMIT ?
    `,
    [
      tenant.companyId,
      limit,
    ],
  );
}
