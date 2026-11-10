-- 03a · Composite index that matches the query
-- Equality columns first, then the column you ORDER BY.
-- Look for: the Sort is gone, and the scan stops after 20 rows.
-- @setup
CREATE INDEX idx_customer_id_status_created_at ON orders(customer_id, status, created_at DESC);
-- @query
SELECT id, created_at, total
  FROM orders
 WHERE customer_id = 4242 AND status = 'paid'
 ORDER BY created_at DESC
 LIMIT 20;
