-- =========================================================
-- AXIOM DATABASE
-- Migration: 001_core
-- Core SaaS + Booking Architecture
-- =========================================================


-- =========================================================
-- COMPANIES
-- Axiom kullanan her acente bir company/tenant'tır.
-- =========================================================

CREATE TABLE IF NOT EXISTS companies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,

    legal_name TEXT,
    tax_number TEXT,
    country_code TEXT NOT NULL DEFAULT 'TR',
    timezone TEXT NOT NULL DEFAULT 'Europe/Istanbul',
    default_currency TEXT NOT NULL DEFAULT 'TRY',

    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN (
            'trial',
            'active',
            'suspended',
            'cancelled'
        )),

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- =========================================================
-- COMPANY USERS
-- Acente paneline giriş yapan kullanıcılar.
-- =========================================================

CREATE TABLE IF NOT EXISTS company_users (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,

    email TEXT NOT NULL,
    password_hash TEXT NOT NULL,

    first_name TEXT,
    last_name TEXT,

    role TEXT NOT NULL DEFAULT 'operator'
        CHECK (role IN (
            'owner',
            'admin',
            'operator',
            'dispatcher',
            'finance',
            'tour_manager',
            'viewer'
        )),

    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN (
            'invited',
            'active',
            'disabled'
        )),

    last_login_at TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE CASCADE,

    UNIQUE (company_id, email)
);


CREATE INDEX IF NOT EXISTS idx_company_users_company
ON company_users(company_id);


-- =========================================================
-- CUSTOMERS
-- Acente müşterileri.
-- =========================================================

CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,

    first_name TEXT NOT NULL,
    last_name TEXT,

    email TEXT,
    phone TEXT,

    nationality TEXT,
    language TEXT,

    notes TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE CASCADE
);


CREATE INDEX IF NOT EXISTS idx_customers_company
ON customers(company_id);

CREATE INDEX IF NOT EXISTS idx_customers_phone
ON customers(company_id, phone);

CREATE INDEX IF NOT EXISTS idx_customers_email
ON customers(company_id, email);


-- =========================================================
-- BOOKINGS
-- Sistemin merkezi rezervasyon kaydı.
-- Bir booking birden fazla hizmet barındırabilir.
-- =========================================================

CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    customer_id TEXT,

    booking_code TEXT NOT NULL,

    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN (
            'draft',
            'pending',
            'confirmed',
            'cancelled',
            'completed'
        )),

    source TEXT NOT NULL DEFAULT 'manual'
        CHECK (source IN (
            'manual',
            'website',
            'booking_widget',
            'api',
            'integration',
            'b2b',
            'phone',
            'whatsapp',
            'hotel',
            'other'
        )),

    source_provider TEXT,
    external_reference TEXT,

    currency TEXT NOT NULL DEFAULT 'TRY',

    subtotal_amount NUMERIC NOT NULL DEFAULT 0,
    discount_amount NUMERIC NOT NULL DEFAULT 0,
    tax_amount NUMERIC NOT NULL DEFAULT 0,
    total_amount NUMERIC NOT NULL DEFAULT 0,

    customer_note TEXT,
    internal_note TEXT,

    booked_at TEXT,
    confirmed_at TEXT,
    cancelled_at TEXT,

    created_by TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE CASCADE,

    FOREIGN KEY (customer_id)
        REFERENCES customers(id)
        ON DELETE SET NULL,

    FOREIGN KEY (created_by)
        REFERENCES company_users(id)
        ON DELETE SET NULL,

    UNIQUE (company_id, booking_code)
);


CREATE INDEX IF NOT EXISTS idx_bookings_company
ON bookings(company_id);

CREATE INDEX IF NOT EXISTS idx_bookings_customer
ON bookings(company_id, customer_id);

CREATE INDEX IF NOT EXISTS idx_bookings_status
ON bookings(company_id, status);

CREATE INDEX IF NOT EXISTS idx_bookings_source
ON bookings(company_id, source);

CREATE INDEX IF NOT EXISTS idx_bookings_external_reference
ON bookings(company_id, external_reference);


-- =========================================================
-- BOOKING SERVICES
--
-- Booking:
-- AX-000001
--   ├── service: TOUR
--   └── service: TRANSFER
--
-- Böylece tek rezervasyonda birden fazla hizmet bulunabilir.
-- =========================================================

CREATE TABLE IF NOT EXISTS booking_services (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    booking_id TEXT NOT NULL,

    service_type TEXT NOT NULL
        CHECK (service_type IN (
            'transfer',
            'tour',
            'other'
        )),

    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN (
            'pending',
            'confirmed',
            'cancelled',
            'completed'
        )),

    title TEXT NOT NULL,
    description TEXT,

    service_date TEXT,
    start_time TEXT,

    pax_adult INTEGER NOT NULL DEFAULT 0
        CHECK (pax_adult >= 0),

    pax_child INTEGER NOT NULL DEFAULT 0
        CHECK (pax_child >= 0),

    pax_infant INTEGER NOT NULL DEFAULT 0
        CHECK (pax_infant >= 0),

    quantity INTEGER NOT NULL DEFAULT 1
        CHECK (quantity > 0),

    unit_price NUMERIC NOT NULL DEFAULT 0,
    total_price NUMERIC NOT NULL DEFAULT 0,

    metadata_json TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE CASCADE,

    FOREIGN KEY (booking_id)
        REFERENCES bookings(id)
        ON DELETE CASCADE
);


CREATE INDEX IF NOT EXISTS idx_booking_services_company
ON booking_services(company_id);

CREATE INDEX IF NOT EXISTS idx_booking_services_booking
ON booking_services(company_id, booking_id);

CREATE INDEX IF NOT EXISTS idx_booking_services_type
ON booking_services(company_id, service_type);

CREATE INDEX IF NOT EXISTS idx_booking_services_date
ON booking_services(company_id, service_date);


-- =========================================================
-- BOOKING EVENTS
-- Rezervasyon üzerinde yapılan işlemlerin geçmişi.
-- =========================================================

CREATE TABLE IF NOT EXISTS booking_events (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    booking_id TEXT NOT NULL,

    event_type TEXT NOT NULL,

    old_value TEXT,
    new_value TEXT,

    description TEXT,

    actor_user_id TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE CASCADE,

    FOREIGN KEY (booking_id)
        REFERENCES bookings(id)
        ON DELETE CASCADE,

    FOREIGN KEY (actor_user_id)
        REFERENCES company_users(id)
        ON DELETE SET NULL
);


CREATE INDEX IF NOT EXISTS idx_booking_events_booking
ON booking_events(company_id, booking_id, created_at);


-- =========================================================
-- AUTH SESSIONS
-- Kullanıcı oturumları.
-- Token'ın kendisini değil hash'ini saklayacağız.
-- =========================================================

CREATE TABLE IF NOT EXISTS auth_sessions (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    user_id TEXT NOT NULL,

    token_hash TEXT NOT NULL UNIQUE,

    ip_address TEXT,
    user_agent TEXT,

    expires_at TEXT NOT NULL,
    revoked_at TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE CASCADE,

    FOREIGN KEY (user_id)
        REFERENCES company_users(id)
        ON DELETE CASCADE
);


CREATE INDEX IF NOT EXISTS idx_auth_sessions_user
ON auth_sessions(company_id, user_id);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_expiry
ON auth_sessions(expires_at);
