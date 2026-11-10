-- 03b · Same columns, wrong order
-- Put created_at first. Before you run it: will Postgres use it, and how?
-- @setup
CREATE INDEX idx_created_at_customer_id_status ON orders(created_at DESC, customer_id, status);
-- @query
SELECT id, created_at, total
  FROM orders
 WHERE customer_id = 4242 AND status = 'paid'
 ORDER BY created_at DESC
 LIMIT 20;
