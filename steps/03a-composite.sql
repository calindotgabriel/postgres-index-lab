-- 03a · Composite index that matches the query
-- Equality columns first, then the column you ORDER BY (in the same direction).
-- Look for: the Sort is gone, and the scan stops after 20 rows.
-- @setup
-- TODO: one CREATE INDEX on the three columns the query filters and sorts by
-- @query
SELECT id, created_at, total
  FROM orders
 WHERE customer_id = 4242 AND status = 'paid'
 ORDER BY created_at DESC
 LIMIT 20;
