PRAGMA foreign_keys = ON;

-- =========================================================
-- AXIOM DATABASE
-- Migration: 004_platform
--
-- Platform foundations:
-- RBAC
-- Domains
-- Public Booking
-- API Keys
-- Passengers
-- Integration Mapping
-- Driver Access
-- Tour Guides
-- Attachments
-- Idempotency
-- Outbox / Domain Events
-- =========================================================


-- =========================================================
-- ROLES
-- company_users.role mevcut temel rol olarak kalabilir.
-- Bu tablolar özel/yeni roller için genişletilebilir RBAC katmanıdır.
-- =========================================================

CREATE TABLE IF NOT EXISTS roles (
    id TEXT PRIMARY KEY,
    company_id TEXT,

    code TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,

    is_system INTEGER NOT NULL DEFAULT 0
        CHECK (is_system IN (0, 1)),

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_roles_company_code
ON roles(
    COALESCE(company_id, '__system__'),
    code
);


CREATE TABLE IF NOT EXISTS permissions (
    id TEXT PRIMARY KEY,

    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS role_permissions (
    role_id TEXT NOT NULL,
    permission_id TEXT NOT NULL,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (role_id, permission_id),

    FOREIGN KEY (role_id)
        REFERENCES roles(id)
        ON DELETE CASCADE,

    FOREIGN KEY (permission_id)
        REFERENCES permissions(id)
        ON DELETE CASCADE
);


CREATE TABLE IF NOT EXISTS user_roles (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role_id TEXT NOT NULL,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE CASCADE,

    FOREIGN KEY (user_id)
        REFERENCES company_users(id)
        ON DELETE CASCADE,

    FOREIGN KEY (role_id)
        REFERENCES roles(id)
        ON DELETE CASCADE,

    UNIQUE (company_id, user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user
ON user_roles(company_id, user_id);


-- =========================================================
-- COMPANY DOMAINS
--
-- Acente web sitesi Axiom'a bağlandığında:
-- exampletravel.com
-- booking.exampletravel.com
-- =========================================================

CREATE TABLE IF NOT EXISTS company_domains (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,

    domain TEXT NOT NULL UNIQUE,

    domain_type TEXT NOT NULL DEFAULT 'website'
        CHECK (domain_type IN (
            'website',
            'booking',
            'api',
            'custom'
        )),

    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN (
            'pending',
            'verifying',
            'verified',
            'failed',
            'disabled'
        )),

    verification_token TEXT,
    verified_at TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_company_domains_company
ON company_domains(company_id);


-- =========================================================
-- BOOKING PASSENGERS
--
-- Customer rezervasyonu yapan kişi olabilir.
-- Yolcular ayrı tutulmalıdır.
-- =========================================================

CREATE TABLE IF NOT EXISTS booking_passengers (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    booking_id TEXT NOT NULL,

    passenger_type TEXT NOT NULL DEFAULT 'adult'
        CHECK (passenger_type IN (
            'adult',
            'child',
            'infant'
        )),

    first_name TEXT NOT NULL,
    last_name TEXT,

    nationality TEXT,
    birth_date TEXT,

    passport_number TEXT,

    phone TEXT,
    email TEXT,

    is_lead_passenger INTEGER NOT NULL DEFAULT 0
        CHECK (is_lead_passenger IN (0, 1)),

    notes TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE CASCADE,

    FOREIGN KEY (booking_id)
        REFERENCES bookings(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_booking_passengers_booking
ON booking_passengers(company_id, booking_id);


-- =========================================================
-- BOOKING SERVICE RELATIONS
--
-- Örnek:
-- TUR hizmetine bağlı pickup transferi.
-- =========================================================

CREATE TABLE IF NOT EXISTS booking_service_relations (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,

    parent_service_id TEXT NOT NULL,
    child_service_id TEXT NOT NULL,

    relation_type TEXT NOT NULL
        CHECK (relation_type IN (
            'depends_on',
            'pickup_for',
            'dropoff_for',
            'included_with',
            'related'
        )),

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE CASCADE,

    FOREIGN KEY (parent_service_id)
        REFERENCES booking_services(id)
        ON DELETE CASCADE,

    FOREIGN KEY (child_service_id)
        REFERENCES booking_services(id)
        ON DELETE CASCADE,

    UNIQUE (
        company_id,
        parent_service_id,
        child_service_id,
        relation_type
    ),

    CHECK (parent_service_id <> child_service_id)
);


-- =========================================================
-- API KEYS
-- Acentenin kendi sitesi veya dış sistem erişimi.
--
-- API key plaintext tutulmayacak.
-- hash saklanacak.
-- =========================================================

CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,

    name TEXT NOT NULL,

    key_prefix TEXT NOT NULL,
    key_hash TEXT NOT NULL UNIQUE,

    scopes TEXT,

    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN (
            'active',
            'revoked',
            'expired'
        )),

    last_used_at TEXT,
    expires_at TEXT,
    revoked_at TEXT,

    created_by TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE CASCADE,

    FOREIGN KEY (created_by)
        REFERENCES company_users(id)
        ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_api_keys_company
ON api_keys(company_id, status);


-- =========================================================
-- PUBLIC BOOKING KEYS
--
-- Acente sitesine gömülen Axiom booking form/widget erişimi.
-- Secret değil, public identifier mantığı.
-- =========================================================

CREATE TABLE IF NOT EXISTS public_booking_keys (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,

    public_key TEXT NOT NULL UNIQUE,

    name TEXT,

    allowed_domain TEXT,

    active INTEGER NOT NULL DEFAULT 1
        CHECK (active IN (0, 1)),

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at TEXT,

    FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_public_booking_keys_company
ON public_booking_keys(company_id, active);


-- =========================================================
-- PUBLIC BOOKING REQUESTS
--
-- Public endpoint'e ulaşan rezervasyon talepleri.
-- Booking oluşmadan önce validation/audit katmanı.
-- =========================================================

CREATE TABLE IF NOT EXISTS public_booking_requests (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,

    public_booking_key_id TEXT,

    request_id TEXT NOT NULL,

    status TEXT NOT NULL DEFAULT 'received'
        CHECK (status IN (
            'received',
            'validated',
            'rejected',
            'booking_created',
            'failed'
        )),

    payload TEXT NOT NULL,

    booking_id TEXT,

    rejection_reason TEXT,
    error_message TEXT,

    ip_address TEXT,
    user_agent TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at TEXT,

    FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE CASCADE,

    FOREIGN KEY (public_booking_key_id)
        REFERENCES public_booking_keys(id)
        ON DELETE SET NULL,

    FOREIGN KEY (booking_id)
        REFERENCES bookings(id)
        ON DELETE SET NULL,

    UNIQUE (company_id, request_id)
);


-- =========================================================
-- IDEMPOTENCY KEYS
--
-- Aynı rezervasyon isteğinin iki kere işlenmesini engeller.
-- Özellikle API, webhook ve ödeme işlemleri için.
-- =========================================================

CREATE TABLE IF NOT EXISTS idempotency_keys (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,

    idempotency_key TEXT NOT NULL,

    operation TEXT NOT NULL,

    request_hash TEXT,

    response_status INTEGER,
    response_body TEXT,

    resource_type TEXT,
    resource_id TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TEXT,

    FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE CASCADE,

    UNIQUE (
        company_id,
        idempotency_key,
        operation
    )
);

CREATE INDEX IF NOT EXISTS idx_idempotency_expiry
ON idempotency_keys(expires_at);


-- =========================================================
-- INTEGRATION ENTITY MAPPINGS
--
-- External sistem ID <-> Axiom ID
--
-- Örn:
-- Pegas Reservation 348821
-- ↔
-- Axiom Booking bkg_xxx
-- =========================================================

CREATE TABLE IF NOT EXISTS integration_entity_mappings (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    integration_id TEXT NOT NULL,

    entity_type TEXT NOT NULL,

    local_entity_id TEXT NOT NULL,
    external_entity_id TEXT NOT NULL,

    external_reference TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE CASCADE,

    FOREIGN KEY (integration_id)
        REFERENCES integrations(id)
        ON DELETE CASCADE,

    UNIQUE (
        company_id,
        integration_id,
        entity_type,
        external_entity_id
    )
);

CREATE INDEX IF NOT EXISTS idx_integration_mapping_local
ON integration_entity_mappings(
    company_id,
    entity_type,
    local_entity_id
);


-- =========================================================
-- EXTERNAL BOOKINGS
--
-- Dış sağlayıcıdan gelen ham rezervasyon kaydı.
-- Önce burada tutulabilir,
-- sonra normalize edilip bookings tablosuna aktarılır.
-- =========================================================

CREATE TABLE IF NOT EXISTS external_bookings (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    integration_id TEXT NOT NULL,

    external_booking_id TEXT NOT NULL,

    status TEXT NOT NULL DEFAULT 'received'
        CHECK (status IN (
            'received',
            'validated',
            'imported',
            'updated',
            'ignored',
            'failed'
        )),

    raw_payload TEXT NOT NULL,

    booking_id TEXT,

    received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    imported_at TEXT,

    error_message TEXT,

    FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE CASCADE,

    FOREIGN KEY (integration_id)
        REFERENCES integrations(id)
        ON DELETE CASCADE,

    FOREIGN KEY (booking_id)
        REFERENCES bookings(id)
        ON DELETE SET NULL,

    UNIQUE (
        company_id,
        integration_id,
        external_booking_id
    )
);


-- =========================================================
-- DRIVER ACCOUNTS
--
-- Şoför paneli kimlik doğrulaması.
-- Driver kaydı ile login hesabını ayırıyoruz.
-- =========================================================

CREATE TABLE IF NOT EXISTS driver_accounts (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    driver_id TEXT NOT NULL UNIQUE,

    login_identifier TEXT NOT NULL,

    password_hash TEXT,

    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN (
            'pending',
            'active',
            'disabled'
        )),

    last_login_at TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE CASCADE,

    FOREIGN KEY (driver_id)
        REFERENCES drivers(id)
        ON DELETE CASCADE,

    UNIQUE (company_id, login_identifier)
);


CREATE TABLE IF NOT EXISTS driver_sessions (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    driver_account_id TEXT NOT NULL,

    token_hash TEXT NOT NULL UNIQUE,

    ip_address TEXT,
    user_agent TEXT,

    expires_at TEXT NOT NULL,
    revoked_at TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE CASCADE,

    FOREIGN KEY (driver_account_id)
        REFERENCES driver_accounts(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_driver_sessions_account
ON driver_sessions(company_id, driver_account_id);


-- =========================================================
-- TOUR GUIDES
-- =========================================================

CREATE TABLE IF NOT EXISTS guides (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,

    first_name TEXT NOT NULL,
    last_name TEXT,

    phone TEXT,
    email TEXT,

    languages TEXT,

    license_number TEXT,

    status TEXT NOT NULL DEFAULT 'available'
        CHECK (status IN (
            'available',
            'busy',
            'off_duty',
            'inactive'
        )),

    active INTEGER NOT NULL DEFAULT 1
        CHECK (active IN (0, 1)),

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_guides_company
ON guides(company_id, status);


CREATE TABLE IF NOT EXISTS operation_guide_assignments (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,

    operation_id TEXT NOT NULL,
    guide_id TEXT NOT NULL,

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

    FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE CASCADE,

    FOREIGN KEY (operation_id)
        REFERENCES operations(id)
        ON DELETE CASCADE,

    FOREIGN KEY (guide_id)
        REFERENCES guides(id)
        ON DELETE CASCADE,

    FOREIGN KEY (assigned_by)
        REFERENCES company_users(id)
        ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_operation_guides_operation
ON operation_guide_assignments(company_id, operation_id);


-- =========================================================
-- ATTACHMENTS
--
-- Voucher, fatura, sözleşme, manifest vb.
-- Dosyanın kendisi DB'de tutulmayacak.
-- Storage reference tutulacak.
-- =========================================================

CREATE TABLE IF NOT EXISTS attachments (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,

    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,

    file_name TEXT NOT NULL,
    mime_type TEXT,

    storage_provider TEXT,
    storage_key TEXT NOT NULL,

    size_bytes INTEGER,

    uploaded_by TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE CASCADE,

    FOREIGN KEY (uploaded_by)
        REFERENCES company_users(id)
        ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_attachments_entity
ON attachments(company_id, entity_type, entity_id);


-- =========================================================
-- OUTBOX EVENTS
--
-- Booking oluşturuldu,
-- driver atandı,
-- operation tamamlandı vb.
--
-- Transaction tamamlandıktan sonra entegrasyon /
-- webhook / notification worker'ları buradan okuyabilir.
-- =========================================================

CREATE TABLE IF NOT EXISTS outbox_events (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,

    event_type TEXT NOT NULL,

    aggregate_type TEXT NOT NULL,
    aggregate_id TEXT NOT NULL,

    payload TEXT NOT NULL,

    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN (
            'pending',
            'processing',
            'processed',
            'failed'
        )),

    attempt_count INTEGER NOT NULL DEFAULT 0,

    available_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at TEXT,

    last_error TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_outbox_pending
ON outbox_events(
    status,
    available_at
);
