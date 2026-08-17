
-- =========================================================
-- AXIOM DATABASE
-- Migration: 002_operations
-- Transfer / Tour / Driver / Vehicle / Operation Engine
-- =========================================================


-- =========================================================
-- DRIVERS
-- =========================================================

CREATE TABLE IF NOT EXISTS drivers (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,

    first_name TEXT NOT NULL,
    last_name TEXT,
    phone TEXT,
    email TEXT,

    license_number TEXT,
    license_class TEXT,

    status TEXT NOT NULL DEFAULT 'available'
        CHECK (status IN (
            'available',
            'busy',
            'off_duty',
            'inactive'
        )),

    active INTEGER NOT NULL DEFAULT 1
        CHECK (active IN (0, 1)),

    notes TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_drivers_company
ON drivers(company_id);

CREATE INDEX IF NOT EXISTS idx_drivers_status
ON drivers(company_id, status);


-- =========================================================
-- VEHICLES
-- =========================================================

CREATE TABLE IF NOT EXISTS vehicles (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,

    plate TEXT NOT NULL,

    brand TEXT,
    model TEXT,
    model_year INTEGER,

    vehicle_class TEXT,
    capacity INTEGER NOT NULL DEFAULT 1
        CHECK (capacity > 0),

    status TEXT NOT NULL DEFAULT 'available'
        CHECK (status IN (
            'available',
            'busy',
            'maintenance',
            'inactive'
        )),

    active INTEGER NOT NULL DEFAULT 1
        CHECK (active IN (0, 1)),

    notes TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE CASCADE,

    UNIQUE (company_id, plate)
);

CREATE INDEX IF NOT EXISTS idx_vehicles_company
ON vehicles(company_id);

CREATE INDEX IF NOT EXISTS idx_vehicles_status
ON vehicles(company_id, status);


-- =========================================================
-- TRANSFERS
-- booking_service içindeki transfer hizmetinin
-- transfer-specific detayları.
-- =========================================================

CREATE TABLE IF NOT EXISTS transfers (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    booking_service_id TEXT NOT NULL UNIQUE,

    pickup_location TEXT NOT NULL,
    dropoff_location TEXT NOT NULL,

    pickup_datetime TEXT,

    flight_number TEXT,
    flight_datetime TEXT,

    pickup_sign TEXT,

    pax INTEGER NOT NULL DEFAULT 1
        CHECK (pax > 0),

    luggage_count INTEGER NOT NULL DEFAULT 0
        CHECK (luggage_count >= 0),

    requested_vehicle_class TEXT,

    special_request TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE CASCADE,

    FOREIGN KEY (booking_service_id)
        REFERENCES booking_services(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_transfers_company
ON transfers(company_id);

CREATE INDEX IF NOT EXISTS idx_transfers_pickup_datetime
ON transfers(company_id, pickup_datetime);


-- =========================================================
-- TOUR PRODUCTS
-- Satılan turun tanımı.
-- Örn: Kapadokya Turu
-- =========================================================

CREATE TABLE IF NOT EXISTS tour_products (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,

    code TEXT,
    name TEXT NOT NULL,
    description TEXT,

    duration_minutes INTEGER,
    default_capacity INTEGER,

    active INTEGER NOT NULL DEFAULT 1
        CHECK (active IN (0, 1)),

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE CASCADE,

    UNIQUE (company_id, code)
);

CREATE INDEX IF NOT EXISTS idx_tour_products_company
ON tour_products(company_id);


-- =========================================================
-- TOUR DEPARTURES
-- Bir turun belirli tarih/saatteki operasyonu.
-- Kapadokya Turu ürün olabilir,
-- 18 Ağustos 2026 06:30 ise departure'dır.
-- =========================================================

CREATE TABLE IF NOT EXISTS tour_departures (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    tour_product_id TEXT NOT NULL,

    departure_date TEXT NOT NULL,
    departure_time TEXT,

    capacity INTEGER,
    meeting_point TEXT,

    status TEXT NOT NULL DEFAULT 'scheduled'
        CHECK (status IN (
            'scheduled',
            'ready',
            'in_progress',
            'completed',
            'cancelled'
        )),

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE CASCADE,

    FOREIGN KEY (tour_product_id)
        REFERENCES tour_products(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tour_departures_company
ON tour_departures(company_id);

CREATE INDEX IF NOT EXISTS idx_tour_departures_date
ON tour_departures(company_id, departure_date);


-- =========================================================
-- TOUR BOOKINGS
-- Booking service'i belirli bir tour departure'a bağlar.
-- =========================================================

CREATE TABLE IF NOT EXISTS tour_bookings (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    booking_service_id TEXT NOT NULL UNIQUE,
    tour_departure_id TEXT NOT NULL,

    adult_count INTEGER NOT NULL DEFAULT 0
        CHECK (adult_count >= 0),

    child_count INTEGER NOT NULL DEFAULT 0
        CHECK (child_count >= 0),

    infant_count INTEGER NOT NULL DEFAULT 0
        CHECK (infant_count >= 0),

    pickup_required INTEGER NOT NULL DEFAULT 0
        CHECK (pickup_required IN (0, 1)),

    pickup_location TEXT,

    notes TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE CASCADE,

    FOREIGN KEY (booking_service_id)
        REFERENCES booking_services(id)
        ON DELETE CASCADE,

    FOREIGN KEY (tour_departure_id)
        REFERENCES tour_departures(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tour_bookings_company
ON tour_bookings(company_id);

CREATE INDEX IF NOT EXISTS idx_tour_bookings_departure
ON tour_bookings(company_id, tour_departure_id);


-- =========================================================
-- OPERATIONS
-- Sahada yapılacak gerçek operasyon kaydı.
--
-- source_type:
-- transfer       -> transfer operasyonu
-- tour_departure -> tur operasyonu
-- other          -> gelecekte genişletilebilir
-- =========================================================

CREATE TABLE IF NOT EXISTS operations (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,

    source_type TEXT NOT NULL
        CHECK (source_type IN (
            'transfer',
            'tour_departure',
            'other'
        )),

    source_id TEXT,

    status TEXT NOT NULL DEFAULT 'not_planned'
        CHECK (status IN (
            'not_planned',
            'waiting_assignment',
            'assigned',
            'ready',
            'in_progress',
            'completed',
            'problem',
            'cancelled'
        )),

    scheduled_start_at TEXT,
    scheduled_end_at TEXT,

    actual_start_at TEXT,
    actual_end_at TEXT,

    priority INTEGER NOT NULL DEFAULT 100,

    operation_note TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_operations_company
ON operations(company_id);

CREATE INDEX IF NOT EXISTS idx_operations_status
ON operations(company_id, status);

CREATE INDEX IF NOT EXISTS idx_operations_schedule
ON operations(company_id, scheduled_start_at);

CREATE INDEX IF NOT EXISTS idx_operations_source
ON operations(company_id, source_type, source_id);


-- =========================================================
-- OPERATION ASSIGNMENTS
-- Driver ve Vehicle belirli operasyona burada bağlanır.
--
-- Driver -> Vehicle kalıcı ilişki YOK.
-- İlişki görev bazlıdır.
-- =========================================================

CREATE TABLE IF NOT EXISTS operation_assignments (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    operation_id TEXT NOT NULL,

    driver_id TEXT,
    vehicle_id TEXT,

    status TEXT NOT NULL DEFAULT 'assigned'
        CHECK (status IN (
            'assigned',
            'accepted',
            'rejected',
            'started',
            'completed',
            'cancelled'
        )),

    assigned_by TEXT,

    assigned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    accepted_at TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE CASCADE,

    FOREIGN KEY (operation_id)
        REFERENCES operations(id)
        ON DELETE CASCADE,

    FOREIGN KEY (driver_id)
        REFERENCES drivers(id)
        ON DELETE SET NULL,

    FOREIGN KEY (vehicle_id)
        REFERENCES vehicles(id)
        ON DELETE SET NULL,

    FOREIGN KEY (assigned_by)
        REFERENCES company_users(id)
        ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_operation_assignments_operation
ON operation_assignments(company_id, operation_id);

CREATE INDEX IF NOT EXISTS idx_operation_assignments_driver
ON operation_assignments(company_id, driver_id);

CREATE INDEX IF NOT EXISTS idx_operation_assignments_vehicle
ON operation_assignments(company_id, vehicle_id);


-- =========================================================
-- OPERATION EVENTS
-- Operasyon geçmişi / timeline / audit trail.
-- =========================================================

CREATE TABLE IF NOT EXISTS operation_events (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    operation_id TEXT NOT NULL,

    event_type TEXT NOT NULL,

    old_status TEXT,
    new_status TEXT,

    description TEXT,

    actor_user_id TEXT,
    driver_id TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE CASCADE,

    FOREIGN KEY (operation_id)
        REFERENCES operations(id)
        ON DELETE CASCADE,

    FOREIGN KEY (actor_user_id)
        REFERENCES company_users(id)
        ON DELETE SET NULL,

    FOREIGN KEY (driver_id)
        REFERENCES drivers(id)
        ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_operation_events_operation
ON operation_events(company_id, operation_id, created_at);
