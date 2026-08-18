-- ============================================================
-- AXIOM D1 Migration 012
-- Driver / Transfer Navigation Enrichment
-- ============================================================

ALTER TABLE transfers ADD COLUMN pickup_latitude REAL;
ALTER TABLE transfers ADD COLUMN pickup_longitude REAL;
ALTER TABLE transfers ADD COLUMN pickup_place_id TEXT;

ALTER TABLE transfers ADD COLUMN dropoff_latitude REAL;
ALTER TABLE transfers ADD COLUMN dropoff_longitude REAL;
ALTER TABLE transfers ADD COLUMN dropoff_place_id TEXT;
