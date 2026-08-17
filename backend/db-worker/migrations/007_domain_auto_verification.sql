
-- =========================================================
-- AXIOM DATABASE
-- Migration: 007_domain_auto_verification
--
-- Otomatik domain doğrulama altyapısı.
-- =========================================================

ALTER TABLE company_domains
ADD COLUMN verification_method TEXT
NOT NULL DEFAULT 'http'
CHECK (
    verification_method IN (
        'http',
        'dns'
    )
);

ALTER TABLE company_domains
ADD COLUMN verification_attempts INTEGER
NOT NULL DEFAULT 0;

ALTER TABLE company_domains
ADD COLUMN last_check_at TEXT;

ALTER TABLE company_domains
ADD COLUMN next_check_at TEXT;

ALTER TABLE company_domains
ADD COLUMN last_error TEXT;


CREATE INDEX IF NOT EXISTS
idx_company_domains_verification_queue
ON company_domains(
    status,
    next_check_at
);
