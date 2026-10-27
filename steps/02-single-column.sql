-- 02 · Index on customer_id only
-- The obvious first index. It finds the customer's rows fast.
-- Question to answer from the plan: why is there still a Sort?
-- @setup
-- TODO: one CREATE INDEX on customer_id
-- @query
SELECT id, created_at, total
  FROM orders
 WHERE customer_id = 4242 AND status = 'paid'
 ORDER BY created_at DESC
 LIMIT 20;
