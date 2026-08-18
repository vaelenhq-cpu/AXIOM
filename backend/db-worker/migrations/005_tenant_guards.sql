-- =========================================================
-- AXIOM DATABASE
-- Migration: 005_tenant_guards
-- Cross-Tenant Relationship Protection
-- =========================================================


-- =========================================================
-- BOOKINGS -> CUSTOMERS
-- =========================================================

CREATE TRIGGER IF NOT EXISTS trg_bookings_customer_tenant_insert
BEFORE INSERT ON bookings
WHEN NEW.customer_id IS NOT NULL
AND NOT EXISTS (
    SELECT 1
    FROM customers
    WHERE id = NEW.customer_id
      AND company_id = NEW.company_id
)
BEGIN
    SELECT RAISE(
        ABORT,
        'TENANT_MISMATCH: booking customer'
    );
END;


CREATE TRIGGER IF NOT EXISTS trg_bookings_customer_tenant_update
BEFORE UPDATE OF customer_id, company_id ON bookings
WHEN NEW.customer_id IS NOT NULL
AND NOT EXISTS (
    SELECT 1
    FROM customers
    WHERE id = NEW.customer_id
      AND company_id = NEW.company_id
)
BEGIN
    SELECT RAISE(
        ABORT,
        'TENANT_MISMATCH: booking customer'
    );
END;


-- =========================================================
-- BOOKING SERVICES -> BOOKINGS
-- =========================================================

CREATE TRIGGER IF NOT EXISTS trg_booking_services_tenant_insert
BEFORE INSERT ON booking_services
WHEN NOT EXISTS (
    SELECT 1
    FROM bookings
    WHERE id = NEW.booking_id
      AND company_id = NEW.company_id
)
BEGIN
    SELECT RAISE(
        ABORT,
        'TENANT_MISMATCH: booking service'
    );
END;


CREATE TRIGGER IF NOT EXISTS trg_booking_services_tenant_update
BEFORE UPDATE OF booking_id, company_id ON booking_services
WHEN NOT EXISTS (
    SELECT 1
    FROM bookings
    WHERE id = NEW.booking_id
      AND company_id = NEW.company_id
)
BEGIN
    SELECT RAISE(
        ABORT,
        'TENANT_MISMATCH: booking service'
    );
END;


-- =========================================================
-- TRANSFERS -> BOOKING SERVICES
-- =========================================================

CREATE TRIGGER IF NOT EXISTS trg_transfers_tenant_insert
BEFORE INSERT ON transfers
WHEN NOT EXISTS (
    SELECT 1
    FROM booking_services
    WHERE id = NEW.booking_service_id
      AND company_id = NEW.company_id
)
BEGIN
    SELECT RAISE(
        ABORT,
        'TENANT_MISMATCH: transfer booking service'
    );
END;


-- =========================================================
-- TOUR BOOKINGS
-- =========================================================

CREATE TRIGGER IF NOT EXISTS trg_tour_bookings_service_tenant_insert
BEFORE INSERT ON tour_bookings
WHEN NOT EXISTS (
    SELECT 1
    FROM booking_services
    WHERE id = NEW.booking_service_id
      AND company_id = NEW.company_id
)
BEGIN
    SELECT RAISE(
        ABORT,
        'TENANT_MISMATCH: tour booking service'
    );
END;


CREATE TRIGGER IF NOT EXISTS trg_tour_bookings_departure_tenant_insert
BEFORE INSERT ON tour_bookings
WHEN NOT EXISTS (
    SELECT 1
    FROM tour_departures
    WHERE id = NEW.tour_departure_id
      AND company_id = NEW.company_id
)
BEGIN
    SELECT RAISE(
        ABORT,
        'TENANT_MISMATCH: tour departure'
    );
END;


-- =========================================================
-- TOUR DEPARTURES -> PRODUCTS
-- =========================================================

CREATE TRIGGER IF NOT EXISTS trg_tour_departures_tenant_insert
BEFORE INSERT ON tour_departures
WHEN NOT EXISTS (
    SELECT 1
    FROM tour_products
    WHERE id = NEW.tour_product_id
      AND company_id = NEW.company_id
)
BEGIN
    SELECT RAISE(
        ABORT,
        'TENANT_MISMATCH: tour product'
    );
END;


-- =========================================================
-- OPERATION ASSIGNMENTS
-- =========================================================

CREATE TRIGGER IF NOT EXISTS trg_assignment_operation_tenant_insert
BEFORE INSERT ON operation_assignments
WHEN NOT EXISTS (
    SELECT 1
    FROM operations
    WHERE id = NEW.operation_id
      AND company_id = NEW.company_id
)
BEGIN
    SELECT RAISE(
        ABORT,
        'TENANT_MISMATCH: operation assignment'
    );
END;


CREATE TRIGGER IF NOT EXISTS trg_assignment_driver_tenant_insert
BEFORE INSERT ON operation_assignments
WHEN NEW.driver_id IS NOT NULL
AND NOT EXISTS (
    SELECT 1
    FROM drivers
    WHERE id = NEW.driver_id
      AND company_id = NEW.company_id
)
BEGIN
    SELECT RAISE(
        ABORT,
        'TENANT_MISMATCH: driver assignment'
    );
END;


CREATE TRIGGER IF NOT EXISTS trg_assignment_vehicle_tenant_insert
BEFORE INSERT ON operation_assignments
WHEN NEW.vehicle_id IS NOT NULL
AND NOT EXISTS (
    SELECT 1
    FROM vehicles
    WHERE id = NEW.vehicle_id
      AND company_id = NEW.company_id
)
BEGIN
    SELECT RAISE(
        ABORT,
        'TENANT_MISMATCH: vehicle assignment'
    );
END;


-- =========================================================
-- PAYMENTS -> BOOKINGS
-- =========================================================

CREATE TRIGGER IF NOT EXISTS trg_payments_booking_tenant_insert
BEFORE INSERT ON payments
WHEN NOT EXISTS (
    SELECT 1
    FROM bookings
    WHERE id = NEW.booking_id
      AND company_id = NEW.company_id
)
BEGIN
    SELECT RAISE(
        ABORT,
        'TENANT_MISMATCH: payment booking'
    );
END;


-- =========================================================
-- EXTERNAL BOOKINGS -> INTEGRATIONS
-- =========================================================

CREATE TRIGGER IF NOT EXISTS trg_external_booking_integration_tenant_insert
BEFORE INSERT ON external_bookings
WHEN NOT EXISTS (
    SELECT 1
    FROM integrations
    WHERE id = NEW.integration_id
      AND company_id = NEW.company_id
)
BEGIN
    SELECT RAISE(
        ABORT,
        'TENANT_MISMATCH: external booking integration'
    );
END;


-- =========================================================
-- DRIVER ACCOUNTS
-- =========================================================

CREATE TRIGGER IF NOT EXISTS trg_driver_accounts_tenant_insert
BEFORE INSERT ON driver_accounts
WHEN NOT EXISTS (
    SELECT 1
    FROM drivers
    WHERE id = NEW.driver_id
      AND company_id = NEW.company_id
)
BEGIN
    SELECT RAISE(
        ABORT,
        'TENANT_MISMATCH: driver account'
    );
END;


-- =========================================================
-- OPERATION GUIDE ASSIGNMENTS
-- =========================================================

CREATE TRIGGER IF NOT EXISTS trg_operation_guides_tenant_insert
BEFORE INSERT ON operation_guide_assignments
WHEN NOT EXISTS (
    SELECT 1
    FROM operations
    WHERE id = NEW.operation_id
      AND company_id = NEW.company_id
)
OR NOT EXISTS (
    SELECT 1
    FROM guides
    WHERE id = NEW.guide_id
      AND company_id = NEW.company_id
)
BEGIN
    SELECT RAISE(
        ABORT,
        'TENANT_MISMATCH: guide assignment'
    );
END;
