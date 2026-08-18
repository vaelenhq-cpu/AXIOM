import { all, atomic, first } from "../core/db";
import { generateId } from "../core/ids";
import { nowIso } from "../core/time";

export type DriverContext = { companyId: string; driverId: string };

const FIELD_EVENT_ORDER = [
  "driver_en_route_to_pickup",
  "driver_arrived_at_pickup",
  "passenger_onboard",
  "driver_departed_pickup",
  "driver_arrived_at_dropoff",
  "passenger_dropped_off",
] as const;

async function assignedOperation(db: D1Database, context: DriverContext, operationId: string) {
  return await first<any>(db, `
    SELECT o.*, oa.id AS assignment_id, oa.status AS assignment_status,
           oa.vehicle_id, oa.assigned_at, oa.accepted_at
    FROM operations o
    JOIN operation_assignments oa ON oa.operation_id = o.id AND oa.company_id = o.company_id
    WHERE o.company_id = ? AND o.id = ? AND oa.driver_id = ?
      AND oa.status NOT IN ('cancelled', 'rejected')
    ORDER BY oa.assigned_at DESC LIMIT 1
  `, [context.companyId, operationId, context.driverId]);
}

export async function driverOperationsList(db: D1Database, context: DriverContext, limit = 100) {
  return await all<any>(db, `
    SELECT
      o.id, o.source_type, o.source_id, o.status, o.scheduled_start_at, o.scheduled_end_at,
      o.actual_start_at, o.actual_end_at, o.priority, o.operation_note,
      oa.id AS assignment_id, oa.status AS assignment_status, oa.vehicle_id, oa.assigned_at, oa.accepted_at,
      b.id AS booking_id, b.booking_code, b.customer_note,
      c.id AS customer_id, c.first_name AS customer_first_name, c.last_name AS customer_last_name,
      c.phone AS customer_phone, c.email AS customer_email, c.language AS customer_language,
      bs.id AS booking_service_id, bs.service_type, bs.title AS service_title,
      bs.description AS service_description, bs.service_date, bs.start_time,
      bs.pax_adult, bs.pax_child, bs.pax_infant,
      t.id AS transfer_id, t.pickup_location, t.pickup_latitude, t.pickup_longitude, t.pickup_place_id,
      t.dropoff_location, t.dropoff_latitude, t.dropoff_longitude, t.dropoff_place_id,
      t.pickup_datetime, t.flight_number, t.flight_datetime, t.pickup_sign, t.pax,
      t.luggage_count, t.requested_vehicle_class, t.special_request,
      v.plate AS vehicle_plate, v.brand AS vehicle_brand, v.model AS vehicle_model,
      v.model_year AS vehicle_model_year, v.vehicle_class, v.capacity AS vehicle_capacity
    FROM operations o
    JOIN operation_assignments oa ON oa.operation_id = o.id AND oa.company_id = o.company_id
    LEFT JOIN transfers t ON o.source_type = 'transfer' AND t.id = o.source_id AND t.company_id = o.company_id
    LEFT JOIN booking_services bs ON bs.id = t.booking_service_id AND bs.company_id = o.company_id
    LEFT JOIN bookings b ON b.id = bs.booking_id AND b.company_id = o.company_id
    LEFT JOIN customers c ON c.id = b.customer_id AND c.company_id = o.company_id
    LEFT JOIN vehicles v ON v.id = oa.vehicle_id AND v.company_id = o.company_id
    WHERE o.company_id = ? AND oa.driver_id = ? AND oa.status NOT IN ('cancelled', 'rejected')
    ORDER BY CASE
      WHEN o.status = 'in_progress' THEN 1
      WHEN o.status = 'ready' THEN 2
      WHEN o.status = 'assigned' THEN 3
      WHEN o.status = 'problem' THEN 4
      WHEN o.status = 'completed' THEN 5
      ELSE 6 END,
      o.scheduled_start_at ASC
    LIMIT ?
  `, [context.companyId, context.driverId, Math.min(Math.max(limit, 1), 200)]);
}

export async function driverOperationTimeline(db: D1Database, context: DriverContext, operationId: string) {
  const row = await assignedOperation(db, context, operationId);
  if (!row) throw new Error("Operation not found or not assigned to this driver");
  return await all<any>(db, `
    SELECT id, event_type, old_status, new_status, description, actor_user_id, driver_id, created_at
    FROM operation_events WHERE company_id = ? AND operation_id = ?
    ORDER BY created_at ASC, id ASC
  `, [context.companyId, operationId]);
}

export async function driverOperationDetail(db: D1Database, context: DriverContext, operationId: string) {
  const rows = await driverOperationsList(db, context, 200);
  const row = rows.find((item) => item.id === operationId);
  if (!row) throw new Error("Operation not found or not assigned to this driver");
  const timeline = await driverOperationTimeline(db, context, operationId);
  const completed = new Set(timeline.map((x) => x.event_type).filter((x) => FIELD_EVENT_ORDER.includes(x as any)));
  let currentStep: string | null = null;
  for (const item of FIELD_EVENT_ORDER) if (completed.has(item)) currentStep = item;
  const nextEvent = FIELD_EVENT_ORDER.find((item) => !completed.has(item)) ?? null;
  const pickupTarget = { type: "pickup", location: row.pickup_location, latitude: row.pickup_latitude, longitude: row.pickup_longitude, place_id: row.pickup_place_id };
  const dropoffTarget = { type: "dropoff", location: row.dropoff_location, latitude: row.dropoff_latitude, longitude: row.dropoff_longitude, place_id: row.dropoff_place_id };
  const dropoffPhase = new Set(["passenger_onboard", "driver_departed_pickup", "driver_arrived_at_dropoff", "passenger_dropped_off"]);
  let activeTarget: typeof pickupTarget | null = pickupTarget;
  if (currentStep && dropoffPhase.has(currentStep)) activeTarget = dropoffTarget;
  if (["completed", "cancelled"].includes(row.status)) activeTarget = null;
  return {
    operation: { id: row.id, status: row.status, source_type: row.source_type, source_id: row.source_id, priority: row.priority,
      scheduled_start_at: row.scheduled_start_at, scheduled_end_at: row.scheduled_end_at,
      actual_start_at: row.actual_start_at, actual_end_at: row.actual_end_at },
    assignment: { id: row.assignment_id, status: row.assignment_status, assigned_at: row.assigned_at, accepted_at: row.accepted_at },
    booking: { id: row.booking_id, code: row.booking_code },
    customer: { id: row.customer_id, first_name: row.customer_first_name, last_name: row.customer_last_name,
      phone: row.customer_phone, email: row.customer_email, language: row.customer_language },
    service: { id: row.booking_service_id, type: row.service_type, title: row.service_title,
      description: row.service_description, date: row.service_date, start_time: row.start_time,
      passengers: { adult: row.pax_adult, child: row.pax_child, infant: row.pax_infant } },
    transfer: { id: row.transfer_id,
      pickup: { location: row.pickup_location, datetime: row.pickup_datetime, latitude: row.pickup_latitude, longitude: row.pickup_longitude, place_id: row.pickup_place_id },
      dropoff: { location: row.dropoff_location, latitude: row.dropoff_latitude, longitude: row.dropoff_longitude, place_id: row.dropoff_place_id },
      flight: { number: row.flight_number, datetime: row.flight_datetime }, pickup_sign: row.pickup_sign,
      pax: row.pax, luggage_count: row.luggage_count, requested_vehicle_class: row.requested_vehicle_class },
    vehicle: { id: row.vehicle_id, plate: row.vehicle_plate, brand: row.vehicle_brand, model: row.vehicle_model,
      model_year: row.vehicle_model_year, class: row.vehicle_class, capacity: row.vehicle_capacity },
    notes: { operation: row.operation_note, customer: row.customer_note, special_request: row.special_request },
    navigation: { active_target: activeTarget, pickup: pickupTarget, dropoff: dropoffTarget,
      has_pickup_coordinates: row.pickup_latitude != null && row.pickup_longitude != null,
      has_dropoff_coordinates: row.dropoff_latitude != null && row.dropoff_longitude != null },
    workflow: { current_step: currentStep, next_event: nextEvent,
      can_accept: row.assignment_status === "assigned" && !["completed", "cancelled"].includes(row.status),
      can_start: row.assignment_status === "accepted" && ["assigned", "ready"].includes(row.status),
      can_complete: row.assignment_status === "started" && row.status === "in_progress" && completed.has("passenger_dropped_off"),
      field_events: { completed: FIELD_EVENT_ORDER.filter((x) => completed.has(x)), remaining: FIELD_EVENT_ORDER.filter((x) => !completed.has(x)) } },
    timeline,
  };
}

export async function driverAcceptOperation(db: D1Database, context: DriverContext, operationId: string) {
  const row = await assignedOperation(db, context, operationId);
  if (!row) throw new Error("Operation not found");
  if (row.assignment_status !== "assigned") throw new Error("Assignment cannot be accepted");
  const now = nowIso();
  const statements: any[] = [{ sql: `UPDATE operation_assignments SET status = 'accepted', accepted_at = ?, updated_at = ? WHERE id = ? AND company_id = ?`, params: [now, now, row.assignment_id, context.companyId] }];
  if (row.status === "assigned") {
    statements.push({ sql: `UPDATE operations SET status = 'ready', updated_at = ? WHERE id = ? AND company_id = ?`, params: [now, operationId, context.companyId] });
    statements.push({ sql: `INSERT INTO operation_events (id, company_id, operation_id, event_type, old_status, new_status, description, actor_user_id, driver_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [generateId("operation_event"), context.companyId, operationId, "status_changed", "assigned", "ready", "Operation status changed: assigned -> ready", null, context.driverId] });
  }
  await atomic(db, statements);
  return { accepted: true };
}

export async function driverStartOperation(db: D1Database, context: DriverContext, operationId: string) {
  const row = await assignedOperation(db, context, operationId);
  if (!row) throw new Error("Operation not found");
  if (row.assignment_status !== "accepted") throw new Error("Assignment must be accepted first");
  if (!["assigned", "ready"].includes(row.status)) throw new Error("Operation cannot be started from current status");
  const now = nowIso();
  const statements: any[] = [
    { sql: `UPDATE operation_assignments SET status = 'started', updated_at = ? WHERE id = ? AND company_id = ?`, params: [now, row.assignment_id, context.companyId] },
    { sql: `UPDATE drivers SET status = 'busy', updated_at = ? WHERE id = ? AND company_id = ?`, params: [now, context.driverId, context.companyId] },
    { sql: `UPDATE operations SET status = 'in_progress', actual_start_at = ?, updated_at = ? WHERE id = ? AND company_id = ?`, params: [now, now, operationId, context.companyId] },
    { sql: `INSERT INTO operation_events (id, company_id, operation_id, event_type, old_status, new_status, description, actor_user_id, driver_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [generateId("operation_event"), context.companyId, operationId, "status_changed", row.status, "in_progress", `Operation status changed: ${row.status} -> in_progress`, null, context.driverId] },
  ];
  if (row.vehicle_id) statements.push({ sql: `UPDATE vehicles SET status = 'busy', updated_at = ? WHERE id = ? AND company_id = ?`, params: [now, row.vehicle_id, context.companyId] });
  await atomic(db, statements);
  return { started: true };
}

export async function driverRecordFieldEvent(db: D1Database, context: DriverContext, operationId: string, eventType: string, description?: string | null) {
  const row = await assignedOperation(db, context, operationId);
  if (!row) throw new Error("Operation not found");
  const targetIndex = FIELD_EVENT_ORDER.indexOf(eventType as any);
  if (targetIndex < 0) throw new Error("Invalid driver operation event");
  if (row.assignment_status === "assigned") throw new Error("Operation must be accepted first");
  if (["completed", "cancelled"].includes(row.status)) throw new Error("Operation is already closed");
  const previous = await driverOperationTimeline(db, context, operationId);
  const completed = new Set(previous.map((x) => x.event_type));
  if (completed.has(eventType)) throw new Error("Driver operation event already recorded");
  if (targetIndex > 0) {
    const required = FIELD_EVENT_ORDER[targetIndex - 1];
    if (!completed.has(required)) throw new Error(`Previous driver operation event is required: ${required}`);
  }
  await atomic(db, [{ sql: `INSERT INTO operation_events (id, company_id, operation_id, event_type, old_status, new_status, description, actor_user_id, driver_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    params: [generateId("operation_event"), context.companyId, operationId, eventType, row.status, row.status, description?.trim() || null, null, context.driverId] }]);
  return { recorded: true, next_event: FIELD_EVENT_ORDER[targetIndex + 1] ?? null };
}

export async function driverCompleteOperation(db: D1Database, context: DriverContext, operationId: string) {
  const row = await assignedOperation(db, context, operationId);
  if (!row) throw new Error("Operation not found");
  if (row.assignment_status !== "started" || row.status !== "in_progress") throw new Error("Operation is not ready for completion");
  const timeline = await driverOperationTimeline(db, context, operationId);
  if (!timeline.some((x) => x.event_type === "passenger_dropped_off")) throw new Error("Passenger drop-off must be completed before operation completion");
  const now = nowIso();
  const statements: any[] = [
    { sql: `UPDATE operation_assignments SET status = 'completed', updated_at = ? WHERE id = ? AND company_id = ?`, params: [now, row.assignment_id, context.companyId] },
    { sql: `UPDATE operations SET status = 'completed', actual_end_at = ?, updated_at = ? WHERE id = ? AND company_id = ?`, params: [now, now, operationId, context.companyId] },
    { sql: `UPDATE drivers SET status = 'available', updated_at = ? WHERE id = ? AND company_id = ?`, params: [now, context.driverId, context.companyId] },
    { sql: `INSERT INTO operation_events (id, company_id, operation_id, event_type, old_status, new_status, description, actor_user_id, driver_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [generateId("operation_event"), context.companyId, operationId, "status_changed", "in_progress", "completed", "Operation status changed: in_progress -> completed", null, context.driverId] },
  ];
  if (row.vehicle_id) statements.push({ sql: `UPDATE vehicles SET status = 'available', updated_at = ? WHERE id = ? AND company_id = ?`, params: [now, row.vehicle_id, context.companyId] });
  await atomic(db, statements);
  return { completed: true };
}
