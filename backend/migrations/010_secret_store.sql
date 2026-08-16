PRAGMA foreign_keys = ON;

-- =========================================================
-- AXIOM DATABASE
-- Migration: 009_secret_store
--
-- Encrypted application secret storage.
--
-- Plaintext secret tutulmaz.
-- AES-256-GCM ciphertext + nonce + auth tag saklanır.
-- Master key environment üzerinden gelir.
-- =========================================================

CREATE TABLE IF NOT EXISTS encrypted_secrets (
    id TEXT PRIMARY KEY,

    company_id TEXT NOT NULL,

    secret_type TEXT NOT NULL,

    ciphertext TEXT NOT NULL,
    nonce TEXT NOT NULL,
    auth_tag TEXT NOT NULL,

    key_version INTEGER NOT NULL DEFAULT 1,

    created_at TEXT NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    updated_at TEXT NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS
idx_encrypted_secrets_company
ON encrypted_secrets(
    company_id,
    secret_type
);
