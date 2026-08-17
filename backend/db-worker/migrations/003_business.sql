
-- =========================================================
-- AXIOM DATABASE
-- Migration: 003_business
-- Routes / Pricing / Finance / Integrations / Settings / Audit
-- =========================================================


-- =========================================================
-- ROUTES
-- Transfer fiyatlandırma ve operasyon şablonları için.
-- =========================================================

CREATE TABLE IF NOT EXISTS routes (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,

    code TEXT,
    name TEXT NOT NULL,

    origin_name TEXT NOT NULL,
    origin_code TEXT,

    destination_name TEXT NOT NULL,
    destination_code TEXT,

    distance_km NUMERIC,
    estimated_duration_minutes INTEGER,

    active INTEGER NOT NULL DEFAULT 1
        CHECK (active IN (0, 1)),

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE CASCADE,

    UNIQUE (company_id, code)
);

CREATE INDEX IF NOT EXISTS idx_routes_company
ON routes(company_id);

CREATE INDEX IF NOT EXISTS idx_routes_active
ON routes(company_id, active);


-- =========================================================
-- PRICING RULES
-- Transfer / Tour / Route / Vehicle / Custom fiyatlandırma.
-- =========================================================

CREATE TABLE IF NOT EXISTS pricing_rules (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,

    name TEXT NOT NULL,

    rule_type TEXT NOT NULL
        CHECK (rule_type IN (
            'route',
            'vehicle',
            'tour',
            'seasonal',
            'custom'
        )),

    route_id TEXT,
    tour_product_id TEXT,

    vehicle_class TEXT,

    currency TEXT NOT NULL DEFAULT 'TRY',

    base_price NUMERIC NOT NULL DEFAULT 0,

    adult_price NUMERIC,
    child_price NUMERIC,
    infant_price NUMERIC,

    min_pax INTEGER,
    max_pax INTEGER,

    valid_from TEXT,
    valid_until TEXT,

    priority INTEGER NOT NULL DEFAULT 100,

    active INTEGER NOT NULL DEFAULT 1
        CHECK (active IN (0, 1)),

    metadata_json TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE CASCADE,

    FOREIGN KEY (route_id)
        REFERENCES routes(id)
        ON DELETE SET NULL,

    FOREIGN KEY (tour_product_id)
        REFERENCES tour_products(id)
        ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_pricing_rules_company
ON pricing_rules(company_id);

CREATE INDEX IF NOT EXISTS idx_pricing_rules_type
ON pricing_rules(company_id, rule_type);

CREATE INDEX IF NOT EXISTS idx_pricing_rules_priority
ON pricing_rules(company_id, priority);


-- =========================================================
-- PAYMENTS
-- Rezervasyon ödeme kayıtları.
-- =========================================================

CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    booking_id TEXT NOT NULL,

    provider TEXT,
    external_payment_id TEXT,

    payment_method TEXT
        CHECK (payment_method IN (
            'cash',
            'card',
            'bank_transfer',
            'online',
            'virtual_pos',
            'other'
        )),

    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN (
            'pending',
            'authorized',
            'paid',
            'partially_refunded',
            'refunded',
            'failed',
            'cancelled'
        )),

    currency TEXT NOT NULL DEFAULT 'TRY',
    amount NUMERIC NOT NULL DEFAULT 0,

    paid_at TEXT,
    refunded_at TEXT,

    notes TEXT,
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

CREATE INDEX IF NOT EXISTS idx_payments_company
ON payments(company_id);

CREATE INDEX IF NOT EXISTS idx_payments_booking
ON payments(company_id, booking_id);

CREATE INDEX IF NOT EXISTS idx_payments_status
ON payments(company_id, status);


-- =========================================================
-- FINANCE TRANSACTIONS
-- Gelir / gider / komisyon / iade kayıtları.
-- =========================================================

CREATE TABLE IF NOT EXISTS finance_transactions (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,

    booking_id TEXT,
    payment_id TEXT,

    transaction_type TEXT NOT NULL
        CHECK (transaction_type IN (
            'income',
            'expense',
            'commission',
            'refund',
            'adjustment'
        )),

    category TEXT,

    currency TEXT NOT NULL DEFAULT 'TRY',
    amount NUMERIC NOT NULL DEFAULT 0,

    description TEXT,

    transaction_date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    created_by TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE CASCADE,

    FOREIGN KEY (booking_id)
        REFERENCES bookings(id)
        ON DELETE SET NULL,

    FOREIGN KEY (payment_id)
        REFERENCES payments(id)
        ON DELETE SET NULL,

    FOREIGN KEY (created_by)
        REFERENCES company_users(id)
        ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_finance_transactions_company
ON finance_transactions(company_id);

CREATE INDEX IF NOT EXISTS idx_finance_transactions_booking
ON finance_transactions(company_id, booking_id);

CREATE INDEX IF NOT EXISTS idx_finance_transactions_date
ON finance_transactions(company_id, transaction_date);


-- =========================================================
-- COMPANY SETTINGS
-- Acente bazlı çalışma ayarları.
-- =========================================================

CREATE TABLE IF NOT EXISTS company_settings (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL UNIQUE,

    booking_prefix TEXT NOT NULL DEFAULT 'AX',

    auto_confirm_bookings INTEGER NOT NULL DEFAULT 0
        CHECK (auto_confirm_bookings IN (0, 1)),

    auto_create_operations INTEGER NOT NULL DEFAULT 1
        CHECK (auto_create_operations IN (0, 1)),

    require_driver_acceptance INTEGER NOT NULL DEFAULT 0
        CHECK (require_driver_acceptance IN (0, 1)),

    default_language TEXT NOT NULL DEFAULT 'tr',
    default_timezone TEXT NOT NULL DEFAULT 'Europe/Istanbul',
    default_currency TEXT NOT NULL DEFAULT 'TRY',

    notification_email TEXT,
    notification_phone TEXT,

    settings_json TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE CASCADE
);


-- =========================================================
-- INTEGRATIONS
-- Acente web sitesi, dış API, B2B ve sağlayıcı bağlantıları.
-- =========================================================

CREATE TABLE IF NOT EXISTS integrations (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,

    provider TEXT NOT NULL,
    integration_type TEXT NOT NULL
        CHECK (integration_type IN (
            'website',
            'api',
            'b2b',
            'tour_operator',
            'payment',
            'messaging',
            'other'
        )),

    name TEXT NOT NULL,

    status TEXT NOT NULL DEFAULT 'inactive'
        CHECK (status IN (
            'inactive',
            'active',
            'error',
            'disabled'
        )),

    base_url TEXT,
    external_account_id TEXT,

    secret_ref TEXT,

    sync_mode TEXT NOT NULL DEFAULT 'manual'
        CHECK (sync_mode IN (
            'manual',
            'scheduled',
            'webhook',
            'realtime'
        )),

    last_sync_at TEXT,
    last_success_at TEXT,
    last_error_at TEXT,

    settings_json TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_integrations_company
ON integrations(company_id);

CREATE INDEX IF NOT EXISTS idx_integrations_provider
ON integrations(company_id, provider);

CREATE INDEX IF NOT EXISTS idx_integrations_status
ON integrations(company_id, status);


-- =========================================================
-- INTEGRATION EVENTS
-- Dış sistemlerden gelen / giden veri hareketleri.
-- =========================================================

CREATE TABLE IF NOT EXISTS integration_events (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    integration_id TEXT NOT NULL,

    direction TEXT NOT NULL
        CHECK (direction IN (
            'inbound',
            'outbound'
        )),

    event_type TEXT NOT NULL,

    external_reference TEXT,

    status TEXT NOT NULL DEFAULT 'received'
        CHECK (status IN (
            'received',
            'processing',
            'processed',
            'failed',
            'ignored'
        )),

    request_payload TEXT,
    response_payload TEXT,

    error_message TEXT,

    received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at TEXT,

    FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE CASCADE,

    FOREIGN KEY (integration_id)
        REFERENCES integrations(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_integration_events_integration
ON integration_events(company_id, integration_id, received_at);

CREATE INDEX IF NOT EXISTS idx_integration_events_status
ON integration_events(company_id, status);


-- =========================================================
-- NOTIFICATIONS
-- Sistem içi bildirim ve ileride email/sms/whatsapp kuyruğu.
-- =========================================================

CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,

    user_id TEXT,
    driver_id TEXT,

    channel TEXT NOT NULL DEFAULT 'in_app'
        CHECK (channel IN (
            'in_app',
            'email',
            'sms',
            'whatsapp',
            'push'
        )),

    type TEXT NOT NULL,

    title TEXT NOT NULL,
    message TEXT NOT NULL,

    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN (
            'pending',
            'sent',
            'read',
            'failed',
            'cancelled'
        )),

    related_type TEXT,
    related_id TEXT,

    sent_at TEXT,
    read_at TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE CASCADE,

    FOREIGN KEY (user_id)
        REFERENCES company_users(id)
        ON DELETE CASCADE,

    FOREIGN KEY (driver_id)
        REFERENCES drivers(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notifications_user
ON notifications(company_id, user_id, status);

CREATE INDEX IF NOT EXISTS idx_notifications_driver
ON notifications(company_id, driver_id, status);


-- =========================================================
-- AUDIT LOGS
-- Kritik işlemlerin merkezi kayıt alanı.
-- =========================================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,

    actor_type TEXT NOT NULL
        CHECK (actor_type IN (
            'user',
            'driver',
            'system',
            'integration'
        )),

    actor_id TEXT,

    action TEXT NOT NULL,

    entity_type TEXT NOT NULL,
    entity_id TEXT,

    old_data TEXT,
    new_data TEXT,

    ip_address TEXT,
    user_agent TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_company
ON audit_logs(company_id, created_at);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity
ON audit_logs(company_id, entity_type, entity_id);


-- =========================================================
-- WEBHOOK ENDPOINTS
-- Axiom'dan dış sistemlere olay iletimi için.
-- =========================================================

CREATE TABLE IF NOT EXISTS webhook_endpoints (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,

    name TEXT NOT NULL,
    endpoint_url TEXT NOT NULL,

    secret_ref TEXT,

    active INTEGER NOT NULL DEFAULT 1
        CHECK (active IN (0, 1)),

    subscribed_events TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_company
ON webhook_endpoints(company_id, active);


-- =========================================================
-- WEBHOOK DELIVERIES
-- =========================================================

CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    webhook_endpoint_id TEXT NOT NULL,

    event_type TEXT NOT NULL,
    payload TEXT NOT NULL,

    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN (
            'pending',
            'sent',
            'failed',
            'cancelled'
        )),

    attempt_count INTEGER NOT NULL DEFAULT 0,

    last_http_status INTEGER,
    last_error TEXT,

    next_attempt_at TEXT,
    delivered_at TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE CASCADE,

    FOREIGN KEY (webhook_endpoint_id)
        REFERENCES webhook_endpoints(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status
ON webhook_deliveries(company_id, status, next_attempt_at);
