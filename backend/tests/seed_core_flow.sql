PRAGMA foreign_keys = ON;

BEGIN TRANSACTION;

-- =========================================================
-- COMPANY
-- =========================================================

INSERT INTO companies (
    id,
    name,
    slug,
    status
) VALUES (
    'cmp_test_001',
    'Axiom Test Travel',
    'axiom-test-travel',
    'active'
);


-- =========================================================
-- OWNER USER
-- Şimdilik gerçek parola doğrulaması yapmıyoruz.
-- Hash yalnızca ilişkisel test verisidir.
-- =========================================================

INSERT INTO company_users (
    id,
    company_id,
    email,
    password_hash,
    first_name,
    last_name,
    role,
    status
) VALUES (
    'usr_test_001',
    'cmp_test_001',
    'owner@test.local',
    'TEST_HASH_ONLY',
    'Axiom',
    'Owner',
    'owner',
    'active'
);


-- =========================================================
-- CUSTOMER
-- =========================================================

INSERT INTO customers (
    id,
    company_id,
    first_name,
    last_name,
    email,
    phone,
    nationality,
    language
) VALUES (
    'cus_test_001',
    'cmp_test_001',
    'Mehmet',
    'Yılmaz',
    'mehmet@test.local',
    '+905321112233',
    'TR',
    'tr'
);


-- =========================================================
-- DRIVER
-- =========================================================

INSERT INTO drivers (
    id,
    company_id,
    first_name,
    last_name,
    phone,
    status,
    active
) VALUES (
    'drv_test_001',
    'cmp_test_001',
    'Ahmet',
    'Kaya',
    '+905331234567',
    'available',
    1
);


-- =========================================================
-- VEHICLE
-- =========================================================

INSERT INTO vehicles (
    id,
    company_id,
    plate,
    brand,
    model,
    model_year,
    vehicle_class,
    capacity,
    status,
    active
) VALUES (
    'veh_test_001',
    'cmp_test_001',
    '07 AXM 001',
    'Mercedes-Benz',
    'Vito',
    2025,
    'VIP Minivan',
    7,
    'available',
    1
);


-- =========================================================
-- BOOKING
-- =========================================================

INSERT INTO bookings (
    id,
    company_id,
    customer_id,
    booking_code,
    status,
    source,
    currency,
    subtotal_amount,
    total_amount,
    booked_at,
    created_by
) VALUES (
    'bkg_test_001',
    'cmp_test_001',
    'cus_test_001',
    'AX-TEST-0001',
    'confirmed',
    'website',
    'TRY',
    2200,
    2200,
    CURRENT_TIMESTAMP,
    'usr_test_001'
);


-- =========================================================
-- BOOKING SERVICE
-- =========================================================

INSERT INTO booking_services (
    id,
    company_id,
    booking_id,
    service_type,
    status,
    title,
    service_date,
    start_time,
    pax_adult,
    quantity,
    unit_price,
    total_price
) VALUES (
    'svc_test_001',
    'cmp_test_001',
    'bkg_test_001',
    'transfer',
    'confirmed',
    'Antalya Havalimanı → Belek',
    '2026-08-18',
    '14:30',
    4,
    1,
    2200,
    2200
);


-- =========================================================
-- TRANSFER
-- =========================================================

INSERT INTO transfers (
    id,
    company_id,
    booking_service_id,
    pickup_location,
    dropoff_location,
    pickup_datetime,
    flight_number,
    pax,
    requested_vehicle_class
) VALUES (
    'trf_test_001',
    'cmp_test_001',
    'svc_test_001',
    'Antalya Havalimanı (AYT)',
    'Belek',
    '2026-08-18T14:30:00',
    'TK2410',
    4,
    'VIP Minivan'
);


-- =========================================================
-- OPERATION
-- =========================================================

INSERT INTO operations (
    id,
    company_id,
    source_type,
    source_id,
    status,
    scheduled_start_at,
    priority
) VALUES (
    'op_test_001',
    'cmp_test_001',
    'transfer',
    'trf_test_001',
    'assigned',
    '2026-08-18T14:30:00',
    100
);


-- =========================================================
-- OPERATION ASSIGNMENT
-- =========================================================

INSERT INTO operation_assignments (
    id,
    company_id,
    operation_id,
    driver_id,
    vehicle_id,
    status,
    assigned_by
) VALUES (
    'asn_test_001',
    'cmp_test_001',
    'op_test_001',
    'drv_test_001',
    'veh_test_001',
    'assigned',
    'usr_test_001'
);


-- =========================================================
-- BOOKING EVENT
-- =========================================================

INSERT INTO booking_events (
    id,
    company_id,
    booking_id,
    event_type,
    new_value,
    description,
    actor_user_id
) VALUES (
    'bev_test_001',
    'cmp_test_001',
    'bkg_test_001',
    'booking_created',
    'confirmed',
    'Test rezervasyonu oluşturuldu.',
    'usr_test_001'
);


-- =========================================================
-- OPERATION EVENT
-- =========================================================

INSERT INTO operation_events (
    id,
    company_id,
    operation_id,
    event_type,
    new_status,
    description,
    actor_user_id,
    driver_id
) VALUES (
    'oev_test_001',
    'cmp_test_001',
    'op_test_001',
    'assignment_created',
    'assigned',
    'Şoför ve araç operasyona atandı.',
    'usr_test_001',
    'drv_test_001'
);

COMMIT;
