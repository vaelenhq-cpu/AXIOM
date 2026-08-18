-- =========================================================
-- AXIOM DATABASE
-- Migration: 008_domain_provider_connections
--
-- Domain / DNS provider automation foundation.
--
-- Örnek:
-- Company -> Cloudflare account
-- Domain  -> Cloudflare zone
--
-- Provider secret plaintext olarak tutulmaz.
-- secret_ref harici secret storage kaydını temsil eder.
-- =========================================================


CREATE TABLE IF NOT EXISTS domain_provider_connections (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,

    provider TEXT NOT NULL
        CHECK (
            provider IN (
                'cloudflare',
                'manual',
                'other'
            )
        ),

    name TEXT NOT NULL,

    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (
            status IN (
                'pending',
                'connected',
                'error',
                'disabled'
            )
        ),

    external_account_id TEXT,

    secret_ref TEXT,

    settings_json TEXT,

    connected_at TEXT,
    last_check_at TEXT,
    last_error TEXT,

    created_at TEXT NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    updated_at TEXT NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE CASCADE
);


CREATE INDEX IF NOT EXISTS
idx_domain_provider_connections_company
ON domain_provider_connections(
    company_id,
    provider,
    status
);


CREATE TABLE IF NOT EXISTS domain_provider_zones (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,

    domain_id TEXT NOT NULL,
    connection_id TEXT NOT NULL,

    external_zone_id TEXT,

    zone_name TEXT NOT NULL,

    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (
            status IN (
                'pending',
                'discovered',
                'configuring',
                'active',
                'error',
                'disabled'
            )
        ),

    nameservers_json TEXT,

    last_sync_at TEXT,
    last_error TEXT,

    created_at TEXT NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    updated_at TEXT NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE CASCADE,

    FOREIGN KEY (domain_id)
        REFERENCES company_domains(id)
        ON DELETE CASCADE,

    FOREIGN KEY (connection_id)
        REFERENCES domain_provider_connections(id)
        ON DELETE CASCADE,

    UNIQUE (
        company_id,
        domain_id,
        connection_id
    )
);


CREATE INDEX IF NOT EXISTS
idx_domain_provider_zones_domain
ON domain_provider_zones(
    company_id,
    domain_id,
    status
);


-- ---------------------------------------------------------
-- Tenant guards
-- ---------------------------------------------------------

CREATE TRIGGER IF NOT EXISTS
trg_domain_provider_zone_domain_tenant_insert
BEFORE INSERT ON domain_provider_zones
WHEN NOT EXISTS (
    SELECT 1
    FROM company_domains
    WHERE id = NEW.domain_id
      AND company_id = NEW.company_id
)
BEGIN
    SELECT RAISE(
        ABORT,
        'TENANT_MISMATCH: domain provider zone domain'
    );
END;


CREATE TRIGGER IF NOT EXISTS
trg_domain_provider_zone_connection_tenant_insert
BEFORE INSERT ON domain_provider_zones
WHEN NOT EXISTS (
    SELECT 1
    FROM domain_provider_connections
    WHERE id = NEW.connection_id
      AND company_id = NEW.company_id
)
BEGIN
    SELECT RAISE(
        ABORT,
        'TENANT_MISMATCH: domain provider zone connection'
    );
END;


CREATE TRIGGER IF NOT EXISTS
trg_domain_provider_zone_domain_tenant_update
BEFORE UPDATE OF
    company_id,
    domain_id
ON domain_provider_zones
WHEN NOT EXISTS (
    SELECT 1
    FROM company_domains
    WHERE id = NEW.domain_id
      AND company_id = NEW.company_id
)
BEGIN
    SELECT RAISE(
        ABORT,
        'TENANT_MISMATCH: domain provider zone domain'
    );
END;


CREATE TRIGGER IF NOT EXISTS
trg_domain_provider_zone_connection_tenant_update
BEFORE UPDATE OF
    company_id,
    connection_id
ON domain_provider_zones
WHEN NOT EXISTS (
    SELECT 1
    FROM domain_provider_connections
    WHERE id = NEW.connection_id
      AND company_id = NEW.company_id
)
BEGIN
    SELECT RAISE(
        ABORT,
        'TENANT_MISMATCH: domain provider zone connection'
    );
END;
