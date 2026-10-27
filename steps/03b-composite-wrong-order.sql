-- 03b · Same columns, wrong order
-- Put created_at first. Before you run it: will Postgres use it, and how?
-- @setup
-- TODO: the 03a index with created_at as the first column
-- @query
SELECT id, created_at, total
  FROM orders
 WHERE customer_id = 4242 AND status = 'paid'
 ORDER BY created_at DESC
 LIMIT 20;
