-- 01 · No index
-- The baseline. 20 rows wanted; watch how many the database reads to find them,
-- and the Sort it needs before it can apply the LIMIT.
-- @setup
-- nothing: the runner drops every index except the primary key before each step
-- @query
SELECT id, created_at, total
  FROM orders
 WHERE customer_id = 4242 AND status = 'paid'
 ORDER BY created_at DESC
 LIMIT 20;
