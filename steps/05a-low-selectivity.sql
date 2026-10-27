-- 05a · Index on a column where 90% of rows match
-- Expect Postgres to ignore your index. Then decide whether that was a mistake.
-- @setup
-- TODO: CREATE INDEX on status
-- @query
SELECT sum(total) FROM orders WHERE status = 'paid';
