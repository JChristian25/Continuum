-- Prepared only. Applying to an existing database requires separate authorization.
-- Use the operator's configured schema/search_path. No rows are rewritten.
BEGIN;
ALTER TABLE review_events ALTER COLUMN reason DROP NOT NULL;
COMMIT;
