PRAGMA foreign_keys = ON;

ALTER TABLE domain_provider_oauth_states
ADD COLUMN connection_id TEXT
REFERENCES domain_provider_connections(id)
ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS
idx_domain_provider_oauth_states_connection
ON domain_provider_oauth_states(
    company_id,
    connection_id
);
