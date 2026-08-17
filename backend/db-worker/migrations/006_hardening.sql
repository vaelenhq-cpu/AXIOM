
-- =========================================================
-- AXIOM DATABASE
-- Migration: 006_hardening
-- Final V1 integrity/index hardening
-- =========================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_operations_unique_source
ON operations(
    company_id,
    source_type,
    source_id
)
WHERE source_id IS NOT NULL;


CREATE UNIQUE INDEX IF NOT EXISTS idx_active_assignment_per_operation
ON operation_assignments(
    company_id,
    operation_id
)
WHERE status IN (
    'assigned',
    'accepted',
    'started'
);


CREATE UNIQUE INDEX IF NOT EXISTS idx_booking_external_identity
ON bookings(
    company_id,
    source_provider,
    external_reference
)
WHERE source_provider IS NOT NULL
  AND external_reference IS NOT NULL;


CREATE INDEX IF NOT EXISTS idx_public_booking_requests_company_status
ON public_booking_requests(
    company_id,
    status,
    created_at
);


CREATE INDEX IF NOT EXISTS idx_external_bookings_status
ON external_bookings(
    company_id,
    integration_id,
    status,
    received_at
);


CREATE INDEX IF NOT EXISTS idx_driver_sessions_expiry
ON driver_sessions(
    expires_at
);


CREATE INDEX IF NOT EXISTS idx_outbox_status_available
ON outbox_events(
    status,
    available_at,
    created_at
);


CREATE INDEX IF NOT EXISTS idx_webhook_delivery_retry
ON webhook_deliveries(
    status,
    next_attempt_at,
    attempt_count
);
