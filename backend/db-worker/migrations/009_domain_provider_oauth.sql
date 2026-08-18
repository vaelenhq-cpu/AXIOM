-- =========================================================
-- AXIOM DATABASE
-- Migration: 009_domain_provider_oauth
--
-- Third-party DNS provider OAuth foundation.
-- OAuth secrets/tokens plaintext tutulmaz.
-- =========================================================

ALTER TABLE domain_provider_connections
ADD COLUMN auth_type TEXT
NOT NULL DEFAULT 'oauth'
CHECK (
    auth_type IN (
        'oauth',
        'api_token',
        'manual'
    )
);

ALTER TABLE domain_provider_connections
ADD COLUMN provider_user_id TEXT;

ALTER TABLE domain_provider_connections
ADD COLUMN token_expires_at TEXT;

ALTER TABLE domain_provider_connections
ADD COLUMN refresh_secret_ref TEXT;


CREATE TABLE IF NOT EXISTS domain_provider_oauth_states (
    id TEXT PRIMARY KEY,

    company_id TEXT NOT NULL,

    provider TEXT NOT NULL
        CHECK (
            provider IN (
                'cloudflare',
                'other'
            )
        ),

    state_hash TEXT NOT NULL UNIQUE,

    redirect_path TEXT,

    expires_at TEXT NOT NULL,

    consumed_at TEXT,

    created_at TEXT NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE CASCADE
);


CREATE INDEX IF NOT EXISTS
idx_domain_provider_oauth_states_company
ON domain_provider_oauth_states(
    company_id,
    provider,
    expires_at
);


CREATE INDEX IF NOT EXISTS
idx_domain_provider_connections_auth
ON domain_provider_connections(
    company_id,
    provider,
    auth_type,
    status
);
